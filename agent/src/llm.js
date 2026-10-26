// Client for the LLM server (OpenAI-compatible). LLM_URL points at whichever runs the model:
//   OpenVINO GenAI (llm-server, the B70 deployment):  http://127.0.0.1:8000/v1, LLM_MODEL=Qwen3-4B-int4-ov
//   Ollama on an NVIDIA card (dev server's RTX 3090): http://127.0.0.1:11434/v1, LLM_MODEL=qwen3:4b
const URL_ = (process.env.LLM_URL || "http://127.0.0.1:8000/v1").replace(/\/$/, "");
const MODEL = process.env.LLM_MODEL || "Qwen3-4B-int4-ov";
const TIMEOUT = +(process.env.LLM_TIMEOUT_MS || 180000);
const THINK = /<think>[\s\S]*?<\/think>\s*/g;

export async function chat(messages, { maxTokens = 260, temperature = 0.4 } = {}) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), TIMEOUT);
  // Qwen3 reasoning off: coaching replies need to be quick (the OpenVINO server also does this itself)
  const msgs = messages.map((m, i) => (i === messages.length - 1 && m.role === "user" && !/\/no_think/.test(m.content) ? { ...m, content: m.content + " /no_think" } : m));
  const t0 = Date.now();
  try {
    const r = await fetch(`${URL_}/chat/completions`, {
      method: "POST", headers: { "content-type": "application/json" }, signal: ctl.signal,
      body: JSON.stringify({ model: MODEL, messages: msgs, max_tokens: maxTokens, temperature }),
    });
    if (!r.ok) throw new Error(`LLM server ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = await r.json(), secs = (Date.now() - t0) / 1000, n = j.usage?.completion_tokens;
    return { text: j.choices[0].message.content.replace(THINK, "").trim(),
      timing: j.timing ?? { seconds: +secs.toFixed(2), tokens_per_s: n ? +(n / secs).toFixed(1) : null, device: process.env.LLM_DEVICE || "GPU" } };
  } finally { clearTimeout(t); }
}

export async function health() {
  const base = URL_.replace(/\/v1$/, "");
  try { // OpenVINO llm-server
    const r = await fetch(base + "/health", { signal: AbortSignal.timeout(3000) });
    if (r.ok) return { url: URL_, ...(await r.json()) };
  } catch { /* try the OpenAI model list below */ }
  try { // any OpenAI-compatible server (Ollama, vLLM, OpenVINO Model Server)
    const r = await fetch(URL_ + "/models", { signal: AbortSignal.timeout(3000) });
    const ids = (await r.json()).data?.map((m) => m.id) ?? [];
    return { url: URL_, ready: ids.includes(MODEL), model: MODEL, device: process.env.LLM_DEVICE || "GPU", error: ids.includes(MODEL) ? null : `model ${MODEL} not loaded` };
  } catch (e) {
    return { url: URL_, ready: false, error: String(e.message || e) };
  }
}
