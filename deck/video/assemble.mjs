// Cut the recorded scenes (build/*.mp4) to the script's timing, label the montage, add the narration track and
// burned-in subtitles, and write ShuttleCoach_demo.mp4 (plus a version without narration for a human voice-over).
//   node assemble.mjs
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const B = path.resolve("build");
const ff = (args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });
const dur = (f) => +execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString();
const FONT = "C\\:/Windows/Fonts/bahnschrift.ttf";
const ARCH = path.resolve("../anim/ShuttleCoach_architecture.mp4");
const NARR = JSON.parse(fs.readFileSync("narration.json", "utf8"));

// [file, from, to, label?] pieces per scene; each scene's pieces are joined, then the scene fades in and out
const SCENES = [
  [["s1", 0.3, 10.8]],
  [[ARCH, 0.6, 4.1], ["m_analyze", 0.8, 3.1, "Analyze a match"], ["m_match", 0.6, 2.9, "Match analysis"], ["m_coaches", 1.4, 3.7, "Four specialist coaches"],
   ["m_roundtable", 0.8, 3.1, "Round table"], ["m_live", 0.8, 3.1, "Live brief between points"], ["m_highlights", 0.8, 3.1, "Auto highlights"],
   ["m_voice", 3.0, 5.3, "Voice coach"], ["m_lab", 1.2, 3.5, "Lab: coaches that keep learning"], ["s7", 8.0, 10.3, "24-hour coach on Telegram"], ["GRID", 0, 1.8]],
  [["s3a", 0.3, 9.3], ["s3b", 0.5, 7.1]],
  [["s4_tactics", 0.3, 6.5], ["s4_technique", 0.5, 4.3], ["s4_fitness", 0.6, 4.4], ["s4_analyst", 0.5, 4.4]],
  [["s5a", 0.3, 12.6], ["s5b", 3.0, 13.0]],
  [["s6", 0.5, 19.2], ["s6", 23.5, 29.7]],
  [["s7", 0.3, 17.3]],
  [["s8", 0, 10]],
];

// the montage cuts on the word that names each feature: [piece index in scene 2, sentence, word]
const K = path.join(B, "kokoro"), LEAD = 0.4;
const TIMES = JSON.parse(fs.readFileSync(path.join(K, "timings.json"), "utf8"));
{
  const rows = TIMES[1], cue = (s, w) => { const r = rows[s], at = Math.max(0, r.text.indexOf(w)) / r.text.length; return LEAD + r.start + at * (r.end - r.start) - 0.15; };
  const cuts = [cue(1, "Analyse"), cue(2, "See"), cue(3, "Meet"), cue(3, "agree"), cue(4, "brief"), cue(4, "auto"), cue(4, "answers"), cue(5, "lab"), cue(6, "24-hour")];
  const m = SCENES[1], end = 26 - 1.6;
  m[0][2] = m[0][1] + cuts[0]; // architecture animation until "Analyse"
  cuts.forEach((c, i) => { const p = m[i + 1]; p[2] = p[1] + ((cuts[i + 1] ?? end) - c); });
}
{ // the four coaches: each page is on screen while its coach is named
  const rows = TIMES[3], at = (s) => LEAD + rows[s].start - 0.15, cuts = [0, at(2), at(3), at(4), 17.7];
  SCENES[3].forEach((p, i) => { p[2] = p[1] + cuts[i + 1] - cuts[i]; });
}

const src = (f) => (path.isAbsolute(f) ? f : path.join(B, f + ".mp4"));
const esc = (t) => t.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\u2019");
let n = 0;
const piece = (f, a, b, label, idx) => {
  const out = path.join(B, `p${String(n++).padStart(3, "0")}.mp4`);
  if (f === "GRID") { // the nine features at once: frames from the labelled pieces
    const ins = [], pieces = idx;
    pieces.forEach((p) => ins.push("-i", p));
    const scale = pieces.map((_, i) => `[${i}:v]trim=0:${b},setpts=PTS-STARTPTS,scale=640:360[v${i}]`).join(";");
    ff([...ins, "-filter_complex", `${scale};${pieces.map((_, i) => `[v${i}]`).join("")}xstack=inputs=9:layout=0_0|w0_0|w0+w1_0|0_h0|w0_h0|w0+w1_h0|0_h0+h1|w0_h0+h1|w0+w1_h0+h1,fps=30,format=yuv420p[v]`,
      "-map", "[v]", "-c:v", "libx264", "-crf", "17", "-preset", "fast", out]);
    return out;
  }
  // a labelled montage piece is shrunk to 80% under a band that carries the feature name
  const vf = label
    ? [`scale=1536:864,pad=1920:1080:192:150:color=0x04070A`, "fps=30", "format=yuv420p",
       `drawtext=fontfile='${FONT}':text='${esc(label)}':x=(w-text_w)/2:y=44:fontsize=68:fontcolor=0xF2E6C9`]
    : [`scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2`, "fps=30", "format=yuv420p"];
  // hold the last frame if a cue asks for longer than the clip has
  ff(["-ss", String(a), "-i", src(f), "-t", (b - a).toFixed(3), "-vf", [...vf, "tpad=stop_mode=clone:stop_duration=5"].join(","), "-an", "-c:v", "libx264", "-crf", "17", "-preset", "fast", out]);
  return out;
};

