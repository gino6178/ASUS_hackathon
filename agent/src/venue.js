// Venues the booking agent can use: real sports centres (names and locations from OpenStreetMap) with a sample
// court schedule for the prototype; a deployment reads each venue's own booking system instead. The agent finds
// the venue that is fair to everyone: it ranks free slots by the longest trip any player would make, then the
// average, then how close the time is to what was asked.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FILE = path.resolve(process.env.VENUE_FILE || "data/venues.json");
const SEED = path.join(path.dirname(fileURLToPath(import.meta.url)), "venues.seed.json");
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const mins = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
const hhmm = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const HOLD_MIN = +(process.env.HOLD_MINUTES || 120);
export const CITY = { name: "Taipei Main Station", lat: 25.0478, lon: 121.517 }; // used until a player shares a location

export function km(a, b) {
  const R = 6371, r = (x) => (x * Math.PI) / 180, dLat = r(b.lat - a.lat), dLon = r(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// travel time, estimated: about 2.4 min per km by MRT and bus plus 8 min of walking and waiting, and 6 more when the
// trip crosses the Tamsui/Xindian river (few bridges and transfers). An estimate, shown as one, not a route planner.
const RIVER = [[25.12, 121.46], [25.08, 121.49], [25.06, 121.505], [25.03, 121.495], [25.01, 121.52], [24.99, 121.55]];
const cross = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q[1] - p[1]) * (r[0] - p[0]) - (q[0] - p[0]) * (r[1] - p[1])); return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b); };
export function minutes(a, b) {
  const over = RIVER.slice(1).some((p, i) => cross([a.lat, a.lon], [b.lat, b.lon], RIVER[i], p));
  return Math.round(8 + km(a, b) * 2.4 + (over ? 6 : 0));
}

// sample schedule: courts, hours and other people's bookings for the next two weeks (evenings fill up first)
function sample() {
  const seed = JSON.parse(fs.readFileSync(SEED, "utf8"));
  let s = 11; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const venues = seed.venues.map((v) => ({ ...v, courts: 4 + Math.floor(rnd() * 5), price: [350, 400, 450, 500][Math.floor(rnd() * 4)], currency: "NT$",
    hours: Object.fromEntries(DAYS.map((d) => [d, d === "Sun" ? ["08:00", "21:00"] : d === "Sat" ? ["08:00", "22:00"] : ["06:00", "22:00"]])) }));
  const bookings = [], today = new Date();
  for (const v of venues) for (let k = 0; k < 14; k++) {
    const d = new Date(today); d.setDate(d.getDate() + k);
    const [o, c] = v.hours[DAYS[d.getDay()]], hot = .5 + rnd() * .35; // some venues are busier than others
    for (let court = 1; court <= v.courts; court++) for (let t = mins(o); t < mins(c); t += 60) {
      const busy = t >= 18 * 60 ? hot : t >= 16 * 60 ? hot * .55 : .18;
      if (rnd() < busy) bookings.push({ id: `m${v.id}${k}${court}${t}`, venue: v.id, court, date: ymd(d), start: hhmm(t), end: hhmm(t + 60), by: "member", status: "booked" });
    }
  }
  return { source: seed.source, sample: true, venues, bookings };
}
let db = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : sample();
const save = () => { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(db)); };
save();

export const venues = () => db.venues;
export const meta = () => ({ source: db.source, sample: db.sample });
export const venue = (id) => db.venues.find((v) => v.id === id);
const live = (b) => b.status === "booked" || (b.status === "held" && b.until > Date.now());

export function freeCourts(vid, date, start, hours) {
  const v = venue(vid), a = mins(start), z = a + hours * 60, [o, c] = v?.hours[DAYS[new Date(date + "T12:00").getDay()]] || [];
  if (!o || a < mins(o) || z > mins(c)) return [];
  return Array.from({ length: v.courts }, (_, i) => i + 1).filter((court) => !db.bookings.some((b) => b.venue === vid && b.court === court && live(b) && b.date === date && mins(b.start) < z && a < mins(b.end)));
}

// people: [{ name, lat, lon }]; returns the best slot per venue, the fairest venues first, and what was considered
export function search({ days, from = "18:00", to = "22:00", hours = 2, busy = () => false, people = [], limit = 3 }) {
  const who = people.filter((p) => p.lat != null);
  const center = who.length ? { lat: who.reduce((s, p) => s + p.lat, 0) / who.length, lon: who.reduce((s, p) => s + p.lon, 0) / who.length } : CITY;
  const considered = [], best = [];
  for (const v of db.venues) {
    const dists = (who.length ? who : [{ name: CITY.name, ...CITY }]).map((p) => ({ name: p.name, km: +km(p, v).toFixed(1), min: minutes(p, v) }));
    const maxKm = Math.max(...dists.map((d) => d.km)), avgKm = dists.reduce((s, d) => s + d.km, 0) / dists.length;
    const maxMin = Math.max(...dists.map((d) => d.min)), avgMin = dists.reduce((s, d) => s + d.min, 0) / dists.length;
    let slot = null;
    for (const date of days) for (let t = mins(from); t + hours * 60 <= mins(to); t += 30) {
      const start = hhmm(t), end = hhmm(t + hours * 60), courts = freeCourts(v.id, date, start, hours);
      if (!courts.length || busy(date, start, end)) continue;
      const late = Math.abs(t - mins(from)) / 60 + days.indexOf(date) * 3; // hours away from what was asked
      if (!slot || late < slot.late) slot = { venue: v.id, name: v.name, local: v.local, lat: v.lat, lon: v.lon, date, start, end, court: courts[0], free: courts.length, cost: v.price * hours, currency: v.currency, late };
    }
    considered.push({ id: v.id, name: v.name, lat: v.lat, lon: v.lon, maxKm, maxMin, free: !!slot });
    // fairness in minutes: the longest trip anyone makes, then the average, then how far from the asked time
    if (slot) best.push({ ...slot, dists, maxKm, maxMin, avgKm: +avgKm.toFixed(1), score: +(maxMin + .25 * avgMin + slot.late * 4).toFixed(2) });
  }
  return { center, considered, slots: best.sort((a, b) => a.score - b.score).slice(0, limit) };
}

export function hold(slot, by) {
  const h = (mins(slot.end) - mins(slot.start)) / 60, free = freeCourts(slot.venue, slot.date, slot.start, h);
  if (!free.length) return null;
  const b = { id: "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), venue: slot.venue, court: free.includes(slot.court) ? slot.court : free[0],
    date: slot.date, start: slot.start, end: slot.end, cost: slot.cost, by, status: "held", until: Date.now() + HOLD_MIN * 60000, at: Date.now() };
  db.bookings.push(b); save(); return b;
}
export const get = (id) => db.bookings.find((b) => b.id === id);
export function confirm(id) { const b = get(id); if (!b || !live(b)) return null; b.status = "booked"; delete b.until; save(); return b; }
export function release(id) { const b = get(id); if (b && b.status !== "cancelled") { b.status = "cancelled"; save(); } return b; }
export const upcoming = (by) => db.bookings.filter((b) => (!by || b.by === by) && live(b) && b.date >= ymd(new Date())).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
export const slotText = (s) => `${venue(s.venue)?.name ?? ""} · ${DAYS[new Date(s.date + "T12:00").getDay()]} ${s.date.slice(5)} ${s.start}-${s.end} · court ${s.court}`;
