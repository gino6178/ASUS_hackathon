// Record the demo video's scenes from the running site (npm run dev on :5190, gateway on the station) at 1920x1080.
//   node record.mjs [scene ...]      scenes: s1 montage s3 s4 s5 s6 s7 s8 (default: all but s6, which declines a real proposal)
// Each scene is written to build/<name>.webm; assemble.mjs cuts, captions and joins them.
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const B = "http://127.0.0.1:5190";
const OUT = path.resolve("build");
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

// hook · the broadcast rally with the skeleton and shuttle-trail overlays, filling the frame, around a smash
if (run("hook")) {
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
  await go("report", 3000);
  await page.evaluate(() => scrollTo(0, 0)); await wait(400);
  await page.evaluate(() => {
    const v = document.querySelector("video"), box = v.parentElement.getBoundingClientRect(), s = 1920 / box.width;
    const r = document.getElementById("root");
    r.style.transformOrigin = "0 0"; r.style.transform = `translate(${-box.left * s}px, ${-box.top * s + (1080 - box.height * s) / 2}px) scale(${s})`;
    document.querySelectorAll(".nav, header").forEach((e) => (e.style.visibility = "hidden"));
    v.currentTime = 3.0; v.play();
  });
  await page.mouse.move(-10, -10);
  await rec("hook", () => wait(4200));
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.reload({ waitUntil: "networkidle2" }); // drop the framing and hidden nav
}

// the 3D rally alone, for the title
if (run("hero")) {
  await go("", 2500);
  await page.addStyleTag({ content: ".hero-copy,.hud,.hero-shade,.nav,#__cur{visibility:hidden!important}" });
  await page.mouse.move(-10, -10);
  await rec("hero", () => wait(11000));
  await page.reload({ waitUntil: "networkidle2" });
}

// scene 2 nodes: the round table in session, voice answers, the highlight reel
if (run("nodes")) {
  await go("roundtable", 500);
  await page.waitForFunction(() => document.querySelectorAll(".rt-msg").length >= 3, { timeout: 120000 });
  const c = await center(".rt-chat");
  await rec("n_round", () => wait(6200));
  await resetFx();
  await go("coaches", 1500);
  await rec("n_voice", async () => {
    await click("button.voice-btn", null, 700); await wait(600);
    await click(".voice-panel input, [class*=voice] input", null, 500).catch(() => {});
    await page.keyboard.type("Where is my opponent beating me?", { delay: 30 }); await page.keyboard.press("Enter");
    await wait(3600);
  });
  await page.keyboard.press("Escape");
  await go("match");
  await click("button", "Highlight reel"); await wait(1000);
  await click("button", "Preview reel", 500); await wait(1500);
  await rec("n_high", () => wait(6200));
}

// scene 4 with camera moves and HUD cards quoting the page's own numbers
if (run("s4z")) {
  const COACH = {
    tactics: ["h3", "Where WANG Po Wei beat you", .62, 1.9, "#B9A2FF", "Rear forehand: <span style='color:#FF6B5E'>7 of 24</span> winners conceded", 6400],
    technique: ["button.stroke", null, .5, -.6, "#6FB6FF", "Every shot graded <span style='color:#6FB6FF'>A / B / C</span> from its 3D flight", 4600],
    fitness: ["canvas", null, .5, .45, "#FF8A6B", "Memory: <span style='color:#F2D46B'>right knee sore</span> &rarr; no jump drills", 4600],
    analyst: ["div", "Reply to a lift or clear", .5, .5, "#5FD39A", "After a lift or clear, WANG smashes <span style='color:#5FD39A'>38%</span>", 4800],
  };
  for (const [id, [sel, text, fx, fy, color, card, ms]] of Object.entries(COACH)) {
    await go(`coach/${id}`, 900);
    let p = await center(sel, text, .5, fy > 1 || fy < 0 ? .5 : fy);
    if (sel === "canvas") p = await page.evaluate(() => { const r = [...document.querySelectorAll("canvas")].map((e) => e.getBoundingClientRect()).sort((a, b) => b.width * b.height - a.width * a.height)[0]; return { x: r.left + r.width / 2, y: r.top + r.height * .42 }; });
    if (sel === "h3") { const b = await page.evaluate(() => { const h = [...document.querySelectorAll("h3")].find((x) => x.innerText.includes("beat you")); const r = h.parentElement.getBoundingClientRect(); return { x: r.left + r.width * .66, y: r.top + r.height * .72 }; }); p = b; }
    if (sel === "button.stroke") p = await page.evaluate(() => { const r = document.querySelector("button.stroke").parentElement.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * .3 }; });
    if (sel === "div") p = await page.evaluate(() => { const e = [...document.querySelectorAll("h3,h4,b,span,div")].find((x) => x.children.length < 3 && /Reply to a lift or clear/.test(x.innerText)); const r = e.getBoundingClientRect(); return { x: r.left + 140, y: r.top + 60 }; });
    await rec("z4_" + id, async () => {
      await wait(600);
      if (id === "technique") await frameEl("ol.tech-list", color);
      else if (id === "analyst") await markEl("section, div", ["Reply to a lift or clear", "Smash"], color);
      else await ring(p.x, p.y, color, id === "fitness" ? 300 : 230);
      await wait(900);
      await callout("fx1", card, color, 80, id === "technique" ? 130 : 760); await wait(ms - 900);
    });
    await resetFx();
  }
}

