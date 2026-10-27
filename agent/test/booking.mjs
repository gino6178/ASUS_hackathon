// End-to-end test of the booking agent with three players on a fake Telegram API and the real local model:
// "doubles with Amy and Ben on Saturday evening" -> free slots -> pick -> court held, friends invited -> both in ->
// the host confirms -> court booked, in all three calendars -> /courts and the hour-before reminder.
//   node test/booking.mjs
import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs";

const TG_PORT = 8798, GW_PORT = 8789, HOST = 4242, AMY = 4343, BEN = 4444, sent = [], queue = [];
const NAMES = { [HOST]: "Hyeok", [AMY]: "Amy", [BEN]: "Ben" };
let upd = 1, cq = 1;
const tg = http.createServer((req, res) => {
  let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
    const body = b ? JSON.parse(b) : {}, method = req.url.split("/").pop();
    const ok = (result) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ ok: true, result })); };
    if (method === "getMe") return ok({ id: 1, is_bot: true, username: "shuttlecoach_test_bot" });
    if (method === "sendMessage") { sent.push({ to: +body.chat_id, text: body.text, buttons: (body.reply_markup?.inline_keyboard || []).flat() }); return ok({ message_id: sent.length }); }
    if (method === "sendVenue") { sent.push({ to: +body.chat_id, text: `📍 ${body.title}`, buttons: [] }); return ok({ message_id: sent.length }); }
    if (method === "answerCallbackQuery") { sent.push({ to: "toast", text: body.text || "" }); return ok(true); }
    if (method === "getUpdates") { const out = queue.splice(0); if (out.length) return ok(out); return setTimeout(() => ok(queue.splice(0)), 300); }
    ok(true);
  });
}).listen(TG_PORT);

// DEMO=1 keeps the game in the station's own data, so the web app's map and trace can show it (restart the gateway after)
const DEMO = process.env.DEMO === "1", FILES = ["data/test-b-players.json", "data/test-venue.json", "data/test-parties.json"];
if (!DEMO) for (const f of FILES) fs.rmSync(f, { force: true });
const gw = spawn(process.execPath, ["src/server.js"], { env: { ...process.env, PORT: String(GW_PORT), TELEGRAM_BOT_TOKEN: "TEST", TELEGRAM_API: `http://127.0.0.1:${TG_PORT}`,
  ...(DEMO ? {} : { STORE_FILE: FILES[0], VENUE_FILE: FILES[1], PARTY_FILE: FILES[2] }), SITE_PORT: "8797" }, stdio: ["ignore", "pipe", "pipe"] });
gw.stderr.on("data", (d) => process.stdout.write("  [gateway!] " + d));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, body) => fetch(`http://127.0.0.1:${GW_PORT}${p}`, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}).then((r) => r.json());
const fails = [];
const expect = (c, what) => { console.log(`  ${c ? "PASS" : "FAIL"} ${what}`); if (!c) fails.push(what); };
const show = (msgs) => msgs.filter((m) => m.to !== "toast").forEach((m) => console.log(`  < [${NAMES[m.to] ?? m.to}] ${m.text.replace(/\n/g, "\n      ")}${m.buttons.length ? `\n      [${m.buttons.map((x) => x.text).join("] [")}]` : ""}`));
async function until(pred, ms = 120000) { const t0 = Date.now(); while (!pred()) { if (Date.now() - t0 > ms) throw new Error("timed out"); await wait(200); } }
async function say(chat, text, settle = 2500) {
  const n = sent.length; queue.push({ update_id: upd++, message: { chat: { id: chat }, from: { id: chat, first_name: NAMES[chat] }, text } });
  await until(() => sent.length > n); await wait(settle);
  console.log(`\n> [${NAMES[chat]}] ${text}`); const got = sent.slice(n); show(got); return got;
}
async function tap(chat, data) {
  const n = sent.length; queue.push({ update_id: upd++, callback_query: { id: "cq" + cq++, from: { id: chat, first_name: NAMES[chat] }, message: { chat: { id: chat } }, data } });
  await until(() => sent.some((m, i) => i >= n && m.to === "toast")); await wait(600);
  const got = sent.slice(n); console.log(`\n* [${NAMES[chat]}] taps ${data} -> "${got.find((m) => m.to === "toast")?.text}"`); show(got); return got;
}

