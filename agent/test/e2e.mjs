// End-to-end test: a fake Telegram API on this machine, the real gateway pointed at it, and a scripted player.
// Checks linking, grounded replies (verifier), learning a memory, pushing the round-table plan, /plan and /forget.
//   node test/e2e.mjs            (LLM_URL defaults to http://127.0.0.1:8000/v1)
import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs";

const TG_PORT = 8799, GW_PORT = 8788, CHAT = 4242, sent = [], queue = [];
let upd = 1;
const tg = http.createServer((req, res) => {
  let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
    const body = b ? JSON.parse(b) : {}, method = req.url.split("/").pop();
    const ok = (result) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ ok: true, result })); };
    if (method === "getMe") return ok({ id: 1, is_bot: true, username: "shuttlecoach_test_bot" });
    if (method === "sendMessage") { sent.push(body.text); return ok({ message_id: sent.length }); }
    if (method === "sendChatAction") return ok(true);
    if (method === "getUpdates") {
      const out = queue.splice(0); if (out.length) return ok(out);
      return setTimeout(() => ok(queue.splice(0)), 400);
    }
    ok(true);
  });
}).listen(TG_PORT);

fs.rmSync("data/test-players.json", { force: true });
const gw = spawn(process.execPath, ["src/server.js"], { env: { ...process.env, PORT: String(GW_PORT), TELEGRAM_BOT_TOKEN: "TEST", TELEGRAM_API: `http://127.0.0.1:${TG_PORT}`, STORE_FILE: "data/test-players.json" }, stdio: ["ignore", "pipe", "pipe"] });
gw.stdout.on("data", (d) => process.stdout.write("  [gateway] " + d));
gw.stderr.on("data", (d) => process.stdout.write("  [gateway!] " + d));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function say(text, timeout = 240000) {
  const before = sent.length;
  queue.push({ update_id: upd++, message: { chat: { id: CHAT }, from: { first_name: "Hyeok" }, text } });
  const t0 = Date.now();
  while (sent.length === before) { if (Date.now() - t0 > timeout) throw new Error("no reply to " + text); await wait(200); }
  await wait(text.startsWith("/") ? 300 : 6000); // allow a follow-up (learned memory) message
  const got = sent.slice(before);
  console.log(`\n> ${text}  (${((Date.now() - t0) / 1000).toFixed(1)} s)\n` + got.map((g) => "< " + g).join("\n"));
  return got;
}
const api = (p, body) => fetch(`http://127.0.0.1:${GW_PORT}${p}`, body ? { method: "POST", headers: { "content-type": "application/json", origin: "http://127.0.0.1:5190" }, body: JSON.stringify(body) } : {}).then((r) => r.json());
const fails = [];
const expect = (cond, what) => { console.log(`  ${cond ? "PASS" : "FAIL"} ${what}`); if (!cond) fails.push(what); };

try {
  await wait(1500);
  const st = await api("/api/status");
  console.log("status:", JSON.stringify(st));
  expect(st.telegram.bot === "shuttlecoach_test_bot", "gateway connects to Telegram");

  expect((await say("/start"))[0].includes("linked"), "/start links the chat");
  const knee = await say("My right knee has been sore since Sunday. What should I train this week?");
  expect(knee.some((t) => /Coach Ren|Head Coach/.test(t)), "a coach answers");
  let players = await api("/api/players");
  for (let k = 0; k < 60 && !players[0]?.memories?.some((m) => /knee/i.test(m.text)); k++) { await wait(1000); players = await api("/api/players"); }
  console.log("  memories:", JSON.stringify(players[0]?.memories?.map((m) => m.text)));
  expect(players[0]?.memories?.some((m) => /knee/i.test(m.text)), "the knee is remembered from chat");
  const net = await say("How many net errors did I make in the match?");
  expect(net.some((t) => /14/.test(t)), "the answer uses the real figure (14 net errors)");
  const hist = (await api("/api/players"))[0].history.filter((h) => h.role === "assistant");
  expect(hist.every((h) => h.verified), "every reply passed the number verifier");

  const plan = { event: "Thailand Masters 2025", goals: ["Cut net errors to 8 or fewer"], days: [{ d: "Mon", blocks: [["technique", 25, "Net kill and net lift with a 30 cm margin"]] }, { d: "Tue", blocks: [] }] };
  const n = await api("/api/notify", { plan });
  await wait(500);
  expect(n.sent?.length === 1 && sent[sent.length - 1].includes("round table"), "the round-table plan is pushed to the player");
  expect((await say("/plan"))[0].includes("Net kill"), "/plan returns the stored plan");

  // the 24-hour coach: kitchen, calendar, training log, reminders
  expect((await say("/pantry eggs, tofu, rice, bananas, milk"))[0].includes("tofu"), "/pantry stores the kitchen list");
  await say("I bought chicken breast and broccoli today");
  let me = (await api("/api/players"))[0];
  expect(me.pantry.some((x) => /chicken/.test(x.item)), "food named in chat goes to the kitchen list");
  const wed = new Date(); do wed.setDate(wed.getDate() + 1); while (wed.getDay() !== 3);
  const wedYmd = `${wed.getFullYear()}-${String(wed.getMonth() + 1).padStart(2, "0")}-${String(wed.getDate()).padStart(2, "0")}`;
  await say("I have club training on Wednesday from 19:00 to 21:00");
  await say("I have an exam on Friday at 9 in the morning");
  me = (await api("/api/players"))[0];
  console.log("  events:", JSON.stringify(me.events.map((e) => [e.date, e.start, e.end, e.title, e.kind])));
  expect(me.events.some((e) => e.date === wedYmd && e.start === "19:00" && e.kind === "training"), `training is filed on Wednesday ${wedYmd} at 19:00`);
  expect(me.events.some((e) => e.kind === "exam"), "the exam is filed");
  const meal = await say("/meal");
  expect(meal.some((t) => /Coach Mei/.test(t) && /egg|tofu|rice|banana|milk|chicken|broccoli/i.test(t)), "Coach Mei plans a meal from the kitchen list");
  await say("Did 45 minutes of footwork and net drills today, knee felt fine");
  me = (await api("/api/players"))[0];
  expect(me.logs.some((l) => l.minutes === 45), "the session is logged with its 45 minutes");
  const wk = await say("/week");
  expect(/1 session/.test(wk[0]) && /training/i.test(wk[0]), "/week shows the calendar and the log");
  let before = sent.length;
  await api("/api/remind", { kind: "presession" }); await wait(500);
  expect(sent.slice(before).some((t) => t.startsWith("Coming up")) && sent.slice(before).some((t) => /Coach Mei/.test(t)), "an hour-before reminder comes with what to eat");
  before = sent.length;
  await api("/api/remind", { kind: "checkin" }); await wait(500);
  expect(sent.slice(before).some((t) => /How did today's session go/.test(t)), "the evening check-in is sent");
  const all = (await api("/api/players"))[0].history.filter((h) => h.role === "assistant");
  console.log("  replies verified:", all.filter((h) => h.verified).length, "of", all.length);
  expect(all.every((h) => h.verified), "every reply, including meals, passed the number verifier");
  expect((await say("/forget"))[0].includes("deleted"), "/forget deletes the player");
  expect((await api("/api/players")).length === 0, "nothing is left after /forget");
} catch (e) { fails.push(String(e.message)); console.log("ERROR", e); }
gw.kill(); tg.close();
console.log(fails.length ? `\n${fails.length} FAILED` : "\nALL PASSED");
process.exit(fails.length ? 1 : 0);
