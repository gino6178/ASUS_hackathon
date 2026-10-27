import { useEffect, useMemo, useState } from "react";
import { agentVenue, AGENT_URL } from "../agent.js";
import "./lab.css";

// Find a court: the booking agent's search, replayed on a map. Where the players start (each player's area, rounded
// to about 1 km), the middle, every sports centre it checked (dim when nothing was free), the three fairest, and the
// trip each player would make to the one it booked. Map tiles © OpenStreetMap contributors.
const W = 1120, H = 700, T = 256;
const px = (lat, lon, z) => { const n = T * 2 ** z, s = Math.sin((lat * Math.PI) / 180); return [((lon + 180) / 360) * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n]; };
const COLORS = ["#F2E6C9", "#6FB6FF", "#FF8A6B", "#5FD39A", "#B9A2FF"];
const STATE = { choosing: "choosing", inviting: "inviting friends", confirming: "waiting for the OK", booked: "booked", cancelled: "cancelled", expired: "expired" };

function useView(points) {
  return useMemo(() => {
    if (!points.length) return null;
    let z = 15;
    for (; z > 9; z--) {
      const xy = points.map((p) => px(p.lat, p.lon, z)), xs = xy.map((p) => p[0]), ys = xy.map((p) => p[1]);
      if (Math.max(...xs) - Math.min(...xs) < W - 300 && Math.max(...ys) - Math.min(...ys) < H - 220) {
        const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
        return { z, x0: cx - W / 2, y0: cy - H / 2 };
      }
    }
    return null;
  }, [points]);
}

