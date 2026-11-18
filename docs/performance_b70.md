# Performance validation on the ASUS UGen Intel Arc Pro B70

Measured on 18 Nov 2026 on the organizer's Stage II instance (Intel Cloud Services, `asus-hackathon-03`).
Raw results: [`docs/bench/b70-20261118/`](bench/b70-20261118). Reproduce with `bash server/bench_b70.sh`
after `bash server/b70.sh start`.

## Setup

| | |
|---|---|
| GPUs | 2 × Intel Arc Pro B70 32 GB (Battlemage). GPU 0 runs the language model, GPU 1 the embedding model |
| Host | Ubuntu 26.04, kernel 7.0, 2-socket Xeon (86 cores), 256 GB RAM |
| Serving | vLLM 0.26.0 for XPU (`vllm/vllm-openai-xpu:v0.26.0`), bf16, eager mode, `--max-model-len 16384`, `--gpu-memory-utilization 0.85` |
| Language model | Qwen3-8B (bf16, thinking off) behind the OpenAI-compatible API on :8000 |
| Embedding model | Qwen3-Embedding-0.6B (pooling runner) on :8001, used by the coaches' knowledge base |
| Application | agent gateway (Node.js 22, :8787) and the web app (:5190), served from the same machine |

## 1. Model serving (vLLM benchmark)

`vllm bench serve`, random prompts of 1,024 input tokens and 256 output tokens, which is roughly one coaching
turn: fact sheet and player memory in, a reply of up to 260 tokens out.

| Concurrent users | Requests | Output tok/s (all users) | TTFT p50 / p90 | Time per output token (mean) | End-to-end p50 | Failed |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 8 | **34.6** | 144 / 149 ms | 28.5 ms | 7.40 s | 0 |
| 4 | 32 | **131.4** | 315 / 550 ms | 29.3 ms | 7.89 s | 0 |
| 8 | 64 | **233.9** | 325 / 1,196 ms | 32.4 ms | 9.04 s | 0 |

Throughput scales almost linearly to 4 users (3.8×) and reaches 6.8× at 8 users, while each user's
generation speed only drops from 35 to 31 tokens/s. Total token throughput at 8 users is 1,170 tok/s.

## 2. Application (coach chat through the gateway)

`server/bench_app.mjs`: the four specialist coaches answer a real question each, through the full pipeline
(fact sheet, player memory, LLM reply, check of every number against the measured match facts).

| Scenario | Result |
|---|---|
| One user, 12 questions in a row (3 per coach) | latency p50 **3.3 s**, mean 4.1 s, max 6.9 s; LLM speed 35.0 tok/s; 12/12 answered |
| 4 users asking at the same moment | all 4 answered in **5.2 s** (p50 3.1 s) |
| 8 users asking at the same moment | all 8 answered in **7.4 s** (p50 3.2 s) |

5 of the 12 sequential replies took about twice their generation time. Those are the replies where the number
check found a figure that was not in the match facts, so the gateway had the model rewrite the reply before
sending it. A single pass is 2.4 to 3.3 s; a checked-and-rewritten reply is 5.3 to 6.9 s.

## 3. Knowledge-base embeddings (GPU 1)

| | |
|---|---|
| One search query | **23 ms** mean (p90 29 ms) |
| Batch of 32 findings | 98 ms, about **327 texts/s** |

## 4. GPU telemetry (GPU 0, under load)

From `xpu-smi dump` (224 one-second samples during the 4- and 8-user runs and the app benchmark):

| | Mean | Range |
|---|---:|---:|
| Board power | 196 W | 67 to 242 W (limit 230 W) |
| Graphics clock | 2,731 MHz | 1,450 to 2,800 MHz |
| VRAM in use | 27.8 GB of 32 GB | vLLM reserves 85%: about 16 GB of weights plus KV cache |

GPU and engine utilization counters read N/A with xpu-smi 2.0 on this driver.

## What this means for ShuttleCoach

- **Interactive coaching on one card.** A coach answers in about 3 s and the first token arrives in 0.15 s, so the
  voice and chat coach feel live. That holds with 8 people asking at once.
- **Room for a club.** One B70 serves 8 concurrent players at 31+ tok/s each. The second card is almost idle
  with only the embedding model on it, so a second LLM replica (or a larger model with tensor parallelism)
  could double this.
- **Accuracy costs latency, and we measured how much.** The number check adds a rewrite on about 4 in 10
  replies. That is the price of never showing a player a statistic the match did not produce.
- **32 GB is the enabler.** An 8B model in bf16 with a 16K context and an 8-user KV cache fits on one card,
  with no quantization.
