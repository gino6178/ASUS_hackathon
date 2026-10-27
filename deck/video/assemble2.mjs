// Demo video v2 (after the review): a 3D title, a four-node overview, camera moves and HUD cards on the
// coaches, the round table and the safety gate. Cuts follow the Kokoro narration (build/kokoro/timings.json).
//   node assemble2.mjs        -> ShuttleCoach_demo.mp4, ShuttleCoach_demo_no_voice.mp4
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const B = path.resolve("build"), K = path.join(B, "kokoro");
const ff = (args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });
const dur = (f) => +execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString();
const FONT = "C\\:/Windows/Fonts/bahnschrift.ttf", MONO = "C\\:/Windows/Fonts/consola.ttf";
const NARR = JSON.parse(fs.readFileSync("narration.json", "utf8"));
const TIMES = JSON.parse(fs.readFileSync(path.join(K, "timings.json"), "utf8"));
const NLEN = TIMES.map((rows) => rows.at(-1).end);
const LEAD = [0.6, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4]; // the video opens on the 3D court (no broadcast footage)
const esc = (t) => t.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\u2019").replace(/%/g, "\\%");
const src = (f) => path.join(B, f + ".mp4");
const at = (scene, s, word) => { const r = TIMES[scene][s], k = word ? Math.max(0, r.text.indexOf(word)) / r.text.length : 0; return LEAD[scene] + r.start + k * (r.end - r.start) - 0.15; };
const BASE = ["scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2", "fps=30", "format=yuv420p"];
const text = (t, o) => `drawtext=expansion=none:fontfile='${o.font ?? FONT}':text='${esc(t)}':x=${o.x}:y=${o.y}:fontsize=${o.size}:fontcolor=${o.color ?? "0xEEF1F2"}:alpha='if(lt(t,${o.from}),0,if(lt(t,${o.from}+0.5),(t-${o.from})/0.5,1))'`;
const label = (t) => [`scale=1536:864,pad=1920:1080:192:150:color=0x04070A`, "fps=30", "format=yuv420p", `drawtext=fontfile='${FONT}':text='${esc(t)}':x=(w-text_w)/2:y=44:fontsize=68:fontcolor=0xF2E6C9`];

// scene lengths: the narration plus a breath, at least what the pictures need
const LEN = NLEN.map((n, i) => +(LEAD[i] + n + (i === 0 ? 0.9 : 1.2)).toFixed(2));
LEN[1] += 1.6; // the overview ends on the zooming grid

// [source, from, seconds, vf] per piece
const S = [];
{ // 1 · the 3D court with the title
  S.push([
    ["hero", 1.0, LEN[0], [...BASE,
      text("SHUTTLE COACH", { x: 110, y: 330, size: 150, from: 0.3 }),
      text("One camera in. A full coaching staff out. 100% offline.", { x: 116, y: 520, size: 44, color: "0xC3CACD", from: 2.6 }),
      text("BUILT FOR INTEL ARC PRO B70 · 32 GB", { x: 118, y: 610, size: 30, color: "0xF2E6C9", font: MONO, from: 4.2 })]]]);
}
{ // 2 · overview in four nodes, cut on the spoken words, then the grid zooms out
  const c = [0, at(1, 2), at(1, 3), at(1, 4), LEN[1] - 1.6];
  S.push([["s3b", 0.5, c[1] - c[0], label("Perception & 3D replay")],
    ["n_round", 0.5, c[2] - c[1], label("Round table")],
    ["SPLIT", 0, c[3] - c[2], null],
    ["s7", 2.0, c[4] - c[3], label("24-hour coach on Telegram")],
    ["GRID", 0, 1.6, null]]);
}
{ // 3 · drop a video in; the stages; the 3D replay
  const a = 8.5;
  S.push([["s3a", 0.3, a, BASE], ["s3b", 0.5, LEN[2] - a, BASE]]);
}
{ // 4 · the four coaches, each on screen while it is named
  const c = [0, at(3, 2), at(3, 3), at(3, 4), LEN[3]];
  S.push([["z4_tactics", 0.2, c[1], BASE], ["z4_technique", 0.2, c[2] - c[1], BASE], ["z4_fitness", 0.2, c[3] - c[2], BASE], ["z4_analyst", 0.2, c[4] - c[3], BASE]]);
}
{ // 5 · the clash and the ruling, then the question; the chat ends on its answer
  const c = at(4, 5), b = LEN[4] - c, zb = dur(src("z5b"));
  S.push([["z5a", 0.3, c, BASE], ["z5b", Math.max(0, zb - b - 0.1), b, BASE]]);
}
{ // 6 · knowledge base, playbooks, the safety gate, declined by a person
  S.push([["z6", 1.5, 7, BASE], ["z6", 12.0, LEN[5] - 7, BASE]]);
}
{ // 7 · Telegram up to the court offer, the search on the map, then the invitations and the booking
  const c1 = at(6, 3), c2 = at(6, 4);
  S.push([["s7", 0.3, c1, ["setpts=PTS/1.7", ...BASE]], ["map", 4.5, c2 - c1, BASE], ["s7", 15.2, LEN[6] - c2, ["setpts=PTS/1.36", ...BASE]]]); // the screencast stretches page time by about 1.36
}
{ // 8 · the agent, as an architecture animation of the real run; then the live trace page ("every step is logged")
  const c = at(7, 3), anim = 16.7;
  S.push([["agentanim", 0.3, c, [`setpts=PTS*${(c / anim).toFixed(4)}`, ...BASE]], ["trace", 2.0, LEN[7] - c, ["setpts=PTS/1.3", ...BASE]]]);
}
S.push([["s8", 0.2, LEN[8], BASE]]);

