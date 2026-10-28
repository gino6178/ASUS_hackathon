// Record the demo video's scenes from the running site (npm run dev on :5190, gateway on the station) at 1920x1080.
//   node record.mjs [scene ...]      scenes: s1 montage s3 s4 s5 s6 s7 s8 (default: all but s6, which declines a real proposal)
// Each scene is written to build/<name>.webm; assemble.mjs cuts, captions and joins them.
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const B = "http://127.0.0.1:5190";
const OUT = path.resolve("build/walk");
const SCENES = path.resolve("scenes");
const SAMPLE = path.resolve("../../web/public/media/sample_rally.mp4");
fs.mkdirSync(OUT, { recursive: true });
const want = process.argv.slice(2);
const run = (n) => (want.length ? want.includes(n) : n !== "s6");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new",
  args: ["--autoplay-policy=no-user-gesture-required", "--ignore-gpu-blocklist", "--enable-gpu-rasterization",
    "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--window-size=1920,1080"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
// a visible cursor with a click ring: headless screencasts show no pointer
await page.evaluateOnNewDocument(() => {
  addEventListener("DOMContentLoaded", () => {
    const c = document.createElement("div");
    c.id = "__cur";
    c.style.cssText = "position:fixed;left:-50px;top:-50px;width:22px;height:22px;z-index:2147483647;pointer-events:none;transition:transform .12s";
    c.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 2l7 19 2.6-8.1L21 10z" fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(c);
    addEventListener("mousemove", (e) => { c.style.left = e.clientX - 3 + "px"; c.style.top = e.clientY - 2 + "px"; }, true);
    addEventListener("mousedown", (e) => {
      const r = document.createElement("div");
      r.style.cssText = `position:fixed;left:${e.clientX - 18}px;top:${e.clientY - 18}px;width:36px;height:36px;border-radius:50%;border:3px solid #F2E6C9;z-index:2147483646;pointer-events:none;transition:all .45s ease-out;opacity:1`;
      document.documentElement.appendChild(r);
      requestAnimationFrame(() => { r.style.transform = "scale(1.8)"; r.style.opacity = "0"; });
      setTimeout(() => r.remove(), 600);
    }, true);
  });
});

let mx = 960, my = 540;
async function move(x, y, ms = 700) {
  // paced by the clock, not by step count: each mouse event takes a while during a screencast
  const t0 = Date.now();
  for (;;) {
    const t = Math.min(1, (Date.now() - t0) / ms), e = t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    await page.mouse.move(mx + (x - mx) * e, my + (y - my) * e);
    if (t >= 1) break;
    await wait(16);
  }
  mx = x; my = y;
}
async function at(sel, text) { // centre of an element (optionally the one containing text), scrolled into view
  const h = await page.evaluateHandle((s, t) => [...document.querySelectorAll(s)].find((e) => !t || e.innerText.includes(t)) || null, sel, text ?? null);
  const el = h.asElement();
  if (!el) throw new Error(`not found: ${sel} ${text ?? ""}`);
  await el.evaluate((e) => { const r = e.getBoundingClientRect(); if (r.top < 70 || r.bottom > innerHeight - 40) e.scrollIntoView({ behavior: "smooth", block: "center" }); });
  await wait(700);
  const b = await el.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, el };
}
async function click(sel, text, ms = 700) { const p = await at(sel, text); await move(p.x, p.y, ms); await wait(150); await page.mouse.click(p.x, p.y); return p; }
async function scrollTo(y, ms = 1200) { await page.evaluate((y) => scrollTo({ top: y, behavior: "smooth" }), y); await wait(ms); }
async function go(hash, settle = 1500) { await page.goto(`${B}/#/${hash}`, { waitUntil: "networkidle2" }); await page.mouse.move(mx, my); await wait(settle); }
async function rec(name, fn) {
  const file = path.join(OUT, name + ".webm");
  const r = await page.screencast({ path: file });
  const t0 = Date.now();
  await fn();
  await r.stop();
  console.log(name, ((Date.now() - t0) / 1000).toFixed(1), "s");
}

