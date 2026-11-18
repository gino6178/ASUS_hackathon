#!/usr/bin/env bash
# ShuttleCoach on the Intel Arc Pro B70 cloud instance (Intel Cloud Services, 2x B70, reached through JupyterLab).
#   server/b70.sh setup    one time: Node.js, Chrome, npm installs, web build for the Jupyter proxy path
#   server/b70.sh start    vLLM (LLM on GPU 0 :8000, embeddings on GPU 1 :8001), agent gateway (:8787), web app (:5190)
#   server/b70.sh stop | status | logs
# Users open https://<jupyter host>/<JUPYTER_BASE>/proxy/5190/ ; the page calls the gateway at
# <JUPYTER_BASE>/proxy/8787 on the same origin. Secrets (TELEGRAM_BOT_TOKEN) go in agent/.env.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JUPYTER_BASE="${JUPYTER_BASE:-/10}"          # the path JupyterLab is served under (…eglb.intel.com/10/lab)
NODE_VER="${NODE_VER:-v22.20.0}"
IMAGE="${VLLM_IMAGE:-vllm/vllm-openai-xpu:v0.26.0}"
# Qwen3-8B as INT4 (AWQ) weights with an FP8 KV cache: the fastest option measured on the B70
# (docs/inference_opt_b70.md). For the original bf16 model: LLM_HF=Qwen/Qwen3-8B LLM_DTYPE=bfloat16 LLM_KV=auto
LLM_HF="${LLM_HF:-Qwen/Qwen3-8B-AWQ}"; LLM_NAME="${LLM_NAME:-qwen3-8b}"
LLM_DTYPE="${LLM_DTYPE:-float16}"; LLM_KV="${LLM_KV:-fp8}"
EMB_HF="${EMB_HF:-Qwen/Qwen3-Embedding-0.6B}"; EMB_NAME="${EMB_NAME:-qwen3-embedding}"
NODE="$ROOT/node/bin/node"; export PATH="$ROOT/node/bin:$PATH"

vllm() { # name gpu port model served-name extra-args...
  # launched the way Intel's demo notebooks do it: privileged, host network, oneAPI sourced before the server
  local name=$1 gpu=$2 port=$3 model=$4 served=$5; shift 5
  if docker ps --format '{{.Names}}' | grep -qx "$name"; then echo "$name already running"; return; fi
  docker rm -f "$name" >/dev/null 2>&1
  local args; args=$(printf ' %q' --model "$model" --served-model-name "$served" --host 127.0.0.1 --port "$port" \
    --enforce-eager --block-size 64 "$@")
  docker run -d --name "$name" --restart unless-stopped --net=host --ipc=host --shm-size=16g --privileged \
    --device /dev/dri:/dev/dri -v /dev/dri/by-path:/dev/dri/by-path \
    -e ZE_AFFINITY_MASK="$gpu" -e VLLM_WORKER_MULTIPROC_METHOD=spawn \
    -v "$HOME/.cache/huggingface:/root/.cache/huggingface" --entrypoint bash "$IMAGE" -c \
    "source /opt/intel/oneapi/setvars.sh --force >/dev/null 2>&1 || source /root/.bashrc 2>/dev/null; exec python -m vllm.entrypoints.openai.api_server$args" >/dev/null
  echo "$name starting on :$port (GPU $gpu, $model), logs: docker logs -f $name"
}

