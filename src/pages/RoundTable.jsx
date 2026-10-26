import { useEffect, useMemo, useRef, useState } from "react";
import { COACHES } from "../coaches/personas.js";
import Avatar from "../coaches/Avatar.jsx";
import { tactics, shotQuality } from "../coaches/analysis.js";
import { REGIONS, findings, score } from "../components/BodyMap.jsx";
import { loadMatches, pointStats, footwork, fatigue, patterns } from "../match/analytics.js";
import { memory, retrieve } from "../memory.js";

// Round table: the four coach agents and the head coach discuss the match, resolve conflicts against the player's
// memory, and agree a training plan with a weekly schedule. Every number comes from the analyses; the dialogue is
// templated in this prototype (the local LLM drives it in Stage II).
const HEAD = { id: "head", name: "Head Coach", role: "Chair", kicker: "Chair", color: "#C3CACD",
  look: { skin: "#E9BE9A", hair: "#C9CED8", hairStyle: "swept", shirt: "#1F4A3D", prop: "glasses" } };
const C = Object.fromEntries([...COACHES, HEAD].map((c) => [c.id, c]));
const f2 = (v) => v.toFixed(2);

function buildMeeting(data, m) {
  const t = tactics(data.outcomes, "A");
  const q = shotQuality(data.rally).filter((x) => x.s.hitter === "near" && x.score != null).sort((a, b) => a.score - b.score);
  const sc = score(findings(data.insights, data.rally));
  const muscles = Object.keys(REGIONS).sort((a, b) => sc[b].v - sc[a].v).slice(0, 3);
  const ps = pointStats(m, "A"), fw = footwork(m, "A"), fa = fatigue(m, "A"), pt = patterns(m, "A");
  const net = ps.errorReasons.find(([k]) => k === "net")?.[1] ?? 0;
  const errAll = ps.errorReasons.reduce((a, [, n]) => a + n, 0);
  const longNet = m.rallies.filter((r) => r.winner !== "A" && r.reason === "net" && r.lastBy === "A" && r.shots.length >= 10).length;
  const hard = fw.byType[0];
  const mem = { joint: retrieve("knee ankle injury sore jump", 1)[0], routine: retrieve("trains week minutes gym routine", 1)[0], goal: retrieve("goal season", 1)[0] };
  const knee = mem.joint && /knee|ankle/i.test(mem.joint.m.text);
  const declining = fa.rec.late > fa.rec.early * 1.05 || fa.err.late > fa.err.early * 1.15;
  const opp = data.names.B;

  const talk = [
    ["head", `Round table on ${data.event}. One priority each, backed by the numbers, then we agree the week.${mem.goal ? ` The player's stated goal: “${mem.goal.m.text}”` : ""}`],
    ["tactics", `My priority is defence in the ${t.weak[0][0]}: ${t.weak[0][1]} of the ${t.conceded} winners ${opp} hit landed there. I want two defence blocks this week, feeding smashes and rushes into that corner.`],
    ["technique", `Mine is margin over the net: ${net} of the ${errAll} own errors went into the net. In the replayed rally the weakest stroke was the ${q[0].s.type.toLowerCase()} (grade ${q[0].grade}: ${q[0].note}).`],
    ["fitness", `Legs and first step: ${muscles.map((r) => REGIONS[r].name.toLowerCase()).join(", ")} carry the most load.${knee ? ` But memory says “${mem.joint.m.text}”, so no jump landings this week.` : ""}`],
    ["analyst", `Footwork data backs Lin: against the ${hard.t.toLowerCase()} ${data.names.A} needs ${f2(hard.v)} m/s and is stretched ${hard.stretched}% of the time. ${declining ? "Recovery gets worse late in the match, so fitness matters." : "Recovery does not get worse late in the match, so this is about reading, not fatigue."}`],
    ...(knee ? [["fitness", `Lin, smash-defence blocks usually mean split-step jumps. With that knee I'd cap them at 70% pace from a lower base, no jumping.`],
      ["tactics", `Agreed. Half-court defence, fed at 70%, low base, and we judge it by recovery to base rather than intensity.`]] : []),
    ["technique", `Data, are the net errors a late-rally problem?`],
    ["analyst", `Partly: ${longNet} of the ${net} net errors came in rallies of 10 or more shots. Worst three-shot pattern: ${pt.worst[0]?.k} (${pt.worst[0]?.w}% won).`],
    ["head", `Ruling. Health limits from memory are hard constraints; inside them I rank every request by the points it cost us in this match. ${knee ? "Lin's blocks stay at 70% with no jumps; Ren's plyometrics wait until the knee settles." : "No request breaks a health limit, so all four stand."} Four goals, one owner each. Building the week now.`],
  ];

  // the head coach's arbitration: memory constraints first, then points at stake in this match
  const lostTo = (fn) => m.rallies.filter((r) => r.winner !== "A" && fn(r)).length;
  const ruling = [
    { owner: "tactics", ask: `Smash-defence blocks into the ${t.weak[0][0]}`, stake: t.weak[0][1], unit: "winners conceded there",
      check: knee ? "Clashes with memory: knee sore, no split-step jumps" : "No conflict", verdict: knee ? "Kept, modified: 70% pace, low base" : "Kept", tone: knee ? "mod" : "ok" },
    { owner: "technique", ask: "Net-margin work on net shots and lifts", stake: net, unit: "own net errors", check: "No conflict", verdict: "Kept", tone: "ok" },
    { owner: "analyst", ask: `Read-and-react against the ${hard.t.toLowerCase()}`, stake: lostTo((r) => r.lastBy === "B" && r.lastType === hard.t), unit: `points ended by a ${hard.t.toLowerCase()}`,
      check: "No conflict", verdict: "Kept", tone: "ok" },
    { owner: "fitness", ask: knee ? "Plyometric jump training" : `Leg power: ${REGIONS[muscles[0]].name.toLowerCase()}`, stake: lostTo((r) => r.shots.length >= 15), unit: "points lost in 15+ shot rallies",
      check: knee ? "Blocked by memory: knee sore" : "No conflict", verdict: knee ? "Deferred: isometric strength instead" : "Kept", tone: knee ? "off" : "ok" },
  ].sort((a, b) => b.stake - a.stake);

  const goals = [
    { owner: "tactics", text: `Concede no more than ${Math.max(2, Math.round(t.weak[0][1] / 2))} winners in the ${t.weak[0][0]}`, now: `${t.weak[0][1]} now` },
    { owner: "technique", text: `Cut net errors to ${Math.max(4, Math.round(net * 0.6))} or fewer`, now: `${net} now` },
    { owner: "analyst", text: `Shots needing more than 3.5 m/s under ${Math.max(5, fw.stretched - 4)}%`, now: `${fw.stretched}% now` },
    { owner: "fitness", text: knee ? "Train legs without jump landings until the knee settles" : `Strengthen ${REGIONS[muscles[0]].name.toLowerCase()} twice this week`, now: knee ? "knee sore" : "baseline" },
  ];

  const days = [
    { d: "Mon", kind: "court", min: 90, blocks: [["tactics", 30, `Half-court defence into the ${t.weak[0][0]}${knee ? ", 70% pace, low base" : ""}`], ["technique", 25, "Net kill and net lift with a 30 cm margin target"], ["analyst", 20, `Read-and-react: coach feeds ${hard.t.toLowerCase()}s, first step on contact`], ["fitness", 15, "Cool-down, calf and quad mobility"]] },
    { d: "Tue", kind: "gym", min: 45, blocks: [["fitness", 45, knee ? "Tempo split squats, isometric calf holds, hip thrusts, wrist work" : "Split squat jumps, calf raises, hip thrusts, wrist work"]] },
    { d: "Wed", kind: "rest", min: 20, blocks: [["fitness", 20, "Mobility and easy bike"]] },
    { d: "Thu", kind: "court", min: 90, blocks: [["analyst", 25, `Pattern drill: break ${pt.worst[0]?.k ?? "the losing pattern"}`], ["tactics", 30, "Lift deep to the backhand corner, recover to base"], ["technique", 25, "Smash and clear from a high contact"], ["fitness", 10, "Cool-down"]] },
    { d: "Fri", kind: "rest", min: 0, blocks: [] },
    { d: "Sat", kind: "match", min: 60, blocks: [["analyst", 60, "Practice match, recorded: ShuttleCoach re-measures the four goals"]] },
    { d: "Sun", kind: "rest", min: 20, blocks: [["fitness", 20, "Recovery walk and stretching"]] },
  ];
  return { talk, goals, days, mem, ruling };
}

export default function RoundTable({ data }) {
  const [m, setM] = useState(null);
  const [shown, setShown] = useState(0);
  const [saved, setSaved] = useState(false);
  const box = useRef(null);
  useEffect(() => { loadMatches().then((d) => setM(d.matches[0])); }, []);
  const meet = useMemo(() => (data && m ? buildMeeting(data, m) : null), [data, m]);
  useEffect(() => {
    if (!meet || shown >= meet.talk.length) return;
    const id = setTimeout(() => setShown((n) => n + 1), shown ? 1900 : 700);
    return () => clearTimeout(id);
  }, [meet, shown]);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" }); }, [shown]);
  if (!meet) return <div className="page"><p className="muted">Gathering the coaches…</p></div>;
  const speaking = meet.talk[Math.max(0, shown - 1)]?.[0];
  const done = shown >= meet.talk.length;
  const seats = ["tactics", "technique", "fitness", "analyst", "head"];

  return (
    <div className="page roundtable">
      <header className="report-head noprint">
        <div>
          <span className="tag">Round table · all coaches</span>
          <h1 className="h1">Agree the plan together</h1>
          <p className="muted">The four coaches and the head coach debate the match, check it against your memory, and agree a training plan and a weekly schedule.</p>
        </div>
        <div className="cta-row">
          <button className="btn ghost" onClick={() => { setShown(0); setSaved(false); }}>Restart meeting</button>
          <button className="btn primary" disabled={!done} onClick={() => window.print()}>Save plan as PDF</button>
        </div>
      </header>

      <div className="rt-grid noprint">
        <div className="rt-table">
          <svg viewBox="0 0 400 400" className="rt-svg" aria-hidden="true">
            <ellipse cx="200" cy="200" rx="120" ry="120" fill="#0A1014" stroke="#2A343A" strokeWidth="2" />
            <ellipse cx="200" cy="200" rx="84" ry="84" fill="none" stroke="#1F6B54" strokeWidth="2" strokeDasharray="4 6" />
            <text x="200" y="196" textAnchor="middle" className="rt-center">Round table</text>
            <text x="200" y="216" textAnchor="middle" className="rt-center sub">{done ? "plan agreed" : "in session"}</text>
          </svg>
          {seats.map((id, k) => {
            const a = -Math.PI / 2 + (k * 2 * Math.PI) / seats.length;
            return (
              <div key={id} className={`rt-seat ${speaking === id && !done ? "speaking" : ""}`} style={{ left: `${50 + 41 * Math.cos(a)}%`, top: `${50 + 41 * Math.sin(a)}%`, "--cc": C[id].color }}>
                <Avatar coach={C[id]} size={78} talking={speaking === id && !done} />
                <b>{C[id].name}</b><span>{C[id].kicker}</span>
              </div>
            );
          })}
        </div>
        <div className="rt-chat" ref={box} aria-live="polite">
          {meet.talk.slice(0, shown).map(([id, text], k) => (
            <div key={k} className="rt-msg" style={{ "--cc": C[id].color }}>
              <Avatar coach={C[id]} size={34} />
              <div><b>{C[id].name}</b><p>{text}</p></div>
            </div>
          ))}
          {!done && <div className="rt-msg typing" style={{ "--cc": C[meet.talk[shown][0]].color }}><Avatar coach={C[meet.talk[shown][0]]} size={34} /><p className="dots"><i /><i /><i /></p></div>}
        </div>
      </div>

      {done && (
        <section className="panel ruling">
          <h3 className="panel-h">How the head coach resolved the conflicts</h3>
          <ol className="rule-steps">
            <li><b>Health first.</b> Injuries and limits in the player's memory are hard constraints; no drill may break them.</li>
            <li><b>Then points at stake.</b> Requests are ranked by how many points that weakness cost in this match.</li>
            <li><b>One owner, one number.</b> Every kept request becomes a goal that the next recorded match re-measures.</li>
          </ol>
          <table className="ptable">
            <thead><tr><th>Request</th><th>Coach</th><th>Points at stake</th><th>Memory check</th><th>Ruling</th></tr></thead>
            <tbody>
              {meet.ruling.map((r) => (
                <tr key={r.owner}>
                  <td>{r.ask}</td>
                  <td style={{ color: C[r.owner].color }}>{C[r.owner].name}</td>
                  <td><b className="mono">{r.stake}</b> <span className="tiny muted">{r.unit}</span></td>
                  <td className={r.check === "No conflict" ? "muted" : "bad"}>{r.check}</td>
                  <td><span className={`verdict ${r.tone}`}>{r.verdict}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {done && (
        <article className="sheet plan-sheet">
          <header>
            <span className="tag">Training plan · agreed by the round table</span>
            <h2 className="plan-h">Next 7 days · {data.names.A}</h2>
            {meet.mem.joint && <p className="muted">Adapted to memory: “{meet.mem.joint.m.text}”{meet.mem.routine ? ` · “${meet.mem.routine.m.text}”` : ""}</p>}
          </header>
          <div className="goal-grid">
            {meet.goals.map((g) => (
              <div key={g.owner} style={{ "--cc": C[g.owner].color }}>
                <Avatar coach={C[g.owner]} size={36} />
                <div><b>{g.text}</b><span>{C[g.owner].name} · {g.now}</span></div>
              </div>
            ))}
          </div>
          <div className="week">
            {meet.days.map((d) => (
              <div key={d.d} className={`day ${d.kind}`}>
                <header><b>{d.d}</b><span>{d.kind === "rest" && !d.min ? "rest" : `${d.kind} · ${d.min} min`}</span></header>
                {d.blocks.map(([who, min, text], k) => (
                  <div key={k} className="blk" style={{ "--cc": C[who].color }}>
                    <span className="mono">{min}′</span><p>{text}</p><em>{C[who].name}</em>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="plan-foot noprint">
            <button className="btn ghost" disabled={saved} onClick={() => { memory.add(`Round-table plan (${data.event}): ${meet.goals.map((g) => g.text).join("; ")}.`, "goal", "round table"); setSaved(true); }}>
              {saved ? "Saved to memory" : "Save goals to memory"}
            </button>
            <span className="tiny muted">Saved goals are retrieved by every coach next session, and the next recorded match is scored against them.</span>
          </div>
        </article>
      )}
    </div>
  );
}
