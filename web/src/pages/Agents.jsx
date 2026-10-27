import { useEffect, useState } from "react";
import { agentTrace, AGENT_URL } from "../agent.js";
import "./lab.css";

// Agent trace: what the agents actually did. Each run (a Telegram message, a button, a web chat, a nightly research
// or reflection run, a reminder) lists its steps: the local LLM's calls, the tools it used, the checks it passed or
// failed, the messages it sent and the moments it waited for a person.
const TYPE = {
  llm: ["LLM", "#F2E6C9", "the local model"],
  tool: ["Tool", "#6FB6FF", "calendar, courts, knowledge base, memory"],
  check: ["Check", "#5FD39A", "verifier and safety gates"],
  message: ["Message", "#8E989D", "sent on Telegram"],
  human: ["Person", "#F2D46B", "waits for a human"],
};
const KIND = { "telegram message": "Telegram", "telegram button": "Telegram button", "web chat": "Web chat", research: "Research agent", reflection: "Reflection", reminder: "Reminder", "human decision": "Human decision" };
const ago = (t) => { const s = Math.round((Date.now() - t) / 1000); return s < 60 ? `${s} s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : new Date(t).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); };
const DETAIL_SKIP = new Set(["type", "name", "t", "t0", "ms", "out", "text", "shot"]);

function Step({ s }) {
  const [label, color] = TYPE[s.type] ?? ["Step", "#8E989D"];
  const bad = s.type === "check" && (s.ok === false || s.passed === false);
  const rest = Object.entries(s).filter(([k, v]) => !DETAIL_SKIP.has(k) && v !== null && v !== "" && v !== undefined);
  return (
    <li className={`tr-step ${s.type}${bad ? " bad" : ""}`} style={{ "--c": bad ? "#FF6B5E" : color }}>
      <span className="tr-type">{label}</span>
      <div>
        <b>{s.name}</b>{s.ms != null && <span className="tiny muted"> · {s.ms} ms</span>}
        {rest.length > 0 && <p className="tiny muted">{rest.map(([k, v]) => `${k}: ${typeof v === "boolean" ? (v ? "yes" : "no") : v}`).join(" · ")}</p>}
        {(s.out || s.text) && <p className="tr-out">{s.out || s.text}</p>}
        {s.shot && <a href={AGENT_URL + s.shot} target="_blank" rel="noreferrer"><img className="tr-shot" src={AGENT_URL + s.shot} alt={`Screenshot after: ${s.name}`} loading="lazy" /></a>}
      </div>
    </li>
  );
}

export default function Agents() {
  const [runs, setRuns] = useState([]), [err, setErr] = useState(null), [sel, setSel] = useState(null), [kind, setKind] = useState("");
  useEffect(() => {
    const f = () => agentTrace(60, kind || null).then((r) => { setRuns(r); setErr(null); }).catch((e) => setErr(e.message));
    f(); const id = setInterval(f, 4000); return () => clearInterval(id);
  }, [kind]);
  const run = runs.find((r) => r.id === sel) ?? runs.find((r) => r.steps.length > 3) ?? runs[0];
  const all = runs.flatMap((r) => r.steps), n = (t) => all.filter((s) => s.type === t).length;
  const llm = all.filter((s) => s.type === "llm" && s.ms), med = llm.length ? llm.map((s) => s.ms).sort((a, b) => a - b)[Math.floor(llm.length / 2)] : null;

  return (
    <div className="page agents">
      <header className="report-head">
        <div>
          <span className="tag">LLM agents · every step, as it happened</span>
          <h1 className="h1">What the agents did</h1>
          <p className="muted">The local model reads each request and decides what to do; tools act on the calendar, the courts, the knowledge base and player memory; checks stop invented numbers and unsafe advice; and anything binding waits for a person to say yes. This is the live log from the coaching station.</p>
        </div>
      </header>
      {err && <div className="notice" role="alert"><b>Agent gateway not reachable</b> at {AGENT_URL} ({err}).</div>}
      <dl className="status-strip" aria-label="Last runs">
        <div><dt>Agent runs</dt><dd>{runs.length}</dd><dd>most recent first</dd></div>
        <div><dt>LLM calls</dt><dd>{n("llm")}</dd><dd>{med ? `median ${med} ms on the station` : ""}</dd></div>
        <div><dt>Tool calls</dt><dd>{n("tool")}</dd><dd>calendar, courts, knowledge base, memory</dd></div>
        <div><dt>Checks</dt><dd>{n("check")}</dd><dd>{all.filter((s) => s.type === "check" && (s.ok === false || s.passed === false)).length} stopped something</dd></div>
        <div><dt>Waited for a person</dt><dd>{n("human")}</dd><dd>picks, answers, confirmations</dd></div>
      </dl>
      <div className="tr-kinds" role="group" aria-label="Filter">
        {["", ...Object.keys(KIND)].map((k) => <button key={k} className="chip" aria-pressed={kind === k} onClick={() => { setKind(k); setSel(null); }}>{k ? KIND[k] : "All"}</button>)}
      </div>
      <div className="tr-grid">
        <ul className="tr-runs" aria-label="Runs">
          {runs.map((r) => (
            <li key={r.id}>
              <button aria-pressed={run?.id === r.id} onClick={() => setSel(r.id)}>
                <span className="tiny muted">{KIND[r.kind] ?? r.kind} · {r.who ?? ""} · {ago(r.at)} · {r.ms} ms</span>
                <b>{r.input || "(no text)"}</b>
                <span className="tr-dots">{r.steps.slice(0, 40).map((s, i) => <i key={i} style={{ background: (s.type === "check" && (s.ok === false || s.passed === false)) ? "#FF6B5E" : TYPE[s.type]?.[1] }} title={s.name} />)}</span>
              </button>
            </li>
          ))}
          {!runs.length && <li className="tiny muted">No agent runs yet.</li>}
        </ul>
        {run && (
          <section className="panel tr-run">
            <header><span className="tag">{KIND[run.kind] ?? run.kind} · {run.who ?? ""} · {run.steps.length} steps · {run.ms} ms</span><h2 className="panel-h">{run.input || run.kind}</h2></header>
            <ol className="tr-steps">{run.steps.map((s, i) => <Step key={i} s={s} />)}</ol>
          </section>
        )}
      </div>
      <p className="tiny muted tr-legend">{Object.values(TYPE).map(([l, c, d]) => <span key={l}><i style={{ background: c }} />{l}: {d}</span>)}</p>
    </div>
  );
}
