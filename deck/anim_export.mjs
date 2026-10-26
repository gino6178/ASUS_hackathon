// Render anim/architecture.html frame by frame, then encode MP4 and GIF: node anim_export.mjs [captions=1]
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const FPS = 20;
const PAGE = process.argv[3] || "architecture";
const captions = process.argv[2] !== "0";
const dir = path.resolve(`anim/frames_${PAGE}` + (captions ? "" : "_nocap"));
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });

const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
const url = "file:///" + path.resolve(`anim/${PAGE}.html`).replace(/\\/g, "/") + `?export=1&captions=${captions ? 1 : 0}`;
await page.goto(url);
await page.evaluate(() => document.fonts.ready);
const L = await page.evaluate(() => window.LOOP_SECONDS);
const canvas = await page.$("canvas");
for (let i = 0; i < L * FPS; i++) {
  await page.evaluate((t) => window.render(t), i / FPS);
  await canvas.screenshot({ path: path.join(dir, `f${String(i).padStart(4, "0")}.png`) });
}
await browser.close();

const base = `anim/ShuttleCoach_${PAGE}` + (captions ? "" : "_nocaption");
const ff = (args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });
ff(["-framerate", String(FPS), "-i", path.join(dir, "f%04d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-movflags", "+faststart", base + ".mp4"]);
ff(["-framerate", String(FPS), "-i", path.join(dir, "f%04d.png"), "-vf",
  "scale=1280:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=sierra2_4a", "-loop", "0", base + ".gif"]);
console.log("wrote", base + ".mp4", base + ".gif");
