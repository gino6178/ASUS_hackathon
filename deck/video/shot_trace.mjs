// Screenshot of the agent trace page with the booking run open, for the deck
import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new" });
const p = await b.newPage(); await p.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 2 });
await p.goto("http://127.0.0.1:5190/#/agents", { waitUntil: "networkidle2" }); await new Promise((r) => setTimeout(r, 2500));
await p.evaluate(() => [...document.querySelectorAll(".tr-runs button")].find((e) => e.innerText.includes("I want to play doubles")).click());
await new Promise((r) => setTimeout(r, 800));
await p.addStyleTag({ content: ".nav,header.nav{display:none!important}" });
const el = await p.$(".tr-run"); await el.screenshot({ path: "../shots/agent_trace.png" });
await b.close();
