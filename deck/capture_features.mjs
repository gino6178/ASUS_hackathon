// Stills of the newer features for the deck (and the PDF): live brief, voice coach, injury watch, highlight sharing.
import puppeteer from "puppeteer-core";
const B = "http://127.0.0.1:5190/#/";
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", protocolTimeout: 600000,
  args: ["--autoplay-policy=no-user-gesture-required"] });
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 });
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const hideNav = () => p.addStyleTag({ content: ".nav{display:none!important} main{padding-top:0!important}" });

if (!process.argv.includes("--from-voice")) {
// 1 live: between-point brief over the video
await p.goto(B + "live", { waitUntil: "networkidle2" }); await hideNav();
await p.waitForSelector(".live-ctl select"); await p.select(".live-ctl select", "17");
await p.evaluate(() => [...document.querySelectorAll(".live-ctl .btn")].find((x) => x.textContent === "2×").click());
await p.waitForSelector(".brief", { timeout: 90000 }); await wait(600);
await p.evaluate(() => [...document.querySelectorAll(".live-ctl .btn")].find((x) => /Pause/.test(x.textContent))?.click());
await (await p.$(".live-grid")).screenshot({ path: "shots/live_brief.png" });
console.log("live brief ok");

// 2 injury watch with the pose check
await p.goto(B + "match?tab=fatigue", { waitUntil: "networkidle2" }); await hideNav(); await wait(1500);
await (await p.$(".riskwatch")).screenshot({ path: "shots/riskwatch.png" });
console.log("risk ok");

}
// 3 voice coach: a spoken question, transcribed offline, answered from the data
await p.goto(B + "match?tab=flow", { waitUntil: "networkidle2" }); await wait(800);
await p.evaluate(() => document.querySelector(".voice-btn").click()); await wait(300);
p.evaluate(() => window.__voiceFile("/_test_voice.wav")).catch(() => {});
await p.waitForSelector(".voice-turn", { timeout: 120000 }); await wait(1500);
const vr = await p.evaluate(() => { const v = document.querySelector(".voice-panel"); if (!v) return null; const r = v.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
console.log("panel rect", JSON.stringify(vr), "hash", await p.evaluate(() => location.hash));
if (vr && vr.width) await p.screenshot({ path: "shots/voice.png", clip: vr }); else await p.screenshot({ path: "verify/voice_dbg.png" });
console.log("voice:", await p.evaluate(() => document.querySelector(".voice-turn").innerText.replace(/\n/g, " | ")));

// 4 highlight reel: one rally, create the video, show the share panel
await p.goto(B + "match?tab=reel", { waitUntil: "networkidle2" }); await hideNav(); await wait(1200);
await p.evaluate(() => { const boxes = [...document.querySelectorAll(".hl-list input")]; boxes.slice(1).forEach((x) => x.click()); });
await wait(300);
await p.evaluate(() => [...document.querySelectorAll(".hl-actions button")].find((x) => /Create video/.test(x.textContent)).click());
const t0 = Date.now();
while (!(await p.$(".hl-done"))) { if (Date.now() - t0 > 300000) throw new Error("reel timeout"); await wait(2000); }
await p.evaluate(() => { const v = document.querySelector(".hl-view video"); v.currentTime = 9; });
await wait(1500);
await (await p.$(".hl-grid")).screenshot({ path: "shots/hl_share.png" });
await (await p.$(".hl-done")).screenshot({ path: "shots/hl_done.png" });
await (await p.$(".hl-view video")).screenshot({ path: "shots/hl_video.png" });
console.log("reel:", await p.evaluate(() => document.querySelector(".hl-done b").innerText));
console.log("errors:", errs.join(" | ") || "none");
await b.close();
