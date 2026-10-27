// Opens every page of the web app and reports console errors, failed requests and any CJK text on screen.
//   node probe_pages.mjs
import puppeteer from "puppeteer-core";

const B = "http://127.0.0.1:5190";
const PAGES = ["", "match", "coaches", "roundtable", "live", "analyze", "highlights", "messages", "courts", "agents", "lab", "report"];
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000 });
let errs = [];
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 160)); });
page.on("pageerror", (e) => errs.push("pageerror " + String(e).slice(0, 160)));
page.on("requestfailed", (r) => errs.push("failed " + r.url().slice(0, 120)));
for (const p of PAGES) {
  errs = [];
  await page.goto(`${B}/#/${p}`, { waitUntil: "networkidle2", timeout: 60000 }).catch((e) => errs.push("goto " + e.message));
  await new Promise((r) => setTimeout(r, 2500));
  const info = await page.evaluate(() => {
    const t = document.body.innerText;
    return { cjk: (t.match(/[\u4e00-\u9fff]+/g) || []).slice(0, 5), h1: document.querySelector("h1")?.innerText ?? "", len: t.length };
  });
  console.log(`#/${p} | ${info.h1} | chars ${info.len} | cjk ${JSON.stringify(info.cjk)} | errors ${errs.length ? JSON.stringify(errs.slice(0, 3)) : "none"}`);
}
await browser.close();
