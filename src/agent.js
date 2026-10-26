// Client for the agent gateway (../agent): coach chat on the local LLM, Telegram status and plan delivery.
// The gateway runs on the coaching station; set VITE_AGENT_URL if it is not on this machine.
export const AGENT_URL = (import.meta.env.VITE_AGENT_URL || "http://127.0.0.1:8787").replace(/\/$/, "");

async function call(path, body) {
  const r = await fetch(AGENT_URL + path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {});
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `gateway ${r.status}`);
  return r.json();
}
export const agentStatus = () => call("/api/status");
export const agentPlayers = () => call("/api/players");
export const agentChat = (coach, message, history) => call("/api/chat", { coach, message, history });
export const agentNotify = (plan, text) => call("/api/notify", { plan, text });
export const agentRemind = () => call("/api/remind", {});
