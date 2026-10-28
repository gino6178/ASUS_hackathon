// ShuttleCoach demo film, rebuilt with video-shotcraft recipes on the narrated cut (≤ 3 min).
// The footage of each scene is the narrated cut from deck/video (assemble2.mjs, v2sceneN_raw.mp4): it already
// follows the spoken words. This film re-stages it: a text-as-mask opening, the footage in a framed panel with a
// blur-slide chapter title, a panel hand-off between scenes, captions, and a logo-shrink lockup to close.
// No camera zoom anywhere (feedback on the earlier cut): the panel settles by tilt and rise, never by scale.
import React from 'react';
import { AbsoluteFill, Audio, Freeze, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { EASE, bezier, ramp } from './fx/Polish';
import { C, MONO, SANS, WIDE } from './theme';
import TL from './timeline.json';
import TIMES from './timings.json';

const FPS = 30;
const f = (s: number) => Math.round(s * FPS);
const LEAD = [0.6, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4]; // narration offset inside each scene (assemble2.mjs)
type Row = { text: string; start: number; end: number };
const T = TIMES as Row[][];

// SHOTS is the one source of truth: captions and SFX are derived from it
export const SHOTS = TL.starts.map((s: number, i: number) => ({ i, from: f(s), dur: f(TL.lens[i]) }));
export const END_HOLD = 45; // keeps the film under 3:00
export const TOTAL = SHOTS[9].from + SHOTS[9].dur + END_HOLD;
const spoken = (scene: number, row: number, word?: string) => {
  const r = T[scene][row], k = word ? Math.max(0, r.text.indexOf(word)) / r.text.length : 0;
  return SHOTS[scene].from + f(LEAD[scene] + r.start + k * (r.end - r.start));
};

const CHAPTERS: Record<number, [string, string]> = {
  1: ['How it is built', 'One Intel Arc card · no cloud'],
  2: ['What it does', 'Four things a player gets'],
  3: ['From one camera to 3D', 'Analysed on the station'],
  4: ['Four specialist coaches', 'Each reads the same match'],
  5: ['The round table', 'Written live by the local model'],
  6: ['Self-evolving coaches', 'They read, reflect and evolve their own playbooks'],
  7: ['A coach in your pocket', 'On Telegram, 24 hours a day'],
  8: ['The booking agent', 'Plans, searches and books, then waits for you'],
};

// ———————————————————————————————— backdrop ————————————————————————————————
const Backdrop: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg }}>
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse 60% 55% at 28% 8%, rgba(242,230,201,0.07), rgba(242,230,201,0) 70%)' }} />
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse 50% 50% at 90% 100%, rgba(95,211,154,0.05), rgba(95,211,154,0) 70%)' }} />
  </AbsoluteFill>
);

