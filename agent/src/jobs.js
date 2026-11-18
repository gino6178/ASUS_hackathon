// Background work for many players: at most BG_CONCURRENCY jobs in flight (default 16), all in the background LLM
// lane. One B70 holds ~30 coaching-sized requests in its KV cache; keeping proactive work at 16 leaves room for
// players who are asking a question right now (see docs/scheduling_5000_users.md for the measurements).
import { background } from "./llm.js";

export const BG_CONCURRENCY = Math.max(1, +(process.env.BG_CONCURRENCY || 16));
export const stats = { running: 0, queued: 0, done: 0, failed: 0 };

export function pool(items, fn, n = BG_CONCURRENCY) {
  return background(async () => {
    let next = 0;
    const out = new Array(items.length);
    stats.queued += items.length;
    const worker = async () => {
      while (next < items.length) {
        const k = next++;
        stats.queued--; stats.running++;
        try { out[k] = await fn(items[k], k); stats.done++; } catch (e) { out[k] = e; stats.failed++; } finally { stats.running--; }
      }
    };
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
    return out;
  });
}
