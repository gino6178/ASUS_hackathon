# Faster inference on one B70: 14 serving options measured

Measured on 18 Nov 2026 on the organizer's Intel Arc Pro B70 instance. Qwen3-8B ran on GPU 0, one serving option at a time, and every option was measured the same way. The embedding model stayed on GPU 1.

**Data**

- [`docs/bench/opt-20261118/results.json`](bench/opt-20261118/results.json): every number below.
- Reproduce with `bash server/opt_bench_b70.sh` (about 6 h 10 min), then `node server/opt_report.mjs bench/opt-<timestamp>`.

## Why this matters

With one user, the bf16 model generates 34.6 tokens per second. Each new token reads all 15.3 GiB of weights from memory, so 34.6 tok/s means about 570 GB/s of weight reads. That is close to the card's memory bandwidth. Generation is therefore limited by **how many bytes it reads**, not by arithmetic, and making the weights smaller is the biggest lever.

## What was measured for every option

| Measure | How |
|---|---|
| Model speed | `vllm bench serve`, random 1,024 tokens in and 256 out, with 1, 8 and 32 users |
| Answers | GSM8K, the first 200 problems, greedy. Shows whether an option changes what the model answers. |
| Real text speed | 10 GSM8K problems answered one at a time, plus all 200 with 16 at once. Speculative decoding gains nothing on random tokens, so this is the fair test for it. |
| Coach replies | The gateway answering web chat questions at 1 per second for 150 s. Records how many replies pass the number check on the first draft. |
| Telegram capacity | The production path with 5,000 players on file, at 3, 4 and 6 questions per second, 240 s each. This is the measure used in [capacity_b70.md](capacity_b70.md). |
| Energy | GPU power from `xpu-smi`, averaged over the 32-user benchmark |

Every option ran with the production settings: priority scheduling, prefix caching on (except `noapc`), 85% of GPU memory, eager mode (except `graph`).

## Results

| Option | Weights | KV cache tokens | 1 user tok/s | 1 user, real text | 32 users tok/s | Tokens per joule | GSM8K | Telegram p95 at 3 / 4 / 6 per s |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| **bf16 (production today)** | 15.3 GiB | 71,488 | 34.6 | 36.2 | 583 | 2.71 | 94.0% | 9.3 / 11.4 / 27.3 s |
| Prefix caching off | 15.3 GiB | 71,488 | 34.6 | 36.2 | 582 | 2.71 | 93.0% | 24.6 / 75.0 / 176 s, 309 lost |
| FP8 weights | 8.8 GiB | 118,656 | 58.5 | 62.7 | 805 | 3.80 | 93.0% | 5.9 / 7.8 / 19.6 s |
| FP8 weights + FP8 KV cache | 8.8 GiB | 237,376 | 56.6 | 62.1 | 883 | 4.22 | 91.5% | 6.2 / 7.0 / **15.1 s** |
| INT4 weights (AWQ) | 5.7 GiB | 139,648 | **71.9** | 75.8 | 878 | 4.22 | 93.0% | **4.7** / 7.4 / 25.1 s |
| **INT4 (AWQ) + FP8 KV cache** | 5.7 GiB | 279,360 | 70.6 | 75.1 | **971** | **4.69** | 93.5% | 5.1 / **6.4** / 20.6 s |
| INT4 weights (Intel AutoRound) | 5.7 GiB | 140,416 | 60.7 | 64.5 | 371 | 1.68 | 95.0% | 21.4 / 26.1 / 52.9 s |
| Speculative decoding, n-gram | 15.3 GiB | 56,064 | 81.6¹ | 43.4 | 643 | 3.01 | 92.0% | 8.6 / 13.5 / 96.4 s |
| Speculative decoding, EAGLE3 | 17.2 GiB | 53,696 | 49.6 | **77.2** | 397 | 1.80 | 93.5% | 10.2 / 45.1 / 167 s, 109 lost |
| Graph mode (no `--enforce-eager`) | 15.3 GiB | 62,272 | 34.8 | 36.4 | 584 | 2.71 | 91.5% | 9.7 / 11.4 / 29.9 s |
| Intel llm-scaler-vllm 1.5, bf16 | 15.3 GiB | 81,408 | 34.7 | 36.2 | 598 | 2.78 | 92.5% | 14.1 / 86.1 / 175 s, 312 lost |
| llm-scaler, FP8 | 8.8 GiB | 128,576 | 58.4 | 63.2 | 765 | 3.63 | 93.0% | 8.0 / 93.8 / 171 s, 585 lost |
| llm-scaler, INT4 (`sym_int4`) | 5.8 GiB | 150,912 | 69.9 | 75.1 | 834 | 3.99 | 93.0% | 6.0 / 65.7 / 172 s, 547 lost |
| llm-scaler, INT4 + FP8 KV cache | 5.8 GiB | 301,824 | 67.7 | 72.6 | 878 | 4.24 | 92.5% | 7.2 / 158 / 174 s, 27 + 848 lost |

¹ The n-gram figure on random tokens is not meaningful: the benchmark's random output repeats itself, and n-gram drafting copies repeated text. On real text it gives 43.4 tok/s.

The target in [capacity_b70.md](capacity_b70.md) is a Telegram reply p95 of 10 s or less with no question lost. Today's setup meets it at 3 per second. FP8, FP8 + FP8 KV, AWQ and AWQ + FP8 KV all meet it at 4 per second, and none meets it at 6. 5 per second was not tested.

