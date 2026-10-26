import { useEffect, useRef, useState } from "react";

// Reveals the coach's messages one at a time and reports how many are shown, so the visual can follow along.
export function useTyping(messages, key) {
  const [shown, setShown] = useState(0);
  useEffect(() => { setShown(0); }, [key]);
  useEffect(() => {
    if (shown >= messages.length) return;
    const id = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 600 : 1700);
    return () => clearTimeout(id);
  }, [shown, messages.length, key]);
  return [shown, setShown];
}

export default function Briefing({ coach, messages, shown, onReplay, memoryHits }) {
  const box = useRef(null);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" }); }, [shown]);
  const typing = shown < messages.length;
  return (
    <div className="briefing">
      {memoryHits.length > 0 && (
        <div className="mem-used">
          <span className="tag">Memory retrieved</span>
          {memoryHits.map(({ m, score }) => <span key={m.id} className="mem-chip" title={`relevance ${score.toFixed(2)}`}>{m.text}</span>)}
        </div>
      )}
      <div className="brief-chat" ref={box} aria-live="polite">
        {messages.slice(0, shown).map((m, i) => (
          <div key={i} className={`brief-msg ${i === shown - 1 ? "now" : ""}`} style={{ borderColor: i === shown - 1 ? coach.color : undefined }}>
            {m.title && <b>{m.title}</b>}
            <p>{m.text}</p>
          </div>
        ))}
        {typing && <div className="brief-msg typing"><p className="dots"><i /><i /><i /></p></div>}
      </div>
      <div className="brief-foot">
        <button className="btn ghost" onClick={onReplay} disabled={typing}>Replay briefing</button>
        <span className="tiny muted">Agent output is templated from computed match facts and retrieved memory; the local LLM is connected in Stage II.</span>
      </div>
    </div>
  );
}
