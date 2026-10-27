// The booking agent's hands: it drives a real browser (headless Chrome on the station) through a venue's booking
// website the way a person would. Each step the local LLM sees the page (title, text, numbered controls) and picks
// one action; code carries it out and takes a screenshot for the trace. Guardrails sit in code, not in the prompt:
//   - the member password is typed by code from the station's config; the model only ever sees {{password}}
//   - the agent stops before any final "Confirm"/"Pay" control and waits for the player's OK
//   - a run has a step budget, and every step is logged with its screenshot
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { chat } from "./llm.js";
import * as trace from "./trace.js";

const CHROME = process.env.CHROME_PATH || "/usr/bin/google-chrome";
const SHOTS = path.resolve(process.env.SHOT_DIR || "data/shots");
const FINAL = /\b(confirm booking|pay|payment|place order|submit payment)\b/i;
const open = new Map(); // party id -> { browser, page } kept on the review page until the player answers
let browser = null;
const launch = async () => (browser && browser.connected ? browser : (browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] })));

// what the model sees: the page text and every control with a number
async function observe(page) {
  return page.evaluate(() => {
    const els = [...document.querySelectorAll("a, button, input:not([type=hidden]), select")].filter((e) => e.offsetParent !== null);
    els.forEach((e, i) => e.setAttribute("data-agent", i));
    const label = (e) => (e.labels?.[0]?.innerText || e.getAttribute("aria-label") || e.placeholder || e.name || "").trim();
    const ctrl = els.map((e, i) => {
      const tag = e.tagName.toLowerCase();
      if (tag === "select") return `[${i}] select "${label(e)}" options: ${[...e.options].map((o) => o.text).join(" | ")} (now: ${e.options[e.selectedIndex]?.text})`;
      if (tag === "input") return `[${i}] input ${e.type} "${label(e)}" value="${e.type === "password" ? (e.value ? "****" : "") : e.value}"`;
      const ctx = e.closest("td") ? ` (${e.closest("tr")?.querySelector("th")?.innerText ?? ""}, ${e.closest("table")?.querySelectorAll("th")[e.closest("td").cellIndex]?.innerText ?? ""})` : "";
      return `[${i}] ${tag} "${(e.getAttribute("aria-label") || e.innerText).trim().slice(0, 60)}"${ctx}`;
    });
    return { url: location.pathname + location.search, title: document.title, text: document.querySelector("main")?.innerText.replace(/\n{2,}/g, "\n").slice(0, 900) ?? "", controls: ctrl.slice(0, 160) };
  });
}

