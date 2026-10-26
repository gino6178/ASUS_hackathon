import { useEffect, useMemo, useRef, useState } from "react";

// Auto highlight reel: picks a player's best five rallies from the labels, then renders a 9:16 social clip on a canvas
// (cropped broadcast video, live shot captions, landing map, score card) and records it in the browser, on the device.
const W = 720, H = 1280, VID = { y: 170, s: 720 };
const COL = { A: "#6FB6FF", B: "#FF8A6B" };

// average flight speed of a shot (km/h): hitter position to landing spot, over the time until the next contact
export function shotSpeed(r, i) {
  const s = r.shots[i], n = r.shots[i + 1];
  if (!s.pos || !s.land || !n) return null;
  const dt = n.t - s.t, d = Math.hypot(s.land[0] - s.pos[0], s.land[1] - s.pos[1]);
  return dt > 0.2 ? (d / dt) * 3.6 : null;
}

export function pickHighlights(m, p, k = 5) {
  return m.rallies.filter((r) => r.winner === p && r.clip).map((r) => {
    const n = r.shots.length, clutch = Math.max(...r.score) >= 18, finish = r.reason === "winner" && r.lastBy === p;
    const smash = finish && /smash/i.test(r.lastType);
    const why = [n >= 12 && `${n}-shot rally`, finish && `${r.lastType.toLowerCase()} winner`, clutch && `at ${r.score[0]}–${r.score[1]}`].filter(Boolean);
    return { r, score: (finish ? 3 : 0) + (smash ? 1.5 : 0) + n / 6 + (clutch ? 2 : 0), why: why.length ? why : [`won at ${r.score[0]}–${r.score[1]}`] };
  }).sort((a, b) => b.score - a.score).slice(0, k).sort((a, b) => a.r.i - b.r.i);
}

function court(ctx, x, y, w, h) {
  ctx.fillStyle = "#16362B"; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#DCE6E0"; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
  const X = (m) => x + (m / 6.1) * w, Y = (m) => y + (m / 13.4) * h;
  ctx.lineWidth = 1.2;
  [[0.46, 0, 0.46, 13.4], [5.64, 0, 5.64, 13.4], [3.05, 0, 3.05, 4.72], [3.05, 8.68, 3.05, 13.4], [0, 4.72, 6.1, 4.72], [0, 8.68, 6.1, 8.68], [0, 0.76, 6.1, 0.76], [0, 12.64, 6.1, 12.64]]
    .forEach(([a, b, c, d]) => { ctx.beginPath(); ctx.moveTo(X(a), Y(b)); ctx.lineTo(X(c), Y(d)); ctx.stroke(); });
  ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 6, Y(6.7)); ctx.lineTo(x + w + 6, Y(6.7)); ctx.stroke();
  return { X, Y };
}

