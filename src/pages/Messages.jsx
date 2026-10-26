import { useEffect, useState } from "react";
import { agentStatus, agentPlayers, agentRemind, AGENT_URL } from "../agent.js";
import { COACHES } from "../coaches/personas.js";
import Avatar from "../coaches/Avatar.jsx";

// Messages: the coaching staff outside the app. Status of the local LLM and the Telegram bot, the linked players,
// what the coaches learned from each conversation, and the conversation itself.
const coachOf = (id) => COACHES.find((c) => c.id === id);
const when = (t) => new Date(t).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function Messages() {
  const [st, setSt] = useState(null), [ps, setPs] = useState([]), [err, setErr] = useState(null), [msg, setMsg] = useState("");
  const refresh = () => Promise.all([agentStatus(), agentPlayers()]).then(([a, b]) => { setSt(a); setPs(b); setErr(null); }).catch((e) => setErr(e.message));
  useEffect(() => { refresh(); const id = setInterval(refresh, 5000); return () => clearInterval(id); }, []);
  const llm = st?.llm, tg = st?.telegram;

  return (
    <div className="page messages">
      <header className="report-head">
        <div>
          <span className="tag">Coaches on Telegram · local LLM</span>
          <h1 className="h1">Your coaches, between sessions</h1>
          <p className="muted">Players chat with the coaching staff on Telegram. Every reply is written by the local model from the measured facts, checked by the verifier, and adapted to what the player has told the coaches before.</p>
        </div>
        <div className="cta-row">
          <button className="btn ghost" disabled={!ps.some((p) => p.plan)} onClick={() => agentRemind().then((r) => setMsg(`Reminder sent to ${r.sent.length} player(s).`)).catch((e) => setMsg(e.message))}>Send today's reminder now</button>
        </div>
      </header>
      {err && <div className="notice" role="alert"><b>Agent gateway not reachable</b> at {AGENT_URL} ({err}). Start it with <code>cd agent && npm start</code>.</div>}
      {msg && <p className="tiny muted">{msg}</p>}

      <section className="msg-status">
        <div className="panel"><h3 className="panel-h">Local LLM</h3>
          <b className={llm?.ready ? "ok" : "bad"}>{llm ? (llm.ready ? "Ready" : "Not ready") : "…"}</b>
          <p className="tiny muted">{llm?.model ?? ""} {llm?.device ? `on ${llm.device}` : ""} · {llm?.url ?? ""}{llm?.error ? ` · ${llm.error}` : ""}</p></div>
        <div className="panel"><h3 className="panel-h">Telegram bot</h3>
          <b className={tg?.bot ? "ok" : "bad"}>{tg?.bot ? `@${tg.bot}` : tg?.enabled ? "Connecting…" : "Not set up"}</b>
          <p className="tiny muted">{tg?.bot ? "Polling; no public server or open port needed." : tg?.error ?? "Create a bot with @BotFather and put its token in agent/.env."}</p></div>
        <div className="panel"><h3 className="panel-h">Players linked</h3>
          <b>{st?.players ?? "–"}</b>
          <p className="tiny muted">Players send /start to the bot. /forget deletes everything stored about them.</p></div>
        <div className="panel"><h3 className="panel-h">Grounding</h3>
          <b>{st?.facts ?? "–"} facts</b>
          <p className="tiny muted">The only numbers the coaches may state, from {st?.athlete ?? "the athlete"}'s match.</p></div>
      </section>

      {!ps.length && !err && <p className="muted">No players linked yet. Open the bot in Telegram and send /start.</p>}
      {ps.map((p) => (
        <section key={p.id} className="panel msg-player">
          <header><h3>{p.name}</h3><span className="tiny muted">chat {p.id} · coach: {p.prefs.coach} · reminders at {p.prefs.reminderHour}:00</span></header>
          <div className="msg-grid">
            <div>
              <h4 className="panel-h">Learned from conversations</h4>
              {p.memories.length ? <ul className="msg-mem">{p.memories.map((m, k) => <li key={k}>{m.text}<span className="tiny muted"> · {when(m.at)}</span></li>)}</ul> : <p className="tiny muted">Nothing yet.</p>}
              <h4 className="panel-h">Plan on file</h4>
              {p.plan ? <ul className="msg-mem">{p.plan.goals.map((g) => <li key={g}>{g}</li>)}</ul> : <p className="tiny muted">None sent yet: use “Send to players” on the round table.</p>}
            </div>
            <div className="msg-log">
              {p.history.map((h, k) => {
                const c = coachOf(h.coach);
                return (
                  <div key={k} className={`chat-msg ${h.role}`} style={{ "--cc": c?.color ?? "#C3CACD" }}>
                    {h.role === "assistant" && (c ? <Avatar coach={c} size={28} /> : <span />)}
                    <div><p>{h.content}</p>{h.role === "assistant" && <span className="tiny chat-meta">{h.verified ? "✓ verified" : "⚠ unverified"}{h.cites?.length ? ` · ${h.cites.join(" ")}` : ""} · {when(h.at)}</span>}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
