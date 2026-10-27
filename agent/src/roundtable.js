// The round table on the local LLM: each coach agent argues for one priority from its own facts, the fitness coach
// checks every request against the player's memory and challenges one that clashes, the challenged coach answers,
// and the head coach rules with fixed priorities (health limits first, then the points each request is worth).
// The web app sends the facts it computed from the match (with ids) and the player's memory; every number a coach
// says is checked against those facts by the verifier, and a turn that fails twice falls back to its fact.
import { chat } from "./llm.js";
import { check } from "./verify.js";
import * as trace from "./trace.js";

const NAME = { head: "Head Coach", tactics: "Coach Lin (tactics)", technique: "Coach Kai (technique)", fitness: "Coach Ren (fitness)", analyst: "Coach Ada (data)" };
const ORDER = ["tactics", "technique", "fitness", "analyst"];
const json = (t, f) => { try { return JSON.parse((t.match(/\{[\s\S]*\}/) || ["{}"])[0]); } catch { return f; } };

// one spoken turn, verified: numbers must come from the cited facts (or the memory and stakes passed in extra)
async function speak(who, sheet, prompt, extra, purpose) {
  const facts = sheet.facts.map((f) => `[${f.id}] ${f.text}`).join("\n");
  const msgs = [
    { role: "system", content: `You are ${NAME[who]} at a badminton coaching staff meeting about one player's match. Speak in 1 or 2 short sentences, plain and direct, to the other coaches. Use only numbers from these facts and cite the fact id in the same sentence, like [F2]:\n${facts}` },
    { role: "user", content: prompt },
  ];
  let text = "", v = null;
  for (let k = 0; k < 2; k++) {
    text = (await chat(msgs, { maxTokens: 120, temperature: k ? 0.1 : 0.3, purpose: `${purpose} (${NAME[who]})` })).text.replace(/\n+/g, " ").trim();
    v = check(text, sheet, extra);
    trace.step("check", "verify every number", { coach: NAME[who], ok: v.ok, numbers: v.numbers, bad: v.bad.join("; ") || null });
    if (v.ok) break;
    msgs.push({ role: "assistant", content: text }, { role: "user", content: `These numbers are not in the fact cited in their sentence: ${v.bad.join("; ")}. Say it again using only numbers from the facts, with the fact id.` });
  }
  return v.ok ? { text, verified: true, numbers: v.numbers } : null;
}

