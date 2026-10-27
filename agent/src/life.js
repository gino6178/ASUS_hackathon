// The 24-hour coach on Telegram: what is in the player's kitchen, their schedule and their training log. Free text
// is read by the local model into a small JSON action ("I have club training Wed 19:00-21:00" -> an event); the
// coaches then see the pantry, the week and the recent sessions in every reply, and the gateway sends reminders
// before a session and a check-in in the evening.
import { chat } from "./llm.js";
import * as store from "./store.js";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n) => String(n).padStart(2, "0");
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const at = (e) => new Date(`${e.date}T${e.start || "00:00"}`);
const json = (t) => { try { return JSON.parse((t.match(/\{[\s\S]*\}/) || ["{}"])[0]); } catch { return {}; } };

// the next 8 days with their dates, so the model can resolve "Wednesday" or "tomorrow" without arithmetic
const calendar = (now = new Date()) => Array.from({ length: 8 }, (_, k) => { const d = new Date(now); d.setDate(d.getDate() + k); return `${k === 0 ? "today" : k === 1 ? "tomorrow" : DAYS[d.getDay()]} = ${DAYS[d.getDay()]} ${ymd(d)}`; }).join("; ");

const PROMPT = (now) => `You file messages from a badminton player for their coaching staff. Now: ${DAYS[now.getDay()]} ${ymd(now)} ${hm(now)}. Dates: ${calendar(now)}.
Return one JSON object only, no prose:
{"intent": "pantry" | "event" | "log" | "chat",
 "items": ["food the player says they have at home, short English names"],
 "events": [{"date": "YYYY-MM-DD", "start": "HH:MM", "end": "HH:MM or empty", "title": "short", "kind": "training" | "match" | "exam" | "travel" | "other"}],
 "log": {"date": "YYYY-MM-DD", "minutes": number or 0, "what": "what they trained", "pain": "any pain or soreness they mention, or empty"}}
pantry = they list food they have or bought. event = a plan in their calendar (training, match, exam, trip). log = a training session they already did. chat = anything else, including questions about food or training.
Examples: "club training Wednesday 19:00-21:00" -> event; "exam on Friday" -> event; "did 1 hour of smash practice" -> log; "bought eggs and milk" -> pantry; "what should I eat tonight?" -> chat.
Use 24-hour times. Leave unused fields empty.`;

// cues a 4B model sometimes misses: a day or time with a session word is a calendar entry; past tense with a
// duration is a finished session. When a cue fires, a second, narrower prompt extracts just that.
const WHEN = /\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b|tomorrow|tonight|next week|\b\d{1,2}(:\d\d)?\s*(am|pm)\b|\b\d{1,2}:\d\d\b|明天|今晚|後天|下週|星期|週[一二三四五六日]|禮拜|\d+點/i;
const SESSION = /training|practice|session|match|tournament|game|exam|test|trip|flight|travel|class|gym|訓練|練球|比賽|考試|出國|旅行|課/i;
const FOOD = /\b(bought|buy|got|have|groceries|fridge|kitchen)\b|買了|冰箱|家裡有/i;
const PAST = /\b(did|done|finished|trained|played|completed|ran|had)\b|just (did|finished|trained)|練了|做了|打了|剛練|今天練/i;
const DURATION = /\d+\s*(min|minute|hour|hr|h\b)|分鐘|小時/i;
const minutesIn = (t) => { const m = t.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h\b|小時)/i); if (m) return Math.round(+m[1] * 60); const n = t.match(/(\d+)\s*(min|minutes?|分鐘)/i); return n ? +n[1] : 0; };

