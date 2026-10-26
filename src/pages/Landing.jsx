import Court3D from "../components/Court3D.jsx";
import { go } from "../App.jsx";

const STEPS = [
  ["01", "Record", "Any fixed camera behind the court. A phone on a tripod is enough."],
  ["02", "Reconstruct", "The shuttle's flight in metric 3D, every hit, both players' positions."],
  ["03", "Measure", "Launch speed, apex, landing zone and stroke type for every shot."],
  ["04", "Coach", "Five local agents turn the numbers into positioning advice and a drill plan."],
];

const AGENTS = [
  ["Head Coach", "Splits your question, assigns the work, merges one answer."],
  ["Stats Analyst", "Queries the match database. Reports only what it finds."],
  ["Positioning", "Finds coverage gaps and tests a better base in the simulator."],
  ["Training Planner", "Turns the weak zone into a weekly drill plan with targets."],
  ["Evidence Verifier", "Re-runs every count. No citation, no claim."],
];

export default function Landing({ data }) {
  const rally = data?.rally;
  const top = rally ? Math.max(...rally.strokes.map((s) => s.v0)) : 200;
  const apex = rally ? Math.max(...rally.strokes.map((s) => s.apex)) : 4.65;
  return (
    <div className="landing">
      <section className="hero">
        <Court3D rally={rally} loop autoRotate variant="hero" className="hero-court" />
        <div className="hero-shade" aria-hidden="true" />
        <div className="hero-copy">
          <p className="eyebrow">Private badminton intelligence</p>
          <h1 className="display">Shuttle<br />Coach</h1>
          <p className="lead">One camera in. A coaching staff out. Every frame, every 3D flight and every word of advice is computed on this machine.</p>
          <div className="cta-row">
            <button className="btn primary" onClick={() => go("analyze")}>Analyze a match</button>
            <button className="btn ghost" onClick={() => go("coaches")}>Meet the coaches</button>
          </div>
        </div>
        <dl className="hud hud-right" aria-label="Sample rally telemetry">
          <div><dt>Peak launch</dt><dd>{Math.round(top)} <small>km/h</small></dd></div>
          <div><dt>Highest apex</dt><dd>{apex.toFixed(2)} <small>m</small></dd></div>
          <div><dt>Shots</dt><dd>{rally?.strokes.length ?? 9}</dd></div>
          <div><dt>Network</dt><dd className="ok">none</dd></div>
        </dl>
        <p className="hud hud-left">Live 3D reconstruction · sample rally · {data?.event ?? ""}</p>
      </section>

      <section className="band">
        <header className="sec-head"><span className="tag">01 · How it works</span><h2>From a phone video to a training plan</h2></header>
        <ol className="steps">
          {STEPS.map(([n, h, b]) => (
            <li key={n}><span className="mono step-n">{n}</span><h3>{h}</h3><p>{b}</p></li>
          ))}
        </ol>
      </section>

      <section className="band split">
        <header className="sec-head"><span className="tag">02 · Measured, not guessed</span><h2>Built on perception research we have already validated</h2>
          <p className="muted">The hard part, metric 3D from a single camera, is done and tested against an independent 10-camera capture.</p></header>
        <div className="stats">
          {[["0.42 m", "median 3D shuttle error vs. a 10-camera reference"], ["95.9%", "of 6,553 real strokes obey every court rule"],
            ["400 ms", "stroke-type anticipation before contact, 27 fps"], ["98.1", "2D shuttle-tracking F1"]].map(([n, l]) => (
            <div className="stat" key={n}><b>{n}</b><span>{l}</span></div>
          ))}
        </div>
      </section>

      <section className="band">
        <header className="sec-head"><span className="tag">03 · Agents</span><h2>A coaching staff of five, running locally</h2></header>
        <div className="agents-row">
          {AGENTS.map(([h, b], i) => (
            <article key={h} className="agent-card"><span className={`agent-dot a${i}`} aria-hidden="true" /><h3>{h}</h3><p>{b}</p></article>
          ))}
        </div>
      </section>

      <section className="band split">
        <header className="sec-head"><span className="tag">04 · Sparring simulator</span><h2>Advice is tested before it is given</h2>
          <p className="muted">Opponent styles are learned from professional rallies. Move your base, replay thousands of rallies, keep the change only if fewer points are lost.</p>
          <button className="btn ghost" onClick={() => go("report")}>Try it on the sample match</button></header>
        <div className="privacy">
          <h3>Private by design</h3>
          <ul>
            <li><b>Offline.</b> No account, no cloud API. Unplug the network and it still works.</li>
            <li><b>Your video stays here.</b> Files are opened by the browser; nothing is uploaded.</li>
            <li><b>Share insights, not footage.</b> Reports contain numbers and drawings only.</li>
          </ul>
        </div>
      </section>

      <footer className="foot">
        <span>ShuttleCoach · ASUS UGen AI League 2026 · Battlefield Thunderstorm (Intel Arc Pro B70 32GB)</span>
        <span className="muted">Prototype: language models are not connected; agent answers are generated from the precomputed match data.</span>
      </footer>
    </div>
  );
}
