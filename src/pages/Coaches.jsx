import { COACHES } from "../coaches/personas.js";
import Avatar from "../coaches/Avatar.jsx";
import { go } from "../App.jsx";

export default function Coaches({ data, video }) {
  return (
    <div className="page coaches">
      {video && <div className="notice" role="note"><b>Demo mode.</b> “{video.name}” stayed on this device. The coaches below analyse the precomputed sample match.</div>}
      <header className="report-head">
        <div>
        <span className="tag">Your coaching staff · {data?.event ?? ""}</span>
        <h1 className="h1">Who do you want to talk to?</h1>
        <p className="muted">Four specialist agents run on this machine. Each one reads the match database, retrieves what it remembers about you, and explains its findings on the visual it owns.</p>
        </div>
      </header>
      <div className="coach-grid">
        {COACHES.map((c) => (
          <button key={c.id} className="coach-card" style={{ "--cc": c.color }} onClick={() => go(`coach/${c.id}`)}>
            <Avatar coach={c} size={132} />
            <span className="cc-zh">{c.kicker}</span>
            <b>{c.name}</b>
            <span className="cc-role">{c.role}</span>
            <p>{c.blurb}</p>
            <span className="cc-go">Start session →</span>
          </button>
        ))}
      </div>
      <button className="rt-banner" onClick={() => go("roundtable")}>
        <span className="rt-faces">{COACHES.map((c) => <Avatar key={c.id} coach={c} size={54} />)}</span>
        <span><b>Call a round table</b><span className="muted">All four coaches debate your match together and agree a training plan with a weekly schedule.</span></span>
        <span className="cc-go">Start meeting →</span>
      </button>
      <div className="coach-links">
        <button className="btn ghost" onClick={() => go("match")}>Open the match analysis</button>
        <button className="btn ghost" onClick={() => go("memory")}>Player memory</button>
      </div>
    </div>
  );
}
