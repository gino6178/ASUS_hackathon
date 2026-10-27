# ShuttleCoach LLM server

Qwen3-4B (INT4) on OpenVINO GenAI behind an OpenAI-compatible API. The coach agents call it through the agent
gateway (`../agent`). It runs on the inference server, never on the coaching laptop.

| Endpoint | |
|---|---|
| `GET /health` | ready, model, device, load time |
| `GET /v1/models` | the loaded model |
| `POST /v1/chat/completions` | OpenAI chat format, `stream` supported; Qwen3 thinking mode off unless `think: true` |

## Install on the server

```bash
mkdir -p ~/shuttlecoach/llm-server/models && cd ~/shuttlecoach/llm-server
~/miniconda3/bin/conda create -y -p ./env python=3.12     # OpenVINO has no Python 3.14 wheels yet
./env/bin/pip install openvino-genai fastapi "uvicorn[standard]" huggingface_hub
./env/bin/python -c "from huggingface_hub import snapshot_download as d; d('OpenVINO/Qwen3-4B-int4-ov', local_dir='models/Qwen3-4B-int4-ov')"
```

Start (with the gateway): `~/shuttlecoach/start.sh`. Device: `DEVICE=GPU` on the ASUS UGen Arc Pro B70, `DEVICE=CPU` elsewhere.

## Measured

| Machine | Device | Qwen3-4B INT4 decode |
|---|---|---|
| Dev server, AMD EPYC 7551P (32 cores) | CPU | about 7 tokens/s |
| ASUS UGen Arc Pro B70 | GPU (XMX) | to be measured (bandwidth ceiling about 240 tokens/s) |

The EPYC 7551P lacks the AVX-512 / VNNI instructions OpenVINO uses for INT4, so it is the slowest case; the
system works the same on the B70, only faster.