// scene 5: zoom on the clash, then on the ruling; then a question answered by the local model, with its real timing
if (run("s5z")) {
  // the meeting is written live by the agents: wait for it, and take a meeting where Ren challenges Lin (the narration)
  for (let k = 0; k < 4; k++) {
    await go("coaches", 300); await go("roundtable", 500);
    await page.waitForFunction(() => document.querySelector(".rt-msg.conflict"), { timeout: 120000 }).catch(() => {});
    const who = await page.evaluate(() => document.querySelector(".rt-msg.conflict .rt-tag")?.innerText ?? "");
    console.log("meeting", k, who);
    if (/Lin/.test(who)) break;
  }
  await wait(700);
  await rec("z5a", async () => {
    let p = await center(".rt-msg.conflict");
    await markEl(".rt-msg.conflict", null, "#FF6B5E"); await wait(900);
    await callout("fx1", "Conflict: Ren challenges Lin &mdash; <span style='color:#F2D46B'>right knee sore</span> vs smash-defence blocks", "#FF6B5E"); await wait(4300);
    await uncall("fx1"); await unmark(); await wait(900);
    await click("button", "Skip to the plan", 600).catch(() => {}); await wait(900);
    p = await center(".rt-msg.resolve", "Ruling");
    if (p) { await markEl(".rt-msg.resolve", "Ruling", "#5FD39A"); await wait(700); }
    await callout("fx2", "Head coach ruling: <span style='color:#5FD39A'>health first</span>, then the points at stake", "#5FD39A"); await wait(3600);
  });
  await resetFx();
  await go("coach/technique", 1500);
  await at("section.coach-chat");
  await rec("z5b", async () => {
    await click("section.coach-chat input[type=text], section.coach-chat input:not([type])", null, 700);
    await page.keyboard.type("Why do I keep losing points at the net?", { delay: 26 });
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => [...document.querySelectorAll(".coach-chat .chat-msg.assistant")].some((e) => /verified/.test(e.innerText)), { timeout: 60000 });
    const meta = await page.evaluate(() => [...document.querySelectorAll(".coach-chat .chat-msg.assistant .chat-meta")].at(-1)?.innerText || "");
    const sec = (meta.match(/([\d.]+) s,/) || [])[1];
    console.log("reply meta:", meta);
    const p = await center(".coach-chat .chat-msg.assistant:last-child");
    await markEl(".coach-chat .chat-msg.assistant:last-child", null, "#5FD39A"); await wait(500);
    await callout("fx1", `Local model &middot; ${sec ? sec + " s" : "about a second"} &middot; <span style='color:#5FD39A'>&check; every figure verified</span>`, "#5FD39A", 80, 120);
    await wait(4200);
  });
  await resetFx();
}

