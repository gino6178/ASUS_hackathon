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
// the self-evolving staff: knowledge base from the research agent, playbooks, proposals and feedback
export const agentKb = () => call("/api/kb");
export const agentKbSearch = (q) => call(`/api/kb/search?q=${encodeURIComponent(q)}`);
export const agentResearch = (topics) => call("/api/research/run", { topics, maxPapers: 6 });
export const agentPlaybooks = () => call("/api/playbooks");
export const agentEvolve = () => call("/api/evolve/run", {});
export const agentDecide = (coach, id, approve) => call("/api/evolve/decide", { coach, id, approve });
export const agentRollback = (coach) => call("/api/evolve/rollback", { coach });
export const agentFeedback = (fb) => call("/api/feedback", fb);
// the club's courts and the games the booking agent is organising
export const agentVenue = () => call("/api/venue");
// what the agents did: recent runs with their LLM calls, tool calls, checks, messages and human confirmations
export const agentTrace = (n = 40, kind = null) => call(`/api/trace?n=${n}${kind ? `&kind=${encodeURIComponent(kind)}` : ""}`);
