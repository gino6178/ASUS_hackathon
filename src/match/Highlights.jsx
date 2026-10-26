import { useEffect, useMemo, useRef, useState } from "react";

// Auto highlight reel: picks a player's best rallies from the labels, then renders them with broadcast-style camera
// work on a canvas: a follow-cam that tracks the shuttle between hitter and receiver (court positions projected into
// the clip with the match homography), an instant slow-motion replay of the final shot with a punch-in on its landing
// spot, and a winner freeze-frame. The reel is recorded in the browser (MP4 where supported) and can be shared.
const COL = { A: "#6FB6FF", B: "#FF8A6B" };
const FORMATS = {
  vertical: { W: 720, H: 1280, label: "9:16 vertical", note: "Reels, TikTok, Shorts", vid: { x: 0, y: 170, w: 720, h: 720 }, zoom: 1.05 },
  wide: { W: 1280, H: 720, label: "16:9 wide", note: "YouTube, club screens", vid: { x: 0, y: 0, w: 1280, h: 720 }, zoom: 1.3 },
};
const SRC = { w: 854, h: 480 };
const cap = (s) => s.replace(/^\w/, (c) => c.toUpperCase());

// average flight speed of a shot (km/h): hitter position to landing spot, over the time until the next contact
export function shotSpeed(r, i) {
  const s = r.shots[i], n = r.shots[i + 1];
  if (!s?.pos || !s.land || !n) return null;
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

const project = (M, [x, y]) => { const w = M[6] * x + M[7] * y + M[8]; return [(M[0] * x + M[1] * y + M[2]) / w, (M[3] * x + M[4] * y + M[5]) / w]; };
const lerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
const mean = (pts) => { const q = pts.filter(Boolean); return q.length ? [q.reduce((s, p) => s + p[0], 0) / q.length, q.reduce((s, p) => s + p[1], 0) / q.length] : null; };

// where the camera wants to look at time t: the shuttle's ground point, weighted with both players
function target(r, t) {
  const k = r.shots.findLastIndex((s) => s.t <= t);
  if (k < 0) return [3.05, 6.7];
  const s = r.shots[k], n = r.shots[k + 1], u = n ? Math.min(1, (t - s.t) / Math.max(.2, n.t - s.t)) : Math.min(1, (t - s.t) / .8);
  const shuttle = s.pos && (s.land || n?.pos) ? lerp(s.pos, s.land || n.pos, u) : s.land || s.pos;
  return mean([shuttle, shuttle, s.pos, s.opp]) || [3.05, 6.7];
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

function pill(ctx, x, y, text, dot) {
  ctx.font = "700 26px Segoe UI, sans-serif"; const w = ctx.measureText(text).width + (dot ? 56 : 32);
  ctx.fillStyle = "#04070AE0"; ctx.beginPath(); ctx.roundRect(x, y, w, 50, 14); ctx.fill();
  if (dot) { ctx.fillStyle = dot; ctx.beginPath(); ctx.arc(x + 24, y + 25, 8, 0, 7); ctx.fill(); }
  ctx.fillStyle = "#EEF1F2"; ctx.fillText(text, x + (dot ? 42 : 16), y + 34);
}

function drawMap(ctx, r, shown, x, y, w, h) {
  const { X, Y } = court(ctx, x, y, w, h);
  shown.forEach((s, i) => {
    if (!s.pos || !s.land) return;
    const last = i === shown.length - 1, x0 = X(s.pos[0]), y0 = Y(s.pos[1]), x1 = X(s.land[0]), y1 = Y(s.land[1]);
    ctx.globalAlpha = last ? 1 : .3; ctx.strokeStyle = COL[s.p]; ctx.lineWidth = last ? 3 : 1.5;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2 + (y1 - y0) * .18, (y0 + y1) / 2, x1, y1); ctx.stroke();
  });
  ctx.globalAlpha = 1;
  shown.filter((s) => s.land).forEach((s, i, a) => { ctx.globalAlpha = i === a.length - 1 ? 1 : .55; ctx.fillStyle = COL[s.p]; ctx.beginPath(); ctx.arc(X(s.land[0]), Y(s.land[1]), i === a.length - 1 ? 7 : 4, 0, 7); ctx.fill(); });
  ctx.globalAlpha = 1;
}

// one composited frame: camera crop of the clip + overlays for the chosen format
function frame(ctx, F, h, k, total, m, video, t, cam, phase) {
  const r = h.r, names = m.names, shown = r.shots.filter((s) => s.t <= t + 0.05), cur = shown[shown.length - 1], { W, H, vid } = F;
  ctx.fillStyle = "#04070A"; ctx.fillRect(0, 0, W, H);
  if (video.videoWidth) {
    const ar = vid.w / vid.h, ch = Math.min(SRC.h, SRC.w / ar) / cam.z, cw = ch * ar;
    const sx = Math.max(0, Math.min(SRC.w - cw, cam.x - cw / 2)), sy = Math.max(0, Math.min(SRC.h - ch, cam.y - ch / 2));
    const kx = video.videoWidth / SRC.w, ky = video.videoHeight / SRC.h;
    ctx.drawImage(video, sx * kx, sy * ky, cw * kx, ch * ky, vid.x, vid.y, vid.w, vid.h);
  }
  const vb = vid.y + vid.h;
  if (phase === "replay" || phase === "impact") {
    // broadcast-replay look: vignette, letterbox bars, a slow-motion badge, and a flash on contact
    const cx = vid.x + vid.w / 2, cy = vid.y + vid.h / 2, g = ctx.createRadialGradient(cx, cy, vid.h * .25, cx, cy, vid.h * .75);
    g.addColorStop(0, "#04070A00"); g.addColorStop(1, "#04070AB0");
    ctx.fillStyle = g; ctx.fillRect(vid.x, vid.y, vid.w, vid.h);
    const bar = vid.h * .07;
    ctx.fillStyle = "#000"; ctx.fillRect(vid.x, vid.y, vid.w, bar); ctx.fillRect(vid.x, vid.y + vid.h - bar, vid.w, bar);
    const by = vid.y + bar + (F === FORMATS.wide ? 100 : 16);
    ctx.fillStyle = "#D6332A"; ctx.beginPath(); ctx.roundRect(vid.x + 24, by, 230, 46, 8); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "800 24px Consolas, monospace"; ctx.fillText(phase === "impact" ? "● CONTACT" : "▶ REPLAY · SLOW-MO", vid.x + 38, by + 31);
    if (phase === "impact") {
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0, .35 - (cam.t || 0) * .9)})`; ctx.fillRect(vid.x, vid.y, vid.w, vid.h);
      ctx.strokeStyle = "#F2E6C9"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy - vid.h * .04, vid.h * (.16 + (cam.t || 0) * .1), 0, 7); ctx.stroke();
    }
  }
  if (phase === "winner") {
    ctx.fillStyle = "#04070A99"; ctx.fillRect(vid.x, vid.y, vid.w, vid.h);
    ctx.save(); ctx.translate(vid.x + vid.w / 2, vid.y + vid.h / 2); ctx.rotate(-0.08);
    ctx.strokeStyle = "#F2E6C9"; ctx.lineWidth = 6; ctx.strokeRect(-250, -75, 500, 150);
    ctx.fillStyle = "#F2E6C9"; ctx.textAlign = "center"; ctx.font = "900 60px Bahnschrift, Segoe UI, sans-serif";
    ctx.fillText(r.reason === "winner" ? `${r.lastType.toUpperCase()}!` : "POINT!", 0, 2);
    ctx.font = "700 30px Consolas, monospace"; ctx.fillText(`${names[r.winner].split(" ")[0]} · ${r.score[0]}–${r.score[1]}`, 0, 50);
    ctx.restore();
  }
  if (cur && phase !== "winner") {
    const v = shotSpeed(r, shown.length - 1);
    pill(ctx, vid.x + 24, vb - 78, `${cur.type} · ${names[cur.p].split(" ")[0]}${v ? ` · avg ${Math.round(v)} km/h` : ""}`, COL[cur.p]);
  }
  const head = cap(h.why[0] || "");
  if (F === FORMATS.vertical) {
    ctx.fillStyle = "#F2E6C9"; ctx.font = "600 22px Consolas, monospace"; ctx.fillText("SHUTTLECOACH · TOP " + total, 40, 62);
    ctx.fillStyle = "#8A979E"; ctx.textAlign = "right"; ctx.fillText(`${k + 1} / ${total}`, W - 40, 62); ctx.textAlign = "left";
    ctx.fillStyle = "#EEF1F2"; ctx.font = "700 40px Segoe UI, sans-serif"; ctx.fillText(names[r.winner], 40, 120);
    ctx.fillStyle = "#8A979E"; ctx.font = "400 22px Segoe UI, sans-serif"; ctx.fillText(`vs ${names[r.winner === "A" ? "B" : "A"]} · Game ${r.set} · ${m.event}`, 40, 152);
    const y0 = vb + 70;
    ctx.fillStyle = "#F2E6C9"; ctx.font = "800 54px Bahnschrift, Segoe UI, sans-serif"; ctx.fillText(head, 40, y0);
    ctx.fillStyle = "#C3CACD"; ctx.font = "400 28px Segoe UI, sans-serif"; h.why.slice(1).forEach((w, i) => ctx.fillText(w, 40, y0 + 48 + i * 38));
    const top = Math.max(0, ...r.shots.map((_, i) => shotSpeed(r, i) ?? 0));
    ctx.fillStyle = "#8A979E"; ctx.font = "600 22px Consolas, monospace";
    ctx.fillText(`SHOT ${shown.length} / ${r.shots.length}${top ? `   FASTEST AVG ${Math.round(top)} KM/H` : ""}`, 40, y0 + 150);
    r.shots.forEach((s, i) => { ctx.fillStyle = s.t <= t ? COL[s.p] : "#1E282E"; ctx.fillRect(40 + i * (420 / r.shots.length), y0 + 168, 420 / r.shots.length - 3, 10); });
    drawMap(ctx, r, shown, W - 160, y0 - 40, 120, 264);
    ctx.fillStyle = "#5FD39A"; ctx.font = "500 18px Consolas, monospace"; ctx.fillText("● analysed on-device · no upload", 40, H - 40);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, 140); g.addColorStop(0, "#04070ACC"); g.addColorStop(1, "#04070A00");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 140);
    ctx.fillStyle = "#F2E6C9"; ctx.font = "600 20px Consolas, monospace"; ctx.fillText(`SHUTTLECOACH · TOP ${total} · ${k + 1}/${total}`, 32, 44);
    ctx.fillStyle = "#EEF1F2"; ctx.font = "800 40px Bahnschrift, Segoe UI, sans-serif"; ctx.fillText(`${head} · ${names[r.winner]}`, 32, 92);
    ctx.fillStyle = "#04070AD0"; ctx.beginPath(); ctx.roundRect(W - 132, 24, 108, 220, 10); ctx.fill();
    drawMap(ctx, r, shown, W - 122, 34, 88, 194);
    r.shots.forEach((s, i) => { ctx.fillStyle = s.t <= t ? COL[s.p] : "#ffffff22"; ctx.fillRect(32 + i * (500 / r.shots.length), H - 22, 500 / r.shots.length - 3, 8); });
  }
}

function card(ctx, F, h, k, total, names) {
  const { W, H } = F;
  ctx.fillStyle = "#04070A"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#F2E6C9"; ctx.font = "600 24px Consolas, monospace"; ctx.fillText(`HIGHLIGHT ${k + 1} OF ${total}`, 60, H / 2 - 70);
  ctx.fillStyle = "#EEF1F2"; ctx.font = "800 64px Bahnschrift, Segoe UI, sans-serif"; ctx.fillText(cap(h.why[0]), 60, H / 2);
  ctx.fillStyle = "#8A979E"; ctx.font = "400 30px Segoe UI, sans-serif"; ctx.fillText(`${names[h.r.winner]} · Game ${h.r.set}`, 60, H / 2 + 54);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function playUntil(v, until, stopRef, draw) {
  return new Promise((done) => {
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(.1, (now - last) / 1000); last = now;
      if (stopRef.current || v.ended || (until != null && v.currentTime >= until)) return done();
      draw(dt); requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

// plays the reel onto the canvas; resolves when done or when stop() is called
async function run(canvas, F, list, m, stopRef, onStep) {
  const ctx = canvas.getContext("2d"), M = m.cam;
  for (let k = 0; k < list.length && !stopRef.current; k++) {
    onStep(k);
    const h = list[k], r = h.r, last = r.shots[r.shots.length - 1];
    card(ctx, F, h, k, list.length, m.names);
    const v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.src = `/media/rallies/${r.clip}`;
    await Promise.all([new Promise((ok) => { v.oncanplay = ok; v.onerror = ok; }), wait(1000)]);
    const cam = { x: SRC.w / 2, y: SRC.h / 2, z: 1 };
    // camera: eases toward a point in clip pixels; zoom has its own (slower or faster) rate
    const toward = (dt, zGoal, [tx, ty], rate = 2.4, zRate = 1.6) => {
      const a = 1 - Math.exp(-dt * rate);
      cam.x += (tx - cam.x) * a; cam.y += (ty - cam.y) * a; cam.z += (zGoal - cam.z) * (1 - Math.exp(-dt * zRate));
    };
    const px = (court) => (M ? project(M, court) : [SRC.w / 2, SRC.h / 2]);
    // a player's body in the clip: feet projected from the court, raised by about half a body height at that depth
    const body = (court) => {
      const [u, y] = px(court), [a] = px([court[0] - .5, court[1]]), [b] = px([court[0] + .5, court[1]]);
      return [u, y - Math.abs(b - a) * 1.1];
    };
    const follow = (dt, zGoal, look, rate) => { const [x, y] = px(look); toward(dt, zGoal, [x, y - 30], rate); };
    // 1 live action with the follow-cam
    await v.play().catch(() => {});
    await playUntil(v, null, stopRef, (dt) => { follow(dt, F.zoom, target(r, v.currentTime)); frame(ctx, F, h, k, list.length, m, v, v.currentTime, cam, "live"); });
    if (stopRef.current) break;
    // 2 instant replay of the winning shot, built like a broadcast replay:
    //    speed ramps down into slow motion while the camera pushes in tight on the player who hits it,
    //    the frame holds on contact with a flash, then eases out toward where the shuttle lands
    if (last) {
      const who = last.pos || target(r, last.t), spot = last.land || who;
      const from = Math.max(0, last.t - 1.6);
      v.currentTime = from; await new Promise((ok) => { v.onseeked = ok; });
      v.playbackRate = 0.6; await v.play().catch(() => {});
      await playUntil(v, last.t, stopRef, (dt) => {
        const u = Math.min(1, (v.currentTime - from) / Math.max(.2, last.t - from));
        v.playbackRate = Math.max(.25, .6 - .35 * u); // speed ramp into slow motion
        toward(dt, F.zoom * (1 + 1.2 * u), body(who), 3.2, 2.2);
        frame(ctx, F, h, k, list.length, m, v, v.currentTime, cam, "replay");
      });
      if (stopRef.current) break;
      // hold on contact
      v.pause();
      const t0 = performance.now();
      await new Promise((done) => {
        const tick = () => {
          cam.t = (performance.now() - t0) / 1000;
          toward(1 / 60, F.zoom * 2.3, body(who), 3.2, 3);
          frame(ctx, F, h, k, list.length, m, v, v.currentTime, cam, "impact");
          cam.t < .8 && !stopRef.current ? requestAnimationFrame(tick) : done();
        };
        tick();
      });
      cam.t = 0;
      v.playbackRate = .3; await v.play().catch(() => {});
      await playUntil(v, Math.min(v.duration - .05, last.t + .9), stopRef, (dt) => {
        const u = Math.min(1, (v.currentTime - last.t) / .9);
        toward(dt, F.zoom * (2.2 - .8 * u), lerp(body(who), px(spot), u * .6), 2, 1.4);
        frame(ctx, F, h, k, list.length, m, v, v.currentTime, cam, "replay");
      });
      v.pause();
    }
    // 3 winner freeze-frame
    frame(ctx, F, h, k, list.length, m, v, 1e9, cam, "winner");
    await wait(stopRef.current ? 0 : 1100);
  }
}

const TYPES = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm"];

export default function Highlights({ m, p }) {
  const all = useMemo(() => pickHighlights(m, p, 8), [m, p]);
  const [off, setOff] = useState(() => new Set());
  const [fmt, setFmt] = useState("vertical");
  const list = useMemo(() => all.filter((h) => !off.has(h.r.i)).slice(0, 5), [all, off]);
  const canvas = useRef(null), stop = useRef(false);
  const [state, setState] = useState("idle"); // idle | preview | recording
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null); // { url, blob, ext }
  const [msg, setMsg] = useState("");
  const F = FORMATS[fmt];
  const caption = `${m.names[p]}: top ${list.length} from ${m.event}. ${list.map((h) => cap(h.why.join(", "))).join(" · ")}. Analysed on-device with ShuttleCoach. #badminton #ShuttleCoach`;

  useEffect(() => { setOff(new Set()); setFile(null); }, [p]);
  useEffect(() => () => { stop.current = true; }, []);
  useEffect(() => { if (list.length && canvas.current && state === "idle" && !file) card(canvas.current.getContext("2d"), F, list[0], 0, list.length, m.names); }, [list, fmt, state, file, m.names]);

  const go = async (record) => {
    stop.current = false; setFile(null); setMsg(""); setState(record ? "recording" : "preview");
    await new Promise((r) => requestAnimationFrame(r)); // let the canvas mount again if a finished video was showing
    let rec, chunks = [], type;
    if (record) {
      type = TYPES.find((x) => MediaRecorder.isTypeSupported(x));
      rec = new MediaRecorder(canvas.current.captureStream(30), { mimeType: type, videoBitsPerSecond: 4e6 }); // ~4 Mbps: sharp at 720p, small enough to share
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.start(500);
    }
    await run(canvas.current, F, list, m, stop, setStep);
    if (rec) {
      await new Promise((ok) => { rec.onstop = ok; rec.stop(); });
      if (!stop.current) {
        const ext = type.startsWith("video/mp4") ? "mp4" : "webm", blob = new Blob(chunks, { type: type.split(";")[0] });
        setFile({ url: URL.createObjectURL(blob), blob, ext });
      }
    }
    setState("idle");
  };

  const name = `shuttlecoach_top${list.length}_${m.names[p].split(" ")[0].toLowerCase()}_${fmt === "vertical" ? "9x16" : "16x9"}`;
  const share = async () => {
    const f = new File([file.blob], `${name}.${file.ext}`, { type: file.blob.type });
    if (navigator.canShare?.({ files: [f] })) {
      try { await navigator.share({ files: [f], title: "ShuttleCoach highlights", text: caption }); setMsg("Shared."); } catch { setMsg("Sharing cancelled."); }
    } else setMsg("This browser cannot share files directly: download the video and post it with the caption.");
  };
  const copy = async () => { try { await navigator.clipboard.writeText(caption); setMsg("Caption copied."); } catch { setMsg("Could not copy; select the caption text instead."); } };

  return (
    <section className={`hl-grid ${fmt}`}>
      <div className="panel">
        <h3 className="panel-h">Auto-picked highlights for {m.names[p]}</h3>
        <p className="tiny muted">Scored from the labels: outright winners, rally length, smash finishes and pressure points (18+). Untick a rally to swap in the next best; the reel uses the top five.</p>
        <ol className="hl-list">
          {all.map((h) => {
            const on = !off.has(h.r.i), idx = list.indexOf(h);
            return (
              <li key={h.r.i} className={`${state !== "idle" && idx === step ? "on" : ""} ${on ? "" : "off"} ${on && idx < 0 ? "spare" : ""}`}>
                <label><input type="checkbox" checked={on} disabled={state !== "idle"} onChange={() => setOff((s) => { const n = new Set(s); n.has(h.r.i) ? n.delete(h.r.i) : n.add(h.r.i); return n; })} />
                  <span><b>{cap(h.why[0])}</b><em>{[...h.why.slice(1), `game ${h.r.set}`].join(" · ")}{on && idx < 0 ? " · reserve" : ""}</em></span></label>
              </li>
            );
          })}
        </ol>
        <div className="seg" role="radiogroup" aria-label="Format">
          {Object.entries(FORMATS).map(([k, f]) => <button key={k} role="radio" aria-checked={fmt === k} disabled={state !== "idle"} onClick={() => { setFmt(k); setFile(null); }}>{f.label}</button>)}
        </div>
        <p className="tiny muted">Camera: follows the shuttle between hitter and receiver; the replay ramps into slow motion and pushes in tight on the player who hits the winning shot, holds on contact, then eases out to where it lands and freezes on the winner. {F.note}.</p>
        <div className="hl-actions hl-sticky">
          {state === "idle" ? <>
            <button className="btn ghost" onClick={() => go(false)}>Preview reel</button>
            <button className="btn primary" onClick={() => go(true)}>Create video</button>
          </> : <button className="btn ghost" onClick={() => { stop.current = true; }}>{state === "recording" ? "Cancel" : "Stop"}</button>}
        </div>
        {state === "recording" && <p className="tiny muted">Recording highlight {step + 1} of {list.length}. The video is rendered in this browser and never uploaded.</p>}
        {file && (
          <div className="hl-done">
            <b>Your reel is ready · {(file.blob.size / 1e6).toFixed(1)} MB · .{file.ext}</b>
            <div className="hl-actions">
              <button className="btn primary" onClick={share}>Share…</button>
              <a className="btn ghost" href={file.url} download={`${name}.${file.ext}`}>Download</a>
              <button className="btn ghost" onClick={copy}>Copy caption</button>
            </div>
            <textarea readOnly value={caption} rows={3} aria-label="Suggested caption" />
            {msg && <p className="tiny muted">{msg}</p>}
            <p className="tiny muted">Sharing only happens when you pick an app; until then the video exists only on this device.</p>
          </div>
        )}
      </div>
      <div className="hl-view">
        {file && <video src={file.url} controls playsInline className="hl-canvas" />}
        <canvas ref={canvas} width={F.W} height={F.H} className="hl-canvas" hidden={!!file} aria-label="Highlight reel preview" />
      </div>
    </section>
  );
}
