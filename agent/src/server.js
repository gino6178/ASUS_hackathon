// Agent gateway: an HTTP API for the web app (status, coach chat, send plan, players), the Telegram bot, and the
// daily training reminder. Configure in .env (see .env.example).
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

for (const f of [".env"]) if (fs.existsSync(f)) for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const { reply, learn, COACHES } = await import("./coach.js");
const { health } = await import("./llm.js");
const tg = await import("./telegram.js");
const store = await import("./store.js");
const { factSheet } = await import("./facts.js");
const kb = await import("./kb.js");
const researcher = await import("./researcher.js");
const evolve = await import("./evolve.js");
const life = await import("./life.js");
const venue = await import("./venue.js");
const booking = await import("./booking.js");
const trace = await import("./trace.js");
const site = await import("./site.js");
site.start(); // the demo venue booking site the booking agent operates

const PORT = +(process.env.PORT || 8787);
const ORIGINS = (process.env.ALLOW_ORIGINS || "http://127.0.0.1:5190,http://localhost:5190").split(",");
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const json = (res, code, body, origin) => {
  res.writeHead(code, { "content-type": "application/json", ...(ORIGINS.includes(origin) ? { "access-control-allow-origin": origin, "access-control-allow-headers": "content-type" } : {}) });
  res.end(JSON.stringify(body));
};
const bodyOf = (req) => new Promise((ok) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { try { ok(JSON.parse(b || "{}")); } catch { ok({}); } }); });

async function remind(force = false) {
  const now = new Date(), day = now.toISOString().slice(0, 10), out = [];
  for (const p of store.players()) {
    if (!p.plan || (!force && (now.getHours() !== (p.prefs.reminderHour ?? 7) || p.prefs.lastReminder === day))) continue;
    try { await tg.send(p.id, tg.todayText(p, now)); store.markReminded(p.id, day); out.push(p.id); } catch (e) { out.push(`${p.id}: ${e.message}`); }
  }
  return out;
}
// the 24-hour coach: a message an hour before each session (with what to eat from the pantry), and an evening
// check-in on training days that have nothing logged yet. force=true (tests, the web button) ignores the clock.
async function lifeTick({ kind = "all", force = false } = {}) {
  const now = new Date(), day = life.ymd(now), out = [];
  for (const p of store.players()) {
    try {
      if (kind === "all" || kind === "presession") {
        const soon = p.events.filter((e) => ["training", "match"].includes(e.kind) && e.start && !e.reminded && (force ? life.at(e) > now : life.at(e) - now > 0 && life.at(e) - now <= 75 * 60000));
        for (const e of soon.slice(0, 1)) {
          store.update(p.id, (q) => { const x = q.events.find((y) => y.id === e.id); if (x) x.reminded = true; });
          await tg.send(p.id, `Coming up: ${life.evText(e)}.${p.plan ? `\n${tg.planText(p.plan, DAYS[life.at(e).getDay()]).split("\n").slice(1).join("\n")}` : ""}`);
          await tg.answerFor(p.id, `My ${e.kind} (${e.title}) starts at ${e.start}. What should I eat before it from the food I have, and when?`, "nutrition");
          out.push(`${p.id}: presession ${e.id}`);
        }
      }
      if (kind === "all" || kind === "checkin") {
        const trainedToday = life.today(p, now).some((e) => ["training", "match"].includes(e.kind)) || p.plan?.days?.find((d) => d.d === DAYS[now.getDay()])?.blocks?.length;
        const logged = p.logs.some((l) => l.date === day);
        if (force || (now.getHours() === (p.prefs.checkinHour ?? 21) && p.prefs.lastCheckin !== day && trainedToday && !logged)) {
          await tg.send(p.id, "How did today's session go? Tell me what you did, roughly how long, and any pain or soreness. I'll log it and your coaches will adjust tomorrow.");
          store.markReminded(p.id, day, "lastCheckin"); out.push(`${p.id}: checkin`);
        }
      }
    } catch (e) { out.push(`${p.id}: ${e.message}`); }
  }
  return out;
}
// nightly: the research agent reads new papers, then the coaches reflect and evolve their playbooks
const busy = { research: false, evolve: false }, done = {};
async function nightly() {
  const now = new Date(), day = now.toISOString().slice(0, 10);
  if (now.getHours() === +(process.env.RESEARCH_HOUR ?? 3) && done.research !== day && !busy.research) {
    done.research = day; busy.research = true; await trace.run("research", { who: "nightly" }, () => researcher.run()).catch(() => {}); busy.research = false;
  }
  if (now.getHours() === +(process.env.EVOLVE_HOUR ?? 4) && done.evolve !== day && !busy.evolve) {
    done.evolve = day; busy.evolve = true; await trace.run("reflection", { who: "nightly" }, () => evolve.run()).catch(() => {}); busy.evolve = false;
  }
}
setInterval(() => { remind().catch(() => {}); lifeTick().catch(() => {}); booking.expire(tg.send).catch(() => {}); nightly().catch(() => {}); }, 60000);