function frame(ctx, h, k, total, names, video, t) {
  const r = h.r, shown = r.shots.filter((s) => s.t <= t + 0.05), cur = shown[shown.length - 1];
  ctx.fillStyle = "#04070A"; ctx.fillRect(0, 0, W, H);
  // header
  ctx.fillStyle = "#F2E6C9"; ctx.font = "600 22px Consolas, monospace"; ctx.fillText("SHUTTLECOACH · TOP 5", 40, 62);
  ctx.fillStyle = "#8A979E"; ctx.textAlign = "right"; ctx.fillText(`${k + 1} / ${total}`, W - 40, 62); ctx.textAlign = "left";
  ctx.fillStyle = "#EEF1F2"; ctx.font = "700 40px Segoe UI, sans-serif"; ctx.fillText(names[r.winner], 40, 120);
  ctx.fillStyle = "#8A979E"; ctx.font = "400 22px Segoe UI, sans-serif"; ctx.fillText(`vs ${names[r.winner === "A" ? "B" : "A"]} · Game ${r.set}`, 40, 152);
  // video, centre-cropped to a square
  if (video.videoWidth) {
    const s = Math.min(video.videoWidth, video.videoHeight), sx = (video.videoWidth - s) / 2;
    ctx.drawImage(video, sx, (video.videoHeight - s) / 2, s, s, 0, VID.y, VID.s, VID.s);
  }
  if (cur) {
    const v = shotSpeed(r, shown.length - 1);
    const label = `${cur.type} · ${names[cur.p].split(" ")[0]}${v ? ` · avg ${Math.round(v)} km/h` : ""}`;
    ctx.font = "700 28px Segoe UI, sans-serif"; const w = ctx.measureText(label).width + 56;
    ctx.fillStyle = "#04070AE0"; ctx.beginPath(); ctx.roundRect(24, VID.y + VID.s - 78, w, 54, 14); ctx.fill();
    ctx.fillStyle = COL[cur.p]; ctx.beginPath(); ctx.arc(48, VID.y + VID.s - 51, 8, 0, 7); ctx.fill();
    ctx.fillStyle = "#EEF1F2"; ctx.fillText(label, 66, VID.y + VID.s - 41);
  }
  // headline + score
  const y0 = VID.y + VID.s + 70;
  ctx.fillStyle = "#F2E6C9"; ctx.font = "800 54px Bahnschrift, Segoe UI, sans-serif"; ctx.fillText(h.why[0].replace(/^\w/, (c) => c.toUpperCase()), 40, y0);
  ctx.fillStyle = "#C3CACD"; ctx.font = "400 28px Segoe UI, sans-serif"; h.why.slice(1).forEach((w, i) => ctx.fillText(w, 40, y0 + 48 + i * 38));
  ctx.fillStyle = "#8A979E"; ctx.font = "600 22px Consolas, monospace"; const top = Math.max(0, ...r.shots.map((_, i) => shotSpeed(r, i) ?? 0));
  ctx.fillText(`SHOT ${shown.length} / ${r.shots.length}${top ? `   FASTEST AVG ${Math.round(top)} KM/H` : ""}`, 40, y0 + 150);
  // shot progress
  r.shots.forEach((s, i) => { ctx.fillStyle = s.t <= t ? COL[s.p] : "#1E282E"; ctx.fillRect(40 + i * (420 / r.shots.length), y0 + 168, 420 / r.shots.length - 3, 10); });
  // landing map
  const { X, Y } = court(ctx, W - 40 - 120, y0 - 40, 120, 264);
  shown.forEach((s, i) => {
    if (!s.pos || !s.land) return;
    const last = i === shown.length - 1, x0 = X(s.pos[0]), y0 = Y(s.pos[1]), x1 = X(s.land[0]), y1 = Y(s.land[1]);
    ctx.globalAlpha = last ? 1 : .3; ctx.strokeStyle = COL[s.p]; ctx.lineWidth = last ? 3 : 1.5;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2 + (y1 - y0) * .18, (y0 + y1) / 2, x1, y1); ctx.stroke();
  });
  ctx.globalAlpha = 1;
  shown.filter((s) => s.land).forEach((s, i, a) => { ctx.globalAlpha = i === a.length - 1 ? 1 : .55; ctx.fillStyle = COL[s.p]; ctx.beginPath(); ctx.arc(X(s.land[0]), Y(s.land[1]), i === a.length - 1 ? 7 : 4, 0, 7); ctx.fill(); });
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#5FD39A"; ctx.font = "500 18px Consolas, monospace"; ctx.fillText("● analysed on-device · no upload", 40, H - 40);
}

