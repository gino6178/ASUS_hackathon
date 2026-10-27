// Screenshot of the Find a court page after its replay finishes
import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new" });
const p = await b.newPage(); await p.setViewport({ width: 1920, height: 1080 });
await p.goto("http://127.0.0.1:5190/#/courts", { waitUntil: "networkidle2" }); await new Promise((r) => setTimeout(r, 9000));
await p.screenshot({ path: process.argv[2] || "build/map.png" });
await b.close();
