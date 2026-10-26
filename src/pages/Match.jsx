import { useEffect, useMemo, useRef, useState } from "react";
import { loadMatches, scoreFlow, pointStats, patterns, footwork, fatigue, profile, sideOf, ownError, pct } from "../match/analytics.js";
import { LineChart, Bars, Kpi } from "../match/charts.jsx";
import RallyClip from "../match/RallyClip.jsx";
import Annotator from "../match/Annotator.jsx";
import CourtMap, { heatGrid } from "../components/CourtMap.jsx";
import { go } from "../App.jsx";

const TABS = [["flow", "Score flow"], ["points", "Points won & lost"], ["patterns", "Shot sequences"], ["rallies", "Rallies & highlights"],
  ["footwork", "Footwork & reads"], ["fatigue", "Fatigue"], ["compare", "Match comparison"]];
const f1 = (v) => v.toFixed(1), f2 = (v) => v.toFixed(2);

export default function Match() {
  const [d, setD] = useState(null);
  const [tab, setTab] = useState(() => location.hash.split("?tab=")[1] || "flow");
  const [who, setWho] = useState("A");
  useEffect(() => { loadMatches().then(setD); }, []);
  if (!d) return <div className="page"><p className="muted">Loading the match…</p></div>;
  const m = d.matches[0];
  return (
    <div className="page match">
      <header className="report-head">
        <div>
          <span className="tag">Match analysis · {m.event}</span>
          <h1 className="h1">{m.names.A} <span className="vs">vs</span> {m.names.B}</h1>
          <p className="muted">{m.rallies.length} labelled rallies, every shot with type, landing and both players' positions · a few rallies are missing from the annotation</p>
        </div>
        <div className="cta-row">
          <button className="btn primary" onClick={() => go("live")}>Live mode</button>
          <button className="btn ghost" onClick={() => go("scout")}>Scouting report</button>
        </div>
      </header>
      <div className="tabs" role="tablist">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
        {["points", "patterns", "footwork", "fatigue"].includes(tab) && (
          <div className="seg tabs-who" role="radiogroup" aria-label="Player">
            {["A", "B"].map((k) => <button key={k} role="radio" aria-checked={who === k} onClick={() => setWho(k)}>{m.names[k]}</button>)}
          </div>
        )}
      </div>
      {tab === "flow" && <Flow m={m} />}
      {tab === "points" && <Points m={m} p={who} />}
      {tab === "patterns" && <Patterns m={m} p={who} />}
      {tab === "rallies" && <Rallies m={m} />}
      {tab === "footwork" && <Footwork m={m} p={who} />}
      {tab === "fatigue" && <Fatigue m={m} p={who} />}
      {tab === "compare" && <Compare d={d} />}
    </div>
  );
}

function Flow({ m }) {
  const { sets, runs } = scoreFlow(m);
  return (
    <section className="mgrid">
      {Object.entries(sets).map(([s, rs]) => {
        const last = rs[rs.length - 1];
        return (
          <div key={s} className="panel">
            <h3 className="panel-h">Game {s} · {last.score[0]}–{last.score[1]}</h3>
            <LineChart n={rs.length} label={`Score difference in game ${s}`} zero={0} yFmt={(v) => (v > 0 ? "+" : "") + v.toFixed(0)}
              series={[{ label: "diff", color: "var(--accent)", values: rs.map((r) => r.score[0] - r.score[1]), dots: true, dotColor: (i) => (rs[i].winner === "A" ? "var(--near)" : "var(--far)") }]} height={190} />
            <p className="tiny muted">Above zero: {m.names.A} leads. Dots: who won each rally.</p>
          </div>
        );
      })}
      <div className="panel">
        <h3 className="panel-h">Momentum</h3>
        <div className="kpis-sm">
          <Kpi v={runs.A} l={`longest run · ${m.names.A}`} /><Kpi v={runs.B} l={`longest run · ${m.names.B}`} />
          <Kpi v={`${pointStats(m, "A").clutchWin}%`} l={`${m.names.A} wins at 18+`} /><Kpi v={`${pointStats(m, "B").clutchWin}%`} l={`${m.names.B} wins at 18+`} />
        </div>
      </div>
    </section>
  );
}

