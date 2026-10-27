// Stills of an anim page at given seconds: node anim_still.mjs agent 3 8 12 17
import puppeteer from "puppeteer-core";
import path from "node:path";
import { pathToFileURL } from "node:url";
const [page, ...ts] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new" });
const p = await b.newPage(); await p.setViewport({ width: 1920, height: 1080 });
p.on("pageerror", (e) => console.log("ERR", e.message));
await p.goto(pathToFileURL(path.resolve(`../anim/${page}.html`)).href + "?export=1");
await p.evaluate(() => document.fonts.ready);
for (const t of ts) { await p.evaluate((t) => window.render(t), +t); await (await p.$("canvas")).screenshot({ path: `build/still_${page}_${t}.png` }); }
await b.close();
