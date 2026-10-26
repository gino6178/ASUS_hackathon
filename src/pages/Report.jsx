import { useMemo, useRef, useState } from "react";
import RallyPlayer from "../components/RallyPlayer.jsx";
import Court3D from "../components/Court3D.jsx";
import SpeedChart from "../components/SpeedChart.jsx";
import CourtMap from "../components/CourtMap.jsx";
import Agents from "../components/Agents.jsx";
import Sparring from "../components/Sparring.jsx";
import BodyMap from "../components/BodyMap.jsx";
import Heatmaps from "../components/Heatmaps.jsx";
import { bestBase, simulate, speedColor, zoneName } from "../data.js";
import { go } from "../App.jsx";

const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export default function Report({ data, video }) {
  const [frame, setFrame] = useState(0);
  const [hl, setHl] = useState(null); // highlighted stroke ids on the landing map
  const seek = useRef(null);

  const ctx = useMemo(() => {
    if (!data) return null;
    const ins = data.insights, shots = ins.oppAttack;
    const best = bestBase(shots, "attacker");
    const cur = simulate(shots, "attacker", ins.base).rate;
    const check = { cur: simulate(shots, "attacker", ins.base, 2000, 99).rate, best: simulate(shots, "attacker", best.base, 2000, 99).rate };
    return { ins, rally: data.rally, players: { near: "you", far: "your opponent" }, sim: { best, cur, check } };
  }, [data]);

  if (!data) return <div className="page"><p className="muted">Loading the analysis…</p></div>;
  const { rally, match, insights: ins } = data;
  const cur = rally.strokes.filter((s) => s.f0 <= frame).pop() ?? rally.strokes[0];
  const sp = rally.speed[frame];
  const smashes = match.strokes.filter((s) => /Smash/.test(s.type));
  const maxType = match.types[0];

  const mapPts = (hl ? match.strokes.filter((s) => hl.includes(s.id)) : ins.oppSmash).map((s) => ({
    xy: s.land, c: hl ? "var(--accent)" : "var(--far)", r: hl ? 5 : 3.4, o: hl ? .95 : .55,
  }));

  const onEvidence = (e) => {
    if (e.frame != null) { seek.current?.(e.frame); document.getElementById("replay")?.scrollIntoView({ behavior: "smooth" }); }
    if (e.ids) { setHl(e.ids.length > 1 ? e.ids : (hl?.includes(e.ids[0]) ? null : e.ids)); document.getElementById("patterns")?.scrollIntoView({ behavior: "smooth" }); }
    if (e.anchor) document.getElementById(e.anchor)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="page report">
      {video && (
        <div className="notice" role="note">
          <b>Demo mode.</b> “{video.name}” was opened locally and never uploaded. This prototype does not run the models on new videos yet,
          so the report below shows the precomputed sample match.
        </div>
      )}
      <header className="report-head">
        <div>
          <span className="tag">Match report · {data.event}</span>
          <h1 className="h1">{data.players.near} <span className="vs">vs</span> {data.players.far}</h1>
          <p className="muted">Coaching the near-side player · rally {data.rallyId} replayed in 3D · {match.n} shots in the match database</p>
        </div>
        <button className="btn ghost" onClick={() => go("analyze")}>Analyze another video</button>
      </header>

      <section id="replay" className="block">
        <div className="replay-grid">
          <RallyPlayer rally={rally} src="/media/sample_rally.mp4" onFrame={setFrame} seekRef={seek} />
          <div className="court-wrap">
            <Court3D rally={rally} frame={frame} interactive />
            <span className="hud-tag mono">3D reconstruction · drag to orbit</span>
          </div>
        </div>
        <div className="telemetry">
          <div><span>Shot</span><b>{cur.i + 1}<small>/{rally.strokes.length}</small></b></div>
          <div><span>Stroke</span><b className={cur.hitter}>{cur.type}</b></div>
          <div><span>Shuttle now</span><b className="mono" style={{ color: sp != null ? speedColor(sp) : undefined }}>{sp != null ? Math.round(sp) : "–"}<small> km/h</small></b></div>
          <div><span>Launch</span><b className="mono">{Math.round(cur.v0)}<small> km/h</small></b></div>
          <div><span>Apex</span><b className="mono">{cur.apex}<small> m</small></b></div>
          <div><span>Contact height</span><b className="mono">{cur.contact[2]}<small> m</small></b></div>
          <div><span>Flight</span><b className="mono">{cur.flight}<small> s</small></b></div>
        </div>
        <SpeedChart rally={rally} frame={frame} onSeek={(f) => seek.current?.(f)} />
        <ol className="strip">
          {rally.strokes.map((s) => (
            <li key={s.i}>
              <button className={`stroke ${s.hitter} ${s.i === cur.i ? "on" : ""}`} onClick={() => seek.current?.(s.f0)}>
                <span className="mono">{fmtT(s.t0)}</span>
                <b>{s.type}</b>
                <span className="mono" style={{ color: speedColor(s.v0) }}>{Math.round(s.v0)} km/h</span>
              </button>
            </li>
          ))}
        </ol>
        <p className="tiny muted legend"><i className="lg near" /> near-side player <i className="lg far" /> far-side player · speeds are estimated from the reconstructed 3D track (frame-to-frame displacement × 30 fps, 3-frame smoothing)</p>
      </section>

      <section id="patterns" className="block">
        <header className="sec-head"><span className="tag">Match patterns</span><h2>Where the points are decided</h2></header>
        <div className="kpis">
          <div><b className="mono">{match.n}</b><span>shots reconstructed</span></div>
          <div><b className="mono">{smashes.length}</b><span>smashes</span></div>
          <div><b className="mono">{ins.oppSmash.length}</b><span>smashes into your half</span></div>
          <div><b className="mono">{Math.round((100 * ins.short.length) / ins.lifts.length)}%</b><span>of your lifts and clears landed in front of the back service line</span></div>
        </div>
        <div className="pattern-grid">
          <div className="panel">
            <h3 className="panel-h">{hl ? `Cited strokes (${hl.length})` : "Opponent smashes landing in your half"}</h3>
            <CourtMap half="near" points={mapPts} label="Landing points on your half" />
            <p className="tiny muted">{hl ? <button className="link" onClick={() => setHl(null)}>Show all smashes again</button>
              : <>Most targeted: <b>{zoneName(ins.topZone.key)}</b> ({ins.topZone.n} of {ins.oppSmash.length})</>}</p>
          </div>
          <div className="panel">
            <h3 className="panel-h">Stroke mix and average horizontal speed</h3>
            <ul className="bars">
              {match.types.slice(0, 9).map((t) => (
                <li key={t.type}>
                  <span>{t.type}</span>
                  <i style={{ width: `${(t.n / maxType.n) * 100}%` }} />
                  <b className="mono">{t.n}</b>
                  <em className="mono">{Math.round(t.vh_med)} km/h</em>
                </li>
              ))}
            </ul>
            <p className="tiny muted">Average horizontal speed = landing distance ÷ flight time, median per stroke type.</p>
          </div>
        </div>
      </section>

      <section id="heat" className="block">
        <header className="sec-head"><span className="tag">Heat zones</span><h2>Where you score, and where you get beaten</h2></header>
        <Heatmaps outcomes={data.outcomes} names={data.names} />
      </section>

      <section id="coach" className="block">
        <header className="sec-head"><span className="tag">Coaching staff</span><h2>Ask your agents</h2></header>
        <Agents ctx={ctx} onEvidence={onEvidence} />
      </section>

      <section id="body" className="block">
        <header className="sec-head"><span className="tag">Body focus</span><h2>What to strengthen, and why</h2>
          <p className="muted">Each highlighted area is loaded by a finding from this match. Click a body part to see the evidence and the drills.</p></header>
        <BodyMap ins={ins} rally={rally} />
      </section>

      <section id="sparring" className="block">
        <header className="sec-head"><span className="tag">Sparring simulator</span><h2>Test a base position before you train it</h2></header>
        <Sparring shots={ins.oppAttack} start={ins.base} />
      </section>
    </div>
  );
}