function Points({ m, p }) {
  const s = pointStats(m, p), o = p === "A" ? "B" : "A";
  return (
    <section className="mgrid">
      <div className="panel span2">
        <div className="kpis-sm">
          <Kpi v={`${s.won}–${s.lost}`} l="points won–lost" /><Kpi v={s.winners.reduce((a, [, n]) => a + n, 0)} l="winners hit" />
          <Kpi v={s.errorReasons.reduce((a, [, n]) => a + n, 0)} l="own errors" tone="bad" /><Kpi v={s.oppErrors.reduce((a, [, n]) => a + n, 0)} l={`errors by ${m.names[o]}`} />
          <Kpi v={`${s.serveWin}%`} l="won on serve" /><Kpi v={`${s.recvWin}%`} l="won on receive" />
        </div>
      </div>
      <div className="panel"><h3 className="panel-h">How points were won</h3>
        <Bars rows={[...s.winners.map(([k, v]) => ({ k: `${k} winner`, v, c: "var(--good)" })), ...s.oppErrors.map(([k, v]) => ({ k: `opponent ${k}`, v }))]} /></div>
      <div className="panel"><h3 className="panel-h">How points were lost</h3>
        <Bars rows={[...s.oppWinners.map(([k, v]) => ({ k: `${k} by opponent`, v, c: "var(--bad)" })), ...s.errors.slice(0, 6).map(([k, v]) => ({ k, v, c: "#c96a5c" }))]} /></div>
      <div className="panel span2"><h3 className="panel-h">Win rate by rally length</h3>
        <Bars rows={s.byLen.map((b) => ({ k: b.b, v: b.w, note: `${b.n} rallies` }))} max={100} fmt={(v) => v + "%"} /></div>
    </section>
  );
}

function Patterns({ m, p }) {
  const t = patterns(m, p);
  const table = (rows, title) => (
    <div className="panel"><h3 className="panel-h">{title}</h3>
      <table className="ptable"><thead><tr><th>Sequence</th><th>Times</th><th>Rally won</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.k}><td>{r.k}</td><td className="mono">{r.n}</td><td className={`mono ${r.w >= 60 ? "good" : r.w <= 40 ? "bad" : ""}`}>{r.w}%</td></tr>)}</tbody></table></div>
  );
  return (
    <section className="mgrid">
      {table(t.pairs, `${m.names[p]}'s shot → opponent reply (most frequent)`)}
      <div className="stack">
        {table(t.best, "Three-shot patterns that win (4+ times)")}
        {table(t.worst, "Three-shot patterns that lose (4+ times)")}
      </div>
    </section>
  );
}

