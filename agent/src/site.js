// A mock sports-centre booking website, served by the station on its own port, so the booking agent can be shown
// doing what a person does on a venue's site: log in, pick the centre and the day, read the timetable, fill in the
// form, review, and confirm. It reads and writes the same sample court schedule as the rest of the station
// (venue.js). It is labelled on every page as a demo; it is not any real venue's system.
import http from "node:http";
import * as venue from "./venue.js";

const PORT = +(process.env.SITE_PORT || 8796);
export const URL_ = `http://127.0.0.1:${PORT}`;
export const LOGIN = { user: process.env.SITE_USER || "station-demo", pass: process.env.SITE_PASS || "demo-only" };
const sessions = new Set();
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addH = (t, h) => `${pad(+t.slice(0, 2) + h)}:${t.slice(3)}`;

const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)} · Taipei Sports Centres Booking</title><style>
body{margin:0;font:16px/1.45 "Segoe UI",Arial,sans-serif;background:#f3f5f7;color:#1d2a33}
header{background:#0b5d7a;color:#fff;padding:14px 28px;display:flex;align-items:center;gap:16px}header b{font-size:20px}
.demo{background:#ffe9a8;color:#5a4300;padding:6px 28px;font-size:13px}
main{max-width:1100px;margin:22px auto;background:#fff;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,.08);padding:24px 30px}
h1{margin:0 0 14px;font-size:24px}a{color:#0b5d7a}label{display:block;margin:12px 0 4px;font-weight:600}
input,select{font:inherit;padding:8px 10px;border:1px solid #b9c4cc;border-radius:6px;min-width:260px}
button{font:inherit;font-weight:700;background:#0b5d7a;color:#fff;border:0;border-radius:6px;padding:10px 18px;margin-top:16px;cursor:pointer}
button.alt{background:#e3e9ed;color:#1d2a33}
.venues{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.venues a{display:block;padding:12px;border:1px solid #d5dde2;border-radius:8px;text-decoration:none}
.days a{display:inline-block;margin:0 6px 8px 0;padding:6px 10px;border:1px solid #d5dde2;border-radius:6px;text-decoration:none}.days a.on{background:#0b5d7a;color:#fff}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #dde4e8;padding:6px;text-align:center;font-size:14px}
td.busy{background:#eef1f3;color:#8a979f}td form{margin:0}td button{margin:0;padding:4px 10px;font-size:13px;background:#1f8a4c}
.box{background:#f6f9fb;border:1px solid #d5dde2;border-radius:8px;padding:14px 18px}.ok{color:#1f8a4c}
</style></head><body><header><b>Taipei Sports Centres · Court Booking</b><span>members</span></header>
<div class="demo">Demo booking site running on the ShuttleCoach station; court schedules are sample data, not a real venue system.</div><main>${body}</main></body></html>`;

function parse(req) { return new Promise((ok) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => ok(Object.fromEntries(new URLSearchParams(b)))); }); }
const cookie = (req) => (req.headers.cookie || "").match(/sid=([a-z0-9]+)/)?.[1];
const send = (res, html, code = 200, extra = {}) => { res.writeHead(code, { "content-type": "text/html; charset=utf-8", ...extra }); res.end(html); };
const go = (res, to, extra = {}) => { res.writeHead(303, { location: to, ...extra }); res.end(); };

export function start() {
  http.createServer(async (req, res) => {
    const u = new URL(req.url, URL_), q = Object.fromEntries(u.searchParams), in_ = sessions.has(cookie(req));
    try {
      if (u.pathname === "/login" && req.method === "POST") {
        const f = await parse(req);
        if (f.member !== LOGIN.user || f.password !== LOGIN.pass) return send(res, page("Log in", `<h1>Member log in</h1><p style="color:#b3261e">Member ID or password is wrong.</p>${loginForm()}`), 401);
        const sid = Math.random().toString(36).slice(2); sessions.add(sid);
        return go(res, "/venues", { "set-cookie": `sid=${sid}; Path=/; HttpOnly` });
      }
      if (!in_) return send(res, page("Log in", `<h1>Member log in</h1>${loginForm()}`));
      if (u.pathname === "/" || u.pathname === "/venues") {
        return send(res, page("Sports centres", `<h1>Choose a sports centre</h1><div class="venues">${venue.venues().map((v) => `<a href="/venue/${v.id}">${esc(v.name)}<br><small>${esc(v.local)}</small></a>`).join("")}</div>`));
      }
      const vm = u.pathname.match(/^\/venue\/([a-z]+)$/);
      if (vm) {
        const v = venue.venue(vm[1]); if (!v) return send(res, page("Not found", "<h1>No such centre</h1>"), 404);
        const days = Array.from({ length: 7 }, (_, k) => { const d = new Date(); d.setDate(d.getDate() + k); return ymd(d); });
        const date = q.date && days.includes(q.date) ? q.date : days[0];
        const [o, c] = v.hours[DAYS[new Date(date + "T12:00").getDay()]];
        const hours = []; for (let h = +o.slice(0, 2); h < +c.slice(0, 2); h++) hours.push(`${pad(h)}:00`);
        const rows = hours.map((t) => `<tr><th>${t}</th>${Array.from({ length: v.courts }, (_, i) => i + 1).map((court) => venue.freeCourts(v.id, date, t, 1).includes(court)
          ? `<td><form action="/book" method="get"><input type="hidden" name="venue" value="${v.id}"><input type="hidden" name="date" value="${date}"><input type="hidden" name="start" value="${t}"><input type="hidden" name="court" value="${court}"><button aria-label="Court ${court} ${t} free">Free</button></form></td>`
          : `<td class="busy">Booked</td>`).join("")}</tr>`).join("");
        return send(res, page(v.name, `<h1>${esc(v.name)} · badminton courts</h1><p><a href="/venues">All centres</a></p>
          <div class="days">${days.map((d) => `<a class="${d === date ? "on" : ""}" href="/venue/${v.id}?date=${d}">${DAYS[new Date(d + "T12:00").getDay()]} ${d.slice(5)}</a>`).join("")}</div>
          <h2 style="font-size:18px">${DAYS[new Date(date + "T12:00").getDay()]} ${date}</h2><table><tr><th>Time</th>${Array.from({ length: v.courts }, (_, i) => `<th>Court ${i + 1}</th>`).join("")}</tr>${rows}</table>`));
      }
      if (u.pathname === "/book") {
        const v = venue.venue(q.venue);
        return send(res, page("Book", `<h1>Book a court</h1><div class="box">${esc(v.name)} · ${esc(q.date)} · from ${esc(q.start)} · court ${esc(q.court)}</div>
          <form action="/review" method="post">${["venue", "date", "start", "court"].map((k) => `<input type="hidden" name="${k}" value="${esc(q[k])}">`).join("")}
          <label for="hours">Duration</label><select id="hours" name="hours"><option value="1">1 hour</option><option value="2">2 hours</option><option value="3">3 hours</option></select>
          <label for="players">Players</label><select id="players" name="players"><option>2</option><option>3</option><option selected>4</option></select>
          <label for="name">Booking name</label><input id="name" name="name" placeholder="Name on the booking">
          <br><button>Review booking</button></form>`));
      }
      if (u.pathname === "/review" && req.method === "POST") {
        const f = await parse(req), v = venue.venue(f.venue), end = addH(f.start, +f.hours);
        const b = venue.hold({ venue: f.venue, date: f.date, start: f.start, end, court: +f.court, cost: v.price * +f.hours }, f.by || "site");
        if (!b) return send(res, page("Not available", `<h1>That court is no longer free</h1><p><a href="/venue/${f.venue}?date=${f.date}">Back to the timetable</a></p>`), 409);
        return send(res, page("Review", `<h1>Review your booking</h1><div class="box"><b>${esc(v.name)}</b><br>${f.date} · ${f.start}-${end} · court ${b.court}<br>${esc(f.players)} players · booking name: ${esc(f.name || "-")}<br>Price: ${v.currency}${b.cost} (pay at the counter)</div>
          ${b.court !== +f.court ? `<p>Court ${esc(f.court)} is not free for the whole ${f.hours} hours, so court ${b.court} is reserved instead.</p>` : ""}
          <p>Reservation hold <b id="hold">${b.id}</b>: the court is kept for you for ${venue.HOLD_MIN} minutes.</p>
          <form action="/confirm" method="post"><input type="hidden" name="hold" value="${b.id}"><button id="confirm">Confirm booking</button></form>
          <form action="/venue/${f.venue}" method="get"><input type="hidden" name="date" value="${f.date}"><button class="alt">Change</button></form>`));
      }
      if (u.pathname === "/confirm" && req.method === "POST") {
        const f = await parse(req), b = venue.confirm(f.hold);
        if (!b) return send(res, page("Expired", "<h1>The hold has expired</h1><p>Please choose the court again.</p>"), 410);
        const ref = "TS-" + b.id.slice(1, 7).toUpperCase();
        return send(res, page("Confirmed", `<h1 class="ok">Booking confirmed</h1><div class="box">Reference <b id="ref">${ref}</b><br>${esc(venue.slotText(b))}</div>`));
      }
      return send(res, page("Not found", "<h1>Page not found</h1>"), 404);
    } catch (e) { return send(res, page("Error", `<h1>Something went wrong</h1><p>${esc(e.message)}</p>`), 500); }
  }).on("error", (e) => console.error(`demo booking site not started: ${e.message}`)).listen(PORT, "127.0.0.1", () => console.log(`demo booking site on ${URL_}`));
}
const loginForm = () => `<form action="/login" method="post"><label for="member">Member ID</label><input id="member" name="member" autocomplete="username"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password"><br><button>Log in</button></form>`;
