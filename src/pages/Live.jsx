import { useEffect, useMemo, useRef, useState } from "react";
import { loadMatches, ownError, ownWinner } from "../match/analytics.js";
import { zoneOf } from "../coaches/analysis.js";
import RallyClip from "../match/RallyClip.jsx";
import CourtMap from "../components/CourtMap.jsx";
import { COACHES } from "../coaches/personas.js";
import Avatar from "../coaches/Avatar.jsx";

// Live mode: the recorded rallies are streamed one after another as if from the court camera. Shots, score,
// heat map and coach alerts update as each shot and rally happens. (Prototype: replay of a recorded match.)
const coach = (id) => COACHES.find((c) => c.id === id);
const ME = "A";

function alertsFor(m, done) {
  const r = done[done.length - 1], out = [];
  const last = (k) => done.slice(-k);
  const name = m.names;
  if (last(3).length === 3 && last(3).every((x) => x.winner !== ME))
    out.push({ c: "tactics", t: `Three points in a row to ${name.B}. Slow it down: lift deep to the backhand corner and reset.` });
  const beaten = done.filter((x) => ownWinner(x, "B")).slice(-4).map((x) => x.shots[x.shots.length - 1].land).filter(Boolean)
    .map((xy) => zoneOf(xy[1] < 6.7 ? [6.1 - xy[0], 13.4 - xy[1]] : xy, "near"));
  const z = beaten[beaten.length - 1];
  if (ownWinner(r, "B") && beaten.filter((x) => x === z).length >= 2) out.push({ c: "tactics", t: `${name.B} has now hit ${beaten.filter((x) => x === z).length} of the last ${beaten.length} winners into your ${z}. Cover it earlier.` });
  if (r.shots.length >= 15) out.push({ c: "fitness", t: `${r.shots.length}-shot rally. Take your full time between points and breathe out slowly.` });
  const errs = last(4).filter((x) => ownError(x, ME));
  if (ownError(r, ME) && errs.length >= 2) out.push({ c: "technique", t: `${errs.length} own errors in the last 4 rallies (${errs.map((x) => x.reason).join(", ")}). Add margin: aim higher over the tape and further inside the lines.` });
  if (Math.max(...r.score) >= 19) {
    const serves = done.flatMap((x) => x.shots.filter((s) => s.p === "B" && /serve/.test(s.type)));
    const short = serves.filter((s) => s.type === "Short serve").length;
    out.push({ c: "analyst", t: `Closing stage. ${name.B} serves short ${Math.round(100 * short / Math.max(1, serves.length))}% of the time; be ready at the front.` });
  }
  return out;
}

export default function Live() {
  const [d, setD] = useState(null);
  const [i, setI] = useState(0);
  const [running, setRunning] = useState(true);
  const [rate, setRate] = useState(1);
  const [feed, setFeed] = useState([]);
  const clip = useRef(null);
  useEffect(() => { loadMatches().then(setD); }, []);
  useEffect(() => { const v = clip.current?.video; if (v) { v.playbackRate = rate; running ? v.play().catch(() => {}) : v.pause(); } }, [rate, running, i]);
  const m = d?.matches[0];
  const done = useMemo(() => (m ? m.rallies.slice(0, i) : []), [m, i]);
  if (!m) return <div className="page"><p className="muted">Connecting to the court camera…</p></div>;
  const r = m.rallies[i];
  const games = { A: 0, B: 0 };
  [1, 2, 3].forEach((s) => { const rs = done.filter((x) => x.set === s); const last = rs[rs.length - 1]; if (last && s < r.set) games[last.score[0] > last.score[1] ? "A" : "B"]++; });
  const prevInSet = done.filter((x) => x.set === r.set);
  const score = prevInSet.length ? prevInSet[prevInSet.length - 1].score : [0, 0];
  const stat = (p) => ({ w: done.filter((x) => ownWinner(x, p)).length, e: done.filter((x) => ownError(x, p)).length });
  const lands = done.flatMap((x) => x.shots.filter((s) => s.land && s.p === "B").map((s) => s.land));

  const next = () => {
    const now = [...done, r];
    const al = alertsFor(m, now).map((a) => ({ ...a, id: `${r.i}-${a.c}`, at: `G${r.set} ${r.score[0]}–${r.score[1]}` }));
    if (al.length) setFeed((f) => [...al, ...f].slice(0, 8));
    if (i + 1 < m.rallies.length) setTimeout(() => setI(i + 1), 900);
    else setRunning(false);
  };

  return (
    <div className="page live">
      <header className="live-head">
        <span className="live-badge"><i /> LIVE</span>
        <h1 className="h1">{m.names.A} <span className="vs">vs</span> {m.names.B}</h1>
        <div className="live-ctl">
          <button className="btn ghost" onClick={() => setRunning(!running)}>{running ? "Pause" : "Resume"}</button>
          {[1, 2].map((x) => <button key={x} className={`btn ghost ${rate === x ? "on" : ""}`} onClick={() => setRate(x)}>{x}×</button>)}
          <select value={i} onChange={(e) => { setFeed([]); setI(+e.target.value); }} aria-label="Jump to rally">
            {m.rallies.map((x) => <option key={x.i} value={x.i}>Game {x.set} · rally {x.rally}</option>)}
          </select>
        </div>
      </header>
      <div className="live-grid">
        <div>
          <RallyClip ref={clip} rally={r} names={m.names} onEnded={next} minimap={false} live />
          <div className="live-hud mono">
            <span>court cam 1080p30</span><span>tracker 27 fps</span><span>shot → stats &lt; 0.3 s</span><span className="ok">network: none</span>
          </div>
          <p className="tiny muted">Prototype: recorded rallies streamed as if live. In Stage II the same view runs on the B70 from the court camera.</p>
        </div>
        <aside className="live-side">
          <div className="scoreboard">
            {["A", "B"].map((p) => (
              <div key={p} className={p === "A" ? "me" : ""}>
                <span>{m.names[p]}</span><b className="mono">{games[p]}</b><strong className="mono">{score[p === "A" ? 0 : 1]}</strong>
              </div>
            ))}
            <p className="tiny muted">Game {r.set} · rally {done.length + 1} of {m.rallies.length}</p>
          </div>
          <div className="live-stats">
            {["A", "B"].map((p) => { const s = stat(p); return <div key={p}><span>{m.names[p].split(" ")[0]}</span><b className="mono">{s.w}</b><em>winners</em><b className="mono">{s.e}</b><em>errors</em></div>; })}
          </div>
          <div className="panel live-map">
            <h3 className="panel-h">Opponent's landings so far</h3>
            <CourtMap half="full" points={lands.map((xy) => ({ xy, c: "var(--far)", r: 3, o: .6 }))} label="Opponent landings" />
          </div>
          <div className="live-feed" aria-live="polite">
            <h3 className="panel-h">Coach alerts</h3>
            {!feed.length && <p className="tiny muted">Coaches speak up when a pattern appears.</p>}
            {feed.map((a) => (
              <div key={a.id} className="alert" style={{ "--cc": coach(a.c).color }}>
                <Avatar coach={coach(a.c)} size={36} />
                <div><b>{coach(a.c).name} · <span className="mono">{a.at}</span></b><p>{a.t}</p></div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