async function shot(page, run, n) {
  const dir = path.join(SHOTS, run); fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${String(n).padStart(2, "0")}.jpg`);
  await page.screenshot({ path: file, type: "jpeg", quality: 62 });
  return `/api/shot/${run}/${path.basename(file)}`;
}

// run the site until the review page (or until the budget runs out); returns { ok, hold, text, steps }
export async function prepare({ party, site, goal, secrets, hint = () => "" }) {
  const b = await launch(), page = await b.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const run = trace.current()?.id ?? party, history = [], seen = new Map();
  await page.goto(site, { waitUntil: "domcontentloaded" });
  trace.step("tool", "browser: open the booking site", { url: site, shot: await shot(page, run, 0) });
  for (let n = 1; n <= 16; n++) {
    const o = await observe(page);
    const hold = o.text.match(/Reservation hold (b[a-z0-9]+)/);
    if (hold) { open.set(party, { page, at: Date.now() }); trace.step("check", "browser: reached the review page, stopping before the final confirm", { hold: hold[1] }); return { ok: true, hold: hold[1], text: o.text }; }
    // the agent's plan says what this page is for; the model picks the action that moves it forward
    const step = hint(o);
    const r = await chat([
      { role: "system", content: `You operate a website for a user, one action at a time. Overall goal: ${goal}
Reply with one JSON object only: {"action": "click"|"type"|"select", "id": control number, "value": "text to type or option to choose"}.
Use "select" only on select controls and "type" only on inputs. Do not type into a field that already has the right value. Never click a control that confirms a booking or pays.` },
      { role: "user", content: `Page: ${o.title} (${o.url})\n${o.text}\n\nControls:\n${o.controls.join("\n")}\n\nOn this page: ${step || "move towards the goal"}\nDone on this page: ${(seen.get(o.url) || []).join("; ") || "nothing yet"}\nNext action?` },
    ], { maxTokens: 80, temperature: 0, purpose: "browser: decide the next action" });
    let a; try { a = JSON.parse((r.text.match(/\{[\s\S]*\}/) || ["{}"])[0]); } catch { a = {}; }
    const el = await page.$(`[data-agent="${a.id}"]`), done = seen.get(o.url) ?? (seen.set(o.url, []), seen.get(o.url));
    if (!el) { done.push(`(there is no control ${a.id})`); continue; }
    const what = await el.evaluate((e) => (e.labels?.[0]?.innerText || e.getAttribute("aria-label") || e.innerText || e.name || "").trim().replace(/\s+/g, " ").slice(0, 50));
    const tag = await el.evaluate((e) => e.tagName.toLowerCase());
    if (a.action === "select" && tag !== "select") a.action = tag === "input" ? "type" : "click";
    if (a.action === "type" && tag !== "input") a.action = "click";
    const key = `${a.action} ${what} ${a.value ?? ""}`;
    // skip a repeat only when the field already shows that value
    const now = await el.evaluate((e) => (e.tagName === "SELECT" ? e.options[e.selectedIndex]?.text : e.value) ?? "");
    if (a.action !== "click" && a.value && String(now).toLowerCase() === String(a.value).toLowerCase()) { done.push(`(${what} already shows ${a.value}; do the next thing)`); continue; }
    if (a.action === "click" && FINAL.test(what)) { history.push("(stopped: final confirm is for the player)"); continue; }
    const value = String(a.value ?? "").replace("{{password}}", secrets.password).replace(/^\*+$/, secrets.password);
    if (a.action === "type") { await el.click({ clickCount: 3 }); await el.type(value); }
    else if (a.action === "select") await el.evaluate((e, v) => { const t = v.toLowerCase(), opts = [...e.options]; const o = opts.find((x) => x.text.toLowerCase() === t || x.value === v) ?? opts.find((x) => x.text.toLowerCase().startsWith(t)) ?? opts.find((x) => x.text.toLowerCase().includes(t)); if (o) { e.value = o.value; e.dispatchEvent(new Event("change", { bubbles: true })); } }, value);
    else await Promise.all([page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 5000 }).catch(() => {}), el.click()]);
    const shown = a.action === "type" && /password/i.test(what + a.value) ? "****" : a.value ?? "";
    history.push(`${a.action} "${what}"${shown ? ` = ${shown}` : ""}`); done.push(key);
    trace.step("tool", `browser: ${a.action} "${what}"${shown ? ` = ${shown}` : ""}`, { shot: await shot(page, run, n) });
  }
  await page.close();
  return { ok: false, text: "the agent ran out of steps" };
}

// after the player's OK: press the final confirm on the page the agent left open, and read the reference
export async function confirm(party) {
  const s = open.get(party); if (!s) return null;
  const { page } = s, run = trace.current()?.id ?? party;
  await Promise.all([page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 5000 }).catch(() => {}), page.click("#confirm")]);
  const text = await page.evaluate(() => document.querySelector("main")?.innerText ?? "");
  const ref = text.match(/Reference\s+(TS-[A-Z0-9]+)/)?.[1] ?? null;
  trace.step("tool", "browser: confirm booking (the player said yes)", { reference: ref, shot: await shot(page, run, 99) });
  await page.close(); open.delete(party);
  return ref;
}
export const forget = async (party) => { const s = open.get(party); if (s) { await s.page.close().catch(() => {}); open.delete(party); } };
