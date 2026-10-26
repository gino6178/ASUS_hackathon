import { useEffect, useRef, useState } from "react";
import Avatar from "./Avatar.jsx";
import { agentChat, agentStatus, AGENT_URL } from "../agent.js";
import { memory } from "../memory.js";
import { scrollBehavior } from "../hooks.js";

// Free conversation with one coach agent on the local LLM (Qwen3-4B on OpenVINO). Every reply is grounded in the
// match facts sheet; the gateway's verifier checks every number before it is shown. "Remember this" also saves the
// message to player memory, which every coach retrieves next time it answers.
export default function CoachChat({ coach, onRemember }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [keep, setKeep] = useState(false);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const box = useRef(null);
  useEffect(() => { agentStatus().then(setStatus).catch(() => setStatus({ offline: true })); }, []);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight, behavior: scrollBehavior() }); }, [msgs, busy]);

  const send = async (e) => {
    e.preventDefault();
    const q = text.trim(); if (!q || busy) return;
    if (keep) { memory.add(q, "note"); setSaved(q); setKeep(false); onRemember?.(); } else setSaved("");
    const history = msgs.map((m) => ({ role: m.role, content: m.text }));
    setMsgs((m) => [...m, { role: "user", text: q }]); setText(""); setBusy(true);
    try {
      const r = await agentChat(coach.id, q, history);
      setMsgs((m) => [...m, { role: "assistant", text: r.text, r }]);
    } catch (err) {
      setMsgs((m) => [...m, { role: "assistant", text: `The agent gateway is not reachable (${err.message}).`, err: true }]);
    }
    setBusy(false);
  };

  const llm = status?.llm;
  return (
    <section className="panel coach-chat" style={{ "--cc": coach.color }}>
      <header>
        <h2 className="panel-h">Talk to {coach.name}</h2>
        <span className={`tiny ${llm?.ready ? "ok" : "muted"}`}>
          {status?.offline ? `Gateway offline · start it in agent/ (${AGENT_URL})` : llm?.ready ? `${llm.model} on ${llm.device} · coaching server` : `Model server ${llm?.error ? "unreachable" : "loading"} · ${llm?.url ?? ""}`}
        </span>
      </header>
      <div className="chat-log" ref={box} aria-live="polite" aria-relevant="additions">
        {!msgs.length && <p className="tiny muted">Ask about your match, or tell {coach.name} how you feel. Answers use only the measured facts; numbers are checked before they are shown.</p>}
        {msgs.map((m, k) => (
          <div key={k} className={`chat-msg ${m.role}`}>
            {m.role === "assistant" && <Avatar coach={coach} size={30} />}
            <div>
              <p>{m.text}</p>
              {m.r && (
                <span className="tiny chat-meta">
                  <b className={m.r.verified.ok ? "ok" : "bad"}>{m.r.verified.ok ? `✓ ${m.r.verified.numbers} figure${m.r.verified.numbers === 1 ? "" : "s"} verified` : "⚠ unverified"}</b>
                  {m.r.cites.length ? ` · cites ${m.r.cites.join(" ")}` : ""}
                  {m.r.timing ? ` · ${m.r.timing.seconds} s, ${m.r.timing.tokens_per_s} tok/s on ${m.r.timing.device}` : ""}
                  {m.r.verified.offline ? " · model offline, raw fact shown" : ""}
                </span>
              )}
            </div>
          </div>
        ))}
        {busy && <div className="chat-msg assistant" aria-label={`${coach.name} is writing`}><Avatar coach={coach} size={30} /><p className="dots"><i /><i /><i /></p></div>}
      </div>
      <form className="chat-form" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Why do I keep losing points at the net?" aria-label={`Message ${coach.name}`} />
        <label title="Also save this message to player memory"><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />Remember this</label>
        <button className="btn primary" disabled={!text.trim() || busy} aria-busy={busy}>Send</button>
      </form>
      <span className="tiny muted">{saved ? <span className="chat-saved">Saved to memory: “{saved}”. </span> : null}Tick “Remember this” for things every coach should know, like an injury or a goal. Memory stays on this device.</span>
    </section>
  );
}
