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
  // what is still needed before players can chat, in order
  const steps = [
    { done: !err && !!st, t: <>Start the agent gateway: <code>cd agent && npm start</code> ({AGENT_URL}).</> },
    { done: !!llm?.ready, t: <>Start the local model server; the gateway finds it at {llm?.url ?? "LLM_URL"}.</> },
    { done: !!tg?.bot, t: <>Create a bot with @BotFather and put its token in <code>agent/.env</code>.</> },
    { done: ps.length > 0, t: <>Each player opens the bot in Telegram and sends <code>/start</code>.</> },
  ];

  return (
    <div className="page messages">
      <header className="report-head">
        <div>
          <span className="tag">24-hour coach on Telegram · local language model</span>
          <h1 className="h1">A coach in the pocket, 24 hours a day</h1>
          <p className="muted">Between sessions the staff lives in Telegram: players tell it what food they have, their schedule and what they trained, and get meals timed around training, reminders an hour before each session and an evening check-in. Every reply is written by the local model from the measured facts, checked by the verifier, and adapted to what the player has told the coaches before.</p>
        </div>
        <div className="cta-row">
          <button className="btn ghost" disabled={!ps.some((p) => p.plan)} title={ps.some((p) => p.plan) ? undefined : "Send a plan from the round table first"}
            onClick={() => agentRemind().then((r) => setMsg(`Reminder sent to ${r.sent.length} player(s).`)).catch((e) => setMsg(e.message))}>Send today's reminder now</button>
        </div>
      </header>
      {err && <div className="notice" role="alert"><b>Agent gateway not reachable</b> at {AGENT_URL} ({err}). Start it with <code>cd agent && npm start</code>.</div>}
      {msg && <p className="tiny muted" role="status">{msg}</p>}

      <dl className="status-strip" aria-label="Status">
        <div><dt>Local model</dt><dd><span className={llm?.ready ? "ok" : "bad"}>{llm ? (llm.ready ? "Ready" : "Not ready") : "…"}</span></dd>
          <dd>{llm?.model ?? ""} {llm?.device ? `on ${llm.device}` : ""}{llm?.error ? ` · ${llm.error}` : ""}</dd></div>
        <div><dt>Telegram bot</dt><dd><span className={tg?.bot ? "ok" : "bad"}>{tg?.bot ? `@${tg.bot}` : tg?.enabled ? "Connecting…" : "Not set up"}</span></dd>
          <dd>{tg?.bot ? "Polling; no public server or open port needed." : tg?.error ?? "Needs a bot token."}</dd></div>
        <div><dt>Players linked</dt><dd>{st?.players ?? "–"}</dd><dd>/forget deletes everything stored about a player.</dd></div>
        <div><dt>Grounding</dt><dd>{st?.facts ?? "–"} facts</dd><dd>The only numbers the coaches may state, from {st?.athlete ?? "the athlete"}'s match.</dd></div>
      </dl>

      {!ps.length && (
        <section className="panel">
          <h2 className="panel-h">Set up messaging</h2>
          <p className="muted small">Four steps, all on this machine. Ticks appear as each one is detected.</p>
          <ol className="setup">{steps.map((x, k) => <li key={k} className={x.done ? "done" : ""}><span>{x.t}</span></li>)}</ol>
        </section>
      )}
      {ps.map((p) => (
        <section key={p.id} className="panel msg-player">
          <header><h3>{p.name}</h3><span className="tiny muted">chat {p.id} · coach: {p.prefs.coach} · reminders at {p.prefs.reminderHour}:00</span></header>
          <div className="msg-grid">
            <div>
              <h4>Learned from conversations</h4>
              {p.memories.length ? <ul className="msg-mem">{p.memories.map((m, k) => <li key={k}>{m.text}<span className="tiny muted"> · {when(m.at)}</span></li>)}</ul> : <p className="tiny muted">Nothing yet.</p>}
              <h4>Plan on file</h4>
              {p.plan ? <ul className="msg-mem">{p.plan.goals.map((g) => <li key={g}>{g}</li>)}</ul> : <p className="tiny muted">None sent yet: use “Send to players” on the round table.</p>}
              <h4>Calendar</h4>
              {p.events?.length ? <ul className="msg-mem">{p.events.slice(-8).map((e) => <li key={e.id}>{e.date} {e.start}{e.end ? `–${e.end}` : ""} · {e.title}<span className="tiny muted"> · {e.kind}</span></li>)}</ul> : <p className="tiny muted">Nothing yet: players tell the bot their sessions, matches and exams.</p>}
              <h4>Training log</h4>
              {p.logs?.length ? <ul className="msg-mem">{p.logs.slice(-6).reverse().map((l, k) => <li key={k}>{l.date} · {l.what}{l.minutes ? `, ${l.minutes} min` : ""}{l.pain ? <span className="bad"> · pain: {l.pain}</span> : null}</li>)}</ul> : <p className="tiny muted">No sessions logged yet.</p>}
              <h4>Food at home</h4>
              {p.pantry?.length ? <p className="small">{p.pantry.map((x) => x.item).join(", ")}</p> : <p className="tiny muted">Empty: players send /pantry or just say what they bought.</p>}
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
