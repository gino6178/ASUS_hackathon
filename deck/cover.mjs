// High-quality cover loop: lossless PNG frames of the landing-page 3D rally (no page copy) -> H.264 MP4 for the deck.
// node cover.mjs  (dev server on :5190)
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const W = 1920, H = 1080, SECONDS = 14, FPS = 30;
const DIR = path.resolve("clips/_cover_frames");
fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--ignore-gpu-blocklist", "--enable-gpu-rasterization", `--window-size=${W},${H}`],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await page.goto("http://127.0.0.1:5190/#/", { waitUntil: "networkidle0" });
await page.addStyleTag({ content: ".nav,.hero-copy,.hud,.hero-shade{display:none!important} main{padding-top:0!important} .hero{height:100vh!important}" });
await new Promise((r) => setTimeout(r, 1500));

// CDP screencast in PNG keeps every frame lossless; timestamps let us rebuild real timing
const cdp = await page.createCDPSession();
const frames = [];
cdp.on("Page.screencastFrame", async (f) => {
  const file = path.join(DIR, `f${String(frames.length).padStart(5, "0")}.png`);
  frames.push({ file, t: f.metadata.timestamp });
  fs.writeFileSync(file, Buffer.from(f.data, "base64"));
  await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
});
await cdp.send("Page.startScreencast", { format: "png", maxWidth: W, maxHeight: H, everyNthFrame: 1 });
await new Promise((r) => setTimeout(r, SECONDS * 1000));
await cdp.send("Page.stopScreencast");
await browser.close();

// concat list with each frame's real duration, then resample to a constant frame rate
const list = frames.map((f, i) => `file '${f.file.replace(/\\/g, "/")}'\nduration ${((frames[i + 1]?.t ?? f.t + 1 / FPS) - f.t).toFixed(4)}`).join("\n")
  + `\nfile '${frames[frames.length - 1].file.replace(/\\/g, "/")}'\n`;
fs.writeFileSync(path.join(DIR, "list.txt"), list);
const span = frames[frames.length - 1].t - frames[0].t;
console.log(`${frames.length} frames over ${span.toFixed(1)} s (${(frames.length / span).toFixed(1)} fps captured)`);
execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", path.join(DIR, "list.txt"),
  "-vf", `fps=${FPS},scale=${W}:${H}:flags=lanczos,format=yuv420p`, "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", "14",
  "-movflags", "+faststart", "-an", "clips/cover.mp4"]);
execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", "2", "-i", "clips/cover.mp4", "-frames:v", "1", "shots/cover_poster.png"]);
console.log("cover.mp4", (fs.statSync("clips/cover.mp4").size / 1e6).toFixed(1), "MB");
