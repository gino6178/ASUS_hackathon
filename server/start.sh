#!/usr/bin/env bash
# Start ShuttleCoach's server side: the LLM backend and the agent gateway with the Telegram bot (port 8787).
# Safe to run again: services already running are left alone.
#   ~/shuttlecoach/start.sh                    Ollama on an NVIDIA card (RTX 3090 here), qwen3:4b-instruct
#   BACKEND=openvino ~/shuttlecoach/start.sh   OpenVINO GenAI llm-server (the ASUS UGen Arc Pro B70; DEVICE=GPU there)
#   ~/shuttlecoach/start.sh stop               stop everything
set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="${BACKEND:-ollama}"
DEVICE="${DEVICE:-CPU}"

stop() {
  pkill -u "$USER" -f "[b]in/ollama serve"; pkill -u "$USER" -f "[l]ib/ollama/llama-server"
  pkill -u "$USER" -f "[u]vicorn server:app --host 0.0.0.0 --port 8000"
  pkill -u "$USER" -f "[n]ode/bin/node src/server.js"
  echo "stopped"
}
[ "${1:-}" = "stop" ] && { stop; exit 0; }

if [ "$BACKEND" = "ollama" ]; then
  if ! pgrep -u "$USER" -f "[b]in/ollama serve" >/dev/null; then
    # one card, CUDA only (no Vulkan), 8K context so the KV cache fits on the GPU, model kept loaded
    cd "$ROOT/ollama" && CUDA_VISIBLE_DEVICES="${GPU:-0}" GGML_VK_VISIBLE_DEVICES=-1 OLLAMA_VULKAN=0 OLLAMA_CONTEXT_LENGTH=8192 OLLAMA_KEEP_ALIVE=24h \
      OLLAMA_HOST=127.0.0.1:11434 OLLAMA_MODELS="$ROOT/ollama/models" setsid nohup ./bin/ollama serve > ollama.log 2>&1 < /dev/null &
    echo "ollama starting on :11434 (GPU ${GPU:-0}), log: $ROOT/ollama/ollama.log"
  else echo "ollama already running"; fi
  export LLM_URL=http://127.0.0.1:11434/v1 LLM_MODEL=qwen3:4b-instruct LLM_DEVICE="RTX 3090 (CUDA)"
else
  if ! pgrep -u "$USER" -f "[u]vicorn server:app --host 0.0.0.0 --port 8000" >/dev/null; then
    cd "$ROOT/llm-server" && DEVICE="$DEVICE" setsid nohup ./env/bin/python -m uvicorn server:app --host 0.0.0.0 --port 8000 > server.log 2>&1 < /dev/null &
    echo "OpenVINO llm-server starting on :8000 ($DEVICE), log: $ROOT/llm-server/server.log"
  else echo "OpenVINO llm-server already running"; fi
  export LLM_URL=http://127.0.0.1:8000/v1 LLM_MODEL=Qwen3-4B-int4-ov LLM_DEVICE="$DEVICE"
fi

if ! pgrep -u "$USER" -f "[n]ode/bin/node src/server.js" >/dev/null; then
  cd "$ROOT/agent" && setsid nohup "$ROOT/node/bin/node" src/server.js > gateway.log 2>&1 < /dev/null &
  echo "gateway starting on :8787 -> $LLM_MODEL at $LLM_URL, log: $ROOT/agent/gateway.log"
else echo "gateway already running (restart with: $0 stop && $0)"; fi
