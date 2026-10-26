// Verifier, sentence by sentence: every number in a coach reply must appear in a fact cited in the SAME sentence
// (written [F4] or (F4)). The only exceptions are numbers the player wrote or that are in their memory, and small
// counts up to 10 (sets, reps, days). A number that exists somewhere else on the facts sheet is not enough:
// "25% of your rallies (F3)" fails when 25 is not part of F3.
const NUM = /\d+(?:[.,]\d+)?/g;
const CITE = /[[(]([FE])(\d+)[\])]/g;
const nums = (s) => (s.match(NUM) || []).map((n) => +n.replace(",", "."));

export function check(reply, sheet, extraText = "", evidence = []) {
  const extra = new Set(nums(extraText));
  // facts [F#] and research findings [E#]: a number may only come from the item cited in its sentence
  const byId = Object.fromEntries([...sheet.facts.map((f) => [f.id, new Set(nums(f.text))]), ...evidence.map((e) => [e.id, new Set(nums(e.claim))])]);
  // sentence ends: ". " in English (so 3.69 stays one number), or 。！？ in Chinese, which needs no space
  const sentences = reply.split(/(?<=[.!?])\s+|(?<=[。！？])/);
  const bad = [];
  let count = 0;
  for (const s of sentences) {
    const cited = [...s.matchAll(CITE)].map((m) => `${m[1]}${m[2]}`);
    const allowed = new Set(cited.flatMap((id) => [...(byId[id] || [])]));
    const found = nums(s.replace(CITE, ""));
    count += found.length;
    // a training prescription may only use small counts: a match figure must not turn into "24 reps"
    const drill = /this week|drill|practi[cs]e|session|reps?\b|sets?\b|練習|訓練|本週|這週|本周|每組|每天/i.test(s);
    // in a sentence about eating, a time before or after training (30 minutes, 2 hours) is advice, not a match figure
    const meal = /\b(eat|meal|snack|breakfast|lunch|dinner|drink)\b|吃|餐|喝/i.test(s);
    const timed = new Set([...s.matchAll(/(\d+(?:\.\d+)?)\s*(?:-|to|–)?\s*(?:\d+\s*)?(min|minutes|hours?|h\b|分鐘|小時)/gi)].map((m) => +m[1]));
    for (const m of s.matchAll(/(\d+)\s*(?:-|to|–)\s*(\d+)\s*(min|minutes|hours?|分鐘|小時)/gi)) timed.add(+m[2]);
    for (const n of found) {
      const small = (Number.isInteger(n) && n >= 0 && n <= 10) || (meal && timed.has(n) && n <= 180);
      const matchFigure = sheet.numbers.has(n) && !allowed.has(n);
      if (drill && !small && !extra.has(n)) {
        // in a prescription, ordinary training values (30 s, 20 cm, 45 min) are fine; a match figure is not
        if (matchFigure || n > 60) bad.push(`${n} (match figure used as a training dose)`);
      } else if (!allowed.has(n) && !extra.has(n) && !small) bad.push(`${n}${cited.length ? ` (not in ${cited.join(", ")})` : " (no fact cited)"}`);
    }
  }
  return { ok: bad.length === 0, numbers: count, bad };
}
