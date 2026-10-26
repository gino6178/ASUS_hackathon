import { useEffect, useRef } from "react";
import { createCourt } from "../court3d.js";

// frame: controlled frame index; when `loop` is set the component plays the rally by itself
export default function Court3D({ rally, frame = 0, loop = false, interactive = false, autoRotate = false, variant = "report", className = "" }) {
  const ref = useRef(null);
  const api = useRef(null);

  useEffect(() => {
    api.current = createCourt(ref.current, { interactive, autoRotate, frame: variant });
    return () => api.current.dispose();
  }, [interactive, autoRotate, variant]);

  useEffect(() => { if (rally) { api.current.setRally(rally); api.current.setFrame(frame); } }, [rally]);
  useEffect(() => { if (!loop) api.current?.setFrame(frame); }, [frame, loop]);

  useEffect(() => {
    if (!loop || !rally) return;
    let raf, start = performance.now();
    const tick = (t) => {
      const total = rally.n + 45; // short hold at the end of the rally
      const i = Math.floor(((t - start) / 1000) * rally.fps) % total;
      api.current.setFrame(Math.min(i, rally.n - 1), 70);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loop, rally]);

  return <canvas ref={ref} className={`court3d ${className}`} aria-label="3D court with the reconstructed shuttle flight" />;
}