fs.readdirSync(B).filter((f) => /^p\d+\.mp4$|^scene\d\.mp4$/.test(f)).forEach((f) => fs.rmSync(path.join(B, f)));
const scenes = [], starts = [];
let t = 0;
SCENES.forEach((pieces, k) => {
  const made = [];
  for (const [f, a, b, label] of pieces) made.push(piece(f, a, b, label, made.filter((_, i) => pieces[i][3])));
  const list = path.join(B, `scene${k + 1}.txt`);
  fs.writeFileSync(list, made.map((m) => `file '${m.replace(/\\/g, "/")}'`).join("\n"));
  const joined = path.join(B, `scene${k + 1}_raw.mp4`), out = path.join(B, `scene${k + 1}.mp4`);
  ff(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", joined]);
  const d = dur(joined);
  ff(["-i", joined, "-vf", `fade=t=in:st=0:d=0.3,fade=t=out:st=${(d - 0.3).toFixed(2)}:d=0.3`, "-c:v", "libx264", "-crf", "17", "-preset", "fast", out]);
  starts.push(t); t += d; scenes.push(out);
  console.log(`scene ${k + 1}: ${d.toFixed(1)} s (starts ${starts[k].toFixed(1)})`);
});

// video only
const all = path.join(B, "scenes.txt");
fs.writeFileSync(all, scenes.map((m) => `file '${m.replace(/\\/g, "/")}'`).join("\n"));
const silent = path.join(B, "video_only.mp4");
ff(["-f", "concat", "-safe", "0", "-i", all, "-c", "copy", silent]);

// narration (Kokoro, made by tts.py on the station): each scene's voice starts 0.4 s into the scene
const ins = [], mix = [];
NARR.forEach((_, i) => { ins.push("-i", path.join(K, `k${i + 1}.wav`)); const ms = Math.round((starts[i] + LEAD) * 1000); mix.push(`[${i}:a]aresample=48000,adelay=${ms}|${ms}[a${i}]`); });
const voice = path.join(B, "narration.wav");
ff([...ins, "-filter_complex", `${mix.join(";")};${NARR.map((_, i) => `[a${i}]`).join("")}amix=inputs=${NARR.length}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,apad=whole_dur=${t.toFixed(2)}[a]`, "-ar", "48000", "-map", "[a]", voice]);

// subtitles: one short line at a time, timed from each spoken sentence; long sentences break at commas
const MAXC = 58;
const lines = (s) => {
  const out = [];
  for (const w of s.split(/(?<=,)\s+/)) {
    const last = out.at(-1);
    if (last && (last + " " + w).length <= MAXC) out[out.length - 1] = last + " " + w; else out.push(w);
  }
  return out.flatMap((x) => { // still too long: break between words near the middle
    if (x.length <= MAXC + 12) return [x];
    const ws = x.split(" "), half = Math.ceil(ws.length / 2);
    return [ws.slice(0, half).join(" "), ws.slice(half).join(" ")];
  });
};
const ts = (s) => { const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = (s % 60).toFixed(2).padStart(5, "0"); return `${h}:${String(m).padStart(2, "0")}:${x}`; };
let ass = `[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Sub,Segoe UI,42,&H00FFFFFF,&H00FFFFFF,&H00000000,&H9904070A,0,0,0,0,100,100,0,0,3,14,0,2,200,200,46,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
TIMES.forEach((rows, i) => rows.forEach((r, j) => {
  const t0 = starts[i] + LEAD + r.start, t1 = starts[i] + LEAD + (rows[j + 1] ? Math.min(r.end + 0.25, rows[j + 1].start) : r.end + 0.4);
  const ls = lines(r.text), chars = ls.reduce((s, l) => s + l.length, 0);
  let at = t0;
  ls.forEach((l, q) => { const end = q === ls.length - 1 ? t1 : at + (r.end - r.start) * l.length / chars; ass += `Dialogue: 0,${ts(at)},${ts(end)},Sub,,0,0,0,,${l}\n`; at = end; });
}));
const subs = path.join(B, "subs.ass");
fs.writeFileSync(subs, ass);

const OUT = path.resolve("ShuttleCoach_demo.mp4"), OUT2 = path.resolve("ShuttleCoach_demo_no_voice.mp4");
const subRel = path.relative(process.cwd(), subs).replace(/\\/g, "/");
ff(["-i", silent, "-i", voice, "-vf", `subtitles=${subRel}`, "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-crf", "19", "-preset", "medium", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", OUT]);
ff(["-i", silent, "-c:v", "copy", "-movflags", "+faststart", OUT2]);
console.log("wrote", OUT, dur(OUT).toFixed(1), "s, and", OUT2);