export default function Courts() {
  const [v, setV] = useState(null), [err, setErr] = useState(null), [phase, setPhase] = useState(0), [sel, setSel] = useState(null);
  useEffect(() => { const f = () => agentVenue().then((x) => { setV(x); setErr(null); }).catch((e) => setErr(e.message)); f(); const id = setInterval(f, 6000); return () => clearInterval(id); }, []);
  const party = v?.parties.find((p) => p.id === sel) ?? v?.parties.find((p) => p.map?.people?.length > 1) ?? v?.parties.find((p) => p.map?.people?.length) ?? v?.parties[0];
  // replay the search step by step whenever a game is selected
  useEffect(() => { setPhase(0); let k = 0; const id = setInterval(() => { k++; setPhase(k); if (k >= 6) clearInterval(id); }, 1100); return () => clearInterval(id); }, [party?.id]);
  const venues = v?.venues ?? [], people = party?.map?.people ?? [], top = party?.slots ?? [], considered = party?.map?.considered ?? venues.map((x) => ({ ...x, free: true }));
  const booking = party?.booking ? v.upcoming.find((b) => b.id === party.booking) : null;
  const chosen = top.find((s) => s.venue === booking?.venue) ?? top[0];
  // frame the players and the three fairest venues; other venues show where they fall inside that view
  const frame = useMemo(() => (people.length ? [...people, ...top] : venues), [party?.id, venues.length]);
  const view = useView(frame);
  const P = (lat, lon) => { const [x, y] = px(lat, lon, view.z); return [x - view.x0, y - view.y0]; };
  const tiles = [];
  if (view) {
    const n = 2 ** view.z;
    for (let tx = Math.floor(view.x0 / T); tx <= Math.floor((view.x0 + W) / T); tx++) for (let ty = Math.floor(view.y0 / T); ty <= Math.floor((view.y0 + H) / T); ty++)
      if (ty >= 0 && ty < n) tiles.push([tx, ty, ((tx % n) + n) % n]);
  }
  const color = (name) => COLORS[Math.max(0, people.findIndex((p) => p.name === name)) % COLORS.length];

  return (
    <div className="page courts-page">
      <header className="report-head">
        <div>
          <span className="tag">Booking agent · on the map</span>
          <h1 className="h1">A court in the middle, for everyone</h1>
          <p className="muted">Say “doubles with Amy and Ben on Saturday evening”. The agent opens the map, finds where each of you starts, checks every sports centre for a free court at that time, and ranks them by the longest trip anyone would make. It books only after you say yes.</p>
        </div>
      </header>
      {err && <div className="notice" role="alert"><b>Agent gateway not reachable</b> at {AGENT_URL} ({err}).</div>}
      <div className="cr-grid">
        <div className="cr-map" style={{ width: W, height: H }} aria-label="Map of the search">
          {view && tiles.map(([tx, ty, wx]) => <img key={`${tx}/${ty}`} alt="" src={`https://tile.openstreetmap.org/${view.z}/${wx}/${ty}.png`} style={{ left: tx * T - view.x0, top: ty * T - view.y0 }} />)}
          {view && (
            <svg width={W} height={H}>
              {/* every sports centre checked: dim when it had no free court */}
              {phase >= 3 && considered.map((c, i) => { const [x, y] = P(c.lat, c.lon); return <circle key={c.id} cx={x} cy={y} r={c.free ? 9 : 6} className={`cr-v ${c.free ? "free" : "full"}`} style={{ animationDelay: `${i * 40}ms` }} />; })}
              {phase >= 2 && party?.map?.center && people.length > 1 && (() => { const [x, y] = P(party.map.center.lat, party.map.center.lon); return <g className="cr-mid"><circle cx={x} cy={y} r={34} /><text x={x} y={y + 54} textAnchor="middle">the middle</text></g>; })()}
              {phase >= 5 && chosen && people.map((p) => { const [a, b] = P(p.lat, p.lon), [c, d] = P(chosen.lat, chosen.lon), dd = chosen.dists?.find((x) => x.name === p.name), km = dd ? (dd.min ? `~${dd.min} min` : `${dd.km} km`) : ""; return (
                <g key={p.id} className="cr-trip"><line x1={a} y1={b} x2={c} y2={d} stroke={color(p.name)} /><text x={(a + c) / 2} y={(b + d) / 2 - 8} textAnchor="middle" fill={color(p.name)}>{km}</text></g>); })}
              {phase >= 4 && top.map((s, i) => { const [x, y] = P(s.lat, s.lon), win = s === chosen && phase >= 5; return (
                <g key={s.venue} className={`cr-top${win ? " win" : ""}`}><circle cx={x} cy={y} r={win ? 16 : 12} /><text x={x} y={y + 5} textAnchor="middle">{i + 1}</text>
                  <text className="lbl" x={x + 22} y={y + 5}>{s.name.replace(/ (Civil )?Sports Center$/, "")}{win && booking ? " · booked" : ""}</text></g>); })}
              {phase >= 1 && people.map((p) => { const [x, y] = P(p.lat, p.lon); return (
                <g key={p.id} className="cr-p" style={{ "--c": color(p.name) }}><circle cx={x} cy={y} r={11} /><text x={x} y={y - 18} textAnchor="middle">{p.name}</text></g>); })}
            </svg>
          )}
          <span className="cr-attr">© OpenStreetMap contributors{v?.sample ? " · court schedules are sample data" : ""}</span>
        </div>
        <aside className="cr-side">
          <ol className="cr-steps">
            {["Open the map", "Find where everyone starts", `Check ${considered.length || venues.length} sports centres for a free court`, "Rank by the longest trip (minutes)", "Pick the fairest; wait for the player's OK"].map((t, i) => (
              <li key={t} className={phase > i ? "on" : ""}>{t}</li>))}
          </ol>
          {party && (
            <section className="panel">
              <h2 className="panel-h">{party.hostName}'s {party.format} · {STATE[party.status]}</h2>
              <ol className="cr-top-list">{top.map((s) => (
                <li key={s.venue} className={s === chosen ? "win" : ""}><b>{s.name}</b><span className="tiny muted"> · {s.date.slice(5)} {s.start}-{s.end}</span>
                  <p className="tiny">{s.dists?.map((d) => `${d.name} ${d.min ? `~${d.min} min` : `${d.km} km`}`).join(" · ")}<span className="muted"> · longest trip {s.maxMin ? `~${s.maxMin} min` : `${s.maxKm} km`}</span></p></li>))}</ol>
            </section>
          )}
          {v && v.parties.length > 1 && (
            <div className="cr-games">{v.parties.slice(0, 6).map((p) => <button key={p.id} className="chip" aria-pressed={p.id === party?.id} onClick={() => setSel(p.id)}>{p.hostName} · {p.format} · {STATE[p.status]}</button>)}</div>
          )}
          {!party && v && <p className="muted small">No games yet. On Telegram, share your location (📎 → Location), then say when you'd like to play.</p>}
        </aside>
      </div>
    </div>
  );
}