try {
  await wait(1500);
  for (const c of [HOST, AMY, BEN]) await say(c, "/start", 500);
  // where they live: Hyeok in Neihu, Amy in Da'an, Ben in Banqiao (shared with 📎 → Location)
  const HOME = { [HOST]: [25.0815, 121.5812], [AMY]: [25.0262, 121.5435], [BEN]: [25.0136, 121.4628] };
  for (const c of [HOST, AMY, BEN]) {
    const n = sent.length; queue.push({ update_id: upd++, message: { chat: { id: c }, from: { id: c, first_name: NAMES[c] }, location: { latitude: HOME[c][0], longitude: HOME[c][1] } } });
    await until(() => sent.length > n); await wait(300); console.log(`
> [${NAMES[c]}] 📍 shares a location`); show(sent.slice(n));
  }
  const homes = (await api("/api/players")).map((p) => p.home);
  expect(homes.every((h) => h && String(h.lat).split(".")[1].length <= 2), "locations are stored rounded to about 1 km");
  const sat = new Date(); do sat.setDate(sat.getDate() + 1); while (sat.getDay() !== 6);
  const satYmd = `${sat.getFullYear()}-${String(sat.getMonth() + 1).padStart(2, "0")}-${String(sat.getDate()).padStart(2, "0")}`;

  const offer = await say(HOST, "I want to play doubles with Amy and Ben on Saturday evening", 3000);
  const o = offer.find((m) => m.to === HOST && m.buttons.some((b) => b.callback_data?.startsWith("bk:pick")));
  expect(!!o, "the agent offers free courts with pick buttons");
  expect(o && o.text.includes(satYmd.slice(5)) && /doubles/.test(o.text) && /Amy and Ben/.test(o.text), `the slots are on Saturday ${satYmd}, doubles, with Amy and Ben`);
  expect(o && o.buttons.filter((b) => b.callback_data.startsWith("bk:pick")).every((b) => /1[89]:|2[01]:/.test(b.text)), "every slot is in the evening");
  expect(o && /checked 18 sports centres/.test(o.text) && /Hyeok [\d.]+ km, Amy [\d.]+ km, Ben [\d.]+ km/.test(o.text), "it searched all 18 venues and shows each player's distance");
  const pv = (await api("/api/venue")).parties[0], free = pv.map.considered.filter((c) => c.free).map((c) => c.maxKm);
  expect(pv.slots[0].maxKm <= Math.min(...free) + 2, `the first venue is fair: farthest trip ${pv.slots[0].maxKm} km (best possible ${Math.min(...free)} km)`);
    expect(offer.some((m) => m.to === HOST && m.text.startsWith("📍")), "a map pin of the best venue is sent");

  const pick = await tap(HOST, o.buttons[0].callback_data);
  const inv = pick.filter((m) => [AMY, BEN].includes(m.to) && m.buttons.some((b) => b.callback_data?.startsWith("bk:in")));
  expect(inv.length === 2 && inv.every((m) => / km from you/.test(m.text)), "Amy and Ben are both invited, each told how far it is from them");
  let v = await api("/api/venue");
  const held = (await api("/api/venue")).parties.find((x) => x.id === pv.id)?.booking;
  expect(v.upcoming.some((b) => b.id === held && b.status === "held" && b.venue === pv.slots[0].venue), "the agent held the court itself, on the venue's booking site");
  const steps = (await api("/api/trace?n=20")).find((r) => r.input?.startsWith("bk:pick"))?.steps ?? [];
  console.log("  browser steps:", steps.filter((x) => x.name.startsWith("browser:")).map((x) => x.name).join(" | "));
  expect(steps.some((x) => /browser: .*log in/i.test(x.name)) && steps.some((x) => /reached the review page/.test(x.name)) && !steps.some((x) => /confirm booking/i.test(x.name)), "it logged in, filled in the form and stopped before the final confirm");
  expect(steps.filter((x) => x.shot).length >= 4, "every browser step has a screenshot");
  expect(!JSON.stringify(steps).includes("demo-only"), "the password never appears in the trace");

  await tap(AMY, inv.find((m) => m.to === AMY).buttons[0].callback_data);
  const last = await tap(BEN, inv.find((m) => m.to === BEN).buttons[0].callback_data);
  const ask = last.find((m) => m.to === HOST && m.buttons.some((b) => b.callback_data?.startsWith("bk:ok")));
  expect(!!ask && /each/.test(ask.text), "when both are in, the host is asked to confirm, with the cost per person");
  v = await api("/api/venue");
  expect(!v.upcoming.some((b) => b.id === held && b.status === "booked"), "nothing is booked before the host confirms");

  const done = await tap(HOST, ask.buttons[0].callback_data);
  expect(done.filter((m) => /^Booked:/.test(m.text)).length === 3 && done.filter((m) => m.text.startsWith("📍")).length === 3, "all three get the booking and a map pin");
  v = await api("/api/venue");
  expect(v.upcoming.some((b) => b.id === held && b.status === "booked" && b.date === satYmd && b.venue === pv.slots[0].venue), `the court is booked on Saturday at ${pv.slots[0].name}`);
  expect(done.some((m) => /booking reference TS-[A-Z0-9]+/.test(m.text)), "the agent pressed Confirm booking on the site and read back the reference");
  const ps = await api("/api/players");
  expect(ps.every((p) => p.events.some((e) => e.date === satYmd && /Badminton doubles/.test(e.title))), "it is in all three calendars");

  const courts = await say(AMY, "/courts", 800);
  expect(courts.some((m) => /Your courts/.test(m.text) && m.text.includes(satYmd.slice(5))), "/courts shows Amy the game");
  const unknown = await say(HOST, "Can we play singles with Carl tomorrow evening", 3000);
  expect(unknown.some((m) => /can't find Carl/.test(m.text)), "a friend who isn't linked is named, with how to join");

  const n = sent.length; await api("/api/remind", { kind: "presession" }); await wait(3000);
  const rem = sent.slice(n); show(rem);
  expect(rem.some((m) => /Coming up/.test(m.text) && /Badminton doubles/.test(m.text)), "the hour-before reminder covers the booked game");
} catch (e) { fails.push(String(e.message)); console.log("ERROR", e); }
gw.kill("SIGKILL"); tg.close(); // SIGKILL: the browser it started must not keep the test gateway alive
if (!DEMO) for (const f of FILES) fs.rmSync(f, { force: true });
console.log(fails.length ? `\n${fails.length} FAILED` : "\nALL PASSED");
process.exit(fails.length ? 1 : 0);
