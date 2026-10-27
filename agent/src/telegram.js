// Telegram bot by long polling: no public server or open port is needed, the gateway asks Telegram for new
// messages. Players link with /start; coaches reply through the grounded agent; the plan and reminders are pushed.
import * as store from "./store.js";
import { reply, learn, COACHES } from "./coach.js";
import { factSheet } from "./facts.js";
import * as evolve from "./evolve.js";
import * as life from "./life.js";
import * as booking from "./booking.js";
import * as trace from "./trace.js";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API = (process.env.TELEGRAM_API || "https://api.telegram.org").replace(/\/$/, "");
export const state = { enabled: !!TOKEN, bot: null, error: null, lastPoll: null };
const call = async (method, body) => {
  const r = await fetch(`${API}/bot${TOKEN}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) });
  const j = await r.json();
  if (!j.ok) throw new Error(`${method}: ${j.description}`);
  return j.result;
};

// a map pin: Telegram shows the venue on a map the player can open in their map app
export const sendVenue = (chatId, v) => { trace.step("message", "send a map pin", { to: store.get(String(chatId))?.name ?? chatId, venue: v.name }); return call("sendVenue", { chat_id: chatId, latitude: v.lat, longitude: v.lon, title: v.name, address: v.local ?? "" }); };
export const send = (chatId, text, extra = {}) => { trace.step("message", "send on Telegram", { to: store.get(String(chatId))?.name ?? chatId, text, buttons: extra.reply_markup ? extra.reply_markup.inline_keyboard.flat().map((b) => b.text).join(" | ") : null }); return call("sendMessage", { chat_id: chatId, text, disable_web_page_preview: true, ...extra }); };

const HELP = `I'm your ShuttleCoach staff, here 24 hours a day: Coach Lin (tactics), Coach Kai (technique), Coach Ren (fitness), Coach Ada (data), Coach Mei (nutrition) and the Head Coach.
Just write to us: what you bought ("eggs, tofu, rice"), your schedule ("club training Wed 19:00-21:00", "exam Friday"), what you trained ("45 min footwork, knee fine"), or that you want a game ("doubles with Amy and Ben on Saturday evening": we find a court, invite them and book it when you say so).
/courts your games and courts · /open open to games from club players · /week calendar and training log · /today today's plan · /meal what to eat next · /pantry your kitchen · /log a session · /plan the round-table plan · /summary match summary · /coach lin|kai|ren|ada|mei|head · /forget delete everything we stored about you`;

export function planText(plan, today = null) {
  if (!plan) return "No plan yet. Your coaches will send one after the next round table.";
  const days = today ? plan.days.filter((d) => d.d === today) : plan.days;
  const lines = days.map((d) => `${d.d}: ${d.blocks.length ? d.blocks.map(([who, min, t]) => `${t} (${min} min, ${COACHES[who]?.name ?? who})`).join("; ") : "rest"}`);
  return `${today ? "Today's training" : `Training plan · ${plan.event ?? ""}`}\n${plan.goals?.length && !today ? "Goals:\n" + plan.goals.map((g) => `• ${g}`).join("\n") + "\n\n" : ""}${lines.join("\n")}`;
}

async function handle(msg) {
  const id = String(msg.chat.id), text = (msg.text || "").trim(), name = msg.from?.first_name || "player";
  if (msg.location && store.get(id)) {
    // only the rough area is kept (about 1 km), enough to find a court in the middle
    const home = { lat: +msg.location.latitude.toFixed(2), lon: +msg.location.longitude.toFixed(2), at: Date.now() };
    store.update(id, (q) => { q.home = home; });
    trace.step("tool", "save the player's area", { lat: home.lat, lon: home.lon, precision: "about 1 km" });
    return send(id, "Got your area (rounded to about 1 km). When you want a game I'll look for courts that are fair for everyone. /forget deletes it.");
  }
  if (!text) return;
  if (text.startsWith("/start")) {
    store.link(id, name);
    const s = factSheet("A");
    return send(id, `Hi ${name}, you're linked to ${s.name}'s coaching staff for ${s.event}.\n\nOnly these text messages pass through Telegram; match video and analysis stay on the coaching station.\n\n${HELP}`);
  }
  const p = store.get(id);
  if (!p) return send(id, "Send /start to link this chat to your coaching staff first.");
  if (text.startsWith("/forget")) { store.forget(id); return send(id, "Done: your memories, messages, plan, kitchen list, calendar and training log are deleted from the station. Send /start to begin again."); }
  if (text.startsWith("/plan")) return send(id, planText(p.plan));
  if (text.startsWith("/help")) return send(id, HELP);
  if (text.startsWith("/week") || text.startsWith("/schedule")) return send(id, life.weekText(p, p.plan));
  if (text.startsWith("/today")) return send(id, todayText(p));
  if (text.startsWith("/courts") || text.startsWith("/book")) return send(id, booking.summary(id));
  if (text.startsWith("/open")) { const on = !/off/i.test(text); store.setPref(id, "openToPlay", on); return send(id, on ? "You're open to games: when a club player looks for partners, I'll invite you. /open off to stop." : "Okay, no game invitations from other players."); }
  if (text.startsWith("/pantry")) {
    const arg = text.replace(/^\/pantry\S*\s*/, "").trim();
    if (/^clear$/i.test(arg)) life.clearPantry(id);
    else if (arg) {
      const parts = arg.split(/[,，、\n]+/).map((x) => x.trim()).filter(Boolean);
      life.removePantry(id, parts.filter((x) => x.startsWith("-")).map((x) => x.slice(1)));
      life.addPantry(id, parts.filter((x) => !x.startsWith("-")));
    }
    return send(id, life.pantryText(store.get(id)));
  }
  if (text.startsWith("/coach")) {
    const want = { lin: "tactics", kai: "technique", ren: "fitness", ada: "analyst", mei: "nutrition", head: "head" }[text.split(/\s+/)[1]?.toLowerCase()];
    if (!want) return send(id, "Use /coach lin, kai, ren, ada, mei or head.");
    store.setPref(id, "coach", want); return send(id, `${COACHES[want].name} will take your questions from now on.`);
  }
  await call("sendChatAction", { chat_id: id, action: "typing" }).catch(() => {});
  if (text.startsWith("/meal")) return answer(id, "What should I eat next, given my next session and the food I have at home?", "nutrition", text);
  if (text.startsWith("/summary")) return answer(id, "Give me a short summary of my last match and the one thing to work on.", null, text);

  // free text (or /log): the local model files it as food, a calendar entry, a finished session, or a question
  const body = text.replace(/^\/log\S*\s*/, "");
  const r = await life.read(body).catch(() => ({ intent: "chat", items: [], events: [], log: {} }));
  if (text.startsWith("/log")) r.intent = "log";
  if (r.intent === "play") { await booking.start(send, id, r.play); return learnFrom(id, text); }
  if (r.intent === "pantry" && r.items.length) {
    const added = life.addPantry(id, r.items);
    trace.step("tool", "add to the kitchen list", { items: added.join(", ") });
    await send(id, `Added to your kitchen: ${added.join(", ") || "(already there)"}. Send /meal any time and Coach Mei plans around it.`);
    return learnFrom(id, text);
  }
  if (r.intent === "event" && r.events.length) {
    const evs = life.addEvents(id, r.events);
    trace.step("tool", "add to the calendar", { events: evs.map(life.evText).join("; ") });
    const sessions = evs.filter((e) => ["training", "match"].includes(e.kind) && e.start);
    await send(id, `In your calendar:\n${evs.map((e) => `• ${life.evText(e)}`).join("\n")}${sessions.length ? "\nI'll message you an hour before, with what to eat." : ""}\nSee the week with /week.`);
    if (evs.some((e) => ["match", "exam", "travel"].includes(e.kind))) await answer(id, `I just added this to my calendar: ${evs.map(life.evText).join("; ")}. How should my training this week change around it? Two sentences.`, "head", text, false);
    return learnFrom(id, text);
  }
  if (r.intent === "log") {
    const l = life.addLog(id, r.log, body);
    trace.step("tool", "log the session", { date: l.date, minutes: l.minutes, what: l.what, pain: l.pain || null });
    await send(id, `Logged for ${l.date}: ${l.what}${l.minutes ? `, ${l.minutes} min` : ""}${l.pain ? ` · pain: ${l.pain}` : ""}.`);
    await answer(id, `I just finished this session: ${body}. Give me one short reaction and what to do next.`, l.pain ? "fitness" : null, text, false);
    return learnFrom(id, text);
  }
  return answer(id, text, null, text);
}

// a coach reply on Telegram, with sources and 👍 / 👎; then learn anything durable the player said
async function answer(id, ask, coach, original, learnAfter = true) {
  store.addTurn(id, "user", ask);
  const r = await reply({ text: ask, playerId: id, coach });
  store.addTurn(id, "assistant", r.text, { coach: r.coach, verified: r.verified.ok, cites: r.cites, evidence: r.evidence });
  const turn = store.get(id).history.length - 1;
  const sources = r.evidence?.length ? `\n\nSources: ${r.evidence.map((e) => `${e.id} ${e.cite}`).join("; ")}` : "";
  // 👍 / 👎 under every reply: the coaches learn from it at the next reflection run
  await send(id, `${r.coachName}: ${r.text}${sources}`, { reply_markup: { inline_keyboard: [[{ text: "👍 Helpful", callback_data: `fb:${turn}:1` }, { text: "👎 Not helpful", callback_data: `fb:${turn}:-1` }]] } });
  if (learnAfter) await learnFrom(id, original);
  return r;
}
async function learnFrom(id, text) {
  if (text.startsWith("/")) return;
  const learned = await learn(id, text);
  if (learned.length) await send(id, `(Noted for your coaches: ${learned.join("; ")}. Send /forget to delete.)`);
}

export const answerFor = (id, ask, coach) => answer(id, ask, coach, "/", false);
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function todayText(p, now = new Date()) {
  const ev = life.today(p, now);
  return `${planText(p.plan, DAYS[now.getDay()])}${ev.length ? `\n\nIn your calendar today:\n${ev.map((e) => `• ${life.evText(e)}`).join("\n")}` : ""}`;
}

async function onButton(q) {
  if ((q.data || "").startsWith("bk:")) { const msg = await booking.button(send, String(q.from?.id ?? q.message?.chat?.id), q.data).catch((e) => String(e.message)); return call("answerCallbackQuery", { callback_query_id: q.id, text: msg }); }
  const m = /^fb:(\d+):(-?1)$/.exec(q.data || ""), id = String(q.message?.chat?.id), p = store.get(id);
  if (!m || !p) return call("answerCallbackQuery", { callback_query_id: q.id });
  const turn = p.history[+m[1]], ask = [...p.history.slice(0, +m[1])].reverse().find((h) => h.role === "user");
  evolve.feedback({ coach: turn?.coach, question: ask?.content, reply: turn?.content, value: +m[2], source: "telegram" });
  return call("answerCallbackQuery", { callback_query_id: q.id, text: +m[2] > 0 ? "Thanks, noted for your coaches." : "Thanks, your coaches will review this." });
}

booking.usePin(sendVenue);

export async function start() {
  if (!TOKEN) { state.error = "TELEGRAM_BOT_TOKEN not set"; return; }
  try { state.bot = await call("getMe"); } catch (e) { state.error = String(e.message); return; }
  let offset = 0;
  for (;;) {
    try {
      const ups = await call("getUpdates", { offset, timeout: 25, allowed_updates: ["message", "callback_query"] });
      state.lastPoll = Date.now(); state.error = null;
      for (const u of ups) {
        offset = u.update_id + 1;
        if (u.message) trace.run("telegram message", { who: u.message.from?.first_name, input: u.message.text ?? (u.message.location ? "📍 shared a location" : "") }, () => handle(u.message)).catch((e) => { state.error = String(e.message); });
        if (u.callback_query) trace.run("telegram button", { who: u.callback_query.from?.first_name, input: u.callback_query.data }, () => onButton(u.callback_query)).catch((e) => { state.error = String(e.message); });
      }
    } catch (e) { state.error = String(e.message); await new Promise((r) => setTimeout(r, 5000)); }
  }
}