// ———————————————— 0 · text-as-mask opening (adapted: the letters open instead of a 46× rush) ————————————————
// card: opening/text-as-mask. Kept: wipe from the baseline + 1.04→1 settle, product drifting inside the letters with
// eased ends, eyebrow tracking in, subtitle rising, a breath before the hand-over. Changed: the 46× push-through
// becomes the mask dissolving over the full-frame 3D rally (the earlier cut was criticised for zooming).
const WORD_A = 'SHUTTLE', WORD_B = 'COACH';
const maskSvg = (fill: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><g font-family="Manrope, Arial Black, sans-serif" font-weight="800" font-size="300" letter-spacing="-12" text-anchor="middle" fill="${fill}">` +
  `<text x="960" y="430">${WORD_A}</text><text x="960" y="710">${WORD_B}</text></g></svg>`;
const MASK = `url("data:image/svg+xml,${encodeURIComponent(maskSvg('white'))}")`;
const SHADOW = `data:image/svg+xml,${encodeURIComponent(maskSvg('#0e2a1e'))}`;

const TitleOpen: React.FC<{ dur: number }> = ({ dur }) => {
  const fr = useCurrentFrame();
  const intro = ramp(fr, 0, 18, EASE.snappy), wipe = ramp(fr, 0, 16, EASE.out);
  const drift = ramp(fr, 18, 132, bezier(0.3, 0, 0.7, 1));
  const breath = ramp(fr, dur - 34, 8, EASE.swift);
  const open = 0; // no hand-over to the full rally: that was the old cover
  const leave = ramp(fr, dur - 26, 22, EASE.exit);
  const s = 1; // no scale moves (user feedback): the wipe and the drift carry the entrance
  const eyebrow = ramp(fr, 6, 20, EASE.out), sub = ramp(fr, 26, 18, EASE.out), chip = ramp(fr, 48, 18, EASE.out);
  const textOut = 1 - leave;
  const clip = `inset(0 0 ${((1 - wipe) * 760).toFixed(1)}px 0)`;
  const inside = (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, #1d5a42 0%, #123c2c 45%, #0b2219 100%)' }}>
      <OffthreadVideo src={staticFile('clips/hero.mp4')} startFrom={30} muted
        style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, objectFit: 'cover', mixBlendMode: 'screen', transformOrigin: '0 0',
          transform: `translate(${(-520 + 260 * (1 - drift)).toFixed(1)}px, -700px) scale(1.75)` }} />
    </div>
  );
  const rally = (
    <OffthreadVideo src={staticFile('clips/hero.mp4')} startFrom={30} muted
      style={{ position: 'absolute', inset: 0, width: 1920, height: 1080, objectFit: 'cover',
        transform: `translateX(${((150 - 300 * drift) * (1 - open)).toFixed(1)}px) translateY(${(-60 * (1 - open)).toFixed(1)}px)` }} />
  );
  return (
    <AbsoluteFill style={{ overflow: 'hidden', opacity: 1 - leave }}>
      <Backdrop />
      <img src={SHADOW} style={{ position: 'absolute', left: 0, top: 22, width: 1920, height: 1080, opacity: 0.55 * intro * (1 - open), filter: 'blur(20px)', transform: `scale(${s})`, clipPath: clip }} />
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${s})`, clipPath: clip, WebkitMaskImage: MASK, maskImage: MASK,
        WebkitMaskSize: '1920px 1080px', maskSize: '1920px 1080px', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', opacity: 1 - open }}>
        {inside}
      </div>
      <div style={{ position: 'absolute', top: 96, width: '100%', textAlign: 'center', opacity: eyebrow * textOut, fontFamily: MONO, fontSize: 24, color: C.ink2,
        letterSpacing: `${(0.16 + (1 - eyebrow) * 0.3).toFixed(3)}em` }}>ASUS UGEN AI LEAGUE 2026 · BATTLEFIELD THUNDERSTORM</div>
      <div style={{ position: 'absolute', top: 770, width: '100%', textAlign: 'center', fontFamily: SANS, fontSize: 46, fontWeight: 500, color: C.ink2,
        opacity: sub * textOut, transform: `translateY(${((1 - sub) * 16).toFixed(1)}px)` }}>
        One camera in. <span style={{ color: C.ink, fontWeight: 700 }}>A self-evolving coaching staff out.</span> 100% offline.
      </div>
      <div style={{ position: 'absolute', top: 858, width: '100%', textAlign: 'center', opacity: chip * textOut }}>
        <span style={{ fontFamily: MONO, fontSize: 26, color: C.accent, letterSpacing: '0.12em', padding: '10px 22px', border: `1px solid rgba(242,230,201,0.35)`, borderRadius: 999 }}>BUILT FOR INTEL ARC PRO B70 · 32 GB</span>
      </div>
    </AbsoluteFill>
  );
};