http.createServer(async (req, res) => {
  const o = req.headers.origin, u = new URL(req.url, "http://x");
  if (req.method === "OPTIONS") return json(res, 204, {}, o);
  try {
    if (u.pathname === "/api/status") {
      const s = factSheet("A");
      const pbs = evolve.playbooks();
      return json(res, 200, { llm: await health(), kb: kb.stats(), busy, feedback: evolve.feedbackStats(),
        playbooks: Object.fromEntries(Object.entries(pbs).map(([c, p]) => [c, { version: p.version, rules: p.rules.length, pending: p.proposals.filter((x) => x.status === "pending").length }])), telegram: { enabled: tg.state.enabled, bot: tg.state.bot?.username ?? null, error: tg.state.error, lastPoll: tg.state.lastPoll },
        players: store.players().length, athlete: s.name, facts: s.facts.length }, o);
    }
    if (u.pathname === "/api/players") return json(res, 200, store.players().map(({ id, name, memories, history, plan, prefs, pantry, events, logs, home }) => ({ id, name, memories, history: history.slice(-20), plan, prefs, pantry, events, logs, home })), o);
    if (u.pathname === "/api/facts") return json(res, 200, factSheet("A").facts, o);
    if (u.pathname === "/api/chat" && req.method === "POST") {
      const b = await bodyOf(req);
      const r = await trace.run("web chat", { who: "web", input: String(b.message || "") }, () => reply({ text: String(b.message || ""), coach: b.coach, history: b.history || [] }));
      return json(res, 200, r, o);
    }
    if (u.pathname === "/api/notify" && req.method === "POST") {
      const b = await bodyOf(req), targets = b.to ? [store.get(String(b.to))].filter(Boolean) : store.players(), sent = [];
      for (const p of targets) {
        if (b.plan) store.setPlan(p.id, b.plan);
        await tg.send(p.id, b.text || `Your coaches met at the round table and agreed this week.\n\n${tg.planText(b.plan)}\n\nReply here any time; we adapt the plan to how you feel.`);
        sent.push(p.id);
      }
      return json(res, 200, { sent }, o);
    }
    const flat = ({ paper, ...f }) => ({ ...f, cite: kb.cite(paper), title: paper.title, url: paper.url, year: paper.year, venue: paper.venue, source: paper.source });
    if (u.pathname === "/api/venue") return json(res, 200, { ...venue.meta(), venues: venue.venues().map(({ id, name, local, lat, lon, courts, price, currency, hours }) => ({ id, name, local, lat, lon, courts, price, currency, hours })),
      upcoming: venue.upcoming().slice(0, 3000), parties: booking.list().slice(-30).reverse().map((p) => ({ ...p, hostName: store.get(p.host)?.name, invitees: p.invitees.map((x) => ({ ...x, name: store.get(x.id)?.name })) })) }, o);
    if (u.pathname === "/api/roundtable" && req.method === "POST") {
      const b = await bodyOf(req), { meet } = await import("./roundtable.js");
      return json(res, 200, await trace.run("round table", { who: "web", input: `round table · ${b.event ?? ""}` }, () => meet(b)), o);
    }
    if (u.pathname === "/api/kb") return json(res, 200, { stats: kb.stats(), findings: kb.listFindings().map(flat), runs: kb.runs() }, o);
    if (u.pathname === "/api/kb/search") return json(res, 200, (await kb.search(u.searchParams.get("q") || "", { k: 6, min: 0.2 })).map(flat), o);
    if (u.pathname === "/api/research/run" && req.method === "POST") {
      if (busy.research) return json(res, 409, { error: "a research run is already going" }, o);
      const b = await bodyOf(req); busy.research = true;
      try { return json(res, 200, await trace.run("research", { who: "web", input: (b.topics || []).join(", ") }, () => researcher.run({ topics: b.topics || [], maxPapers: b.maxPapers || 6 })), o); } finally { busy.research = false; }
    }
    if (u.pathname === "/api/playbooks") return json(res, 200, { playbooks: evolve.playbooks(), feedback: evolve.feedbackStats() }, o);
    if (u.pathname === "/api/evolve/run" && req.method === "POST") {
      if (busy.evolve) return json(res, 409, { error: "an evolution run is already going" }, o);
      const b = await bodyOf(req); busy.evolve = true;
      try { return json(res, 200, await trace.run("reflection", { who: "web" }, () => evolve.run(b.coaches ? { coaches: b.coaches } : {})), o); } finally { busy.evolve = false; }
    }
    if (u.pathname === "/api/evolve/decide" && req.method === "POST") { const b = await bodyOf(req); return json(res, 200, await trace.run("human decision", { who: "web", input: `${b.approve ? "approve" : "decline"} ${b.coach}` }, async () => evolve.decide(b.coach, b.id, !!b.approve)), o); }
    const sh = u.pathname.match(/^\/api\/shot\/(r[a-z0-9]+|g[a-z0-9]+)\/(\d{2}\.jpg)$/);
    if (sh) { const f = path.resolve(process.env.SHOT_DIR || "data/shots", sh[1], sh[2]); if (!fs.existsSync(f)) return json(res, 404, { error: "no such shot" }, o); res.writeHead(200, { "content-type": "image/jpeg", "access-control-allow-origin": "*" }); return res.end(fs.readFileSync(f)); }
    if (u.pathname === "/api/trace") return json(res, 200, trace.recent(+(u.searchParams.get("n") || 40), u.searchParams.get("kind")), o);
    if (u.pathname === "/api/evolve/retire" && req.method === "POST") { const b = await bodyOf(req); return json(res, 200, await trace.run("human decision", { who: "web", input: `retire ${b.coach} ${b.id}` }, async () => evolve.retire(b.coach, b.id, b.reason)), o); }
    if (u.pathname === "/api/evolve/rollback" && req.method === "POST") { const b = await bodyOf(req); return json(res, 200, evolve.rollback(b.coach), o); }
    if (u.pathname === "/api/feedback" && req.method === "POST") { const b = await bodyOf(req); evolve.feedback({ ...b, source: "web" }); return json(res, 200, { ok: true }, o); }
    if (u.pathname === "/api/remind" && req.method === "POST") {
      const b = await bodyOf(req);
      return json(res, 200, { sent: await trace.run("reminder", { who: "station", input: b.kind || "morning" }, () => (b.kind && b.kind !== "morning" ? lifeTick({ kind: b.kind, force: true }) : remind(true))) }, o);
    }
    return json(res, 404, { error: "not found" }, o);
  } catch (e) { return json(res, 500, { error: String(e.message || e) }, o); }
}).listen(PORT, () => console.log(`agent gateway on http://127.0.0.1:${PORT} · LLM ${process.env.LLM_URL || "http://127.0.0.1:8000/v1"} · Telegram ${tg.state.enabled ? "on" : "off (no token)"}`));

tg.start();
export { COACHES, learn };
