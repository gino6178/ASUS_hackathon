import { useEffect, useRef, useState } from "react";
import { speedColor } from "../data.js";

// Sample clip with the tracker's 2D detections drawn on top; reports the current frame upward.
export default function RallyPlayer({ rally, src, onFrame, seekRef, overlay = true }) {
  const vid = useRef(null);
  const cvs = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);

  useEffect(() => {
    if (seekRef) seekRef.current = (frame) => { const v = vid.current; if (v) { v.currentTime = frame / rally.fps + 1e-3; v.play(); } };
  }, [rally]);

  useEffect(() => {
    let raf;
    const draw = () => {
      const v = vid.current, c = cvs.current;
      if (v && c && rally) {
        const i = Math.min(rally.n - 1, Math.floor(v.currentTime * rally.fps));
        onFrame?.(i); setT(v.currentTime);
        const w = c.clientWidth, h = c.clientHeight;
        if (c.width !== w * 2) { c.width = w * 2; c.height = h * 2; }
        const ctx = c.getContext("2d");
        ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.clearRect(0, 0, w, h);
        if (overlay) {
          const s = Math.min(w / rally.width, h / rally.height), ox = (w - rally.width * s) / 2, oy = (h - rally.height * s) / 2;
          const P = (uv) => [ox + uv[0] * s, oy + uv[1] * s];
          ctx.lineCap = "round"; ctx.lineWidth = 2.5;
          for (let k = Math.max(1, i - 24); k <= i; k++) {
            const a = rally.frames[k - 1], b = rally.frames[k];
            if (!a?.uv || !b?.uv || a.s !== b.s) continue;
            ctx.strokeStyle = speedColor(rally.speed[k] || 0); ctx.globalAlpha = .25 + .75 * (k - i + 24) / 24;
            const [x1, y1] = P(a.uv), [x2, y2] = P(b.uv);
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
          }
          ctx.globalAlpha = 1;
          const f = rally.frames[i];
          if (f?.uv) {
            const [x, y] = P(f.uv);
            ctx.strokeStyle = "#f2e6c9"; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.stroke();
            const sp = rally.speed[i];
            if (sp != null) {
              ctx.font = "500 12px 'IBM Plex Mono', monospace"; ctx.fillStyle = "#f2e6c9";
              ctx.fillText(`${Math.round(sp)} km/h`, x + 14, y - 10);
            }
          }
        }
      }
    };
    const loop = () => { draw(); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    // seeks and time updates redraw too, so a paused video (or a throttled tab) still shows the right frame
    const v = vid.current;
    ["seeked", "timeupdate", "loadeddata"].forEach((e) => v.addEventListener(e, draw));
    return () => { cancelAnimationFrame(raf); ["seeked", "timeupdate", "loadeddata"].forEach((e) => v.removeEventListener(e, draw)); };
  }, [rally, overlay]);

  const toggle = () => { const v = vid.current; v.paused ? v.play() : v.pause(); };
  const dur = rally ? rally.duration : 1;
  return (
    <div className="player">
      <div className="player-stage" onClick={toggle}>
        <video ref={vid} src={src} muted playsInline loop preload="auto"
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
        <canvas ref={cvs} aria-hidden="true" />
        {!playing && <span className="play-badge" aria-hidden="true">▶</span>}
      </div>
      <div className="player-bar">
        <button className="icon-btn" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>{playing ? "❚❚" : "▶"}</button>
        <input type="range" min="0" max={dur} step="0.01" value={t} aria-label="Seek"
          onChange={(e) => { vid.current.currentTime = +e.target.value; }} />
        <span className="mono small">{t.toFixed(1)} / {dur.toFixed(1)} s</span>
      </div>
    </div>
  );
}
