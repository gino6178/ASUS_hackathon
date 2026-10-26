// Record short screen clips of the running site (npm run dev on :5190) and turn them into looping GIFs for the deck.
// node record.mjs [clipName ...]
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const BASE = "http://127.0.0.1:5190";
const OUT = path.resolve("clips");
fs.mkdirSync(OUT, { recursive: true });
let VH = 900;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const only = process.argv.slice(2);

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--autoplay-policy=no-user-gesture-required", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });
const hideNav = () => page.addStyleTag({ content: ".nav{display:none!important} main{padding-top:0!important}" });

async function box(sel) {
  const h = await page.$(sel);
  await h.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await wait(500);
  const b = await h.boundingBox();
  const even = (v) => Math.max(2, Math.floor(v / 2) * 2);
  return { x: Math.max(0, Math.round(b.x)), y: Math.max(0, Math.round(b.y)), width: even(Math.min(b.width, 1600 - b.x)), height: even(Math.min(b.height, VH - Math.max(0, b.y))) };
}

async function record(name, crop, action, seconds, speed = 1) {
  if (only.length && !only.includes(name)) return;
  const webm = path.join(OUT, name + ".webm");
  const rec = await page.screencast({ path: webm, crop });
  await action();
  await wait(seconds * 1000);
  await rec.stop();
  await wait(300);
  const gif = path.join(OUT, name + ".gif");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", webm, "-vf",
    `setpts=PTS/${speed},fps=12,scale='min(1100,iw)':-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=200:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
    "-loop", "0", gif]);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", webm, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-vf", `setpts=PTS/${speed},scale=trunc(iw/2)*2:trunc(ih/2)*2`, path.join(OUT, name + ".mp4")]);
  console.log("clip", name, (fs.statSync(gif).size / 1e6).toFixed(1), "MB");
}

const OLD = !only.length || only.some((n) => !["roundtable", "match_tour", "live", "highlight"].includes(n));
if (OLD) {
// landing hero: the 3D rally replay
await page.goto(`${BASE}/#/`, { waitUntil: "networkidle0" });
await hideNav();
await wait(1200);
await record("hero", { x: 0, y: 0, width: 1600, height: 900 }, async () => {}, 13);

// cover background: only the 3D court and the rally, no page chrome or copy
await page.addStyleTag({ content: ".hero-copy,.hud,.hero-shade{display:none!important} .hero{height:100vh!important}" });
await wait(800);
await record("hero_clean", { x: 0, y: 0, width: 1600, height: 900 }, async () => {}, 13.5);

// upload -> processing
await page.goto(`${BASE}/#/analyze`, { waitUntil: "networkidle0" });
await hideNav();
await wait(600);
await record("process", { x: 0, y: 0, width: 1600, height: 900 }, async () => {
  await wait(1200);
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /sample match/i.test(b.textContent)).click());
}, 10.5);

// report: taller viewport so whole sections fit in one crop
VH = 1400;
await page.setViewport({ width: 1600, height: VH, deviceScaleFactor: 1 });
await page.goto(`${BASE}/#/report`, { waitUntil: "networkidle0" });
await page.reload({ waitUntil: "networkidle0" });
await hideNav();
await wait(1500);

const replayCrop = await box("#replay");
await record("replay", replayCrop, async () => {
  await page.evaluate(() => { const v = document.querySelector(".player video"); v.currentTime = 0; v.play(); });
}, 12.5);
await page.evaluate(() => document.querySelector(".player video").pause());

const heatCrop = only.length && !only.includes("heat") ? null : await box(".heat");
await record("heat", heatCrop, async () => {
  await wait(2500);
  await page.evaluate(() => document.querySelectorAll(".heat .seg button")[1].click());
  await wait(3000);
  await page.evaluate(() => document.querySelectorAll(".heat .seg button")[0].click());
}, 2.5);

const agentsCrop = only.length && !only.includes("agents") ? null : await box(".agents");
await record("agents", agentsCrop, async () => {
  await page.evaluate(() => document.querySelectorAll(".ask-row .chip")[0].click());
}, 8);

if (!only.length || only.includes("body")) await page.waitForFunction(() => !document.querySelector(".body3d-load"), { timeout: 60000 });
const bodyCrop = only.length && !only.includes("body") ? null : await box(".bodymap");
await record("body", bodyCrop, async () => {
  const click = (label) => page.evaluate((l) => [...document.querySelectorAll(".bm-tools .seg button")].find((b) => b.textContent === l).click(), label);
  const pick = (i) => page.evaluate((k) => document.querySelectorAll(".rank button")[k].click(), i);
  await wait(1200); await pick(1);
  await wait(1200); await click("Side");
  await wait(1500); await click("Back"); await pick(3);
  await wait(1800); await pick(2);
  await wait(1500); await click("Front"); await pick(0);
}, 1.5);

