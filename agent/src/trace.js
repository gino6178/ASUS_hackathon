// Agent trace: every run (a Telegram message, a button, a web chat, a nightly research or reflection run, a
// reminder) records its steps: LLM calls, tool calls, checks, messages and the moments it waits for a person.
// The current run travels with the async call chain (AsyncLocalStorage), so deep code adds steps without plumbing.
// Finished runs are appended to a JSON-lines file on the station; the web app shows them live.
import fs from "node:fs";
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";

const FILE = path.resolve(process.env.TRACE_FILE || "data/trace.jsonl");
const als = new AsyncLocalStorage();
const MAX_STEPS = 400;
const clip = (v, n = 160) => (typeof v === "string" ? (v.length > n ? v.slice(0, n - 1) + "…" : v) : v);

export async function run(kind, meta, fn) {
  const r = { id: "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), kind, who: meta.who ?? null, input: clip(meta.input ?? ""), at: Date.now(), steps: [] };
  return als.run(r, async () => {
    try { const out = await fn(); r.status = "ok"; return out; }
    catch (e) { r.status = "error"; r.error = clip(String(e.message || e)); throw e; }
    finally {
      r.ms = Date.now() - r.at;
      if (r.steps.length) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.appendFileSync(FILE, JSON.stringify(r) + "\n"); }
    }
  });
}

// type: llm | tool | check | message | human
export function step(type, name, detail = {}) {
  const r = als.getStore(); if (!r || r.steps.length >= MAX_STEPS) return;
  const d = Object.fromEntries(Object.entries(detail).map(([k, v]) => [k, clip(v)]));
  r.steps.push({ t: Date.now() - r.at, type, name, ...d });
}
// time a step: detail.result(value) adds what came back
export async function timed(type, name, detail, fn) {
  const r = als.getStore(), t0 = Date.now(), { result, ...rest } = detail;
  try {
    const v = await fn();
    if (r) step(type, name, { ...rest, ...(result ? result(v) : {}), ms: Date.now() - t0, t0: t0 - r.at });
    return v;
  } catch (e) { if (r) step(type, name, { ...rest, error: String(e.message || e), ms: Date.now() - t0, t0: t0 - r.at }); throw e; }
}
export const current = () => als.getStore();

export function recent(n = 40, kind = null) {
  if (!fs.existsSync(FILE)) return [];
  const lines = fs.readFileSync(FILE, "utf8").trim().split("\n");
  const out = [];
  for (let i = lines.length - 1; i >= 0 && out.length < n; i--) { try { const r = JSON.parse(lines[i]); if (!kind || r.kind === kind) out.push(r); } catch {} }
  return out;
}
