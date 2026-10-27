// The booking agent: "I want to play doubles with Amy and Ben on Saturday evening" becomes a court and a game.
//   1. the local model reads the request (days, window, length, singles/doubles, friends)      -> life.readPlay
//   2. the agent searches the club's courts, skipping times in anyone's calendar and match/exam days -> venue.search
//   3. the player picks a slot; the court is held and the friends are invited on Telegram
//   4. when they answer, the player confirms; only then is the court booked and everyone's calendar updated
// Nothing is booked or paid without the player's tap on "Book it". Holds expire on their own.
import fs from "node:fs";
import path from "node:path";
import * as store from "./store.js";
import * as life from "./life.js";
import * as venue from "./venue.js";
import * as trace from "./trace.js";
import * as browser from "./browser.js";
import * as site from "./site.js";

const FILE = path.resolve(process.env.PARTY_FILE || "data/parties.json");
let parties = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : [];
const save = () => { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(parties.slice(-200), null, 1)); };
export const list = () => parties;
// a map pin on Telegram (sendVenue), set by the bot; a no-op in tests without it
let pin = async () => {};
export const usePin = (fn) => { pin = (chat, x) => fn(chat, x).catch(() => {}); };
const find = (id) => parties.find((p) => p.id === id);
const nameOf = (id) => store.get(id)?.name ?? "a friend";
const names = (ids) => { const n = ids.map(nameOf); return n.length > 1 ? `${n.slice(0, -1).join(", ")} and ${n.at(-1)}` : n[0] ?? ""; };
const mins = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const BODY = /(knee|ankle|shoulder|back|wrist|calf|膝|腳踝|肩|腰)/i, HURT = /(sore|pain|hurt|injur|strain|sprain|痛|痠|傷)/i;

// someone is busy if the slot overlaps their calendar, or the day holds an exam or a match (no extra load then)
const busyFor = (ids) => (date, start, end) => ids.some((pid) => {
  const p = store.get(pid); if (!p) return false;
  return p.events.some((e) => e.date === date && (["exam", "match"].includes(e.kind) || (e.start && mins(e.start) < mins(end) && mins(start) < mins(e.end || e.start) + 60)));
});
// a word from the fitness coach when memory holds an injury
function coachNote(pid) {
  const m = (store.get(pid)?.memories || []).map((x) => x.text).find((t) => BODY.test(t) && HURT.test(t));
  return m ? `\nCoach Ren: you told us "${m.replace(/^Player said: /, "")}". Keep it to doubles at an easy pace, no jump smashes, and warm up for 10 minutes first.` : "";
}
const buttons = (rows) => ({ reply_markup: { inline_keyboard: rows } });

