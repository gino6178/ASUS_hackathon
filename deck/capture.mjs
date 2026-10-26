// Screenshots of the running ShuttleCoach site (npm run dev on :5190) for the deck: node capture.mjs
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const BASE = "http://127.0.0.1:5190";
const OUT = "shots";
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 2 });

// the fixed nav would cover element screenshots
const hideNav = () => page.addStyleTag({ content: ".nav{display:none!important} main{padding-top:0!important}" });

async function el(sel, file, pad = 0) {
  const h = await page.$(sel);
  await h.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await wait(700);
  await h.screenshot({ path: `${OUT}/${file}.png` });
  console.log("saved", file, pad);
}

// hero, mid-rally
await page.goto(`${BASE}/#/`, { waitUntil: "networkidle0" });
await wait(7200);
await page.screenshot({ path: `${OUT}/hero.png` });
// clean background for the deck cover: only the 3D court, no page chrome or copy
await page.addStyleTag({ content: ".nav,.hero-copy,.hud,.hero-shade{display:none!important} main{padding-top:0!important} .hero{height:100vh!important}" });
await wait(1500);
await page.screenshot({ path: `${OUT}/hero_clean.png` });
console.log("saved hero");

// upload page
await page.goto(`${BASE}/#/analyze`, { waitUntil: "networkidle0" });
await wait(500);
await page.screenshot({ path: `${OUT}/upload.png` });

// processing, about half way
await page.evaluate(() => (location.hash = "/processing"));
await wait(4300);
await page.screenshot({ path: `${OUT}/processing.png` });

// report
await page.goto(`${BASE}/#/report`, { waitUntil: "networkidle0" });
await page.reload({ waitUntil: "networkidle0" });
await wait(1500);
await hideNav();
await page.evaluate(async () => {
  const v = document.querySelector(".player video");
  v.currentTime = 5.62; await new Promise((r) => v.addEventListener("seeked", r, { once: true }));
});
await wait(800);
await el("#replay", "replay", 8);
await el(".replay-grid", "replay_top", 4);
await el(".pattern-grid", "patterns", 4);
await el(".heat-grid", "heat", 4);
await page.evaluate(() => document.querySelectorAll(".ask-row .chip")[0].click());
await wait(6500);
await el(".agents", "agents", 4);
await page.waitForFunction(() => !document.querySelector(".body3d-load"), { timeout: 60000 });
await wait(1500);
await el(".bodymap", "body_front", 4);
await page.evaluate(() => [...document.querySelectorAll(".bm-tools .seg button")].find((b) => b.textContent === "Back").click());
await wait(1200);
await el(".body3d", "body_back", 0);
await el(".sparring", "sparring", 4);
await browser.close();
