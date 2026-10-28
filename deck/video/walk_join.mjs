// Join the walkthrough parts (build/walk/wNN.webm from walkthrough.mjs) into ShuttleCoach_walkthrough.mp4:
// a title card from the demo's opening, then each part with a short fade.  node walk_join.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const D = "build/walk";
const ff = (...a) => execFileSync("ffmpeg", ["-v", "error", "-y", ...a], { stdio: "inherit" });
const dur = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());
const parts = fs.readdirSync(D).filter((f) => /^w\d+\.webm$/.test(f)).sort();

// title: the 3D court with the title, held still for a moment, from the demo video
// (one frame with all three lines on screen, without the subtitle band, held for 4 s)
ff("-ss", "6.4", "-i", "ShuttleCoach_demo.mp4", "-frames:v", "1", "-vf", "crop=1920:960:0:0,pad=1920:1080:0:60:color=0x04080B", `${D}/title.png`);
ff("-loop", "1", "-t", "4", "-i", `${D}/title.png`, "-vf", "fps=30,format=yuv420p,fade=t=in:st=0:d=0.4,fade=t=out:st=3.6:d=0.4", "-an", "-c:v", "libx264", "-crf", "18", "-preset", "fast", `${D}/p00.mp4`);
const list = [`${D}/p00.mp4`];
for (const f of parts) {
  const out = `${D}/p${f.slice(1, 3)}.mp4`, tmp = `${D}/t${f.slice(1, 3)}.mp4`;
  // screencast webm has no duration in its header: re-encode first, then fade at both ends
  ff("-i", `${D}/${f}`, "-vf", "fps=30,scale=1920:1080,format=yuv420p", "-an", "-c:v", "libx264", "-crf", "16", "-preset", "fast", tmp);
  const n = dur(tmp);
  // the first moment of a screencast can show the previous page: start a little in
  ff("-ss", "0.3", "-i", tmp, "-vf", `fade=t=in:st=0:d=0.35,fade=t=out:st=${(n - 0.75).toFixed(2)}:d=0.4`,
    "-an", "-c:v", "libx264", "-crf", "18", "-preset", "fast", out);
  list.push(out);
}
fs.writeFileSync(`${D}/list.txt`, list.map((f) => `file '${f.replace(`${D}/`, "")}'`).join("\n"));
ff("-f", "concat", "-safe", "0", "-i", `${D}/list.txt`, "-c", "copy", "-movflags", "+faststart", "ShuttleCoach_walkthrough.mp4");
console.log("ShuttleCoach_walkthrough.mp4", dur("ShuttleCoach_walkthrough.mp4").toFixed(1), "s");
