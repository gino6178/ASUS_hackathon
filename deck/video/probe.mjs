// List each page's headings and interactive anchors, and save a screenshot, to plan the demo recording.
import puppeteer from "puppeteer-core";
import fs from "node:fs";
const B = "http://127.0.0.1:5190";
const routes = process.argv.slice(2).length ? process.argv.slice(2) : ["", "analyze", "match", "coaches", "coach/tactics", "coach/technique", "coach/fitness", "coach/analyst", "roundtable", "live", "report", "lab", "messages"];
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
fs.mkdirSync("probe", { recursive: true });
for (const r of routes) {
  await page.goto(`${B}/#/${r}`, { waitUntil: "networkidle2" }); await new Promise((x) => setTimeout(x, 2500));
  const info = await page.evaluate(() => ({ h: document.documentElement.scrollHeight,
    heads: [...document.querySelectorAll("h1,h2,h3,section[class],button")].slice(0, 60).map((e) => `${e.tagName}${e.className ? "." + String(e.className).split(" ").slice(0, 2).join(".") : ""}: ${e.innerText.trim().slice(0, 50).replace(/\n/g, " ")} @${Math.round(e.getBoundingClientRect().top + scrollY)}`) }));
  console.log(`\n### /${r} height ${info.h}\n` + info.heads.join("\n"));
  await page.screenshot({ path: `probe/${r.replace("/", "_") || "home"}.png` });
}
await browser.close();