// no camera moves (the zoom was tiring to watch): the point is marked instead. markEl outlines an element, so the
// frame moves with it when the page scrolls; ring draws a circle on a spot inside something large (a heat map, the body)
const MARK_CSS = "@keyframes __mp{0%,100%{box-shadow:0 0 0 0 var(--mc),0 0 22px var(--mc)}50%{box-shadow:0 0 0 10px transparent,0 0 44px var(--mc)}}" +
  "@keyframes __mk{0%{opacity:0;transform:scale(1.15)}100%{opacity:1;transform:none}}" +
  ".__marked{outline:4px solid var(--mcs)!important;outline-offset:6px;border-radius:14px;animation:__mp 1.6s ease-in-out 2;transition:outline-color .3s}";
async function markEl(sel, text, color = "#F2D46B") {
  await page.evaluate((sel, text, color, css) => {
    if (!document.getElementById("__markcss")) { const st = document.createElement("style"); st.id = "__markcss"; st.textContent = css; document.head.appendChild(st); }
    document.querySelectorAll(".__marked").forEach((e) => e.classList.remove("__marked"));
    // the smallest element that matches (and holds the text): the card itself, not the page around it
    const es = [...document.querySelectorAll(sel)].filter((e) => !text || [].concat(text).every((t) => e.innerText.includes(t)));
    const e = es.sort((a, b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height)[0];
    if (!e) return;
    const b = e.getBoundingClientRect();
    if (b.top < 70 || b.bottom > innerHeight - 20) e.scrollIntoView({ behavior: "smooth", block: "center" });
    e.style.setProperty("--mc", color + "88"); e.style.setProperty("--mcs", color);
    e.classList.add("__marked");
  }, sel, text ?? null, color, MARK_CSS);
}
async function ring(x, y, color = "#F2D46B", size = 240) {
  await page.evaluate((x, y, color, size, css) => {
    if (!document.getElementById("__markcss")) { const st = document.createElement("style"); st.id = "__markcss"; st.textContent = css; document.head.appendChild(st); }
    document.getElementById("__ring")?.remove();
    const m = document.createElement("div"); m.id = "__ring"; m.className = "fx";
    m.style.cssText = `position:fixed;z-index:2147483639;pointer-events:none;left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px;` +
      `border:4px solid ${color};border-radius:50%;--mc:${color}88;animation:__mk .45s ease-out both,__mp 1.6s ease-in-out .45s 2`;
    document.documentElement.appendChild(m);
  }, x, y, color, size, MARK_CSS);
}
// a frame drawn over an element's box, for one whose parent clips an outline (the stroke row)
async function frameEl(sel, color = "#F2D46B", up = 0) {
  await page.evaluate((sel, color, css, up) => {
    if (!document.getElementById("__markcss")) { const st = document.createElement("style"); st.id = "__markcss"; st.textContent = css; document.head.appendChild(st); }
    let e = document.querySelector(sel); if (!e) return;
    for (let k = 0; k < up; k++) e = e.parentElement;
    const r = e.getBoundingClientRect();
    document.getElementById("__ring")?.remove();
    const m = document.createElement("div"); m.id = "__ring"; m.className = "fx";
    m.style.cssText = `position:fixed;z-index:2147483639;pointer-events:none;left:${r.left - 10}px;top:${r.top - 10}px;width:${r.width + 20}px;height:${r.height + 20}px;` +
      `border:4px solid ${color};border-radius:16px;--mc:${color}88;animation:__mk .45s ease-out both,__mp 1.6s ease-in-out .45s 2`;
    document.documentElement.appendChild(m);
  }, sel, color, MARK_CSS, up);
}
const unmark = () => page.evaluate(() => { document.getElementById("__ring")?.remove(); document.querySelectorAll(".__marked").forEach((e) => e.classList.remove("__marked")); });
// a HUD card in the lower third, above the subtitles; color = the coach's or the state's
async function callout(id, html, color = "#F2E6C9", x = 80, y = 760) {
  await page.evaluate((id, html, color, x, y) => {
    let el = document.getElementById(id);
    if (!el) { el = document.createElement("div"); el.id = id; el.className = "fx"; document.documentElement.appendChild(el); }
    el.style.cssText = `position:fixed;z-index:2147483640;left:${x}px;top:${y}px;opacity:0;transform:translateY(14px);transition:opacity .45s,transform .45s;background:rgba(6,10,13,.95);border:2px solid ${color};border-left-width:10px;color:#EEF1F2;font:700 30px/1.3 'Segoe UI',sans-serif;padding:16px 26px;border-radius:14px;box-shadow:0 18px 60px rgba(0,0,0,.6);max-width:980px;pointer-events:none`;
    el.innerHTML = html;
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.opacity = "1"; el.style.transform = "none"; }));
  }, id, html, color, x, y);
}
const uncall = (id) => page.evaluate((id) => { const el = document.getElementById(id); if (el) { el.style.opacity = "0"; setTimeout(() => el.remove(), 500); } }, id);
const resetFx = () => page.evaluate(() => { document.querySelectorAll(".fx").forEach((e) => e.remove()); document.querySelectorAll(".__marked").forEach((e) => e.classList.remove("__marked")); const r = document.getElementById("root"); if (r) { r.style.transition = "none"; r.style.transform = "none"; } });
// centre of the first element matching sel whose text includes text, without scrolling
const center = (sel, text, fx = .5, fy = .5) => page.evaluate((sel, text, fx, fy) => {
  const e = [...document.querySelectorAll(sel)].find((x) => !text || x.innerText.includes(text)); if (!e) return null;
  const r = e.getBoundingClientRect(); return { x: r.left + r.width * fx, y: r.top + r.height * fy };
}, sel, text ?? null, fx, fy);