function Rallies({ m }) {
  const [f, setF] = useState({ set: 0, res: "all", len: "all", end: "all" });
  const [cur, setCur] = useState(0);
  const [queue, setQueue] = useState(null);
  const [annot, setAnnot] = useState(false);
  const clip = useRef(null);
  const rs = m.rallies.filter((r) => (!f.set || r.set === f.set) && (f.res === "all" || (f.res === "won" ? r.winner === "A" : r.winner === "B"))
    && (f.len === "all" || (f.len === "short" ? r.shots.length <= 4 : f.len === "long" ? r.shots.length >= 10 : r.shots.length > 4 && r.shots.length < 10))
    && (f.end === "all" || (f.end === "winner" ? r.reason === "winner" : r.reason !== "winner")));
  const r = m.rallies[cur];
  const next = () => { if (!queue) return; const q = queue.slice(1); setQueue(q.length ? q : null); if (q.length) setCur(q[0]); };
  const seg = (k, opts) => (
    <div className="seg" role="radiogroup" aria-label={k}>{opts.map(([v, l]) => <button key={l} role="radio" aria-checked={f[k] === v} onClick={() => setF({ ...f, [k]: v })}>{l}</button>)}</div>
  );
  return (
    <section className="rallies">
      <div className="rfilters">
        {seg("set", [[0, "All games"], [1, "Game 1"], [2, "Game 2"], [3, "Game 3"]])}
        {seg("res", [["all", "All"], ["won", `${m.names.A.split(" ")[0]} won`], ["lost", `${m.names.A.split(" ")[0]} lost`]])}
        {seg("len", [["all", "Any length"], ["short", "1–4"], ["mid", "5–9"], ["long", "10+"]])}
        {seg("end", [["all", "Any end"], ["winner", "Winners"], ["error", "Errors"]])}
        <button className="btn primary" disabled={!rs.length} onClick={() => { setQueue(rs.map((x) => x.i)); setCur(rs[0].i); }}>▶ Play reel ({rs.length})</button>
      </div>
      <div className="rgrid">
        <div>
          <RallyClip ref={clip} rally={r} names={m.names} onEnded={next} minimap>
            {annot && <Annotator clip={r.clip} videoRef={clip} onClose={() => setAnnot(false)} />}
          </RallyClip>
          <div className="rclip-actions">
            {queue && <span className="tag">Reel · {queue.length} left</span>}
            <button className="btn ghost" onClick={() => setAnnot(true)} disabled={annot}>✎ Annotate frame</button>
          </div>
        </div>
        <ol className="rlist">
          {rs.map((x) => (
            <li key={x.i}><button className={`${x.i === cur ? "on" : ""} ${x.winner === "A" ? "w" : "l"}`} onClick={() => { setQueue(null); setCur(x.i); }}>
              <span className="mono">G{x.set} · {x.score[0]}–{x.score[1]}</span>
              <b>{x.shots.length} shots</b>
              <span>{x.reason === "winner" ? `${x.lastType} winner` : `${x.lastType} ${x.reason}`} · {m.names[x.lastBy].split(" ")[0]}</span>
            </button></li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Footwork({ m, p }) {
  const fw = footwork(m, p);
  const reads = fw.reads.filter((r) => r.v > 3.5);
  return (
    <section className="mgrid">
      <div className="panel span2">
        <div className="kpis-sm">
          <Kpi v={`${(fw.totalMove / 1000).toFixed(2)} km`} l="covered between own shots" /><Kpi v={`${f2(fw.perShot)} m`} l="moved per shot" />
          <Kpi v={`${f2(fw.recovery)} m`} l="from base when the opponent strikes" /><Kpi v={`${f2(fw.reqSpeed)} m/s`} l="speed needed to reach the shuttle" />
          <Kpi v={`${fw.stretched}%`} l="shots that needed > 3.5 m/s" tone={fw.stretched > 20 ? "bad" : ""} />
        </div>
      </div>
      <div className="panel">
        <h3 className="panel-h">Which opponent shots stretch {m.names[p]}</h3>
        <table className="ptable"><thead><tr><th>Opponent shot</th><th>Time</th><th>Distance</th><th>Needed</th><th>With TELL +0.4 s</th></tr></thead>
          <tbody>{fw.byType.map((r) => <tr key={r.t}><td>{r.t}</td><td className="mono">{f2(r.dt)} s</td><td className="mono">{f2(r.d)} m</td>
            <td className={`mono ${r.v > 3 ? "bad" : ""}`}>{f2(r.v)} m/s</td><td className="mono good">{f2(r.vEarly)} m/s</td></tr>)}</tbody></table>
        <p className="tiny muted">Read and react: time from the opponent's contact to {m.names[p]}'s next contact, distance covered in that time. The last column is a what-if: the speed needed if our stroke-anticipation model (TELL, 400 ms before contact) gave the warning earlier. TELL itself is integrated in Stage II.</p>
      </div>
      <div className="panel">
        <h3 className="panel-h">Where the stretched reaches started</h3>
        <CourtMap half="near" label="Positions when the opponent struck, for shots needing more than 3.5 m/s"
          heat={heatGrid(reads.map((r) => r.from), "near", .5)} heatColor="#ff5f56" />
        <p className="tiny muted">Heat: where {m.names[p]} stood at the opponent's contact on the hardest-to-reach shots.</p>
      </div>
    </section>
  );
}
function Fatigue({ m, p }) {
  const fa = fatigue(m, p);
  const marks = fa.series.map((x, i) => (i && x.set !== fa.series[i - 1].set ? { i, label: `Game ${x.set}` } : null)).filter(Boolean);
  const change = (o, lowerIsBetter = true) => {
    const d = (o.late - o.early) / (o.early || 1) * 100;
    const bad = lowerIsBetter ? d > 5 : d < -5;
    return <span className={bad ? "bad" : Math.abs(d) <= 5 ? "" : "good"}>{d > 0 ? "+" : ""}{d.toFixed(0)}%</span>;
  };
  return (
    <section className="mgrid">
      <div className="panel span2">
        <h3 className="panel-h">First third vs last third of the match</h3>
        <div className="kpis-sm">
          <Kpi v={<>{f2(fa.rec.early)} → {f2(fa.rec.late)} m {change(fa.rec)}</>} l="distance from base at opponent contact" />
          <Kpi v={<>{f2(fa.req.early)} → {f2(fa.req.late)} m/s {change(fa.req)}</>} l="speed needed to reach the shuttle" />
          <Kpi v={<>{f2(fa.tempo.early)} → {f2(fa.tempo.late)} s {change(fa.tempo, false)}</>} l="time between shots" />
          <Kpi v={<>{pct(fa.err.early * 100, 100)} → {pct(fa.err.late * 100, 100)}% </>} l="rallies ending in own error" />
        </div>
        <p className="tiny muted">Rolling 10-rally averages below. A tiring player recovers less (distance from base rises), needs more speed and makes more errors; a shorter time between shots means the rally is getting faster.</p>
      </div>
      <div className="panel"><h3 className="panel-h">Recovery: distance from base (m)</h3>
        <LineChart n={fa.series.length} marks={marks} label="Recovery distance" series={[{ label: "rec", color: "var(--near)", values: fa.rollRec }]} yFmt={f2} /></div>
      <div className="panel"><h3 className="panel-h">Speed needed to reach (m/s)</h3>
        <LineChart n={fa.series.length} marks={marks} label="Required speed" series={[{ label: "req", color: "var(--far)", values: fa.rollReq }]} yFmt={f2} /></div>
      <div className="panel"><h3 className="panel-h">Own-error rate</h3>
        <LineChart n={fa.series.length} marks={marks} label="Error rate" series={[{ label: "err", color: "var(--bad)", values: fa.rollErr.map((v) => v * 100) }]} yFmt={(v) => v.toFixed(0) + "%"} yMin={0} /></div>
      <div className="panel"><h3 className="panel-h">Time between shots (s)</h3>
        <LineChart n={fa.series.length} marks={marks} label="Tempo" series={[{ label: "tempo", color: "var(--accent)", values: fa.rollTempo }]} yFmt={f2} /></div>
      <div className="panel span2"><h3 className="panel-h">By game</h3>
        <table className="ptable"><thead><tr><th>Game</th><th>From base</th><th>Speed needed</th><th>Own errors</th><th>Time between shots</th><th>Shots per rally</th></tr></thead>
          <tbody>{fa.bySet.map((s) => <tr key={s.s}><td>Game {s.s}</td><td className="mono">{f2(s.rec)} m</td><td className="mono">{f2(s.req)} m/s</td><td className="mono">{s.err}%</td><td className="mono">{f2(s.tempo)} s</td><td className="mono">{f1(s.shots)}</td></tr>)}</tbody></table></div>
    </section>
  );
}

function Compare({ d }) {
  const name = "WANG Po Wei";
  const cols = d.matches.map((m) => ({ m, p: sideOf(m, name), opp: m.names[sideOf(m, name) === "A" ? "B" : "A"] })).map((c) => ({ ...c, pr: profile(c.m, c.p) }));
  const rows = [["Points won", (x) => `${x.winPct}%`], ["Winners hit", (x) => x.winners], ["Own errors", (x) => x.errors], ["Smash share", (x) => `${x.smashShare}%`],
    ["Attacking shots", (x) => `${x.attackShare}%`], ["Shots per rally", (x) => f1(x.avgRally)], ["Speed needed to reach", (x) => `${f2(x.reqSpeed)} m/s`],
    ["Distance from base", (x) => `${f2(x.recovery)} m`], ["Short serves", (x) => `${x.serveShort}%`], ["Top target", (x) => x.targets[0]?.[0] ?? "–"], ["Weakest zone", (x) => x.weak[0]?.[0] ?? "–"]];
  return (
    <section className="mgrid">
      <div className="panel span2">
        <h3 className="panel-h">{name} across {cols.length} matches</h3>
        <table className="ptable cmp"><thead><tr><th />{cols.map((c) => <th key={c.m.video}>{c.m.event}<br /><span className="muted">vs {c.opp}</span></th>)}</tr></thead>
          <tbody>{rows.map(([l, fn]) => <tr key={l}><td>{l}</td>{cols.map((c) => <td key={c.m.video} className="mono">{fn(c.pr)}</td>)}</tr>)}</tbody></table>
        <p className="tiny muted">Same metrics, computed the same way on both matches. Each analysed match is also saved to the player's memory, so coaches can compare over a season.</p>
      </div>
      {cols.map((c) => (
        <div key={c.m.video} className="panel">
          <h3 className="panel-h">{c.m.event} · where {name}'s shots land</h3>
          <CourtMap half="far" heat={heatGrid(c.pr.land.map((x) => x.xy), "far", .55)} heatColor="#f2a33a" label="Landing heat" />
        </div>
      ))}
    </section>
  );
}