let n = 0;
const out = () => path.join(B, `q${String(n++).padStart(3, "0")}.mp4`);
const enc = ["-an", "-c:v", "libx264", "-crf", "17", "-preset", "fast"];
function piece([f, a, d, vf]) {
  const o = out();
  if (f === "SPLIT") { // voice answer and highlight reel side by side
    ff(["-ss", "6.0", "-i", src("n_voice"), "-ss", "1.0", "-i", src("n_high"), "-filter_complex",
      `[0:v]tpad=stop_mode=clone:stop_duration=5,crop=1100:1000:820:0,scale=900:-2[a];[1:v]tpad=stop_mode=clone:stop_duration=5,crop=1400:1000:260:40,scale=900:-2[b];` +
      `color=0x04070A:s=1920x1080:r=30[bg];[bg][a]overlay=40:190:shortest=1[x];[x][b]overlay=980:190:shortest=1,` +
      `drawtext=fontfile='${FONT}':text='Voice coach  ·  Auto highlights':x=(w-text_w)/2:y=44:fontsize=68:fontcolor=0xF2E6C9,format=yuv420p[v]`,
      "-map", "[v]", "-t", d.toFixed(3), ...enc, o]);
    return o;
  }
  if (f === "GRID") { // the nine features, zooming out from the centre tile
    const tiles = ["m_analyze", "m_match", "m_coaches", "m_roundtable", "m_live", "m_highlights", "m_voice", "m_lab", "s7"];
    const ins = tiles.flatMap((t) => ["-ss", t === "s7" ? "8" : "1", "-i", src(t)]);
    ff([...ins, "-filter_complex", `${tiles.map((_, i) => `[${i}:v]tpad=stop_mode=clone:stop_duration=3,scale=640:360,setpts=PTS-STARTPTS[v${i}]`).join(";")};` +
      `${tiles.map((_, i) => `[v${i}]`).join("")}xstack=inputs=9:layout=0_0|w0_0|w0+w1_0|0_h0|w0_h0|w0+w1_h0|0_h0+h1|w0_h0+h1|w0+w1_h0+h1,` +
      `zoompan=z='max(1,2.4-on*0.05)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30,format=yuv420p[v]`,
      "-map", "[v]", "-t", d.toFixed(3), ...enc, o]);
    return o;
  }
  ff(["-ss", String(a), "-i", src(f), "-t", d.toFixed(3), "-vf", [...vf, "tpad=stop_mode=clone:stop_duration=6"].join(","), ...enc, o]);
  return o;
}

