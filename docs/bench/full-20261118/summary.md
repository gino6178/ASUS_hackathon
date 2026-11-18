## Part B: the real gateway, 5,000 players

| Run | Meal-advice replies/s | All players served after | Live chat p50 / p90 / p99 (s) | Live < 10 s | Store writes (blocking ms) | GPU W mean |
|---|---:|---:|---:|---:|---:|---:|
| 1-today-serial: today: one player at a time, no priority, write per change | 0.59 | ~141 min (projected) | 3.0 / 5.8 / 7.1 | 100% | 1055 of 1055 (31467) | 218.1 |
| 2-pool16-oldstore: pool of 16 + priority, write per change | 7.83 | ~11 min (projected) | 3.5 / 6.9 / 7.3 | 100% | 14024 of 14024 (401372) | 228.2 |
| 3-pool32: pool of 32 + priority, batched writes | 15.38 | 5.4 min (measured) | 3.8 / 7.7 / 8.8 | 100% | 557 of 15000 (22641) | 223.9 |
| 4-pool16-full5000: pool of 16 + priority, batched writes (all 5,000) | 8.54 | 9.8 min (measured) | 3.4 / 6.9 / 7.9 | 100% | 942 of 15000 (37620) | 227.7 |
| C-peak2: peak: live 2/s + 5,000 pre-session jobs (pool 16, priority) | 7.65 | 10.9 min (measured) | 3.5 / 7.1 / 8.0 | 100% | 1058 of 15000 (43460) | 229.2 |
| C-tpeak: peak: telegram live 1.5/s + 5,000 pre-session jobs | 6.98 | 11.9 min (measured) | 5.6 / 8.4 / 11.0 | 97% | 1259 of 18355 (55758) | 229.5 |

## Part A: model-level sweeps (300 background jobs + live questions)

| Run | Live TTFT p50 / p90 / p99 (s) | Live reply p50 / p90 (s) | TTFT < 1 s | Reply < 10 s | Background jobs/s | Output tok/s |
|---|---:|---:|---:|---:|---:|---:|
| K4: paced-priority K=4 | 0.29 / 0.58 / 0.96 | 5.3 / 6.3 | 99% | 100% | 0.44 | 135.8 |
| K8: paced-priority K=8 | 0.31 / 0.59 / 1.03 | 6.2 / 7.7 | 99% | 100% | 0.68 | 210.8 |
| K16: paced-priority K=16 | 0.35 / 0.96 / 1.18 | 7.8 / 11.1 | 91% | 72% | 1.00 | 311.9 |
| K32: paced-priority K=32 | 0.91 / 1.87 / 3.46 | 10.8 / 13.2 | 60% | 30% | 1.17 | 363.7 |
| K64: paced-priority K=64 | 0.85 / 2.02 / 3.46 | 10.9 / 13.4 | 64% | 29% | 1.17 | 362.4 |
| L0.35: paced-priority K=16, live 0.35/s | 0.32 / 1.01 / 1.09 | 8.1 / 10.2 | 90% | 85% | 1.07 | 301.9 |
| L1.4: paced-priority K=16, live 1.4/s | 0.52 / 1.09 / 1.76 | 10.2 / 13.2 | 84% | 47% | 0.88 | 328.2 |
| L2.1: paced-priority K=16, live 2.1/s | 1.08 / 2.08 / 3.84 | 13.9 / 15.4 | 43% | 0% | 0.72 | 320.0 |
| fcfs-s8: fcfs-burst seed 8 | 94.59 / 181.98 / 189.82 | 108.3 / 192.9 | 0% | 0% | 1.41 | 366.8 |
| best-s8: paced-priority K=16 seed 8 | 0.34 / 0.95 / 1.27 | 8.3 / 11.1 | 93% | 73% | 0.98 | 315.6 |
| fcfs-s9: fcfs-burst seed 9 | 100.56 / 175.66 / 188.51 | 114.2 / 185.3 | 0% | 0% | 1.41 | 365.2 |
| best-s9: paced-priority K=16 seed 9 | 0.37 / 0.90 / 1.19 | 7.8 / 10.8 | 94% | 77% | 1.00 | 312.2 |
| C-m1: live only 1/s | 0.28 / 0.44 / 0.93 | 4.7 / 5.5 | 100% | 100% | – | 107.2 |
| C-m2: live only 2/s | 0.32 / 0.60 / 1.03 | 7.0 / 8.8 | 99% | 100% | – | 216.8 |
| C-m3: live only 3/s | 1.38 / 4.67 / 7.45 | 14.3 / 18.2 | 44% | 11% | – | 323.1 |
| C-m4: live only 4/s | 25.77 / 51.01 / 57.83 | 39.8 / 64.4 | 4% | 0% | – | 337.5 |
| C-m5: live only 5/s | 57.45 / 106.46 / 118.64 | 71.5 / 120.4 | 1% | 0% | – | 339.7 |
| C-m6: live only 6/s | 88.66 / 162.41 / 177.16 | 102.5 / 176.4 | 1% | 0% | – | 340.1 |
| C-m8: live only 8/s | 155.82 / 284.32 / 314.15 | 169.7 / 298.3 | 1% | 0% | – | 339.6 |
| C-b2.8: paced-priority K=16, live 2.8/s | 2.50 / 4.36 / 5.24 | 16.3 / 18.6 | 17% | 0% | 0.63 | 316.6 |
| C-b3.5: paced-priority K=16, live 3.5/s | 17.08 / 34.70 / 41.20 | 31.1 / 48.6 | 1% | 0% | 0.56 | 317.3 |