// ---- full user walkthrough: node walkthrough.mjs [w01 w02 ...] -> build/walk/wNN.webm, joined by walk_join.mjs ----
// a step label at the bottom, so the video reads without narration
async function step(n, title, sub = "") {
  await page.evaluate((n, title, sub) => {
    let el = document.getElementById("__step");
    if (!el) { el = document.createElement("div"); el.id = "__step"; document.documentElement.appendChild(el); }
    el.style.cssText = "position:fixed;z-index:2147483641;left:50%;bottom:26px;transform:translateX(-50%);background:rgba(6,10,13,.94);border:1px solid #2C363B;" +
      "color:#EEF1F2;font:600 26px/1.3 'Segoe UI',sans-serif;padding:12px 26px;border-radius:999px;box-shadow:0 14px 50px rgba(0,0,0,.6);pointer-events:none;white-space:nowrap";
    el.innerHTML = (n ? `<span style="color:#F2E6C9;font-family:Consolas,monospace;margin-right:14px">${n}</span>` : "") + title +
      (sub ? `<span style="color:#9AA6AB;font-weight:400;margin-left:14px">${sub}</span>` : "");
  }, n, title, sub);
}
const W = (n) => want.length ? want.includes(n) : true;
async function nav(label) { await click(".nav-links a", label, 800); await wait(1400); }
async function more(label) { await click(".nav-more-btn", null, 700); await wait(500); await click(".menu-pop a", label, 600); await wait(1500); }
async function glide(to, ms = 2500) { await scrollTo(to, ms); }
async function tab(label, hold = 2600) { await click("[role=tab]", label, 650); await wait(hold); }