// "I want to play" is its own intent: the booking agent finds a court and gets the friends together
const PLAY = /\b(want|wanna|like|let'?s|can we|could we|find|book|up for)\b.{0,40}\b(play|hit|game|court|badminton|doubles|singles)\b|\bbook (a )?court\b|約球|打球|訂場|找人打|想運動|想打|揪/i;
export async function readPlay(text, now = new Date()) {
  const r = await chat([{ role: "system", content: `A badminton player wants to play. Now: ${DAYS[now.getDay()]} ${ymd(now)} ${hm(now)}. Dates: ${calendar(now)}.
Return one JSON object only: {"days": ["YYYY-MM-DD", ...], "from": "HH:MM", "to": "HH:MM", "hours": number, "format": "singles" | "doubles", "friends": ["first names the player mentions"]}.
days: the dates they could play; "weekend" means Saturday and Sunday; no day mentioned means the next three days.
from/to: the window they could start and finish; evening 18:00-22:00, morning 08:00-12:00, afternoon 13:00-18:00; "at 7pm" means from 19:00 to 22:00; nothing said means 18:00-22:00.
hours: how long to play, 2 if not said. format: doubles if they say doubles or name two or more friends, else singles.` }, { role: "user", content: text }], { maxTokens: 160, temperature: 0, purpose: "read the play request" });
  const j = json(r.text);
  const days = (j.days || []).filter((d) => /^\d{4}-\d\d-\d\d$/.test(d) && d >= ymd(now));
  const next3 = [0, 1, 2].map((k) => { const d = new Date(now); d.setDate(d.getDate() + k); return ymd(d); });
  const t = (x, f) => (/^\d\d:\d\d$/.test(x || "") ? x : f);
  const friends = (j.friends || []).filter((x) => typeof x === "string" && x.trim() && !/^(me|i|myself)$/i.test(x)).map((x) => x.trim());
  // time-of-day words and the length are read by rule; the model fills in the rest
  const WIN = [[/morning|早上|上午/i, "08:00", "12:00"], [/afternoon|下午/i, "13:00", "18:00"], [/evening|tonight|night|after work|晚上|今晚|下班/i, "18:00", "22:00"]];
  const win = WIN.find(([re]) => re.test(text)), at = /at\s*(\d{1,2})(?::(\d\d))?\s*(am|pm)?|(\d{1,2})\s*點/i.exec(text);
  let from = t(j.from, "18:00"), to = t(j.to, "22:00");
  if (win && !at) [, from, to] = win;
  const len = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|小時)/i.exec(text);
  return { days: days.length ? days : next3, from, to, hours: len ? Math.min(4, Math.max(1, Math.round(+len[1]))) : 2,
    format: j.format === "doubles" || friends.length >= 2 ? "doubles" : "singles", friends };
}

export async function read(text, now = new Date()) {
  const asks = /\?|？|嗎|how|what/i.test(text) && !PLAY.test(text);
  if (!asks && PLAY.test(text) && !PAST.test(text)) return { intent: "play", play: await readPlay(text, now), items: [], events: [], log: {} };
  const r = await chat([{ role: "system", content: PROMPT(now) }, { role: "user", content: text }], { maxTokens: 220, temperature: 0, purpose: "understand the message" });
  const j = json(r.text);
  const out = { intent: ["pantry", "event", "log", "chat"].includes(j.intent) ? j.intent : "chat", items: (j.items || []).filter((x) => typeof x === "string" && x.trim()),
    events: (j.events || []).filter((e) => /^\d{4}-\d\d-\d\d$/.test(e?.date || "")), log: j.log || {} };
  const question = /\?|？|嗎|什麼|怎麼|how|what|should|can i/i.test(text);
  if (out.intent === "chat" && !question && PAST.test(text) && DURATION.test(text)) out.intent = "log";
  else if (out.intent === "chat" && !question && FOOD.test(text) && !SESSION.test(text)) out.intent = "pantry";
  else if (out.intent === "chat" && !question && WHEN.test(text) && SESSION.test(text)) out.intent = "event";
  if (out.intent === "pantry" && !out.items.length) out.items = await extractFood(text);
  if (out.intent === "pantry" && !out.items.length) out.intent = "chat";
  if (out.intent === "event" && !out.events.length) out.events = await extractEvents(text, now);
  if (out.intent === "event" && !out.events.length) out.intent = "chat";
  if (out.intent === "log" && !(out.log.minutes > 0)) out.log = { ...out.log, minutes: minutesIn(text) };
  return out;
}

async function extractFood(text) {
  const r = await chat([{ role: "system", content: "List the foods in the message as a JSON array of short English names, e.g. [\"chicken breast\", \"broccoli\"]. JSON only." }, { role: "user", content: text }], { maxTokens: 120, temperature: 0, purpose: "list the foods" });
  try { return (JSON.parse((r.text.match(/\[[\s\S]*\]/) || ["[]"])[0]) || []).filter((x) => typeof x === "string" && x.trim()); } catch { return []; }
}

async function extractEvents(text, now) {
  const r = await chat([{ role: "system", content: `Now: ${DAYS[now.getDay()]} ${ymd(now)} ${hm(now)}. Dates: ${calendar(now)}.
List the calendar entries in the message as a JSON array only: [{"date": "YYYY-MM-DD", "start": "HH:MM", "end": "HH:MM or empty", "title": "short", "kind": "training" | "match" | "exam" | "travel" | "other"}]. Use 24-hour times; "7pm" is "19:00". A weekday means its next date in the list.` },
    { role: "user", content: text }], { maxTokens: 200, temperature: 0, purpose: "read the calendar entries" });
  try { return (JSON.parse((r.text.match(/\[[\s\S]*\]/) || ["[]"])[0]) || []).filter((e) => /^\d{4}-\d\d-\d\d$/.test(e?.date || "")); } catch { return []; }
}

// --- pantry --------------------------------------------------------------------------------------------------------
export function addPantry(id, items) {
  const p = store.get(id), have = new Set(p.pantry.map((x) => x.item.toLowerCase()));
  const fresh = items.map((x) => x.trim().toLowerCase()).filter((x) => x && !have.has(x));
  store.update(id, (q) => { q.pantry.push(...fresh.map((item) => ({ item, at: Date.now() }))); q.pantry = q.pantry.slice(-60); });
  return fresh;
}
export const removePantry = (id, items) => store.update(id, (q) => { const out = new Set(items.map((x) => x.trim().toLowerCase())); q.pantry = q.pantry.filter((x) => !out.has(x.item)); });
export const clearPantry = (id) => store.update(id, (q) => { q.pantry = []; });