function card(ctx, h, k, total, names) {
  ctx.fillStyle = "#04070A"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#F2E6C9"; ctx.font = "600 24px Consolas, monospace"; ctx.fillText(`HIGHLIGHT ${k + 1} OF ${total}`, 40, H / 2 - 70);
  ctx.fillStyle = "#EEF1F2"; ctx.font = "800 64px Bahnschrift, Segoe UI, sans-serif"; ctx.fillText(h.why[0].replace(/^\w/, (c) => c.toUpperCase()), 40, H / 2);
  ctx.fillStyle = "#8A979E"; ctx.font = "400 30px Segoe UI, sans-serif"; ctx.fillText(`${names[h.r.winner]} · Game ${h.r.set}`, 40, H / 2 + 54);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// plays the reel onto the canvas; resolves when done or when stop() is called
async function run(canvas, list, names, stopRef, onStep) {
  const ctx = canvas.getContext("2d");
  for (let k = 0; k < list.length && !stopRef.current; k++) {
    onStep(k);
    card(ctx, list[k], k, list.length, names);
    const v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.src = `/media/rallies/${list[k].r.clip}`;
    await Promise.all([new Promise((ok) => { v.oncanplay = ok; v.onerror = ok; }), wait(1100)]);
    await v.play().catch(() => {});
    await new Promise((done) => {
      const tick = () => {
        if (stopRef.current || v.ended) return done();
        frame(ctx, list[k], k, list.length, names, v, v.currentTime);
        requestAnimationFrame(tick);
      };
      tick();
    });
    frame(ctx, list[k], k, list.length, names, v, 1e9);
    await wait(stopRef.current ? 0 : 700);
  }
}

export default function Highlights({ m, p }) {
  const list = useMemo(() => pickHighlights(m, p), [m, p]);
  const canvas = useRef(null), stop = useRef(false);
  const [state, setState] = useState("idle"); // idle | preview | recording
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  useEffect(() => () => { stop.current = true; }, []);
  useEffect(() => { if (list.length && canvas.current) card(canvas.current.getContext("2d"), list[0], 0, list.length, m.names); }, [list, m.names]);

  const go = async (record) => {
    stop.current = false; setFile(null); setState(record ? "recording" : "preview");
    let rec, chunks = [];
    if (record) {
      const type = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((x) => MediaRecorder.isTypeSupported(x));
      rec = new MediaRecorder(canvas.current.captureStream(30), { mimeType: type, videoBitsPerSecond: 6e6 });
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.start(500);
    }
    await run(canvas.current, list, m.names, stop, setStep);
    if (rec) {
      await new Promise((ok) => { rec.onstop = ok; rec.stop(); });
      if (!stop.current) setFile(URL.createObjectURL(new Blob(chunks, { type: "video/webm" })));
    }
    setState("idle");
  };

  return (
    <section className="hl-grid">
      <div className="panel">
        <h3 className="panel-h">Auto-picked: best five rallies for {m.names[p]}</h3>
        <p className="tiny muted">Scored from the labels: won with an outright winner, rally length, smash finish and pressure points (18+). The landing map draws each shot's flight path; speeds are average flight speeds (hitter to landing over flight time), lower than launch speed.</p>
        <ol className="hl-list">
          {list.map((h, k) => (
            <li key={h.r.i} className={state !== "idle" && k === step ? "on" : ""}>
              <b>{h.why[0].replace(/^\w/, (c) => c.toUpperCase())}</b>
              <span>{[...h.why.slice(1), `game ${h.r.set}`].join(" · ")}</span>
            </li>
          ))}
        </ol>
        <div className="hl-actions">
          {state === "idle" ? <>
            <button className="btn ghost" onClick={() => go(false)}>Preview reel</button>
            <button className="btn primary" onClick={() => go(true)}>Export 9:16 video</button>
          </> : <button className="btn ghost" onClick={() => { stop.current = true; }}>{state === "recording" ? "Cancel export" : "Stop"}</button>}
          {file && <a className="btn primary" href={file} download={`shuttlecoach_top5_${m.names[p].split(" ")[0].toLowerCase()}.webm`}>Download .webm</a>}
        </div>
        <p className="tiny muted">{state === "recording" ? `Recording highlight ${step + 1} of ${list.length}… the video is rendered in this browser and never uploaded.` : "Vertical 720 × 1280 for Instagram Reels, TikTok and Shorts. Rendered and saved on this device."}</p>
      </div>
      <canvas ref={canvas} width={W} height={H} className="hl-canvas" aria-label="Highlight reel preview" />
    </section>
  );
}