export async function start(send, host, req) {
  const players = store.players().filter((p) => p.id !== host);
  const want = req.friends.map((n) => n.toLowerCase());
  const named = players.filter((p) => want.some((n) => p.name.toLowerCase().startsWith(n) || n.startsWith(p.name.toLowerCase())));
  const missing = req.friends.filter((n) => !named.some((p) => p.name.toLowerCase().startsWith(n.toLowerCase()) || n.toLowerCase().startsWith(p.name.toLowerCase())));
  const open = !req.friends.length;
  const invitees = open ? players.filter((p) => p.prefs.openToPlay).map((p) => p.id) : named.map((p) => p.id);
  const need = req.format === "doubles" ? 3 : 1; // players besides the host
  trace.step("tool", "find the friends", { named: req.friends.join(", ") || "anyone open to a game", linked: names(invitees) || "none", missing: missing.join(", ") || null });
  trace.step("tool", "check calendars", { people: names([host, ...(open ? [] : invitees)]), rule: "skip overlaps and exam or match days" });
  // where everyone starts from: the areas players shared (rounded to about 1 km); the city centre otherwise
  const people = [host, ...(open ? [] : invitees)].map((id) => ({ id, name: nameOf(id), ...(store.get(id)?.home ?? {}) }));
  const located = people.filter((x) => x.lat != null);
  trace.step("tool", "open the map", { located: located.map((x) => x.name).join(", ") || "nobody yet", unknown: people.filter((x) => x.lat == null).map((x) => x.name).join(", ") || null });
  const ask = (days) => venue.search({ days, from: req.from, to: req.to, hours: req.hours, busy: busyFor([host, ...(open ? [] : invitees)]), people: located });
  let found = ask(req.days), wider = false;
  if (!found.slots.length) { // nothing in that window: the same hours over the next week
    found = ask(Array.from({ length: 7 }, (_, k) => { const d = new Date(); d.setDate(d.getDate() + k); return life.ymd(d); }));
    wider = true;
  }
  const slots = found.slots;
  trace.step("tool", "search venues near the middle", { venues: found.considered.length, withFreeCourts: found.considered.filter((c) => c.free).length, window: `${req.from}-${req.to}`, hours: req.hours,
    best: slots.map((x) => `${x.name} (farthest ${x.maxKm} km)`).join(", ") || "none" });
  if (!slots.length) return send(host, `No sports centre has a free court for ${req.hours} hours between ${req.from} and ${req.to} this week. Try another time of day?`);
  trace.step("check", "rank by fairness", { rule: "shortest longest trip, then the average, then the time asked", pick: `${slots[0].name}: ${slots[0].dists.map((d) => `${d.name} ${d.km} km`).join(", ")}` });
  const party = { id: "g" + Date.now().toString(36), host, format: req.format, hours: req.hours, open, need, slots, invitees: invitees.map((id) => ({ id, answer: null })), status: "choosing", at: Date.now(),
    map: { people: located.map(({ id, name, lat, lon }) => ({ id, name, lat, lon })), center: found.center, considered: found.considered } };
  parties.push(party); save();
  trace.step("human", "ask the player to pick a venue and time", { options: slots.length });
  const who = open ? (invitees.length ? `I'll ask the ${invitees.length} club players who are open to a game` : "nobody has said they're open to a game yet, so it would be just you") : invitees.length ? `with ${names(invitees)}` : "just you for now";
  const dist = (x) => x.dists.map((d) => `${d.name} ${d.km} km`).join(", ");
  const intro = `${wider ? "Nothing was free in the window you asked for, so I looked across this week:" : "I checked"} ${found.considered.length} sports centres for ${req.format} (${req.hours} h), ${who}. Fairest for everyone:`;
  await send(host, `${intro}\n${slots.map((x, i) => `${i + 1}. ${x.name} · ${x.date.slice(5)} ${x.start}-${x.end} · ${x.currency}${x.cost}\n   ${located.length ? dist(x) : `${x.dists[0].km} km from the city centre`}`).join("\n")}` +
    `${located.length < people.length ? `\n\n${people.filter((x) => x.lat == null).map((x) => x.name).join(" and ")} ${people.filter((x) => x.lat == null).length > 1 ? "haven't" : "hasn't"} shared a location yet (📎 → Location in this chat), so I measured from what I know.` : ""}` +
    `${missing.length ? `\n\nI can't find ${missing.join(", ")} among the club's players; they can join by opening this bot and sending /start.` : ""}` +
    `${coachNote(host)}\n\nPick one: I'll hold the court and ${invitees.length ? "invite them" : "ask you to confirm"}.`,
  buttons([slots.map((x, i) => ({ text: `${i + 1}. ${x.name.replace(/ (Civil )?Sports Center$/, "")} ${x.start}`, callback_data: `bk:pick:${party.id}:${i}` })), [{ text: "Cancel", callback_data: `bk:x:${party.id}` }]]));
  await pin(host, slots[0]);
  return party;
}

async function askToBook(send, p) {
  const b = venue.get(p.booking), v = venue.venue(b.venue), going = [p.host, ...p.invitees.filter((x) => x.answer).map((x) => x.id)];
  p.status = "confirming"; save();
  trace.step("human", "ask the player to confirm before booking", { going: going.length, cost: b.cost });
  await send(p.host, `Book ${venue.slotText(b)} for ${names(going)}? ${v.currency}${b.cost} for the court, ${v.currency}${Math.ceil(b.cost / going.length)} each, paid at the counter.`,
    buttons([[{ text: "Book it", callback_data: `bk:ok:${p.id}` }, { text: "Cancel", callback_data: `bk:x:${p.id}` }]]));
}

