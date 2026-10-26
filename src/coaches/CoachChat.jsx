import { useEffect, useRef, useState } from "react";
import Avatar from "./Avatar.jsx";
import { agentChat, agentStatus, AGENT_URL } from "../agent.js";

// Free conversation with one coach agent on the local LLM (Qwen3-4B on OpenVINO). Every reply is grounded in the
// match facts sheet; the gateway's verifier checks every number before it is shown.
export default function CoachChat({ coach }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const box = useRef(null);
  useEffect(() => { agentStatus().then(setStatus).catch(() => setStatus({ offline: true })); }, []);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" }); }, [msgs, busy]);

  const send = async (e) => {
    e.preventDefault();
    const q = text.trim(); if (!q || busy) return;
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
        <h3 className="panel-h">Talk to {coach.name}</h3>
        <span className={`tiny ${llm?.ready ? "ok" : "muted"}`}>
          {status?.offline ? `gateway offline · start it in agent/ (${AGENT_URL})` : llm?.ready ? `${llm.model} on ${llm.device} · coaching server` : `model server ${llm?.error ? "unreachable" : "loading"} · ${llm?.url ?? ""}`}
        </span>
      </header>
      <div className="chat-log" ref={box}>
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
        {busy && <div className="chat-msg assistant"><Avatar coach={coach} size={30} /><p className="dots"><i /><i /><i /></p></div>}
      </div>
      <form onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`e.g. Why do I keep losing points at the net?`} aria-label={`Message ${coach.name}`} />
        <button className="btn primary" disabled={!text.trim() || busy}>Send</button>
      </form>
    </section>
  );
}