fs.readdirSync(B).filter((f) => /^q\d+\.mp4$|^v2scene\d/.test(f)).forEach((f) => fs.rmSync(path.join(B, f)));
const scenes = [], starts = [];
let t = 0;
S.forEach((pieces, k) => {
  const made = pieces.map(piece), list = path.join(B, `v2scene${k + 1}.txt`), raw = path.join(B, `v2scene${k + 1}_raw.mp4`), sc = path.join(B, `v2scene${k + 1}.mp4`);
  fs.writeFileSync(list, made.map((m) => `file '${m.replace(/\\/g, "/")}'`).join("\n"));
  ff(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", raw]);
  const d = dur(raw);
  ff(["-i", raw, "-vf", `fade=t=in:st=0:d=${k ? 0.3 : 0.15},fade=t=out:st=${(d - 0.3).toFixed(2)}:d=0.3`, ...enc, sc]);
  starts.push(t); t += d; scenes.push(sc);
  console.log(`scene ${k + 1}: ${d.toFixed(1)} s (starts ${starts[k].toFixed(1)})`);
});
const all = path.join(B, "v2scenes.txt"), silent = path.join(B, "v2video.mp4");
fs.writeFileSync(all, scenes.map((m) => `file '${m.replace(/\\/g, "/")}'`).join("\n"));
ff(["-f", "concat", "-safe", "0", "-i", all, "-c", "copy", silent]);

// audio: the narration
const ins = [], mix = [];
NARR.forEach((_, i) => { ins.push("-i", path.join(K, `k${i + 1}.wav`)); const ms = Math.round((starts[i] + LEAD[i]) * 1000); mix.push(`[${i}:a]aresample=48000,adelay=${ms}|${ms}[a${i}]`); });
const m = NARR.length;
const voice = path.join(B, "v2audio.wav");
ff([...ins, "-filter_complex", `${mix.join(";")};${NARR.map((_, i) => `[a${i}]`).join("")}amix=inputs=${m}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[vo];[vo]apad=whole_dur=${t.toFixed(2)}[a]`,
  "-ar", "48000", "-map", "[a]", voice]);

// subtitles: one line at a time, timed from each spoken sentence
const MAXC = 58;
const lines = (s) => {
  const out = [];
  for (const w of s.split(/(?<=,)\s+/)) { const last = out.at(-1); if (last && (last + " " + w).length <= MAXC) out[out.length - 1] = last + " " + w; else out.push(w); }
  return out.flatMap((x) => { if (x.length <= MAXC + 12) return [x]; const ws = x.split(" "), h = Math.ceil(ws.length / 2); return [ws.slice(0, h).join(" "), ws.slice(h).join(" ")]; });
};
const ts = (s) => `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${(s % 60).toFixed(2).padStart(5, "0")}`;
let ass = `[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Sub,Segoe UI,42,&H00FFFFFF,&H00FFFFFF,&H00000000,&H9904070A,0,0,0,0,100,100,0,0,3,14,0,2,200,200,46,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
TIMES.forEach((rows, i) => rows.forEach((r, j) => {
  const t0 = starts[i] + LEAD[i] + r.start, t1 = starts[i] + LEAD[i] + (rows[j + 1] ? Math.min(r.end + 0.25, rows[j + 1].start) : r.end + 0.4);
  const ls = lines(r.text), chars = ls.reduce((s, l) => s + l.length, 0);
  let x = t0;
  ls.forEach((l, q) => { const e = q === ls.length - 1 ? t1 : x + (r.end - r.start) * l.length / chars; ass += `Dialogue: 0,${ts(x)},${ts(e)},Sub,,0,0,0,,${l}\n`; x = e; });
}));
fs.writeFileSync(path.join(B, "subs.ass"), ass);
fs.writeFileSync(path.join(B, "v2timeline.json"), JSON.stringify({ starts, lens: LEN, pieces: S.map((p) => p.map(([f, a, d]) => [f, a, +d.toFixed(2)])) }, null, 1));

const OUT = path.resolve("ShuttleCoach_demo.mp4"), OUT2 = path.resolve("ShuttleCoach_demo_no_voice.mp4");
ff(["-i", silent, "-i", voice, "-vf", "subtitles=build/subs.ass", "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-crf", "19", "-preset", "medium", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", OUT]);
ff(["-i", silent, "-c:v", "copy", "-movflags", "+faststart", OUT2]);
console.log("wrote", OUT, dur(OUT).toFixed(1), "s");