// every tap on a booking button lands here: bk:<action>:<party>[:<slot>]
export async function button(send, from, data) {
  const [, act, pid, i] = data.split(":"), p = find(pid);
  if (!p) return "This game is no longer open.";
  const v = venue.venue(p.booking ? venue.get(p.booking).venue : p.slots[+i || 0]?.venue) ?? {};
  if (act === "pick" && from === p.host && p.status === "choosing") {
    const sl = p.slots[+i], DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(sl.date + "T12:00").getDay()];
    trace.step("human", "the player picked a venue and time", { slot: `${sl.name} ${sl.date} ${sl.start}-${sl.end}` });
    p.status = "booking"; save();
    await send(p.host, `On it: I'm booking ${sl.name} on its booking site (${DAY} ${sl.start}-${sl.end}). I'll stop before the final confirm.`);
    // the agent books the court itself, on the venue's website, and stops on the review page
    const going = (p.open ? p.need : p.invitees.length) + 1;
    const dd = `${DAY.slice(0, 3)} ${sl.date.slice(5)}`;
    // the plan for each page of the site; the LLM picks the control that carries it out
    const hint = (o) => /password/i.test(o.controls.join(" ")) ? `Log in: type ${site.LOGIN.user} into Member ID, type {{password}} into Password, then click Log in.`
      : o.url.startsWith("/venues") ? `Click "${sl.name}".`
      : o.url.startsWith("/venue/") ? (o.url.includes(`date=${sl.date}`) ? `Click a "Free" button in the ${sl.start} row (any court).` : `Click the day "${dd}".`)
      : o.url.startsWith("/book") ? formStep(o) : "";
    // the booking form, one field at a time: whatever is not yet right is the next thing to do
    const players = Math.min(4, (p.open ? p.need : p.invitees.length) + 1);
    function formStep(o) {
      const line = (label) => o.controls.find((c) => c.includes(`"${label}"`)) ?? "", n = (l) => l.match(/^\[(\d+)\]/)?.[1];
      const dur = line("Duration"), pl = line("Players"), nm = line("Booking name"), go = line("Review booking");
      if (!dur.includes(`now: ${p.hours} hour`)) return `Select "${p.hours} hours" in Duration (control ${n(dur)}).`;
      if (!pl.includes(`now: ${players})`)) return `Select "${players}" in Players (control ${n(pl)}).`;
      if (!nm.includes(`value="${nameOf(p.host)}"`)) return `Type ${nameOf(p.host)} into Booking name (control ${n(nm)}).`;
      return `Click "Review booking" (control ${n(go)}).`;
    }
    const r = await browser.prepare({ party: p.id, site: site.URL_, secrets: { password: site.LOGIN.pass }, hint,
      goal: `Log in with member ID ${site.LOGIN.user} and password {{password}}. Open ${sl.name}. Choose the day ${DAY.slice(0, 3)} ${sl.date.slice(5)}. In the timetable click a Free button in the ${sl.start} row (any court). In the form choose duration ${p.hours} hours and ${Math.min(4, going)} players, type the booking name ${nameOf(p.host)}, then click Review booking.` });
    const b = r.ok ? venue.get(r.hold) : null;
    trace.step("tool", "hold the court", { court: b ? venue.slotText(b) : "not reached", minutes: venue.HOLD_MIN, via: "the venue's booking site" });
    if (!b) { p.status = "choosing"; save(); await send(p.host, `I couldn't finish the booking on ${sl.name}'s site (${r.text ?? "the court may have just gone"}). Pick another option or ask me again.`); return "Couldn't book that one."; }
    p.booking = b.id; p.status = p.invitees.length ? "inviting" : "confirming"; save();
    if (!p.invitees.length) { await askToBook(send, p); return "Court held."; }
    const until = new Date(b.until).toTimeString().slice(0, 5);
    await send(p.host, `Court ${b.court} is held until ${until}. I've invited ${names(p.invitees.map((x) => x.id))}; I'll ask you to confirm when they answer.`);
    const vb = venue.venue(b.venue), me = (id) => p.slots[+i].dists.find((d) => d.name === nameOf(id));
    for (const x of p.invitees) {
      await send(x.id, `${nameOf(p.host)} wants to play ${p.format}: ${venue.slotText(b)}, about ${vb.currency}${Math.ceil(b.cost / ((p.open ? p.need : p.invitees.length) + 1))} each${me(x.id) ? `, ${me(x.id).km} km from you` : ""}. Are you in?`,
      buttons([[{ text: "I'm in", callback_data: `bk:in:${p.id}` }, { text: "Can't make it", callback_data: `bk:no:${p.id}` }]]));
      await pin(x.id, { ...vb, venue: vb.id });
    }
    return "Court held, invitations sent.";
  }
  if ((act === "in" || act === "no") && p.status === "inviting") {
    const x = p.invitees.find((y) => y.id === from); if (!x) return "This invitation is for someone else.";
    if (x.answer !== null) return "Already noted.";
    const yes = p.invitees.filter((y) => y.answer).length;
    if (act === "in" && p.open && yes >= p.need) return "Sorry, the game is already full.";
    x.answer = act === "in"; save();
    trace.step("human", `${nameOf(from)} answered`, { answer: x.answer ? "in" : "can't make it" });
    const now = p.invitees.filter((y) => y.answer).length, waiting = p.invitees.filter((y) => y.answer === null).length;
    await send(p.host, `${nameOf(from)} ${x.answer ? "is in" : "can't make it"} (${now} of ${p.open ? p.need : p.invitees.length} in).`);
    if ((p.open && now >= p.need) || (!p.open && !waiting && now > 0)) await askToBook(send, p);
    else if (!waiting && !now) { venue.release(p.booking); p.status = "cancelled"; save(); await send(p.host, "Nobody can make that slot, so I've released the court. Tell me another time and I'll look again."); }
    return x.answer ? "Great, I've told them." : "No problem, I've told them.";
  }
  if (act === "ok" && from === p.host && p.status === "confirming") {
    trace.step("human", "the player confirmed");
    // the agent presses "Confirm booking" on the site it left open; if that page is gone, the hold is confirmed directly
    const ref = await browser.confirm(p.id).catch(() => null);
    const b = ref ? venue.get(p.booking) : venue.confirm(p.booking);
    if (!b || b.status !== "booked") { p.status = "expired"; save(); return "The hold ran out. Ask me again for new times."; }
    p.status = "booked"; p.reference = ref; save();
    trace.step("tool", "book the court", { court: venue.slotText(b), reference: ref ?? "confirmed without the site page" });
    const going = [p.host, ...p.invitees.filter((y) => y.answer).map((y) => y.id)];
    for (const id of going) {
      life.addEvents(id, [{ date: b.date, start: b.start, end: b.end, title: `Badminton ${p.format} with ${names(going.filter((g) => g !== id))}`.trim(), kind: "training" }]);
      trace.step("tool", "add to the calendar and set a reminder", { who: nameOf(id) });
      await send(id, `Booked: ${venue.slotText(b)}, ${p.format} with ${names(going.filter((g) => g !== id)) || "the club"}${ref ? ` (booking reference ${ref})` : ""}. It's in your calendar; I'll remind you an hour before with what to eat.`);
      await pin(id, { ...venue.venue(b.venue), venue: b.venue });
    }
    return "Booked.";
  }
  if (act === "x" && (from === p.host) && !["booked", "cancelled"].includes(p.status)) {
    if (p.booking) venue.release(p.booking);
    await browser.forget(p.id);
    p.status = "cancelled"; save();
    for (const x of p.invitees.filter((y) => y.answer !== false && p.booking)) await send(x.id, `${nameOf(p.host)} cancelled the game ${venue.slotText(venue.get(p.booking))}.`);
    return "Cancelled; the court is free again.";
  }
  return "That button has expired.";
}

// holds that ran out: tell the host and free the court
export async function expire(send) {
  for (const p of parties.filter((x) => ["inviting", "confirming"].includes(x.status))) {
    const b = venue.get(p.booking);
    if (b && b.status === "held" && b.until <= Date.now()) { venue.release(b.id); p.status = "expired"; save(); await send(p.host, `The hold on ${venue.slotText(b)} ran out before everyone answered, so the court is free again. Ask me for new times any time.`).catch(() => {}); }
  }
}

export function summary(pid) {
  const mine = venue.upcoming().filter((b) => parties.some((p) => p.booking === b.id && (p.host === pid || p.invitees.some((x) => x.id === pid && x.answer))));
  const open = parties.filter((p) => ["choosing", "inviting", "confirming"].includes(p.status) && (p.host === pid || p.invitees.some((x) => x.id === pid)));
  return [mine.length ? `Your courts:\n${mine.map((b) => `• ${venue.slotText(b)}${b.status === "held" ? " (held)" : ""}`).join("\n")}` : "No courts booked yet. Just tell me when you'd like to play, e.g. \"doubles with Amy and Ben on Saturday evening\".",
    open.length ? `\nIn progress: ${open.map((p) => `${p.format} (${p.status})`).join(", ")}` : ""].join("");
}