// ———————————————— blur-slide chapter title (card: typography/blur-slide) ————————————————
// y, blur and opacity share one progress per word; the subtitle starts before the title has settled
const Words: React.FC<{ text: string; start: number; step: number; dur: number; dy: number; blur: number; style: React.CSSProperties }> = ({ text, start, step, dur, dy, blur, style }) => {
  const fr = useCurrentFrame();
  return (
    <div style={{ display: 'flex', gap: '0.26em', whiteSpace: 'nowrap', ...style }}>
      {text.split(' ').map((w, i) => {
        const p = ramp(fr, start + i * step, dur, EASE.out);
        return <span key={i} style={{ display: 'inline-block', opacity: p, transform: `translateY(${((1 - p) * dy).toFixed(2)}px)`, filter: p >= 0.999 ? undefined : `blur(${((1 - p) * blur).toFixed(2)}px)` }}>{w}</span>;
      })}
    </div>
  );
};
const Chapter: React.FC<{ n: number; title: string; sub: string; dur: number }> = ({ n, title, sub, dur }) => {
  const fr = useCurrentFrame();
  const out = 1 - ramp(fr, dur - 12, 10, EASE.exit);
  const rule = ramp(fr, 2, 24, EASE.snappy);
  return (
    <div style={{ position: 'absolute', left: 128, right: 128, top: 26, height: 80, opacity: out }}>
      <div style={{ position: 'absolute', left: 0, top: 18, fontFamily: MONO, fontSize: 24, color: C.accent, letterSpacing: '0.14em', opacity: ramp(fr, 0, 16, EASE.out) }}>{String(n).padStart(2, '0')}</div>
      <Words text={title} start={4} step={4} dur={22} dy={28} blur={14} style={{ position: 'absolute', left: 62, top: 6, fontFamily: SANS, fontSize: 44, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }} />
      <Words text={sub} start={16} step={2.4} dur={20} dy={14} blur={8} style={{ position: 'absolute', right: 0, top: 16, fontFamily: SANS, fontSize: 30, fontWeight: 500, color: C.ink2, justifyContent: 'flex-end' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 78, height: 1.5, background: C.line, transform: `scaleX(${rule.toFixed(4)})`, transformOrigin: '0 50%' }} />
    </div>
  );
};

// ———————————————— the footage in a framed panel; it settles by tilt and rise, never by scale ————————————————
const PX = 128, PY = 122, PW = 1664, PH = 936;
const Panel: React.FC<{ src: string; dur: number; color?: string; rate?: number }> = ({ src, dur, color = C.accent, rate = 1 }) => {
  const fr = useCurrentFrame();
  const inP = ramp(fr, 0, 21, EASE.snappy); // ~21f entrance: the "professional, trustworthy" preset, no bounce
  const outP = ramp(fr, dur - 12, 12, EASE.exit);
  const tilt = 9 * (1 - inP), rise = 70 * (1 - inP) - 50 * outP;
  return (
    <div style={{ position: 'absolute', left: PX, top: PY, width: PW, height: PH, perspective: 2200, opacity: inP * (1 - outP) }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 22, overflow: 'hidden', transform: `translateY(${rise.toFixed(1)}px) rotateX(${tilt.toFixed(2)}deg)`, transformOrigin: '50% 100%',
        boxShadow: `0 40px 120px rgba(0,0,0,0.65), 0 0 0 1.5px ${C.line}`, filter: outP > 0.001 ? `blur(${(outP * 6).toFixed(2)}px)` : undefined, background: C.surface }}>
        <OffthreadVideo src={staticFile(src)} muted playbackRate={rate} style={{ width: PW, height: PH, objectFit: 'cover' }} />
        {/* one thin accent edge on top: the panel is a window onto the app */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 3, background: `linear-gradient(90deg, ${color}, rgba(0,0,0,0) 70%)`, opacity: 0.8 }} />
      </div>
    </div>
  );
};

