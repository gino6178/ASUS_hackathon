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
          <p className="muted">Four specialist coaches and a head coach run on this machine. Each one reads the match, recalls what it knows about you, and explains its findings on the visual it owns. Together they meet at the round table.</p>
        </div>
      </header>
      <button className="rt-banner" onClick={() => go("roundtable")}>
        <span className="rt-faces">{COACHES.map((c) => <Avatar key={c.id} coach={c} size={56} />)}</span>
        <span>
          <b>Call a round table</b>
          <span className="muted">The whole staff debates your match, settles conflicts against your memory, and agrees four goals and a 7-day plan.</span>
        </span>
        <span className="btn primary">Start meeting</span>
      </button>
      <div className="coach-grid">
        {COACHES.map((c) => (
          <button key={c.id} className="coach-card" style={{ "--cc": c.color }} onClick={() => go(`coach/${c.id}`)}>
            <Avatar coach={c} size={120} />
            <span className="cc-zh">{c.kicker}</span>
            <b>{c.name}</b>
            <span className="cc-role">{c.role}</span>
            <p>{c.blurb}</p>
            <span className="cc-go">Start session →</span>
          </button>
        ))}
      </div>
      <div className="coach-links">
        <button className="btn ghost" onClick={() => go("match")}>Open the match analysis</button>
        <button className="btn ghost" onClick={() => go("memory")}>Player memory</button>
      </div>
    </div>
  );
}