// --- schedule ------------------------------------------------------------------------------------------------------
export function addEvents(id, events) {
  const clean = events.map((e) => ({ id: Math.random().toString(36).slice(2, 8), date: e.date, start: /^\d\d:\d\d$/.test(e.start) ? e.start : "", end: /^\d\d:\d\d$/.test(e.end) ? e.end : "",
    title: String(e.title || e.kind || "event").slice(0, 60), kind: ["training", "match", "exam", "travel"].includes(e.kind) ? e.kind : "other", at: Date.now() }));
  store.update(id, (q) => { q.events.push(...clean); q.events.sort((a, b) => at(a) - at(b)); q.events = q.events.filter((e) => at(e) > Date.now() - 14 * 864e5).slice(-80); });
  return clean;
}
export const upcoming = (p, days = 7, now = new Date()) => p.events.filter((e) => { const t = at(e); return t >= new Date(ymd(now) + "T00:00") && t < new Date(now.getTime() + days * 864e5); });
export const today = (p, now = new Date()) => p.events.filter((e) => e.date === ymd(now));

// --- training log --------------------------------------------------------------------------------------------------
export function addLog(id, log, text, now = new Date()) {
  const entry = { date: /^\d{4}-\d\d-\d\d$/.test(log.date || "") ? log.date : ymd(now), minutes: Math.max(0, Math.round(+log.minutes || 0)), what: String(log.what || text).slice(0, 120), pain: /^(no|none|fine|ok|nothing|n\/a|無|沒有)?\.?$/i.test(String(log.pain || "").trim()) || /no pain|felt fine/i.test(String(log.pain)) ? "" : String(log.pain).slice(0, 80), text, at: Date.now() };
  store.update(id, (q) => { q.logs.push(entry); q.logs = q.logs.slice(-120); });
  return entry;
}
export function week(p, now = new Date()) {
  const from = new Date(now); from.setDate(from.getDate() - 6);
  const logs = p.logs.filter((l) => l.date >= ymd(from));
  return { logs, sessions: logs.length, minutes: logs.reduce((s, l) => s + l.minutes, 0), pain: logs.filter((l) => l.pain) };
}

// --- text for the coaches' prompt and for Telegram -----------------------------------------------------------------
const evText = (e) => `${DAYS[at(e).getDay()]} ${e.date}${e.start ? ` ${e.start}${e.end ? `-${e.end}` : ""}` : ""} ${e.title} (${e.kind})`;
export function context(p, now = new Date()) {
  if (!p) return "";
  const w = week(p, now), up = upcoming(p, 7, now);
  return `TODAY: ${DAYS[now.getDay()]} ${ymd(now)} ${hm(now)}
THE PLAYER'S WEEK (their calendar):
${up.map((e) => `- ${evText(e)}`).join("\n") || "- (nothing entered)"}
TRAINING THEY LOGGED IN THE LAST 7 DAYS:
${w.logs.map((l) => `- ${l.date}: ${l.what}${l.minutes ? `, ${l.minutes} min` : ""}${l.pain ? `, pain: ${l.pain}` : ""}`).join("\n") || "- (nothing logged)"}
FOOD THEY HAVE AT HOME:
${p.pantry.map((x) => x.item).join(", ") || "(not told yet)"}`;
}
export const pantryText = (p) => (p.pantry.length ? `In your kitchen (${p.pantry.length}): ${p.pantry.map((x) => x.item).join(", ")}.\nAdd with /pantry eggs, rice · remove with /pantry -eggs · /pantry clear` : "Your kitchen list is empty. Send /pantry eggs, tofu, rice (or just tell me what you bought) and I'll plan meals around training with it.");
export function weekText(p, plan, now = new Date()) {
  const up = upcoming(p, 7, now), w = week(p, now);
  const planToday = plan?.days?.find((d) => d.d === DAYS[now.getDay()]);
  return [`This week`,
    up.length ? up.map((e) => `• ${evText(e)}`).join("\n") : "• Nothing in your calendar. Tell me your sessions, matches and exams, e.g. \"club training Wed 19:00-21:00\".",
    planToday ? `\nToday's plan: ${planToday.blocks.length ? planToday.blocks.map(([, min, t]) => `${t} (${min} min)`).join("; ") : "rest"}` : "",
    `\nLogged in the last 7 days: ${w.sessions} session${w.sessions === 1 ? "" : "s"}${w.minutes ? `, ${w.minutes} min` : ""}${w.pain.length ? ` · pain noted: ${w.pain.map((l) => l.pain).join("; ")}` : ""}`].join("\n");
}
export { evText };
