// Record the Highlight reel tab for the README GIF: node hl_rec.mjs -> build/hl.webm
import puppeteer from "puppeteer-core";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new",
  args: ["--autoplay-policy=no-user-gesture-required", "--ignore-gpu-blocklist", "--enable-gpu-rasterization", "--window-size=1920,1500"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1500, deviceScaleFactor: 1 });
await page.goto("http://127.0.0.1:5190/#/match?tab=reel", { waitUntil: "networkidle2" });
await wait(2500);
const tab = await page.$("#tab-reel"); if (tab) await tab.click();
await wait(1500);
await page.evaluate(() => { const s = document.querySelector(".hl-grid"); scrollBy(0, s.getBoundingClientRect().top - 20); });
await wait(800);
const r = await page.screencast({ path: "build/hl.webm" });
await wait(1200);
await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.includes("Preview reel")).click());
await wait(Number(process.argv[2] ?? 30000));
await r.stop();
await browser.close();