if (W("w01")) {
  await go("", 2500);
  await rec("w01", async () => {
    await step("1", "Open ShuttleCoach", "everything runs on this machine"); await wait(3500);
    await move(700, 560, 1500); await wait(1000);
    await glide(900, 3000); await wait(1500); await glide(1800, 3000); await wait(1500); await glide(0, 2200); await wait(800);
  });
}
if (W("w02")) {
  await go("", 1200);
  await rec("w02", async () => {
    await step("2", "Analyze a match video", "drop in footage; nothing is uploaded");
    await click(".nav-analyze", null, 900); await wait(1800);
    const input = await page.$("input[type=file]");
    const p = await at("section.panel", "File"); await move(p.x, p.y, 900);
    await input.uploadFile(SAMPLE); await wait(2500);
    await click("button", "Start on-device analysis", 900);
    await step("2", "On-device analysis", "court calibration, 2D shuttle tracking, 3D trajectories");
    await page.waitForFunction(() => !location.hash.includes("analyze"), { timeout: 30000 }).catch(() => {});
    await wait(4000);
  });
}
if (W("w03")) {
  await go("match", 1500);
  await rec("w03", async () => {
    await step("3", "Match analysis", "the sample match, already analysed"); await move(900, 300, 900); await wait(2500);
    for (const [t, s] of [["Score flow", "who led, point by point"], ["Points won & lost", "where points were won and lost"], ["Shot sequences", "the patterns before a winner"],
      ["Rallies & highlights", "every rally, ready to replay"], ["Footwork & reads", "movement and anticipation"], ["Fatigue", "speed and reach as the match goes on"], ["Match comparison", "the two players side by side"]]) {
      await step("3", t, s); await tab(t, 1800); await glide(420, 1500); await wait(1200); await glide(0, 900);
    }
  });
}
if (W("w04")) {
  await go("match", 1500);
  await rec("w04", async () => {
    await step("4", "Auto highlight reel", "the best rallies, cut like a broadcast");
    await tab("Highlight reel", 1500);
    await click("button", "Preview reel", 800); await wait(14000);
    await click("button", "Stop", 600).catch(() => {}); await wait(800);
  });
}
if (W("w05")) {
  await go("match", 1200);
  await rec("w05", async () => {
    await step("5", "Rally 3D", "the broadcast view beside the 3D replay");
    await click(".subnav a", "Rally 3D", 800); await wait(2500);
    const play = await at("button.icon-btn", "▶").catch(() => null);
    if (play) { await move(play.x, play.y, 600); await page.mouse.click(play.x, play.y); }
    const c = await page.evaluate(() => { const cs = [...document.querySelectorAll("canvas")].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 300 && r.top < innerHeight); const r = cs.sort((a, b) => b.left - a.left)[0]; return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; });
    await wait(3000);
    if (c) { await move(c.x, c.y, 700); await page.mouse.down(); await move(c.x + 300, c.y - 50, 2600); await page.mouse.up(); }
    await wait(4000);
    await step("5", "Scouting report", "the opponent on one page");
    await click(".subnav a", "Scouting report", 800); await wait(2000);
    await glide(700, 3000); await wait(1500); await glide(1500, 3000); await wait(1500);
  });
}
if (W("w06")) {
  await go("match", 1000);
  await rec("w06", async () => {
    await step("6", "The coaching staff", "four specialist agents and a head coach");
    await nav("Coaches"); await wait(2000);
    for (const [name, area, extra] of [["Coach Lin", "tactics: the zones that cost points", 0], ["Coach Kai", "technique: every shot graded from its 3D flight", 1], ["Coach Ren", "fitness: what to train, from your memory", 0], ["Coach Ada", "data: the opponent's habits", 0]]) {
      await nav("Coaches"); await wait(600);
      await click("button.coach-card", name, 800); await wait(1500);
      await step("6", name, area); await wait(1500);
      if (extra) { await click("button.stroke", null, 700).catch(() => {}); await wait(1500); }
      await glide(500, 2000); await wait(1800); await glide(0, 1000);
    }
  });
}
if (W("w07")) {
  await go("coach/technique", 1500);
  await at("section.coach-chat");
  await rec("w07", async () => {
    await step("7", "Ask a coach", "a local model answers; a verifier checks every number");
    await click("section.coach-chat input[type=text], section.coach-chat input:not([type])", null, 800);
    await page.keyboard.type("Why do I keep losing points at the net?", { delay: 40 }); await wait(300);
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => [...document.querySelectorAll(".coach-chat .chat-msg.assistant")].some((e) => /verified/.test(e.innerText)), { timeout: 90000 }).catch(() => {});
    await at(".coach-chat .chat-msg.assistant:last-child"); await markEl(".coach-chat .chat-msg.assistant:last-child", null, "#5FD39A"); await wait(5500); await unmark();
    await step("7", "Voice coach", "ask out loud, or type");
    await click("button.voice-btn", null, 800); await wait(1000);
    await click(".voice-panel input, [class*=voice] input", null, 500).catch(() => {});
    await page.keyboard.type("Where is my opponent beating me?", { delay: 40 }); await page.keyboard.press("Enter");
    await wait(6000); await page.keyboard.press("Escape"); await wait(600);
  });
}
if (W("w08")) {
  await go("coaches", 800);
  await rec("w08", async () => {
    await step("8", "Round table", "the coaches debate the week, live on the local model");
    await nav("Round table");
    await page.waitForFunction(() => document.querySelectorAll(".rt-msg").length >= 2, { timeout: 120000 }).catch(() => {});
    await move(1200, 520, 1500); await wait(9000);
    if (await page.$(".rt-msg.conflict")) { await step("8", "A conflict", "the fitness coach challenges a request"); await markEl(".rt-msg.conflict", null, "#FF6B5E"); await wait(4500); await unmark(); }
    await click("button", "Skip to the plan", 900).catch(() => {}); await wait(1500);
    await step("8", "The ruling and the plan", "health first, then the points at stake");
    await markEl(".rt-msg.resolve", "Ruling", "#5FD39A"); await wait(3500); await unmark();
    await glide(800, 3000); await wait(2500); await glide(1600, 3000); await wait(2500);
  });
}
if (W("w09")) {
  await go("roundtable", 800);
  await rec("w09", async () => {
    await step("9", "Live mode", "a brief from the coaches between points");
    await nav("Live"); await wait(9000);
    await click("button", "Next serve", 800).catch(() => {}); await wait(7000);
    await click("a.exit", null, 800).catch(() => {}); await wait(1500);
  });
}
if (W("w10")) {
  await go("", 1000); await page.evaluate(() => scrollTo(0, 0)); await wait(500);
  await rec("w10", async () => {
    await step("10", "Lab", "the research agent's knowledge base and the coaches' playbooks");
    await more("Lab"); await wait(1500);
    await click(".lab-search input", null, 900);
    await page.keyboard.type("knee pain after lunges", { delay: 40 }); await page.keyboard.press("Enter"); await wait(3500);
    await glide(470, 2000); await wait(2500);
    if (await page.$(".lab-prop.pending")) { await step("10", "Proposed playbook changes", "anything about health waits for a human coach"); await markEl(".lab-prop.pending", null); await wait(4500); await unmark(); }
    await glide(1300, 3000); await wait(2000);
  });
}
if (W("w11")) {
  await go("", 1000); await page.evaluate(() => scrollTo(0, 0)); await wait(500);
  await rec("w11", async () => {
    await step("11", "Player memory", "what the coaches remember about you");
    await more("Player memory"); await wait(2500); await glide(500, 2500); await wait(2000); await glide(0, 1200);
    await step("11", "Messages", "the same coaches on Telegram");
    await more("Messages"); await wait(2500); await glide(500, 2500); await wait(2500);
  });
}
if (W("w12")) {
  await go("", 1000); await page.evaluate(() => scrollTo(0, 0)); await wait(500);
  await rec("w12", async () => {
    await step("12", "Find a court", "the booking agent's search, replayed on the map");
    await more("Find a court"); await wait(8000);
    if (await page.$(".cr-top.win")) { await markEl(".cr-top.win", null, "#5FD39A"); await wait(3500); await unmark(); }
    await glide(600, 2500); await wait(2500);
  });
}
if (W("w13")) {
  await go("", 1000); await page.evaluate(() => scrollTo(0, 0)); await wait(500);
  await rec("w13", async () => {
    await step("13", "Agent trace", "every LLM call, tool call and approval");
    await more("Agent trace"); await wait(2000);
    await click(".tr-runs button", "I want to play doubles", 900).catch(() => {}); await wait(2000);
    await glide(500, 3000); await wait(2000); await glide(1100, 3000); await wait(2000); await glide(1800, 3000); await wait(2500);
  });
}
if (W("w14")) {
  await go("agents", 1000);
  await rec("w14", async () => {
    await step("", "ShuttleCoach", "one camera in, a full coaching staff out, 100% offline");
    await nav("Overview"); await page.evaluate(() => scrollTo(0, 0)); await wait(6000);
  });
}
await browser.close();