export async function meet({ event, player, opponent, memory = [], briefs, stakes = [] }) {
  // one facts sheet for the meeting, ids per coach so each can cite its own
  let n = 0; const sheet = { facts: [], numbers: new Set() }, mine = {};
  for (const c of ORDER) mine[c] = (briefs[c]?.facts ?? []).map((t) => { const f = { id: `F${++n}`, text: t }; sheet.facts.push(f); return f; });
  for (const f of sheet.facts) for (const x of f.text.match(/\d+(?:\.\d+)?/g) ?? []) sheet.numbers.add(+x);
  const memText = memory.join(" "), stakeText = stakes.map((s) => `${s.owner}: ${s.ask} (${s.stake} ${s.unit})`).join("; ");
  const extra = `${event} ${memText} ${stakeText} 70 10 30`;
  const scoped = (c) => ({ facts: c === "head" ? sheet.facts : mine[c], numbers: sheet.numbers });
  const talk = [], said = {};
  const add = (who, r, meta = {}, fallback) => { const text = r?.text ?? fallback; talk.push([who, text, { ...meta, llm: !!r, verified: r?.verified ?? false }]); return text; };

  // the chair opens
  const goal = memory.find((m) => /goal/i.test(m));
  add("head", await speak("head", { facts: [], numbers: new Set() }, `Open the meeting on ${event} for ${player} in one or two sentences, without citing facts: ask each coach for one priority backed by the numbers.${goal ? ` Mention the player's stated goal: "${goal}".` : ""}`, extra + " " + (goal ?? ""), "open the meeting"),
    {}, `Round table on ${event}. One priority each, backed by the numbers, then we agree the week.`);
  talk[0][1] = talk[0][1].replace(/\s*\[F\d+\]/g, "");

  // each coach argues for one priority from its own facts
  for (const c of ORDER) {
    said[c] = add(c, await speak(c, scoped(c), `In two sentences: first what your data shows, with its number and fact id; then the drill you want this week: ${briefs[c]?.ask ?? "your drill"}. Do not turn match numbers into drill counts. The opponent is ${opponent}.${c === "fitness" && memory.length ? ` What you know about the player: ${memory.join("; ")}.` : ""}`, extra, "argue for a priority"),
      { coach: c }, `${briefs[c]?.ask ?? "My priority stands on the numbers."} [${mine[c][0]?.id ?? ""}]`.replace(" []", ""));
  }

  // the fitness coach checks every request against the player's memory
  let conflict = null;
  const hurtMem = memory.find((m) => /(knee|ankle|shoulder|back|wrist|calf)/i.test(m) && /(sore|pain|hurt|injur|strain|sprain)/i.test(m));
  if (memory.length) {
    const r = await chat([
      { role: "system", content: `You are Coach Ren, fitness coach. The player's memory: ${memory.join("; ")}. Read the other coaches' requests. If the memory reports pain or an injury, challenge the one request whose drill most needs jumping, split-steps, explosive footwork or deep lunges; a drill without those is safe. If the memory reports no pain or injury, challenge nobody. Answer JSON only: {"with": "tactics"|"technique"|"analyst"|null, "why": "one short reason"}.` },
      { role: "user", content: ORDER.filter((c) => c !== "fitness").map((c) => `${c}: ${said[c]} (planned drill: ${briefs[c]?.ask ?? ""})`).join("\n") },
    ], { maxTokens: 80, temperature: 0, purpose: "check the requests against the player's memory (Coach Ren)" });
    const j = json(r.text, {});
    if (ORDER.includes(j.with) && j.with !== "fitness") conflict = { with: j.with, why: String(j.why || "") };
    trace.step("check", "health check of every request", { conflict: conflict ? `${conflict.with}: ${conflict.why}` : "none" });
  }
  if (conflict) {
    add("fitness", await speak("fitness", scoped("fitness"), `Challenge ${NAME[conflict.with]} directly: their request ("${said[conflict.with]}") clashes with what you know about the player (${memory.join("; ")}): ${conflict.why}. Propose a safer version with numbers like 70% pace.`, extra, "challenge a request"),
      { conflict: ["fitness", conflict.with] }, `${NAME[conflict.with].split(" (")[0]}, memory says "${hurtMem ?? memory[0]}", so I'd keep that drill at 70% pace from a lower base, with no jumping.`);
    add(conflict.with, await speak(conflict.with, scoped(conflict.with), `Coach Ren challenged your request on health grounds: ${talk.at(-1)[1]} Answer: agree to a modified version and say how you will judge it.`, extra, "answer the challenge"),
      { resolve: true }, "Agreed: lower intensity, and we judge it by recovery rather than intensity.");
  }

  // the head coach rules: health limits first, then the points at stake
  const r = await chat([
    { role: "system", content: `You are the Head Coach chairing the meeting. Rules: health limits from the player's memory are hard constraints; inside them, rank requests by the points they cost in this match. Answer JSON only: {"ruling": "two sentences, no new numbers", "verdicts": {"tactics": "kept"|"modified"|"deferred", "technique": "...", "analyst": "...", "fitness": "..."}, "notes": {"tactics": "few words", "technique": "...", "analyst": "...", "fitness": "..."}}` },
    { role: "user", content: `Memory: ${memory.join("; ") || "nothing"}\nRequests and what they are worth: ${stakeText}\nMeeting:\n${talk.map(([w, t]) => `${NAME[w]}: ${t}`).join("\n")}` },
  ], { maxTokens: 260, temperature: 0.2, purpose: "rule on the requests (Head Coach)" });
  const j = json(r.text, {});
  const rv = j.ruling ? check(j.ruling, sheet, extra) : { ok: false };
  trace.step("check", "verify the ruling", { ok: rv.ok });
  add("head", rv.ok ? { text: `Ruling. ${j.ruling.replace(/^Ruling\.?\s*/i, "")}`, verified: true } : null, { resolve: true, ruling: true },
    "Ruling. Health limits from memory are hard constraints; inside them I rank every request by the points it cost us in this match. Four goals, one owner each.");
  const verdicts = Object.fromEntries(ORDER.map((c) => [c, { verdict: ["kept", "modified", "deferred"].includes(j.verdicts?.[c]) ? j.verdicts[c] : "kept", note: String(j.notes?.[c] ?? "").slice(0, 80) }]));
  trace.step("human", "plan goes to the player for the week", { verdicts: ORDER.map((c) => `${c} ${verdicts[c].verdict}`).join(", ") });
  return { talk, verdicts, facts: sheet.facts };
}