const sparCrop = only.length && !only.includes("sparring") ? null : await box(".sparring");
await record("sparring", sparCrop, async () => {
  const style = (i) => page.evaluate((k) => document.querySelectorAll(".sparring .seg button")[k].click(), i);
  const svg = await page.$(".sparring .court-map");
  const b = await svg.boundingBox();
  await wait(1000); await page.mouse.click(b.x + b.width * .3, b.y + b.height * .75);
  await wait(1300); await page.mouse.click(b.x + b.width * .7, b.y + b.height * .45);
  await wait(1300); await style(1);
  await wait(1500); await page.evaluate(() => [...document.querySelectorAll(".sparring button")].find((x) => /best base/i.test(x.textContent)).click());
  await wait(1500); await style(2);
}, 1.5);

// coach agents: record each coach page while its briefing plays
VH = 1000;
await page.setViewport({ width: 1600, height: VH, deviceScaleFactor: 1 });
for (const [id, secs] of [["fitness", 12], ["tactics", 12], ["technique", 12], ["analyst", 11]]) {
  if (only.length && !only.includes("coach_" + id)) continue;
  await page.goto(`${BASE}/#/coaches`, { waitUntil: "networkidle0" });
  await hideNav();
  await page.evaluate((i) => { location.hash = "/coach/" + i; }, id);
  await page.waitForSelector(".coach-body");
  await wait(id === "fitness" ? 1500 : 300);
  const crop = await box(".coach-body");
  await record("coach_" + id, crop, async () => { await page.evaluate(() => document.querySelector(".brief-foot button").click()); }, secs);
}

}

// match analysis, live mode and the round table
VH = 1000;
await page.setViewport({ width: 1600, height: VH, deviceScaleFactor: 1 });
if (!only.length || only.includes("match_tour")) {
  await page.goto(`${BASE}/#/match`, { waitUntil: "networkidle0" });
  await hideNav();
  await page.addStyleTag({ content: ".page{padding-top:16px!important}" });
  await wait(1500);
  const tab = (t) => page.evaluate((x) => [...document.querySelectorAll(".tabs > button")].find((b) => b.textContent.startsWith(x)).click(), t);
  await record("match_tour", { x: 0, y: 0, width: 1600, height: 1000 }, async () => {
    for (const t of ["Points", "Shot", "Highlight", "Footwork", "Fatigue"]) { await wait(2600); await tab(t); }
  }, 4);
}
if (!only.length || only.includes("live")) {
  await page.goto(`${BASE}/#/live`, { waitUntil: "networkidle0" });
  await hideNav();
  await page.addStyleTag({ content: ".page{padding-top:16px!important} .live-head + .live-grid .tiny{display:none}" });
  await page.waitForSelector(".live-ctl select");
  await page.select(".live-ctl select", "18");
  await page.evaluate(() => [...document.querySelectorAll(".live-ctl .btn")].find((b) => b.textContent === "2×").click());
  await wait(800);
  await record("live", { x: 0, y: 0, width: 1600, height: 1000 }, async () => {}, 30, 2);
}
if (!only.length || only.includes("highlight")) {
  // the 9:16 reel as it renders: follow-cam, slow-mo replay with punch-in, winner freeze
  await page.goto(`${BASE}/#/match?tab=reel`, { waitUntil: "networkidle0" });
  await hideNav();
  await wait(1200);
  const crop = await box(".hl-canvas");
  await record("highlight", crop, async () => {
    await page.evaluate(() => [...document.querySelectorAll(".hl-actions button")].find((b) => /Preview/.test(b.textContent)).click());
  }, 30, 1.25);
  await page.evaluate(() => [...document.querySelectorAll(".hl-actions button")].find((b) => /Stop/.test(b.textContent))?.click());
}
if (!only.length || only.includes("roundtable")) {
  await page.goto(`${BASE}/#/roundtable`, { waitUntil: "networkidle0" });
  await hideNav();
  await page.addStyleTag({ content: ".page{padding-top:16px!important}" });
  await page.waitForSelector(".rt-grid");
  // only the table and the conversation, so the clip fills its slot
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Restart/.test(b.textContent)).click());
  await wait(300);
  // put the table 24 px below the top of the frame and crop it with a little padding
  await page.evaluate(() => { const g = document.querySelector(".rt-grid"); window.scrollTo(0, g.getBoundingClientRect().top + scrollY - 24); });
  await wait(400);
  const rb = await page.evaluate(() => { const r = document.querySelector(".rt-grid").getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const even = (v) => Math.floor(v / 2) * 2;
  const rtCrop = { x: Math.max(0, even(rb.x - 16)), y: Math.max(0, even(rb.y - 16)), width: even(Math.min(1600, rb.w + 32)), height: even(Math.min(VH - Math.max(0, rb.y - 16), rb.h + 40)) };
  await record("roundtable", rtCrop, async () => {
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Restart/.test(b.textContent)).click());
  }, 20, 1.5);
  await page.evaluate(() => document.querySelector(".plan-sheet").scrollIntoView());
  await (await page.$(".plan-sheet")).screenshot({ path: "shots/plan.png" });
  console.log("shot plan.png");
}

await browser.close();