GSM8K over 200 problems has a margin of about ±3.5 points (95% interval). Every option except AutoRound is between 91.5% and 94%, so none measurably changes the answers. AutoRound's 95% is within that margin too.

## What each method did

### 1. Quantization: the biggest gain

- **INT4 (AWQ) doubles single-user speed**, from 34.6 to 70–72 tok/s. Coach chat in the browser goes from p50 3.1 s to 1.4 s.
- **The FP8 KV cache halves the memory each token's cache takes.** AWQ's cache goes from 139,648 to 279,360 tokens, so more requests fit at once: 32-user throughput rises from 878 to 971 tok/s.
- **AWQ + FP8 KV is the best all-round option.** Against today's setup:
  - 2.0× single-user speed.
  - 1.67× throughput at 32 users.
  - 1.73× tokens per joule.
  - Telegram 4/s p95 drops from 11.4 s to 6.4 s.
  - GSM8K is 93.5% against 94.0%.
- **FP8 + FP8 KV holds up best at 6 per second** (p95 15.1 s), but it is slower than AWQ for a single user.
- **Intel's AutoRound INT4 checkpoint is slow** in this vLLM build. With 8 users it reaches 113 tok/s, half of bf16. The kernel this build picks for that format appears to be unoptimized. Use AWQ instead.
- The coach replies also passed the number check more often with INT4: 77–86% on the first draft against 67% with bf16. About 150 replies per option is a small sample. The check also rewards replies that quote fewer numbers, so this is not proof of better advice.

### 2. Prefix caching: already on, and essential

The coach prompts share a long system prompt, so about 43% of prompt tokens are served from the prefix cache (vLLM's log). Turning the cache off does not change the random-token benchmark, but the Telegram path collapses:

- 3 per second: p95 goes from 9.3 s to 24.6 s.
- 6 per second: 309 questions are lost.

vLLM enables prefix caching by default, so production already has it. Keep the system prompt first and unchanging so the cache keeps hitting.

### 3. Speculative decoding: good for one user, bad at load

- **EAGLE3** (draft model `RedHatAI/Qwen3-8B-speculator.eagle3`) brings one user on real text to 77 tok/s, 2.1× bf16.
  - The draft model takes 1.9 GiB, so the KV cache shrinks to 53,696 tokens.
  - When the GPU is busy, every drafted token that is rejected wastes work. At 32 users it reaches 397 tok/s against bf16's 583, and the Telegram path fails at 4 per second.
- **n-gram** helps less on real text (43 tok/s) and also fails under load.
- vLLM applies speculative decoding to every request, so it cannot be switched on only when few users are online. INT4 already gives the same single-user speed without that cost.

### 4. Graph mode: no effect on this card

Without `--enforce-eager`, vLLM 0.26 compiles the model with torch.compile. Its log shows `cudagraph_mode: NONE`, so it does not capture graphs on XPU. Speed is unchanged (34.8 tok/s), startup takes 35 s longer, and the KV cache is 13% smaller. Keep `--enforce-eager`.

### 5. Intel's llm-scaler-vllm image: same model speed, fails on the real workload

- llm-scaler 1.5 (vLLM 0.26.1 with Intel patches) matches upstream on every model benchmark. Its own online INT4 (`--quantization sym_int4`) works without a pre-quantized checkpoint.
- On the Telegram path every llm-scaler option breaks down at 4 per second (p95 66–158 s) and loses questions at 6. Upstream vLLM with the same settings stays at 11.4 s in bf16 and under 8 s with FP8 or INT4.
  - Its prefix cache hit rate is normal (38–44%).
  - Late in the 6-per-second runs its log showed 106–161 requests running, hundreds waiting and the KV cache 97–99% full. That is the same pattern as upstream with prefix caching off.
  - The cause is not identified. Requests may be queuing faster than they finish, but that has not been checked against the scheduler's settings.
- Upstream `vllm/vllm-openai-xpu:v0.26.0` is the better choice for this workload.

## What this changes

**`server/b70.sh` now starts AWQ + FP8 KV**: `Qwen/Qwen3-8B-AWQ` with `--dtype float16 --kv-cache-dtype fp8`, with the other settings unchanged. `LLM_HF=Qwen/Qwen3-8B LLM_DTYPE=bfloat16 LLM_KV=auto` brings back bf16.

What it is expected to change (projection):

- The planning numbers in [capacity_b70.md](capacity_b70.md) would move as follows. They come from the same method, scaled from the measured edge of 3 to 4 per second.
  - The edge goes from 3 to at least 4 Telegram questions per second, about 24,000 daily active players instead of 18,000.
  - With the same headroom, the planning figure goes from 2 per second (about 12,000 daily players) to about 2.7 per second (about 16,000).
- Every reply would arrive about twice as fast when the server is not busy.

Not yet done:

- The instance on the B70 still runs bf16; it has not been restarted with the new script.
- The 5,000-player pre-session burst was not rerun with these options.
- 5 per second was not tested, so the true edge for AWQ + FP8 KV lies somewhere between 4 and 6.

## Caveats

- Each option ran once. Differences smaller than about 10% in throughput, or 3 points on GSM8K, may be noise.
- GSM8K is maths in English. The coach answers in Chinese about badminton. The number-check pass rate is the closest domain measure we have, and it did not get worse with any quantized option.
- Telegram players and questions are synthetic, as in [capacity_b70.md](capacity_b70.md). The mock Telegram server answers instantly.
- GPU power never reached the 230 W limit in these runs (207–221 W at 32 users), so tokens per joule reflects the work done, not throttling.