// scene 6 with the safety gate called out (declines a real proposal on the station: run last)
if (run("s6z")) {
  await go("lab", 2500);
  await rec("z6", async () => {
    await wait(1500);
    await click(".lab-search input", null, 900);
    await page.keyboard.type("knee pain after lunges", { delay: 32 });
    await page.keyboard.press("Enter");
    await wait(3000);
    await scrollTo(470, 1500);
    await move(700, 640, 1000); await wait(2600);
    const d = await at(".lab-prop.pending");
    await markEl(".lab-prop.pending", null); await wait(600);
    await move(d.x - 120, d.y - 10, 1000);
    await callout("fx1", "Safety gate: <span style='color:#F2D46B'>health changes need a human coach</span>", "#F2D46B", 80, 130); await wait(3400);
    await unmark(); await wait(700);
    await click(".lab-prop.pending button", "Decline", 1100);
    await page.waitForFunction(() => ![...document.querySelectorAll(".lab-prop.pending")].some((e) => e.innerText.includes("knee pain after lunges")), { timeout: 8000 }).catch(() => {});
    await uncall("fx1");
    await callout("fx2", "Declined by the human coach &middot; <span style='color:#FF6B5E'>rule not adopted</span>", "#FF6B5E", 80, 130); await wait(3200);
  });
  await resetFx();
}

// the agent trace page: a booking run step by step, then a reply the verifier stopped, then the confirmation
if (run("trace")) {
  await go("agents", 3000);
  await rec("trace", async () => {
    await wait(1500);
    await click(".tr-runs button", "I want to play doubles", 900); await wait(1200);
    let p = await center(".tr-step.llm");
    await markEl(".tr-step.llm", null); await wait(600);
    await callout("fx1", "LLM &middot; reads the request into <span style='color:#F2E6C9'>days, time, friends</span>", "#F2E6C9", 80, 860); await wait(2600);
    await uncall("fx1"); await unmark();
    p = await center(".tr-step.tool", "ask the fitness coach agent");
    await markEl(".tr-step.tool", "ask the fitness coach agent", "#6FB6FF"); await wait(500);
    await callout("fx2", "Agent to agent &middot; <span style='color:#6FB6FF'>asks the fitness coach</span>: knee sore, so 1 hour", "#6FB6FF", 80, 860); await wait(2800);
    await uncall("fx2"); await unmark(); await wait(800);
    p = await center(".tr-step.human");
    if (p) { await markEl(".tr-step.human", null); await wait(400);
      await callout("fx4", "Person &middot; <span style='color:#F2D46B'>nothing is booked until you say yes</span>", "#F2D46B", 80, 860); await wait(2600); }
  });
  await resetFx();
}

// the booking agent's search replayed on the map, ending on the court it booked
if (run("map")) {
  await go("agents", 1500);
  await rec("map", async () => {
    await page.goto(`${B}/#/courts`, { waitUntil: "domcontentloaded" });
    await wait(7600);
    const p = await center(".cr-top.win");
    if (p) { await markEl(".cr-top.win", null, "#5FD39A"); await wait(600); }
    await callout("fx1", "Fairest: <span style='color:#5FD39A'>Wanhua</span> &middot; longest trip ~29 min of 18 centres checked", "#5FD39A", 80, 880); await wait(3000);
  });
  await resetFx();
}

// 1 · title over the 3D hero
if (run("s1")) {
  await go("", 2500);
  await rec("s1", async () => { await wait(4000); const p = await at("button", "Analyze a match"); await move(p.x - 160, p.y + 60, 3000); await wait(4500); });
}

// 2 · montage: one short clip per feature (the Telegram piece is cut from s7)
if (run("montage")) {
  await go("analyze");
  await rec("m_analyze", async () => { await move(900, 330, 1200); await wait(1600); });
  await go("match");
  await rec("m_match", async () => { await move(1100, 600, 1400); await wait(1400); });
  await go("coaches");
  await rec("m_coaches", async () => { const p = await at("button.coach-card", "Coach Lin"); await move(p.x, p.y, 1200); await wait(1600); });
  await go("roundtable", 5500);
  await rec("m_roundtable", async () => { await wait(2800); });
  await go("live", 4000);
  await rec("m_live", async () => { await wait(2800); });
  await go("match");
  await click("button", "Highlight reel");
  await wait(1200);
  await click("button", "Preview reel", 500); await wait(2500);
  await rec("m_highlights", async () => { await wait(2800); });
  await go("coaches");
  await rec("m_voice", async () => { await click("button.voice-btn", null, 700); await wait(2200); });
  await page.keyboard.press("Escape");
  await go("lab", 2000);
  await rec("m_lab", async () => { await scrollTo(480, 2400); await wait(500); });
}

