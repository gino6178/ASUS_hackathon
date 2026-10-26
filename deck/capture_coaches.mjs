// Screenshots of the coach pages (dev server on :5190): node capture_coaches.mjs
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const BASE = "http://127.0.0.1:5190";
fs.mkdirSync("shots", { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1.5 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(`${BASE}/#/coaches`, { waitUntil: "networkidle0" });
await wait(800);
await page.screenshot({ path: "shots/coaches.png" });
for (const [id, ms] of [["fitness", 11000], ["tactics", 11000], ["technique", 9000], ["analyst", 8000]]) {
  await page.evaluate((i) => { location.hash = "/coach/" + i; }, id);
  await wait(ms);
  await page.screenshot({ path: `shots/coach_${id}.png`, fullPage: true });
  console.log("saved", id);
}
await page.evaluate(() => { location.hash = "/memory"; });
await wait(800);
await page.screenshot({ path: "shots/memory.png" });
console.log("errors:", errors.length ? errors : "none");
await browser.close();
