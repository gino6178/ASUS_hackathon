import { useMemo, useState } from "react";
import { coachById, COACHES } from "../coaches/personas.js";
import Avatar from "../coaches/Avatar.jsx";
import FitnessCoach from "../coaches/FitnessCoach.jsx";
import TacticsCoach from "../coaches/TacticsCoach.jsx";
import TechniqueCoach from "../coaches/TechniqueCoach.jsx";
import AnalystCoach from "../coaches/AnalystCoach.jsx";
import { memory, retrieve } from "../memory.js";
import { go } from "../App.jsx";
import CoachChat from "../coaches/CoachChat.jsx";

const VIEWS = { fitness: FitnessCoach, tactics: TacticsCoach, technique: TechniqueCoach, analyst: AnalystCoach };

export default function Coach({ id, data }) {
  const coach = coachById(id) || COACHES[0];
  const [run, setRun] = useState(0);
  const [note, setNote] = useState("");
  const hits = useMemo(() => retrieve(coach.query, 2), [coach, run]);
  if (!data) return <div className="page"><p className="muted">Loading the analysis…</p></div>;
  const View = VIEWS[coach.id];

  return (
    <div className="page coach-page" style={{ "--cc": coach.color }}>
      <header className="coach-head">
        <Avatar coach={coach} size={96} talking />
        <div>
          <span className="tag">{coach.kicker} · agent · runs locally</span>
          <h1 className="h1">{coach.name}</h1>
          <p className="muted">{coach.role}</p>
        </div>
        <nav className="coach-switch" aria-label="Other coaches">
          {COACHES.filter((c) => c.id !== coach.id).map((c) => (
            <button key={c.id} onClick={() => go(`coach/${c.id}`)} title={`${c.name} · ${c.role}`}><Avatar coach={c} size={44} /></button>
          ))}
        </nav>
      </header>
      <View key={coach.id} coach={coach} data={data} hits={hits} runKey={coach.id + run} onReplay={() => setRun((r) => r + 1)} />
      <CoachChat key={"chat-" + coach.id} coach={coach} />
      <form className="coach-mem" onSubmit={(e) => { e.preventDefault(); memory.add(note, "note"); setNote(""); setRun((r) => r + 1); }}>
        <label htmlFor="mem-in" className="panel-h">Tell {coach.name} something to remember</label>
        <div>
          <input id="mem-in" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. My right knee is sore this week" />
          <button className="btn primary" disabled={!note.trim()}>Save to memory</button>
        </div>
        <span className="tiny muted">Saved on this device. Every coach retrieves it next time it answers.</span>
      </form>
    </div>
  );
}
