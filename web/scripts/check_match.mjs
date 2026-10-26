// Print the key match-analysis numbers for a quick sanity check: node scripts/check_match.mjs
import fs from "node:fs";
import * as A from "../src/match/analytics.js";

const d = JSON.parse(fs.readFileSync(new URL("../public/data/matches.json", import.meta.url), "utf8"));
const m = d.matches[0];
const ps = A.pointStats(m, "A");
console.log("points", ps.won, ps.lost, ps.winners.slice(0, 3), ps.errorReasons, ps.byLen, ps.serveWin, ps.recvWin, ps.clutchWin);
const pt = A.patterns(m, "A");
console.log("pairs", pt.pairs.slice(0, 3), "best", pt.best[0], "worst", pt.worst[0]);
const fw = A.footwork(m, "A");
console.log("footwork", fw.recovery.toFixed(2), fw.reqSpeed.toFixed(2), fw.stretched, fw.perShot.toFixed(2), fw.totalMove.toFixed(0),
  fw.byType.slice(0, 3).map((x) => [x.t, x.v.toFixed(2), x.dt.toFixed(2), x.vEarly.toFixed(2), x.stretched]));
const fa = A.fatigue(m, "A");
console.log("fatigue", JSON.stringify({ rec: fa.rec, req: fa.req, err: fa.err, tempo: fa.tempo }));
console.log("by set", fa.bySet.map((s) => [s.s, s.rec.toFixed(2), s.req.toFixed(2), s.err, s.tempo.toFixed(2)]));
console.log("runs", A.scoreFlow(m).runs);
for (const mm of d.matches) {
  const pr = A.profile(mm, A.sideOf(mm, "WANG Po Wei"));
  console.log(mm.event, pr.winPct, pr.winners, pr.errors, pr.smashShare, pr.attackShare, pr.avgRally.toFixed(1), pr.reqSpeed.toFixed(2), pr.targets, pr.weak);
}