// ———————————————— 2 · overview as a 2×2 split (card: rhythm/quad-split-parallel-scenes) ————————————————
// all four features stay on screen for the whole line; each tile wakes (plays, full colour, accent frame) as it is
// named, so nothing flashes past. Kept from the card: four parallel scenes, staggered beats, a final all-four hold.
type Tile = { label: string; clips: [string, number, number][] }; // [file, startFrom (s), switch at (frame in scene)]
const Overview: React.FC<{ dur: number; at: number[] }> = ({ dur, at }) => {
  const fr = useCurrentFrame();
  const TILES: Tile[] = [
    { label: 'Perception & 3D replay', clips: [['ov_s3b.mp4', 0.5, 0]] },
    { label: 'Round table', clips: [['ov_n_round.mp4', 0.5, 0]] },
    { label: 'Voice coach · Auto highlights', clips: [['ov_n_voice.mp4', 6.0, 0], ['ov_n_high.mp4', 1.0, at[4] - at[2]]] },
    { label: 'Coach on Telegram', clips: [['ov_s7.mp4', 2.0, 0]] },
  ];
  const W = 800, H = 430, X = [144, 976], Y = [134, 588];
  const outP = ramp(fr, dur - 12, 12, EASE.exit);
  return (
    <AbsoluteFill style={{ opacity: 1 - outP }}>
      {TILES.map((t, i) => {
        const inP = ramp(fr, i * 4, 21, EASE.snappy); // staggered by 4 frames, as the card asks
        const on = ramp(fr, at[i], 10, EASE.out);
        const local = fr - at[i];
        const cur = [...t.clips].reverse().find((c) => local >= c[2]) ?? t.clips[0];
        const vid = <OffthreadVideo src={staticFile('clips/' + cur[0])} muted startFrom={Math.round(cur[1] * FPS)} style={{ width: W, height: H, objectFit: 'cover' }} />;
        return (
          <div key={i} style={{ position: 'absolute', left: X[i % 2], top: Y[i >> 1], width: W, height: H, opacity: inP, transform: `translateY(${((1 - inP) * 40).toFixed(1)}px)` }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: 18, overflow: 'hidden', background: C.surface, boxShadow: `0 30px 90px rgba(0,0,0,0.6), 0 0 0 ${on > 0.01 ? 3 : 1.5}px ${on > 0.01 ? C.accent : C.line}`,
              filter: `saturate(${(0.25 + 0.75 * on).toFixed(2)}) brightness(${(0.55 + 0.45 * on).toFixed(2)})` }}>
              <Sequence from={0} layout="none">{local < 0 ? <Freeze frame={0}>{vid}</Freeze> : <Sequence from={at[i] + cur[2]} layout="none">{vid}</Sequence>}</Sequence>
            </div>
            <div style={{ position: 'absolute', left: 18, top: 16, fontFamily: SANS, fontSize: 28, fontWeight: 700, color: on > 0.5 ? C.bg : C.ink, background: on > 0.5 ? C.accent : 'rgba(4,7,10,0.8)',
              padding: '6px 16px', borderRadius: 10 }}>{t.label}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ———————————————— 6 · the evolution loop over the Lab footage ————————————————
// five steps of one night, lit in turn as the narration reaches them; the return arrow closes the loop (v+1 → next night)
const STEPS: [string, string][] = [
  ['Research agent', 'reads new sports-science papers every night'],
  ['Reflect', 'each coach reviews your feedback and its rejected drafts'],
  ['Propose', 'a new version of its own playbook'],
  ['Gate', 'cites a study, passes safety and regression tests; health waits for a human'],
  ['Adopt v+1', 'used from the next reply; every version can be rolled back'],
];
const EvolveLoop: React.FC<{ dur: number; lit: number[] }> = ({ dur, lit }) => {
  const fr = useCurrentFrame();
  const inP = ramp(fr, 0, 21, EASE.snappy), outP = ramp(fr, dur - 14, 14, EASE.exit);
  const W = 1600, X = (1920 - W) / 2, Y = 300, CW = 268, GAP = (W - 80 - 5 * CW) / 4;
  const loop = ramp(fr, lit[4] + 8, 24, EASE.swift);
  return (
    <AbsoluteFill style={{ opacity: inP * (1 - outP) }}>
      <div style={{ position: 'absolute', left: PX, top: PY, width: PW, height: PH, borderRadius: 22, background: 'rgba(4,7,10,0.93)' }} />
      <div style={{ position: 'absolute', left: X, top: Y - 110, width: W, transform: `translateY(${((1 - inP) * 30).toFixed(1)}px)` }}>
        <div style={{ fontFamily: MONO, fontSize: 24, color: C.accent, letterSpacing: '0.16em' }}>EVERY NIGHT, ON THE STATION</div>
        <div style={{ fontFamily: SANS, fontSize: 52, fontWeight: 800, color: C.ink, marginTop: 8 }}>Each coach agent evolves its own playbook</div>
      </div>
      {STEPS.map(([h, b], i) => {
        const on = ramp(fr, lit[i], 12, EASE.out);
        return (
          <div key={i} style={{ position: 'absolute', left: X + 40 + i * (CW + GAP), top: Y + 40, width: CW, height: 310, borderRadius: 18, padding: '22px 22px', boxSizing: 'border-box',
            background: C.surface, border: `2px solid ${on > 0.5 ? C.accent : C.line}`, transform: `translateY(${((1 - on) * 12).toFixed(1)}px)`,
            boxShadow: on > 0.5 ? '0 0 40px rgba(242,230,201,0.18)' : 'none' }}>
            <div style={{ opacity: 0.3 + 0.7 * on }}><div style={{ fontFamily: MONO, fontSize: 22, color: C.accent }}>{String(i + 1).padStart(2, '0')}</div>
            <div style={{ fontFamily: SANS, fontSize: 32, fontWeight: 800, color: C.ink, marginTop: 8 }}>{h}</div>
            <div style={{ fontFamily: SANS, fontSize: 22, fontWeight: 500, color: C.ink2, marginTop: 10, lineHeight: 1.28 }}>{b}</div></div>
            {i < 4 && <div style={{ position: 'absolute', right: -GAP + 8, top: 140, width: GAP - 16, height: 3, background: on > 0.5 ? C.accent : C.line }} />}
          </div>
        );
      })}
      {/* the return path: v+1 feeds the next night's run */}
      <svg width={W} height={140} style={{ position: 'absolute', left: X, top: Y + 360, overflow: 'visible' }}>
        <path d={`M ${W - 40 - CW / 2} 0 V 70 H ${40 + CW / 2} V 0`} fill="none" stroke={C.accent} strokeWidth={3} strokeDasharray="2400" strokeDashoffset={(2400 * (1 - loop)).toFixed(0)} />
        <polygon points={`${40 + CW / 2 - 9},12 ${40 + CW / 2 + 9},12 ${40 + CW / 2},-2`} fill={C.accent} opacity={loop > 0.98 ? 1 : 0} />
        <text x={W / 2} y={104} textAnchor="middle" fontFamily={MONO} fontSize={24} fill={C.accent} opacity={loop}>v+1 → the next night starts from the improved coach</text>
      </svg>
    </AbsoluteFill>
  );
};

// ———————————————— 9 · logo-shrink-wordmark-lockup (card: outro/logo-shrink-wordmark-lockup) ————————————————
const inOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const outCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const seg = (x: number, a: number, b: number) => Math.min(1, Math.max(0, (x - a) / (b - a)));
const Lockup: React.FC<{ land: number; dur: number }> = ({ land, dur }) => {
  const fr = useCurrentFrame();
  const L = 132, t = (fr - (land - Math.round(0.28 * L))) / L; // the ring lands on the spoken "ShuttleCoach"
  const shrink = inOutCubic(seg(t, 0.02, 0.28)), brake = t > 0.26 && t < 0.37 ? Math.sin(Math.PI * seg(t, 0.26, 0.37)) * 0.06 : 0;
  const sc = 1; // no scale: the ring draws on at its final size, then heals into the mark
  const heal = seg(t, 0.1, 0.28), swap = seg(t, 0.24, 0.32), shift = inOutCubic(seg(t, 0.34, 0.47));
  const R = 64, word = 'ShuttleCoach', ICON = 150, GROUP = 820;
  const iconX = 960 - (GROUP / 2 - ICON / 2) * shift;
  const tag = seg(t, 0.72, 0.84), extra = ramp(fr, land + 100, 24, EASE.out), foot = ramp(fr, land + 115, 24, EASE.out);
  const fade = 1 - ramp(fr, dur - 18, 18, EASE.swift);
  if (t < 0) return null;
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <div style={{ position: 'absolute', left: iconX - ICON / 2, top: 420 - ICON / 2, width: ICON, height: ICON, transform: `scale(${sc.toFixed(4)})` }}>
        <svg viewBox="0 0 150 150" width={ICON} height={ICON} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          {/* the neon ring, open at the top right, healing as it shrinks */}
          <circle cx={75} cy={75} r={R} fill="none" stroke={C.accent} strokeWidth={5} strokeDasharray={`${(2 * Math.PI * R * (0.82 * shrink + 0.18 * heal)).toFixed(1)} 999`}
            transform={`rotate(${(-60 + 140 * shrink).toFixed(1)} 75 75)`} opacity={1 - swap} style={{ filter: `drop-shadow(0 0 ${(18 * (1 - heal)).toFixed(1)}px ${C.accent})` }} />
        </svg>
        {/* the app's mark: a shuttle's flight arc ending in the shuttle */}
        <svg viewBox="0 0 64 64" width={ICON} height={ICON} style={{ position: 'absolute', inset: 0, opacity: swap }}>
          <rect width="64" height="64" rx="14" fill={C.surface} stroke={C.line} />
          <path d="M14 46 C 24 10, 40 10, 50 30" fill="none" stroke={C.accent} strokeWidth={4} strokeLinecap="round" />
          <circle cx="50" cy="30" r="5" fill={C.accent} />
        </svg>
      </div>
      <div style={{ position: 'absolute', left: iconX + ICON / 2 + 40, top: 420 - 62, display: 'flex', fontFamily: SANS, fontSize: 104, fontWeight: 800, color: C.ink, letterSpacing: '-0.02em' }}>
        {word.split('').map((ch, i) => {
          const p = outCubic(seg(t, 0.46 + i * (0.24 / word.length), 0.56 + i * (0.24 / word.length)));
          return <span key={i} style={{ opacity: p, transform: `translateX(${((1 - p) * 8).toFixed(1)}px)` }}>{ch}</span>;
        })}
      </div>
      <div style={{ position: 'absolute', top: 560, width: '100%', textAlign: 'center', fontFamily: MONO, fontSize: 30, letterSpacing: '0.18em', color: C.accent, opacity: tag }}>A SELF-EVOLVING COACHING STAFF · NEVER LEAVES YOUR COURT</div>
      <div style={{ position: 'absolute', top: 660, width: '100%', display: 'flex', justifyContent: 'center', gap: 22, opacity: extra, transform: `translateY(${((1 - extra) * 14).toFixed(1)}px)` }}>
        {['100% local processing', 'Self-evolving coach agents', 'Multi-agent round table', 'Built for Intel Arc Pro B70 · 32 GB'].map((b, i) => (
          <span key={b} style={{ fontFamily: SANS, fontSize: 27, fontWeight: 600, color: i === 0 ? C.green : i === 1 ? C.accent : C.ink, padding: '12px 22px', borderRadius: 14, border: `1.5px solid ${i === 0 ? 'rgba(95,211,154,0.5)' : i === 1 ? 'rgba(242,230,201,0.55)' : C.line}`, background: 'rgba(12,20,24,0.8)' }}>{b}</span>
        ))}
      </div>
      <div style={{ position: 'absolute', top: 800, width: '100%', textAlign: 'center', fontFamily: MONO, fontSize: 32, color: C.ink, letterSpacing: '0.06em', opacity: foot }}>Team rm-rf-2 · github.com/gino6178/ASUS_hackathon</div>
    </AbsoluteFill>
  );
};

// ———————————————— captions: one line at a time, timed from each spoken sentence ————————————————
const MAXC = 56;
const split = (s: string) => {
  const out: string[] = [];
  for (const w of s.split(/(?<=,)\s+/)) { const last = out[out.length - 1]; if (last && (last + ' ' + w).length <= MAXC) out[out.length - 1] = last + ' ' + w; else out.push(w); }
  return out.flatMap((x) => { if (x.length <= MAXC + 10) return [x]; const ws = x.split(' '), h = Math.ceil(ws.length / 2); return [ws.slice(0, h).join(' '), ws.slice(h).join(' ')]; });
};
export const CAPTIONS = T.flatMap((rows, i) => rows.flatMap((r, j) => {
  const t0 = TL.starts[i] + LEAD[i] + r.start, t1 = TL.starts[i] + LEAD[i] + (rows[j + 1] ? Math.min(r.end + 0.25, rows[j + 1].start) : r.end + 0.4);
  const ls = split(r.text), chars = ls.reduce((s, l) => s + l.length, 0);
  let x = t0;
  return ls.map((l, q) => { const e = q === ls.length - 1 ? t1 : x + (r.end - r.start) * l.length / chars; const c = { from: f(x), dur: Math.max(6, f(e) - f(x)), text: l }; x = e; return c; });
}));
const Cap: React.FC<{ text: string; dur: number }> = ({ text, dur }) => {
  const fr = useCurrentFrame();
  const a = interpolate(fr, [0, 5, dur - 4, dur], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 44, display: 'flex', justifyContent: 'center', opacity: a }}>
      <span style={{ fontFamily: SANS, fontSize: 44, fontWeight: 600, color: C.ink, background: 'rgba(4,7,10,0.82)', padding: '10px 28px 12px', borderRadius: 14, letterSpacing: '-0.005em' }}>{text}</span>
    </div>
  );
};

// ———————————————— SFX table: every entry relative to its shot ————————————————
const S = SHOTS;
export const SFX: { from: number; src: string; volume: number; dur?: number; note: string }[] = [
  { from: S[0].from + 0, src: 'transition-soft.mp3', volume: 0.35, note: 'title letters wipe up from the baseline' },
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => ({ from: S[k].from - 2, src: 'swoosh-slow.mp3', volume: 0.22, dur: 45, note: `panel ${k} rises in` })),
  { from: spoken(9, 1) - 70, src: 'riser-cine.mp3', volume: 0.3, dur: 70, note: 'riser into the lockup' },
  { from: spoken(9, 1), src: 'impact-cine-big.mp3', volume: 0.45, note: 'the ring lands as the mark' },
  { from: spoken(9, 1) + 20, src: 'shimmer-sparkle-sweep.mp3', volume: 0.22, note: 'wordmark letters slide in' },
];

export const Main: React.FC<{ bgm: boolean }> = ({ bgm }) => {
  const land = spoken(9, 1) - S[9].from;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Backdrop />
      <Sequence from={S[0].from} durationInFrames={S[0].dur + 8}><TitleOpen dur={S[0].dur} /></Sequence>
      {[1, 2, 3, 4, 5, 6, 7, 8].map((k) => (
        <Sequence key={k} from={S[k].from} durationInFrames={S[k].dur + 8}>
          {k === 2 ? <Overview dur={S[k].dur + 8} at={[1, 2, 3, 4].map((r) => spoken(2, r) - S[2].from).concat([spoken(2, 3, 'highlights') - S[2].from])} />
            : <Panel src={`clips/scene${k + 1}.mp4`} dur={S[k].dur + 8} />}
          <Chapter n={k} title={CHAPTERS[k][0]} sub={CHAPTERS[k][1]} dur={S[k].dur + 8} />
        </Sequence>
      ))}
      {/* "built for a single Intel Arc Pro B70 workstation": the hardware animation, then the lockup */}
      {/* 6 · the evolution loop, from the first word to "Every change must cite a study" */}
      <Sequence from={S[6].from + 8} durationInFrames={spoken(6, 3) - S[6].from - 8}>
        <EvolveLoop dur={spoken(6, 3) - S[6].from - 8} lit={[spoken(6, 1) - 12, spoken(6, 1, 'each coach') - 30, spoken(6, 1, 'proposes'), spoken(6, 2), spoken(6, 2) + 30].map((x) => x - S[6].from - 8)} />
      </Sequence>
      <Sequence from={S[9].from} durationInFrames={land - 40}>
        <Panel src="clips/hardware.mp4" dur={land - 40} rate={1.6} />
        <Chapter n={9} title="One workstation" sub="Intel Arc Pro B70 · 32 GB · no cloud" dur={land - 40} />
      </Sequence>
      <Sequence from={S[9].from}><Lockup land={land} dur={S[9].dur + END_HOLD} /></Sequence>
      {CAPTIONS.map((c, i) => <Sequence key={i} from={c.from} durationInFrames={c.dur}><Cap text={c.text} dur={c.dur} /></Sequence>)}
      <Audio src={staticFile('audio/narration.wav')} />
      {bgm && <Audio src={staticFile('audio/house-vibez.mp3')} volume={(fr) => 0.07 * interpolate(fr, [0, 45, TOTAL - 90, TOTAL], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} loop />}
      {SFX.map((s, i) => <Sequence key={i} from={s.from} durationInFrames={s.dur}><Audio src={staticFile('audio/sfx/' + s.src)} volume={s.volume} /></Sequence>)}
    </AbsoluteFill>
  );
};
