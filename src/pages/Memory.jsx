import { useEffect, useState } from "react";
import { memory, retrieve } from "../memory.js";

const KINDS = [["note", "Note"], ["goal", "Goal"], ["body", "Body / injury"], ["routine", "Routine"], ["preference", "Preference"]];

export default function Memory() {
  const [list, setList] = useState(memory.all());
  const [text, setText] = useState("");
  const [kind, setKind] = useState("note");
  const [q, setQ] = useState("knee jump training");
  useEffect(() => memory.subscribe(setList), []);
  const hits = q.trim() ? retrieve(q, 3, list) : [];

  return (
    <div className="page memory">
      <header className="report-head">
        <div>
        <span className="tag">Player memory · RAG</span>
        <h1 className="h1">What your coaches remember about you</h1>
        <p className="muted">Goals, injuries, routines and past sessions. Every coach retrieves the most relevant entries before it answers,
          so advice adapts to you over time. Stored on this device only.</p>
        </div>
      </header>

      <div className="mem-grid">
        <section className="panel">
          <h2 className="panel-h">Add a memory</h2>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4}
            placeholder="e.g. Left shoulder tight after smashing practice" />
          <div className="mem-row">
            <div className="seg" role="radiogroup" aria-label="Memory type">
              {KINDS.map(([k, l]) => <button key={k} role="radio" aria-checked={kind === k} onClick={() => setKind(k)}>{l}</button>)}
            </div>
            <button className="btn primary" disabled={!text.trim()} onClick={() => { memory.add(text, kind); setText(""); }}>Save</button>
          </div>

          <h2 className="panel-h mem-try">Try retrieval</h2>
          <input className="mem-q" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Retrieval query" />
          <ol className="mem-hits">
            {hits.map(({ m, score }) => <li key={m.id}><span className="mono">{score.toFixed(2)}</span>{m.text}</li>)}
            {!hits.length && <li className="muted">No matching memory.</li>}
          </ol>
          <p className="tiny muted">Prototype retrieval: TF-IDF over words and Chinese character pairs. Stage II swaps in a local embedding model and vector store on the B70.</p>
        </section>

        <section className="panel">
          <div className="mem-head">
            <h2 className="panel-h">Memory ({list.length})</h2>
            <button className="link" onClick={() => memory.reset()}>Reset to demo</button>
          </div>
          <ul className="mem-list">
            {list.map((m) => (
              <li key={m.id}>
                <span className={`mem-kind k-${m.kind}`}>{m.kind}</span>
                <p>{m.text}</p>
                <span className="tiny muted">{new Date(m.at).toLocaleDateString()} · {m.source}</span>
                <button className="icon-btn" aria-label="Delete memory" onClick={() => memory.remove(m.id)}>×</button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