setup() {
  if [ ! -x "$NODE" ]; then
    curl -fsSL "https://nodejs.org/dist/$NODE_VER/node-$NODE_VER-linux-x64.tar.xz" | tar -xJ -C "$ROOT" && mv "$ROOT/node-$NODE_VER-linux-x64" "$ROOT/node"
  fi
  echo "node $("$NODE" --version)"
  if [ ! -x /usr/bin/google-chrome ]; then # the booking agent drives a headless Chrome (puppeteer-core)
    curl -fsSLo /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && sudo apt-get install -y /tmp/chrome.deb && rm -f /tmp/chrome.deb
  fi
  (cd "$ROOT/agent" && npm install --no-audit --no-fund)
  [ -f "$ROOT/agent/.env" ] || printf 'TELEGRAM_BOT_TOKEN=\n' > "$ROOT/agent/.env"
  # onnxruntime-node (pulled in by transformers.js) would fetch CUDA binaries; Whisper runs in the browser anyway
  (cd "$ROOT/web" && npm install --no-audit --no-fund --onnxruntime-node-install-cuda=skip &&VITE_AGENT_URL="$JUPYTER_BASE/proxy/8787" npx vite build --base "$JUPYTER_BASE/proxy/5190/")
}

start() {
  mkdir -p "$HOME/.cache/huggingface"
  vllm sc-llm 0 8000 "$LLM_HF" "$LLM_NAME" --dtype "$LLM_DTYPE" --kv-cache-dtype "$LLM_KV" --max-model-len 16384 --gpu-memory-utilization 0.85 \
    --default-chat-template-kwargs '{"enable_thinking": false}' --scheduling-policy priority
  vllm sc-embed 1 8001 "$EMB_HF" "$EMB_NAME" --runner pooling --convert embed --gpu-memory-utilization 0.3
  if ! pgrep -u "$USER" -f "[s]rc/server.js" >/dev/null; then
    # LLM_PRIORITY=1: live questions before background work; BG_CONCURRENCY: proactive jobs in flight
    (cd "$ROOT/agent" && LLM_URL=http://127.0.0.1:8000/v1 LLM_MODEL="$LLM_NAME" LLM_DEVICE="Intel Arc Pro B70 (vLLM)" \
      LLM_PRIORITY=1 BG_CONCURRENCY="${BG_CONCURRENCY:-16}" \
      EMBED_URL=http://127.0.0.1:8001/v1 EMBED_MODEL="$EMB_NAME" CHROME_PATH=/usr/bin/google-chrome \
      setsid nohup "$NODE" --env-file-if-exists=.env src/server.js > gateway.log 2>&1 < /dev/null &)
    echo "gateway starting on :8787, log: $ROOT/agent/gateway.log"
  else echo "gateway already running"; fi
  # the web app is served from here too, so users only need a browser (WEB=0 to run the backend alone)
  if [ "${WEB:-1}" = "1" ]; then
    if ! pgrep -u "$USER" -f "[s]erver/static.mjs" >/dev/null; then
      (cd "$ROOT" && setsid nohup "$NODE" server/static.mjs web/dist 5190 > web.log 2>&1 < /dev/null &)
      echo "web app on :5190, log: $ROOT/web.log"
    else echo "web app already running"; fi
    echo "open: https://<jupyter host>$JUPYTER_BASE/proxy/5190/"
  fi
}

stop() {
  pkill -u "$USER" -f "[s]rc/server.js"; pkill -u "$USER" -f "[s]erver/static.mjs"
  [ "${1:-}" = "all" ] && docker rm -f sc-llm sc-embed
  echo "stopped (models keep running unless: $0 stop all)"
}

status() {
  docker ps --filter name=sc- --format '{{.Names}}  {{.Status}}'
  for p in 8000 8001; do printf ':%s ' $p; curl -s -m 3 "127.0.0.1:$p/v1/models" | grep -o '"id":"[^"]*"' | head -1 || echo down; done
  printf ':8787 '; curl -s -m 3 127.0.0.1:8787/api/status | head -c 300; echo
  printf ':5190 '; curl -s -o /dev/null -m 3 -w '%{http_code}\n' 127.0.0.1:5190/
}

case "${1:-start}" in
  setup) setup ;; start) start ;; stop) stop "${2:-}" ;; status) status ;;
  logs) tail -n 40 "$ROOT/agent/gateway.log"; docker logs --tail 20 sc-llm; docker logs --tail 20 sc-embed ;;
  *) echo "usage: $0 setup|start|stop [all]|status|logs"; exit 1 ;;
esac