// 3 · drop a video in, the on-device stages, then the 3D replay
if (run("s3")) {
  await go("analyze");
  await rec("s3a", async () => {
    const input = await page.$("input[type=file]");
    const p = await at("section.panel", "File");
    await move(p.x, p.y, 900);
    await input.uploadFile(SAMPLE);
    await wait(1800);
    await click("button", "Start on-device analysis", 900);
    await wait(5800);
  });
  await go("report", 2500);
  await rec("s3b", async () => {
    const play = await at("button.icon-btn", "▶");
    await move(play.x, play.y, 600); await page.mouse.click(play.x, play.y);
    // orbit the 3D court: drag on the canvas on the right of the replay
    const c = await page.evaluate(() => { const cs = [...document.querySelectorAll("canvas")].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 300 && r.top < innerHeight); const r = cs.sort((a, b) => b.left - a.left)[0]; return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; });
    if (c) { await move(c.x, c.y, 700); await page.mouse.down(); await move(c.x + 260, c.y - 40, 2200); await page.mouse.up(); }
    await wait(2600);
  });
}

// 4 · the four coaches, each with its briefing animation
if (run("s4")) {
  for (const [id, ms] of [["tactics", 6200], ["technique", 3900], ["fitness", 3900], ["analyst", 3900]]) {
    await go(`coach/${id}`, 300);
    await rec("s4_" + id, async () => { await move(1000 + Math.random() * 300, 520, 1500); await wait(ms - 1500); });
  }
}

// 5 · round table from the clash to the plan, then a question to a coach on the local model
if (run("s5")) {
  await go("roundtable", 500);
  await page.waitForFunction(() => document.body.innerText.includes("challenges"), { timeout: 90000 });
  await wait(600);
  await rec("s5a", async () => {
    await move(1200, 520, 1500); await wait(5500);
    await click("button", "Skip to the plan", 900).catch(() => {}); await wait(4500);
    await scrollTo(600, 1500);
  });
  await go("coach/technique", 1500);
  await at("section.coach-chat");
  await rec("s5b", async () => {
    await click("section.coach-chat input[type=text], section.coach-chat input:not([type])", null, 800);
    await page.keyboard.type("Why do I keep losing points at the net?", { delay: 28 });
    await wait(300);
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => [...document.querySelectorAll(".coach-chat .chat-msg.assistant")].some((e) => /verified/.test(e.innerText)), { timeout: 60000 });
    await wait(400);
    await at(".coach-chat .chat-msg.assistant:last-child");
    await wait(5200);
  });
}

// 6 · the Lab: knowledge base, playbooks, and a health proposal declined by a person (changes the station: run last)
if (run("s6")) {
  await go("lab", 2500);
  await rec("s6", async () => {
    await wait(1800);
    await click(".lab-search input", null, 900);
    await page.keyboard.type("knee pain after lunges", { delay: 35 });
    await page.keyboard.press("Enter");
    await wait(3500);
    await scrollTo(470, 1600);
    await move(700, 640, 1200); await wait(2500);
    const d = await at(".lab-prop.pending");
    await move(d.x - 120, d.y - 10, 1200); await wait(3200);
    await click(".lab-prop.pending button", "Decline", 1300);
    const gone = await page.waitForFunction(() => ![...document.querySelectorAll(".lab-prop.pending")].some((e) => e.innerText.includes("knee pain after lunges")), { timeout: 8000 }).then(() => true, () => false);
    console.log("declined on screen:", gone, "scrollY", await page.evaluate(() => scrollY));
    await wait(2200);
  });
}

// 7 · Telegram (real bot replies from the end-to-end test) and 8 · end card
if (run("s7")) { await page.goto("file:///" + path.join(SCENES, "telegram.html").replace(/\\/g, "/")); await rec("s7", () => wait(16800)); }
if (run("s8")) { await page.goto("file:///" + path.join(SCENES, "endcard.html").replace(/\\/g, "/")); await rec("s8", () => wait(13500)); }

await browser.close();