## Capacity: live rate against latency targets (MLPerf server: TTFT ≤ 2 s and TPOT ≤ 100 ms; interactive: 0.5 s and 30 ms)

| Run | Live rate (/s) | Background | TTFT p50 / p95 (s) | TPOT p50 / p95 (ms) | Reply p95 (s) | Meet server target | Meet interactive target |
|---|---:|---|---:|---:|---:|---:|---:|
| C-m1 | 1 | none | 0.28 / 0.49 | 37 / 47 | 5.9 | 100% | 4% |
| C-m2 | 2 | none | 0.32 / 0.71 | 56 / 72 | 9.1 | 100% | 0% |
| C-m3 | 3 | none | 1.38 / 5.49 | 113 / 121 | 18.8 | 27% | 0% |
| C-m4 | 4 | none | 25.77 / 54.61 | 116 / 121 | 65.3 | 0% | 0% |
| C-m5 | 5 | none | 57.45 / 113.41 | 116 / 118 | 125.5 | 0% | 0% |
| C-m6 | 6 | none | 88.66 / 171.27 | 116 / 119 | 183.3 | 0% | 0% |
| C-m8 | 8 | none | 155.82 / 302.65 | 117 / 119 | 316.4 | 0% | 0% |
| L0.35 | 0.35 | 300 jobs, ≤16 in flight | 0.32 / 1.06 | 62 / 85 | 10.4 | 100% | 0% |
| K4 | 0.7 | 300 jobs, ≤4 in flight | 0.29 / 0.74 | 41 / 52 | 6.5 | 100% | 0% |
| K8 | 0.7 | 300 jobs, ≤8 in flight | 0.31 / 0.78 | 49 / 65 | 8.1 | 100% | 0% |
| K16 | 0.7 | 300 jobs, ≤16 in flight | 0.35 / 1.05 | 60 / 92 | 11.2 | 100% | 0% |
| K32 | 0.7 | 300 jobs, ≤32 in flight | 0.91 / 2.44 | 83 / 112 | 14.1 | 79% | 0% |
| K64 | 0.7 | 300 jobs, ≤64 in flight | 0.85 / 2.53 | 84 / 114 | 14.1 | 78% | 0% |
| fcfs-s8 | 0.7 | 300 jobs, ≤all in flight | 94.59 / 184.15 | 114 / 117 | 195.1 | 0% | 0% |
| best-s8 | 0.7 | 300 jobs, ≤16 in flight | 0.34 / 1.04 | 63 / 94 | 11.6 | 98% | 0% |
| fcfs-s9 | 0.7 | 300 jobs, ≤all in flight | 100.56 / 179.80 | 113 / 117 | 189.1 | 0% | 0% |
| best-s9 | 0.7 | 300 jobs, ≤16 in flight | 0.37 / 1.02 | 61 / 91 | 11.2 | 100% | 0% |
| L1.4 | 1.4 | 300 jobs, ≤16 in flight | 0.52 / 1.17 | 78 / 111 | 13.7 | 80% | 0% |
| L2.1 | 2.1 | 300 jobs, ≤16 in flight | 1.08 / 2.67 | 107 / 120 | 16.0 | 17% | 0% |
| C-b2.8 | 2.8 | 300 jobs, ≤16 in flight | 2.50 / 4.71 | 119 / 125 | 19.0 | 2% | 0% |
| C-b3.5 | 3.5 | 300 jobs, ≤16 in flight | 17.08 / 37.48 | 116 / 120 | 51.2 | 0% | 0% |

## Capacity through the real gateway (end to end: web /api/chat, or a Telegram message to the coach's reply)

| Run | Path | Asked (/s) | Reply p50 / p95 / p99 (s) | Reply ≤ 10 s | LLM calls per question | GPU W mean |
|---|---|---:|---:|---:|---:|---:|
| C-t1 | telegram | 0.984 | 4.5 / 7.6 / 9.3 | 100% | 3.13 | 224.7 |
| C-t2 | telegram | 1.928 | 5.0 / 8.0 / 9.8 | 99% | 3.11 | 226.4 |
| C-t3 | telegram | 2.887 | 5.7 / 9.3 / 10.7 | 97% | 3.12 | 228.0 |
| C-t4 | telegram | 3.827 | 7.1 / 11.9 / 14.6 | 89% | 3.12 | 227.2 |
| C-g1 | web | 0.976 | 3.0 / 6.4 / 6.8 | 100% | 1.26 | 214.0 |
| C-g2 | web | 2.014 | 3.0 / 6.5 / 7.1 | 100% | 1.25 | 222.5 |
| C-g3 | web | 3.005 | 3.1 / 6.6 / 7.2 | 100% | 1.23 | 225.4 |
| C-g4 | web | 3.999 | 3.2 / 6.7 / 7.3 | 100% | 1.23 | 227.0 |
| C-g5 | web | 4.984 | 3.2 / 6.8 / 7.2 | 100% | 1.25 | 229.1 |
| C-g6 | web | 5.947 | 3.3 / 7.0 / 7.5 | 100% | 1.25 | 228.5 |
| C-g8 | web | 7.816 | 3.5 / 7.5 / 8.2 | 100% | 1.27 | 227.7 |
| C-v4 | web-varied | 4.004 | 3.2 / 6.8 / 8.1 | 100% | 1.33 | 227.6 |
| C-v8 | web-varied | 7.76 | 3.6 / 7.7 / 8.8 | 100% | 1.31 | 227.1 |
