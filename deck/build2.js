// Stage I proposal deck in the website's visual language: PPTX_SKILL=<skill dir> node build2.js
const fs = require("fs");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa6");
const { applyTheme } = require(process.env.PPTX_SKILL + "/scripts/apply_theme.js");

const THEME = {
  name: "ShuttleCoach Dark",
  headFontFace: "Bahnschrift",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "04070A", lt1: "EEF1F2", dk2: "0A1014", lt2: "C3CACD",
    accent1: "F2E6C9", accent2: "6FB6FF", accent3: "FF8A6B",
    accent4: "5FD39A", accent5: "8E989D", accent6: "111A20",
    hlink: "F2E6C9", folHlink: "8E989D",
  },
};
const H = THEME.colors;
// STATIC=1 swaps each looping clip for a still, for the PDF (a PDF shows only a GIF's first frame)
const STATIC = process.env.STATIC === "1";
const OUT = STATIC ? "ShuttleCoach_StageI_Proposal_v4_static.pptx" : "ShuttleCoach_StageI_Proposal_v4.pptx";
const STILL = { "clips/process.gif": "shots/processing.png", "clips/replay.gif": "shots/replay.png", "clips/heat.gif": "shots/heat.png",
  "clips/agents.gif": "shots/agents.png", "clips/body.gif": "shots/body_front.png", "clips/sparring.gif": "shots/sparring.png",
  "clips/architecture.gif": "shots/architecture_frame.png", "clips/hardware.gif": "shots/hardware_frame.png", "clips/coach_tactics.gif": "clips/_coach_tactics.jpg", "clips/coach_technique.gif": "clips/_coach_technique.jpg", "clips/coach_fitness.gif": "clips/_coach_fitness.jpg", "clips/coach_analyst.gif": "clips/_coach_analyst.jpg",
  "clips/match_tour.gif": "clips/_match_tour.jpg", "clips/live.gif": "clips/_live.jpg", "clips/highlight.gif": "shots/hl_replay.png", "clips/roundtable.gif": "shots/rt_conflict.png", "clips/recon.gif": "shots/recon_still.png", "clips/agent_arch.gif": "shots/agent_arch.png" };
const MONO = "Consolas";
const FOOT = "SHUTTLECOACH  ·  ASUS UGEN AI LEAGUE 2026  ·  BATTLEFIELD THUNDERSTORM";
const GH_URL = "https://github.com/gino6178/ASUS_hackathon";
const GH = "github.com/gino6178/ASUS_hackathon";
// the five required sections of the Stage I brief, in the brief's order
const SECTIONS = ["Context and problem definition", "Solution: tools, technologies and methodology",
  "Hardware and software architecture, system planning", "Expected benefits and outcomes", "References and GitHub source code"];

async function icon(Comp, color) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: "#" + color, size: "256" }));
  return "image/png;base64," + (await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64");
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.title = "ShuttleCoach: A Private, On-Device Multi-Agent Badminton Analyst";
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  const C = pres.SchemeColor;

  pres.defineSlideMaster({
    title: "COVER", background: { color: C.text1 },
    objects: [{ placeholder: { options: { name: "title", type: "title", x: .7, y: 5.75, w: 12, h: .4, fontSize: 13, color: C.accent1, fontFace: MONO, charSpacing: 2, align: "left" }, text: "" } }],
  });
  pres.defineSlideMaster({
    title: "SECTION", background: { color: C.text1 },
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: .7, y: 1.6, w: 6.4, h: 2.4, fontSize: 48, bold: true, color: C.background1, valign: "bottom", align: "left" }, text: "" } },
      { placeholder: { options: { name: "body", type: "body", x: .7, y: 4.2, w: 6.4, h: 1.6, fontSize: 20, color: C.background2, valign: "top", align: "left" }, text: "" } },
    ],
  });
  pres.defineSlideMaster({
    title: "CONTENT", background: { color: C.text1 },
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: .6, y: .62, w: 12.1, h: .8, fontSize: 30, bold: true, color: C.background1, valign: "middle", align: "left" }, text: "" } },
      { text: { text: FOOT, options: { x: .6, y: 7.02, w: 9, h: .28, fontSize: 9, fontFace: MONO, color: C.accent5, charSpacing: 1 } } },
    ],
    slideNumber: { x: 12.2, y: 7.02, w: .5, h: .28, fontSize: 9, fontFace: MONO, color: C.accent5, align: "right" },
  });

  const I = {
    shield: await icon(fa.FaShieldHalved, H.accent1), shieldOk: await icon(fa.FaShieldHalved, H.accent4), lock: await icon(fa.FaLock, H.accent1), wifi: await icon(fa.FaWifi, H.accent1),
    users: await icon(fa.FaUserGroup, H.accent1), video: await icon(fa.FaVideo, H.dk1), cube: await icon(fa.FaCube, H.dk1),
    brain: await icon(fa.FaBrain, H.dk1), list: await icon(fa.FaClipboardList, H.dk1), money: await icon(fa.FaMoneyBillTrendUp, H.accent1),
    school: await icon(fa.FaSchool, H.accent1), tg: await icon(fa.FaTelegram, "2AABEE"), up: await icon(fa.FaThumbsUp, H.lt1), down: await icon(fa.FaThumbsDown, H.lt1), check: await icon(fa.FaCircleCheck, H.accent4), trophy: await icon(fa.FaTrophy, H.accent1), person: await icon(fa.FaPersonRunning, H.accent1),
  };

  // images and looping GIF clips (recorded from the running prototype); keyed by path
  const sz = {};
  const MEDIA = ["shots/processing.png", "shots/patterns.png", "clips/process.gif", "clips/replay.gif", "clips/heat.gif",
    "clips/agents.gif", "clips/body.gif", "clips/sparring.gif", "clips/architecture.gif", "clips/hardware.gif", "shots/plan.png", "clips/roundtable.gif", "clips/match_tour.gif", "clips/highlight.gif", "clips/live.gif", "clips/recon.gif", "shots/rt_ruling.png", "shots/hl_follow.png", "shots/hl_replay.png", "shots/hl_freeze.png", "shots/hl_done.png", "shots/live_brief.png", "shots/voice.png", "shots/calib.png", "shots/risk_feed.png", "shots/positions_court.png", "shots/agent_trace.png", "clips/agent_arch.gif", "clips/coach_tactics.gif", "clips/coach_technique.gif", "clips/coach_fitness.gif", "clips/coach_analyst.gif"];
  for (const f of MEDIA) { const m = await sharp(f, { animated: false }).metadata(); sz[f] = m.width / m.height; }
  // place an image inside a box, keeping its aspect ratio, aligned top-left unless centred
  for (const f of Object.values(STILL)) { const m = await sharp(f).metadata(); sz[f] = m.width / m.height; }
  const fit = (s, f, x, y, w, h, name, center = true) => {
    if (STATIC && STILL[f]) f = STILL[f];
    const r = sz[f]; let iw = w, ih = w / r;
    if (ih > h) { ih = h; iw = h * r; }
    s.addImage({ path: f, x: center ? x + (w - iw) / 2 : x, y: center ? y + (h - ih) / 2 : y, w: iw, h: ih, objectName: name });
  };
  const card = (s, x, y, w, h, fill, name, line) =>
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: .1, fill: { color: fill }, line: { color: line || fill, width: .75 }, objectName: name });
  const txt = (s, t, o) => s.addText(t, Object.assign({ isTextBox: true, margin: 0, fontSize: 15, color: C.background2, valign: "top" }, o));
  const tag = (s, t, x, y, color = C.accent1, w = 8) => txt(s, t.toUpperCase(), { x, y, w, h: .3, fontSize: 11, fontFace: MONO, color, charSpacing: 3 });
  // every content slide names its section from the brief and shows where it sits among the five
  const content = (title, n) => {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: SECTIONS[n - 1] });
    tag(s, `${n} · ${SECTIONS[n - 1]}`, .6, .32, C.accent1, 9);
    SECTIONS.forEach((_, i) => {
      const on = i + 1 === n, x = 10.75 + i * .4;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: .3, w: .32, h: .3, rectRadius: .06,
        fill: { color: on ? H.accent1 : H.accent6 }, line: { color: on ? H.accent1 : H.accent6 }, objectName: `section ${i + 1} marker` });
      txt(s, String(i + 1), { x, y: .3, w: .32, h: .3, fontSize: 10, fontFace: MONO, bold: on, align: "center", valign: "middle", color: on ? C.text1 : C.accent5 });
    });
    s.addText(title, { placeholder: "title" });
    return s;
  };

  pres.addSection({ title: "Opening" });
  // 1 Cover
  let s = pres.addSlide({ masterName: "COVER", sectionTitle: "Opening" });
  // cover background: 1440 px GIF from lossless 1080p frames (GIFs autoplay and loop everywhere); a still in the PDF variant
  s.addImage({ path: STATIC ? "shots/cover_poster.png" : "clips/cover.gif", x: 0, y: 0, w: 13.333, h: 7.5, objectName: "3D rally reconstruction" });
  tag(s, "Private badminton intelligence", .7, 1.75);
  txt(s, "SHUTTLE\nCOACH", { x: .7, y: 2.15, w: 6.5, h: 2.6, fontSize: 80, bold: true, color: C.background1, fontFace: "Bahnschrift", charSpacing: 4, lineSpacingMultiple: .85 });
  txt(s, "A private, on-device multi-agent badminton analyst", { x: .7, y: 4.75, w: 4.9, h: .9, fontSize: 22, color: C.background2 });
  s.addText("BATTLEFIELD THUNDERSTORM · INTEL ARC PRO B70 32GB · EVERYDAY AI", { placeholder: "title" });
  txt(s, [{ text: "Team rm-rf-2  ·  " }, { text: GH, options: { hyperlink: { url: GH_URL }, color: H.accent1 } }],
    { x: .7, y: 6.2, w: 9, h: .4, fontSize: 14, color: C.accent5 });
  s.addNotes("The cover is the live product: the 3D rally behind the title is reconstructed from a single broadcast camera.");

  pres.addSection({ title: SECTIONS[0] });
  // 2 Problem
  s = content("Pros get data-driven coaching. Everyone else guesses.", 1);
  const COLS = [["Hire an analyst", C.accent5], ["Cloud analysis app", C.accent3], ["ShuttleCoach", C.accent1]];
  const ROWS = [
    ["Match video leaves the court", "Shared with a person", "Uploaded to a server", "Never: 0 bytes leave"],
    ["Time to a report", "Days", "Upload, then queue", "≤ match length"],
    ["Cost model", "Salary or per-match fee", "Monthly, per player", "One station + yearly update"],
    ["Works with no internet", "Yes", "No", "Yes"],
    ["3D flight and shot speed", "Rarely", "2D stats", "Every shot, metric 3D"],
    ["Plan adapted to the player", "If there is time", "Generic tips", "A coaching staff that debates and learns"],
  ];
  const cx = [3.85, 6.85, 9.85], cw = 2.85, ry = 2.35, rh = .66;
  card(s, 9.75, 1.6, 3.05, 5.15, C.accent6, "shuttlecoach column", H.accent1);
  COLS.forEach(([h, col], k) => {
    s.addShape(pres.shapes.OVAL, { x: cx[k] + .05, y: 1.86, w: .22, h: .22, fill: { color: col }, line: { color: col }, objectName: "column dot " + k });
    txt(s, h, { x: cx[k] + .4, y: 1.76, w: cw - .4, h: .42, fontSize: 17, bold: true, color: k === 2 ? C.accent1 : C.background1, valign: "middle" });
  });
  ROWS.forEach((r, i) => {
    const y = ry + i * rh;
    s.addShape(pres.shapes.LINE, { x: .6, y, w: 12.1, h: 0, line: { color: H.accent6, width: .75 }, objectName: "row rule " + i });
    txt(s, r[0], { x: .6, y: y + .1, w: 3.1, h: rh - .15, fontSize: 13.5, color: C.accent5, valign: "middle" });
    r.slice(1).forEach((v, k) => txt(s, v, { x: cx[k] + .05, y: y + .1, w: cw - .1, h: rh - .15, fontSize: 14.5, valign: "middle",
      bold: k === 2, color: k === 2 ? C.background1 : (k === 1 && i === 0 ? C.accent3 : C.background2) }));
  });
  txt(s, "Pro insight, priced for a club, and the footage never leaves the building.", { x: .6, y: 6.45, w: 9, h: .35, fontSize: 14, italic: true, color: C.accent1 });

  // 3 Why local
  s = content("Match video is personal data, so the analysis stays local", 1);
  [[I.shield, "Biometric data", "Faces, body shape and movement signatures, often of minors in school and junior programmes."],
   [I.lock, "Tactical secrets", "A team's footage is its game plan. Coaches will not upload it to a third-party cloud."],
   [I.wifi, "Courts are offline", "Gyms and community halls have weak or no internet."]].forEach(([ic, h, b], i) => {
    const y = 1.8 + i * 1.6;
    s.addShape(pres.shapes.OVAL, { x: .7, y, w: .95, h: .95, fill: { color: C.accent6 }, line: { color: C.accent6 }, objectName: "why circle " + i });
    s.addImage({ data: ic, x: .94, y: y + .24, w: .47, h: .47, objectName: "why icon " + i });
    txt(s, h, { x: 1.95, y: y + .02, w: 5.2, h: .45, fontSize: 20, bold: true, color: C.background1 });
    txt(s, b, { x: 1.95, y: y + .5, w: 5.2, h: .9, fontSize: 15 });
  });
  card(s, 7.7, 1.8, 5.0, 4.5, C.accent6, "design rule", H.accent1);
  tag(s, "Design rule", 8.1, 2.15);
  txt(s, "Zero bytes of video or pose data leave the machine.", { x: 8.1, y: 2.65, w: 4.2, h: 1.8, fontSize: 28, bold: true, color: C.background1, fontFace: "Bahnschrift" });
  txt(s, "Every model, from shuttle tracking to the coaching agents, runs on one Intel Arc Pro B70.", { x: 8.1, y: 4.25, w: 4.2, h: .9, fontSize: 15 });
  txt(s, "Offline by default · no account · Telegram is opt-in and carries text only · one-step deletion · reports never share frames.", { x: 8.1, y: 5.2, w: 4.2, h: .9, fontSize: 13, italic: true, color: C.accent1 });

  pres.addSection({ title: SECTIONS[1] });
  // 4 Flow
  s = content("One camera in. A coaching staff out.", 2);
  [[I.video, "Record", "Any fixed camera behind the court"], [I.cube, "Reconstruct", "Shuttle flight in metric 3D, hits, player positions"],
   [I.brain, "Reason", "Four coach agents analyse, remember and simulate"], [I.list, "Act", "Personified coaches flash zones, muscles and flights"]].forEach(([ic, h, b], i) => {
    const y = 1.75 + i * 1.22;
    s.addShape(pres.shapes.OVAL, { x: .7, y, w: .8, h: .8, fill: { color: i === 3 ? C.accent3 : C.accent1 }, line: { color: H.dk1, transparency: 100 }, objectName: "flow dot " + i });
    s.addImage({ data: ic, x: .9, y: y + .2, w: .4, h: .4, objectName: "flow icon " + i });
    txt(s, h, { x: 1.75, y: y + .02, w: 3.6, h: .4, fontSize: 19, bold: true, color: C.background1 });
    txt(s, b, { x: 1.75, y: y + .42, w: 3.6, h: .6, fontSize: 14 });
  });
  fit(s, "clips/process.gif", 5.6, 1.7, 7.1, 4.0, "upload and processing clip");
  txt(s, "Recorded from the prototype: the video is opened by the browser and never uploaded.", { x: 5.6, y: 5.85, w: 7.1, h: .5, fontSize: 12, italic: true, color: C.accent5 });

  // Solution: tools, technologies, methodology, drawn as the system's layers with the tools as chips
  s = content("Solution: tools, technologies and methodology", 2);
  {
    const L = .6, W = 7.95, LAB = 1.5;
    // chip row inside a band; dashed chips are the closed blocks
    const chips = (items, x0, y, maxX, maxY) => {
      let x = x0, row = 0;
      items.forEach(([t, closed]) => {
        const w = t.length * .073 + .32;
        if (x + w > maxX) { x = x0; row++; }
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: y + row * .36, w, h: .3, rectRadius: .06, fill: { color: H.dk1 },
          line: { color: closed ? H.accent1 : "2A343A", width: .75, dashType: closed ? "dash" : "solid" }, objectName: "chip " + t });
        txt(s, t, { x, y: y + row * .36, w, h: .3, fontSize: 9.5, align: "center", valign: "middle", color: closed ? C.accent1 : C.background2 });
        x += w + .08;
      });
      if (maxY && y + row * .36 + .3 > maxY) console.warn("slide 5: chips overflow their layer:", items.map((c) => c[0]).join(", "));
    };
    const band = (y, h, name, sub, color, items, x = L, w = W) => {
      card(s, x, y, w, h, C.accent6, "layer " + name, color);
      s.addShape(pres.shapes.RECTANGLE, { x: x + .02, y: y + .12, w: .07, h: h - .24, fill: { color }, line: { color }, objectName: "layer bar " + name });
      txt(s, name, { x: x + .2, y: y + .1, w: LAB, h: .32, fontSize: 13, bold: true, color: C.background1 });
      if (sub) txt(s, sub, { x: x + .2, y: y + .4, w: LAB, h: h - .45, fontSize: 9, color: C.accent5 });
      chips(items, x + LAB + .25, y + .14, x + w - .12, y + h - .06);
    };
    const arrow = (y) => s.addShape(pres.shapes.LINE, { x: L + W / 2, y, w: 0, h: .2, line: { color: H.accent5, width: 1.5, endArrowType: "triangle" }, objectName: "flow arrow" });

    band(1.5, .95, "Perception", "video → tracks", H.accent2, [["TrackNetV5 · 2D shuttle"], ["Monocular scene reconstruction", 1], ["Intent detection", 1], ["hit detection"], ["YOLO11-pose / MediaPipe"]]);
    arrow(2.47);
    band(2.7, .8, "Analytics", "tracks → facts", "F2D46B", [["match database"], ["speed · apex · landing"], ["stroke type"], ["rally outcome"]]);
    arrow(3.52);
    band(3.75, 1.25, "Agents", "facts → advice", H.accent1, [["Tactics"], ["Technique"], ["Fitness"], ["Data"], ["Head coach · round table"], ["LLM 4–14B INT4"], ["OpenVINO"], ["verifier"], ["research agent"]], L, 5.45);
    // memory and simulator sit beside the agents: name and role on two short lines
    [[3.75, "Memory", "RAG: player memory · papers", H.accent4], [4.42, "Simulator", "what-if before advice", H.accent3]].forEach(([y, name, what, color]) => {
      const x = L + 5.55, w = 2.4, h = .58;
      card(s, x, y, w, h, C.accent6, "layer " + name, color);
      s.addShape(pres.shapes.RECTANGLE, { x: x + .02, y: y + .1, w: .07, h: h - .2, fill: { color }, line: { color }, objectName: "layer bar " + name });
      txt(s, name, { x: x + .2, y: y + .06, w: 2.1, h: .26, fontSize: 12, bold: true, color: C.background1 });
      txt(s, what, { x: x + .2, y: y + .31, w: 2.1, h: .22, fontSize: 9, color: C.accent5 });
    });
    arrow(5.02);
    band(5.25, .95, "Interface", "advice → player", H.lt2, [["React + Three.js"], ["Telegram bot"], ["Whisper voice (offline)"], ["court calibration"], ["highlight MP4"], ["live brief"], ["CSV / JSON"]]);
    txt(s, "Dashed chips: closed blocks. Everything runs on one local GPU.", { x: L, y: 6.35, w: W, h: .3, fontSize: 9.5, italic: true, color: C.accent5 });
  }
  // methodology: four rules down the right, joined by a line
  tag(s, "Methodology", 8.95, 1.55, C.accent1, 3);
  s.addShape(pres.shapes.LINE, { x: 9.2, y: 2.25, w: 0, h: 3.75, line: { color: H.accent6, width: 2 }, objectName: "method spine" });
  [["Facts before language", "Deterministic code computes every number; the LLM only explains it."],
   ["100% traceable", "A verifier recomputes every figure an agent says and links it to a rally, shot and video time."],
   ["Simulate before advising", "Positioning changes must cut simulated losses first."],
   ["Measure against ground truth", "3D checked against a multi-camera capture; outcomes against labelled rallies."]].forEach(([h, b], k) => {
    const y = 2.0 + k * 1.15;
    s.addShape(pres.shapes.OVAL, { x: 8.95, y, w: .5, h: .5, fill: { color: k === 1 ? H.accent4 : H.accent1 }, line: { color: H.dk1, width: 2 }, objectName: "method " + (k + 1) });
    txt(s, String(k + 1), { x: 8.95, y, w: .5, h: .5, fontSize: 16, bold: true, align: "center", valign: "middle", color: C.text1 });
    txt(s, h, { x: 9.6, y: y - .02, w: 3.1, h: .32, fontSize: 13.5, bold: true, color: C.background1 });
    txt(s, b, { x: 9.6, y: y + .3, w: 3.1, h: .75, fontSize: 10.5 });
  });

  // Architecture animation (section 2)
  s = content("How the system works, end to end", 2);
  fit(s, "clips/architecture.gif", .6, 1.55, 12.1, 5.35, "architecture animation");

  // 6 Replay & speed
  s = content("Every shot measured: 3D flight, speed, apex, contact height", 2);
  fit(s, "clips/replay.gif", .6, 1.6, 8.3, 5.25, "rally replay clip", false);
  { // numbered badges on the clip: 2D track -> 3D court -> speed curve (positions as fractions of the clip)
    const r = sz["clips/replay.gif"]; let iw = 8.3, ih = 8.3 / r; if (ih > 5.25) { ih = 5.25; iw = ih * r; }
    [[.03, .05, "1"], [.53, .05, "2"], [.03, .55, "3"]].forEach(([fx, fy, n]) => {
      s.addShape(pres.shapes.OVAL, { x: .6 + fx * iw, y: 1.6 + fy * ih, w: .42, h: .42, fill: { color: H.accent1 }, line: { color: H.dk1, width: 1.5 }, objectName: "callout " + n });
      txt(s, n, { x: .6 + fx * iw, y: 1.6 + fy * ih, w: .42, h: .42, fontSize: 15, bold: true, align: "center", valign: "middle", color: C.text1 });
    });
  }
  card(s, 9.2, 1.6, 3.5, 5.25, C.accent6, "replay notes");
  tag(s, "2D to 3D in 3 steps", 9.5, 1.9, C.accent1, 3);
  txt(s, [
    { text: "1  2D track. ", options: { bold: true, color: H.lt1 } }, { text: "TrackNetV5 finds the shuttle in every broadcast frame.", options: { breakLine: true } },
    { text: " ", options: { breakLine: true, fontSize: 6 } },
    { text: "2  Camera, 3D and pose. ", options: { bold: true, color: H.lt1 } }, { text: "Monocular scene reconstruction turns the 2D track into the flight in metres; pose gives both skeletons, speed and distance.", options: { breakLine: true } },
    { text: " ", options: { breakLine: true, fontSize: 6 } },
    { text: "3  Speed curve. ", options: { bold: true, color: H.lt1 } }, { text: "Each hit's launch speed, apex and contact height, clickable back to the frame.", options: {} },
  ], { x: 9.5, y: 2.3, w: 2.95, h: 2.9, fontSize: 12.5 });
  txt(s, [{ text: "200 km/h", options: { fontSize: 34, bold: true, color: H.accent3, fontFace: "Bahnschrift", breakLine: true } },
          { text: "far player's smash, measured from the 3D track", options: { fontSize: 12 } }], { x: 9.5, y: 5.3, w: 2.95, h: 1.4 });

  // Round table: every coach agent in one meeting, grounded in the player memory (RAG)
  s = content("Round table: coaches who argue, then agree the week", 2);
  fit(s, "clips/roundtable.gif", .6, 1.6, 8.3, 3.05, "round table clip", false);
  fit(s, "shots/rt_ruling.png", .6, 4.8, 8.3, 2.05, "head coach ruling", false);
  card(s, 9.2, 1.6, 3.5, 5.25, C.accent6, "round table notes");
  txt(s, [
    { text: "Written live by the agents", options: { bold: true, color: H.accent1, breakLine: true } },
    { text: "Each coach speaks on the local model from its own facts. Ren checks every request against memory (\u201cright knee sore\u201d) and challenges Lin's drill; Lin answers; the head coach rules: health first, then points at stake.", options: { breakLine: true } },
    { text: " ", options: { breakLine: true, fontSize: 6 } },
    { text: "No invented numbers", options: { bold: true, color: H.accent4, breakLine: true } },
    { text: "Every turn passes the verifier (8 of 8 here), or falls back to the measured fact; evidence chips open the exact rally and shot.", options: { breakLine: true } },
    { text: " ", options: { breakLine: true, fontSize: 6 } },
    { text: "Output", options: { bold: true, color: H.lt1, breakLine: true } },
    { text: "Four measurable goals and a 7-day schedule, written back to memory and sent to each player on Telegram.", options: {} },
  ], { x: 9.45, y: 1.85, w: 3.05, h: 4.85, fontSize: 12.5 });

  // two coach agents per slide: each with its recorded session and three points
  const coachPair = (title, pair) => {
    const sl = content(title, 2);
    pair.forEach(([clip, who, color, lines, call], k) => {
      const x = .6 + k * 6.15;
      fit(sl, clip, x, 1.5, 5.95, 3.35, who + " clip", false);
      if (call) { // the one thing to read off the screenshot, as a label over it
        const r = sz[clip]; let iw = 5.95, ih = 5.95 / r; if (ih > 3.35) { ih = 3.35; iw = ih * r; }
        const [fx, fy, t, c] = call, cx = x + fx * iw, cy = 1.5 + fy * ih;
        sl.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx, y: cy, w: 3.25, h: .4, rectRadius: .08, fill: { color: H.dk1 }, line: { color: c, width: 2 },
          shadow: { type: "outer", color: "000000", opacity: .6, blur: 6, offset: 2, angle: 90 }, objectName: who + " callout" });
        sl.addShape(pres.shapes.OVAL, { x: cx + .14, y: cy + .13, w: .14, h: .14, fill: { color: c }, line: { color: c }, objectName: who + " callout dot" });
        txt(sl, t, { x: cx + .36, y: cy, w: 2.85, h: .4, fontSize: 10.5, bold: true, valign: "middle", color: C.background1 });
      }
      tag(sl, who, x, 5.0, color, 5.9);
      txt(sl, lines.flatMap(([h, b], n) => [
        { text: h + ". ", options: { bold: true, color: H.lt1 } },
        { text: b, options: { breakLine: n < lines.length - 1 } },
      ]), { x, y: 5.35, w: 5.9, h: 1.55, fontSize: 11.5, paraSpaceAfter: 3 });
    });
  };
  coachPair("Tactics and technique coaches: the zones and the flights", [
    ["clips/coach_tactics.gif", "Coach Lin · tactics", H.accent1, [
      ["Reads every point", "101 points: 9 winners hit vs 24 conceded; the match was won on 41 opponent errors."],
      ["Flashes the leak", "Rear forehand: 7 of 24 points lost, blinking on the defence map."],
      ["Game plan", "Recover toward the forehand after clears; lift deep to the backhand corner."]], [.31, .76, "Rear forehand: 29% of points lost (7/24)", "FF6B5E"]],
    ["clips/coach_technique.gif", "Coach Kai · technique", H.accent2, [
      ["Every flight in 3D", "Launch speed, apex, contact height, net clearance and depth per shot."],
      ["Shot quality grades", "A deep 141 km/h clear earns an A; a net shot 40 cm over the tape a B."],
      ["What to fix", "The weakest stroke goes first on next session's list."]], [.44, .03, "Every shot graded A / B / C from its 3D flight", H.accent2]],
  ]);
  coachPair("Fitness and data coaches: the body and the habits", [
    ["clips/coach_fitness.gif", "Coach Ren · fitness", H.accent3, [
      ["Muscles that flash", "Quadriceps, calves, forearm and glutes pulse on a 402-muscle 3D model."],
      ["Why each one", "Tied to findings: 60% of smashes into your half go to the mid forehand."],
      ["Adapts to memory", "“Right knee sore”: jump drills become tempo split squats and isometric holds."]], [.33, .04, "Right knee sore: no jump drills this week", "F2D46B"]],
    ["clips/coach_analyst.gif", "Coach Ada · data", H.accent4, [
      ["Player profile", "Shot mix, attack types and winners for either player, from every labelled shot."],
      ["Heat zones that blink", "Favourite landing targets and hitting positions."],
      ["Habits under pressure", "Facing a lift, the opponent smashes 38% of the time."]], [.44, .04, "After a lift, WANG smashes 38% of the time", H.accent4]],
  ]);

  // Self-evolving coaches (the main story), with the 24-hour Telegram coach as an extension on the right
  s = content("Self-evolving coaches: they read, reflect and improve", 2);
  {
    tag(s, "Every night, on the station", .6, 1.5, C.accent1, 7);
    const LOOP = [["Research agent", "Turns the player's weak points into paper searches; keeps a finding only if its numbers are in the abstract.", H.accent2],
      ["Knowledge base", "Findings embedded on the station (RAG); each coach cites the closest studies as [E#].", H.accent4],
      ["Grounded reply", "Match numbers only from facts [F#], study numbers only from [E#]; the verifier checks each one.", H.accent1],
      ["Feedback", "Helpful / not helpful from players, plus every draft the verifier rejected.", H.accent3],
      ["Reflection", "Each coach proposes at most two changes to its own playbook of rules.", "F2D46B"]];
    const CW = 1.38, GAP = .2;
    LOOP.forEach(([h, b, color], k) => {
      const x = .6 + k * (CW + GAP);
      card(s, x, 1.88, CW, 2.02, C.accent6, "loop " + h, color);
      s.addShape(pres.shapes.OVAL, { x: x + .12, y: 2.0, w: .3, h: .3, fill: { color }, line: { color }, objectName: "loop step " + (k + 1) });
      txt(s, String(k + 1), { x: x + .12, y: 2.0, w: .3, h: .3, fontSize: 11, bold: true, align: "center", valign: "middle", color: C.text1 });
      txt(s, h, { x: x + .12, y: 2.36, w: CW - .2, h: .28, fontSize: 11, bold: true, color: C.background1 });
      txt(s, b, { x: x + .12, y: 2.68, w: CW - .22, h: 1.15, fontSize: 8.5 });
      if (k < 4) s.addShape(pres.shapes.LINE, { x: x + CW + .02, y: 2.9, w: GAP - .04, h: 0, line: { color: H.accent5, width: 1.5, endArrowType: "triangle" }, objectName: "loop arrow " + k });
    });
    const c5 = .6 + 4 * (CW + GAP) + CW / 2, c3 = .6 + 2 * (CW + GAP) + CW / 2;
    s.addShape(pres.shapes.LINE, { x: c5, y: 3.9, w: 0, h: .28, line: { color: H.accent1, width: 1.5 }, objectName: "return down" });
    s.addShape(pres.shapes.LINE, { x: c3, y: 4.18, w: c5 - c3, h: 0, line: { color: H.accent1, width: 1.5 }, objectName: "return across" });
    s.addShape(pres.shapes.LINE, { x: c3, y: 3.9, w: 0, h: .28, line: { color: H.accent1, width: 1.5, beginArrowType: "triangle" }, objectName: "return up" });
    txt(s, "playbook v+1, used from the next reply", { x: c3 + .1, y: 4.22, w: c5 - c3 - .2, h: .25, fontSize: 9, align: "center", color: C.accent1 });

    tag(s, "Gates, like a head coach signing off", .6, 4.65, C.accent1, 4.6);
    ["Cites a study, in the coach's own area", "Passes the safety check; locked rules stay", "No regression on its test questions", "Health changes need a human coach; any version rolls back"].forEach((t, i) => {
      const y = 5.0 + i * .42;
      s.addImage({ data: I.check, x: .6, y: y + .06, w: .2, h: .2, objectName: "gate " + (i + 1) });
      txt(s, t, { x: .92, y, w: 4.1, h: .36, fontSize: 10.5, valign: "middle" });
    });
    card(s, 5.15, 4.65, 3.15, 2.25, C.accent6, "first run", "F2D46B");
    txt(s, [{ text: "First reflection run", options: { bold: true, color: "F2D46B", breakLine: true } },
      { text: "A coach proposed lunges for knee pain, citing a real study. The gates held it for a human coach instead of adopting it.", options: {} },
    ], { x: 5.35, y: 4.8, w: 2.8, h: 1.3, fontSize: 10.5 });
    [["67", "findings from 24 papers, 3 nightly runs"], ["0.8 s", "median reply, local 4B"]].forEach(([n, l], k) => {
      txt(s, n, { x: 5.35 + k * 1.45, y: 6.08, w: 1.35, h: .42, fontSize: 20, bold: true, fontFace: "Bahnschrift", color: k ? C.accent4 : C.accent1 });
      txt(s, l, { x: 5.35 + k * 1.45, y: 6.48, w: 1.35, h: .35, fontSize: 8.5 });
    });

    // extension: the same staff on Telegram, a coach in the pocket 24 hours a day (real bot output from the end-to-end test)
    s.addShape(pres.shapes.LINE, { x: 8.55, y: 1.55, w: 0, h: 5.35, line: { color: H.accent6, width: 1 }, objectName: "extension divider" });
    tag(s, "Extension · 24-hour coach", 8.8, 1.5, C.accent1, 4);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.8, y: 1.88, w: 2.55, h: 4.62, rectRadius: .22, fill: { color: "1A2228" }, line: { color: "4A555C", width: 1.5 }, objectName: "phone body" });
    s.addShape(pres.shapes.RECTANGLE, { x: 8.9, y: 2.0, w: 2.35, h: 4.38, fill: { color: "0E1621" }, line: { color: "0E1621" }, objectName: "chat screen" });
    s.addShape(pres.shapes.RECTANGLE, { x: 8.9, y: 2.0, w: 2.35, h: .32, fill: { color: "17212B" }, line: { color: "17212B" }, objectName: "chat header" });
    s.addImage({ data: I.tg, x: 8.97, y: 2.06, w: .2, h: .2, objectName: "telegram icon" });
    txt(s, [{ text: "ShuttleCoach staff ", options: { bold: true, color: H.lt1 } }, { text: "bot", options: { color: H.accent5 } }], { x: 9.22, y: 2.0, w: 2.0, h: .32, fontSize: 8.5, valign: "middle" });
    let by = 2.4;
    const bubble = (t, h, me, opts = {}) => {
      const x = me ? 9.38 : 8.96, w = me ? 1.82 : 2.12;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: by, w, h, rectRadius: .06, fill: { color: me ? "2B5278" : "182533" }, line: { color: me ? "2B5278" : "182533" }, objectName: "chat bubble" });
      txt(s, t, Object.assign({ x: x + .06, y: by + .02, w: w - .12, h: h - .04, fontSize: 7, color: C.background1, valign: "middle" }, opts));
      by += h + .05;
    };
    bubble("I bought chicken breast and broccoli today", .3, true);
    bubble("Added to your kitchen: chicken breast, broccoli. …", .3, false);
    bubble("I have club training on Wednesday from 19:00 to 21:00", .3, true);
    bubble("In your calendar: Wed 2026-10-28 19:00-21:00 club training (training). I'll message you an hour before, with what to eat.", .43, false);
    bubble("/meal", .22, true);
    bubble([{ text: "Coach Mei: ", options: { bold: true, color: "F2D46B" } }, { text: "Eat a meal of rice (1 cup) and stir-fried broccoli with tofu (1 fist) about 2 hours before your next session. …" }], .56, false);
    bubble("I want to play doubles with Amy and Ben on Saturday evening", .3, true);
    bubble("Booked: Wanhua Sports Center · Sat 10-31 18:00-19:00 · court 3, doubles with Amy and Ben (ref TS-MVQ7EI). It's in your calendar.", .43, false);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.96, y: 6.08, w: 2.22, h: .24, rectRadius: .1, fill: { color: "17212B" }, line: { color: "17212B" }, objectName: "message box" });
    txt(s, "Message", { x: 9.08, y: 6.08, w: 2.0, h: .24, fontSize: 7, valign: "middle", color: C.accent5 });
    txt(s, "Bot output from its end-to-end test", { x: 8.8, y: 6.55, w: 2.55, h: .25, fontSize: 8.5, align: "center", color: C.accent5 });
    [["Food at home", "meals timed to training"], ["Schedule & log", "reminder 1 h before; evening check-in"], ["Court booking", "a court in the middle; the agent books it on the venue's site after your OK"], ["44 / 44", "end-to-end checks passed"]].forEach(([h, b], i) => {
      const y = 2.0 + i * 1.12;
      txt(s, h, { x: 11.5, y, w: 1.25, h: .3, fontSize: i === 3 ? 16 : 11, bold: true, fontFace: i === 3 ? "Bahnschrift" : undefined, color: i === 3 ? C.accent4 : C.accent1 });
      txt(s, b, { x: 11.5, y: y + (i === 3 ? .36 : .3), w: 1.22, h: .7, fontSize: 9 });
    });
  }
  s.addNotes("Real coaches keep reading and learn from their players; so do these. Each night a research agent reads new papers into a local knowledge base, and each coach reflects on player feedback, rejected drafts and new findings to change its own playbook, behind gates a head coach would apply: a cited study, a safety check, no regression, and a human sign-off for anything about health. The same staff extends to Telegram as a 24-hour coach: food at home, schedule and training log, with reminders before each session and an evening check-in. Only text passes through Telegram.");

  // LLM agents that act: the loop every agent runs, a real trace from the station, and the agents themselves
  s = content("LLM agents that act: read, plan, use tools, check, ask", 2);
  {
    // the booking agent, animated from a real run on the station: large, on the left
    fit(s, "clips/agent_arch.gif", .6, 1.42, 8.5, 4.78, "booking agent architecture animation", false);
    // the loop every agent runs, as a compact list on the right
    tag(s, "Every agent runs this loop", 9.35, 1.5, C.accent1, 3.4);
    const LOOP = [["Read", "the local LLM turns a message into a structured request", H.accent1],
      ["Plan", "picks the tools and fills their arguments", H.accent1],
      ["Act", "map, calendars, memory, and its own browser on the venue's booking site", H.accent2],
      ["Check", "verifier on every number; safety gates on advice", H.accent4],
      ["Ask", "anything binding waits for a person's yes", "F2D46B"],
      ["Learn", "feedback and nightly reflection", H.accent3]];
    LOOP.forEach(([h, b, color], i) => {
      const y = 1.88 + i * .65;
      s.addShape(pres.shapes.OVAL, { x: 9.35, y, w: .36, h: .36, fill: { color }, line: { color }, objectName: "agent step " + (i + 1) });
      txt(s, String(i + 1), { x: 9.35, y, w: .36, h: .36, fontSize: 12, bold: true, align: "center", valign: "middle", color: C.text1 });
      txt(s, h, { x: 9.85, y: y - .03, w: 2.8, h: .26, fontSize: 13, bold: true, color: C.background1 });
      txt(s, b, { x: 9.85, y: y + .22, w: 2.85, h: .42, fontSize: 9.5 });
    });
    txt(s, "From a real run on the station. The agent then books on the venue's website in its own browser and stops before the final confirm.",
      { x: 9.35, y: 5.8, w: 3.35, h: .36, fontSize: 8.5, italic: true, color: C.accent5 });
    // the agents
    [["Coach agents × 6", "answer, advise, cite their evidence", H.accent1], ["Booking agent", "finds the fair court, books it on the venue's site", H.accent2], ["Research agent", "searches and reads papers nightly", H.accent4],
     ["Reflection agent", "proposes playbook changes behind gates", H.accent3], ["Reminder agent", "before and after every session", "F2D46B"]].forEach(([h, b, color], i) => {
      const x = .6 + i * 2.44;
      card(s, x, 6.25, 2.32, .66, C.accent6, "agent " + h, color);
      txt(s, h, { x: x + .14, y: 6.29, w: 2.1, h: .28, fontSize: 11.5, bold: true, color: C.background1 });
      txt(s, b, { x: x + .14, y: 6.56, w: 2.1, h: .3, fontSize: 9 });
    });
  }
  s.addNotes("ShuttleCoach is built from LLM agents that act, not a chatbot. Each agent runs the same loop on the local model: read the request, plan the tool calls, act with tools such as calendars, the map and the sports centres, the knowledge base and memory, check the result with the verifier and safety gates, ask a person before anything binding, and learn from feedback overnight. The animation follows a real booking run logged on the station: each player's calendar and area, 18 sports centres, the fairest free court, and the player's yes.");

  // Auto highlights: picked, filmed with camera moves, captioned and shared, all on the device
  s = content("Auto highlights: picked, filmed and shared on the device", 2);
  // phone frame: the reel as it would look posted to Reels / TikTok / Shorts
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: .48, y: 1.36, w: 2.84, h: 4.9, rectRadius: .28, fill: { color: "1A2228" }, line: { color: "4A555C", width: 2 }, objectName: "phone body" });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 1.55, y: 1.41, w: .7, h: .08, rectRadius: .04, fill: { color: "04070A" }, line: { color: "04070A" }, objectName: "phone speaker" });
  fit(s, "clips/highlight.gif", .6, 1.55, 2.6, 4.6, "highlight reel clip", false);
  txt(s, "9:16, ready for Reels · TikTok · Shorts", { x: .48, y: 6.32, w: 2.84, h: .3, fontSize: 10, align: "center", color: C.accent5 });
  [["shots/hl_follow.png", "1  Follow-cam", "tracks the shuttle between hitter and receiver"],
   ["shots/hl_replay.png", "2  Slow-mo push-in", "speed ramps down, camera closes on the hitter, holds on contact"],
   ["shots/hl_freeze.png", "3  Winner freeze", "stamp, score and the winning shot"]].forEach(([f, h, b], k) => {
    const x = 3.45 + k * 1.82;
    fit(s, f, x, 1.5, 1.62, 2.88, "camera step " + (k + 1), false);
    txt(s, h, { x, y: 4.45, w: 1.75, h: .3, fontSize: 12, bold: true, color: C.accent1 });
    txt(s, b, { x, y: 4.75, w: 1.72, h: .7, fontSize: 10 });
  });
  fit(s, "shots/hl_done.png", 3.45, 5.5, 5.3, 1.45, "share panel", false);
  card(s, 9.05, 1.5, 3.65, 5.45, C.accent6, "highlight notes", H.accent1);
  txt(s, [
    { text: "Picked automatically", options: { bold: true, color: H.lt1, breakLine: true } },
    { text: "Outright winners, rally length, smash finishes and pressure points (18+) rank every rally; untick one and the next best fills in.", options: { breakLine: true } },
    { text: " ", options: { breakLine: true, fontSize: 6 } },
    { text: "Ready to post", options: { bold: true, color: H.lt1, breakLine: true } },
    { text: "MP4 in 9:16 (Reels, TikTok, Shorts) or 16:9; one-tap Share, Download, and a written caption with hashtags.", options: { breakLine: true } },
    { text: " ", options: { breakLine: true, fontSize: 6 } },
    { text: "Why it sells", options: { bold: true, color: H.accent4, breakLine: true } },
    { text: "Players post their best rallies with the club's name on them: free marketing for the venue, and a reason to keep the subscription.", options: {} },
  ], { x: 9.3, y: 1.75, w: 3.2, h: 5.0, fontSize: 11.5 });

  // Live and hands-free: a brief in every break, answers by voice
  s = content("Live and hands-free: a brief in every break, answers by voice", 2);
  fit(s, "shots/live_brief.png", .6, 1.5, 7.4, 4.17, "live between-point brief", false);
  fit(s, "shots/voice.png", 8.3, 1.5, 4.4, 3.3, "voice coach panel", false);
  card(s, 8.3, 4.88, 4.4, .78, "0D2A1D", "privacy badge", H.accent4);
  s.addImage({ data: I.shieldOk, x: 8.45, y: 5.0, w: .5, h: .5, objectName: "on-device shield" });
  txt(s, [{ text: "Speech stays on this device. ", options: { bold: true, color: H.accent4 } },
          { text: "Whisper runs locally in the browser: no audio and no court conversation is recorded or sent anywhere.", options: {} }],
      { x: 9.1, y: 4.93, w: 3.5, h: .7, fontSize: 10, valign: "middle" });
  [["Between points (~20 s)", "Last point, next serve, the opponent's hot zone and an error warning; longer briefs at 11 points and between games. Computed in under 1 ms."],
   ["Hands-free voice", "Tap Ask and speak: “What should I do next point?”. Whisper tiny runs in the browser, so no audio leaves the court."],
   ["On the B70", "Pose and tracking live from the court camera; a 4B model turns each brief into one spoken sentence in under a second; Whisper on OpenVINO."]].forEach(([h, b], i) => {
    const x = .6 + i * 4.1;
    txt(s, h, { x, y: 5.8, w: 3.9, h: .32, fontSize: 13.5, bold: true, color: C.accent1 });
    txt(s, b, { x, y: 6.12, w: 3.9, h: .8, fontSize: 10.5 });
  });

  // Analyst toolkit: calibration, injury watch, position maps (what traditional tactical software offers)
  s = content("Analyst toolkit: court calibration, injury watch, position maps", 2);
  fit(s, "shots/calib.png", .6, 1.5, 5.6, 3.75, "court calibration", false);
  fit(s, "shots/risk_feed.png", 6.4, 1.5, 3.4, 3.75, "load and injury watch", false);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 6.25, y: 4.42, w: 3.7, h: .5, rectRadius: .08, fill: { color: H.dk1 }, line: { color: "F2D46B", width: 2 },
    shadow: { type: "outer", color: "000000", opacity: .6, blur: 6, offset: 2, angle: 90 }, objectName: "knee badge" });
  s.addShape(pres.shapes.OVAL, { x: 6.4, y: 4.6, w: .14, h: .14, fill: { color: "F2D46B" }, line: { color: "F2D46B" }, objectName: "knee badge dot" });
  txt(s, "Deep knee bend 108° on the sore right knee (over 90°)", { x: 6.62, y: 4.42, w: 3.3, h: .5, fontSize: 10.5, bold: true, valign: "middle", color: C.background1 });
  fit(s, "shots/positions_court.png", 10.0, 1.5, 2.7, 3.75, "position heat map", false);
  [["Court calibration", "Corners found automatically from the court lines, draggable to correct; the court model is drawn back and a top-down view checks the fit."],
   ["Load and injury watch", "Lunges and sharp cuts per rally from positions; pose skeletons give knee bend at every hit: 5 of 6 deep bends on the sore right knee."],
   ["Maps, scouting, export", "Where each player hits from (heat map or scatter); one-page scouting PDF; every shot as CSV or JSON."]].forEach(([h, b], i) => {
    const x = .6 + i * 4.1;
    txt(s, h, { x, y: 5.4, w: 3.9, h: .35, fontSize: 14, bold: true, color: C.accent1 });
    txt(s, b, { x, y: 5.75, w: 3.9, h: 1.1, fontSize: 11 });
  });

  pres.addSection({ title: SECTIONS[2] });
  // 11 Deployment on the ASUS platform (animated)
  s = content("Deployment on ASUS UGen Intel Arc Pro B70", 3);
  fit(s, "clips/hardware.gif", .6, 1.55, 12.1, 5.35, "hardware deployment animation");

  // 12 Memory
  // One GPU, scheduled by phase: each workload holds the card only when its phase needs it
  s = content("One GPU, scheduled by phase: what runs when", 3);
  {
    const PH = [["Rally (live)", "33 ms a frame"], ["Between points", "brief < 3 s"], ["After the match", "batch, minutes"], ["Coaching", "answers < 10 s"]];
    const ROWS = [["2D tracking + pose", [1, .15, .7, 0], H.accent2], ["3D reconstruction", [1, .15, .7, 0], H.accent2], ["Intent detection", [1, 0, 0, 0], H.accent2],
      ["4B assistant \u00b7 voice", [.1, 1, 0, .3], H.accent4], ["Coach agents \u00b7 round table", [0, 0, 0, 1], H.accent1], ["Booking agent \u00b7 browser", [0, 0, .25, .5], H.accent3],
      ["Research \u00b7 reflection (night)", [0, 0, .6, 0], "F2D46B"], ["Simulator", [0, 0, .3, .7], H.lt2]];
    const x0 = .6, lab = 1.95, cw = 1.3, y0 = 1.5;
    tag(s, "GPU time by phase · bar = share of the card", x0, y0, C.accent1, 7);
    PH.forEach(([h, d], k) => {
      const x = x0 + lab + k * cw;
      txt(s, h, { x, y: y0 + .32, w: cw - .06, h: .26, fontSize: 10.5, bold: true, align: "center", color: C.background1 });
      txt(s, d, { x, y: y0 + .56, w: cw - .06, h: .22, fontSize: 8.5, align: "center", color: C.accent5 });
    });
    ROWS.forEach(([name, load, color], r) => {
      const y = y0 + .88 + r * .4;
      txt(s, name, { x: x0, y, w: lab - .1, h: .3, fontSize: 10, valign: "middle", color: C.background2 });
      s.addShape(pres.shapes.LINE, { x: x0, y: y + .36, w: lab + 4 * cw, h: 0, line: { color: H.accent6, width: .5 }, objectName: "row rule " + r });
      load.forEach((v, k) => {
        if (!v) return;
        const x = x0 + lab + k * cw + .05, w = (cw - .16) * Math.max(.25, v);
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: y + .05, w, h: .22, rectRadius: .04, fill: { color, transparency: Math.round(70 - 60 * v) }, line: { color, width: .5 }, objectName: `${name} ${k}` });
      });
    });

    // peak memory per phase: models are loaded when their phase starts
    const lbl = PH.map((p) => p[0]);
    s.addChart(pres.charts.BAR, [
      { name: "Tracking, pose, 3D, intent", labels: lbl, values: [6, 6, 6, 0] },
      { name: "4B assistant + voice", labels: lbl, values: [3, 3, 0, 3] },
      { name: "Coach agents, 14B planned + KV cache", labels: lbl, values: [0, 0, 0, 16] },
      { name: "Browser, embeddings, research", labels: lbl, values: [0, 0, 3, 2] },
      { name: "Simulator", labels: lbl, values: [0, 0, 0, 4] },
      { name: "Player memory", labels: lbl, values: [1, 1, 1, 1] },
    ], {
      x: 8.0, y: 1.45, w: 4.7, h: 4.0, barDir: "col", barGrouping: "stacked", barGapWidthPct: 55,
      chartColors: [H.accent2, H.accent4, H.accent1, H.accent3, "F2D46B", H.accent5],
      showValue: false, catAxisLabelColor: H.lt2, catAxisLabelFontSize: 9, catAxisLabelFontFace: "+mn-lt",
      valAxisLabelColor: H.accent5, valAxisLabelFontSize: 9, valAxisMaxVal: 32, valAxisMinVal: 0, valAxisMajorUnit: 8, valAxisLabelFormatCode: '0" GB"',
      valGridLine: { color: H.accent6, size: .5 }, catGridLine: { style: "none" },
      showLegend: true, legendPos: "b", legendColor: H.lt2, legendFontSize: 8.5, legendFontFace: "+mn-lt",
      showTitle: true, title: "Peak GPU memory by phase (GB, planned; card = 32)", titleFontSize: 11, titleColor: H.lt2, titleFontFace: "+mn-lt", objectName: "memory by phase",
    });
  }
  card(s, .6, 5.62, 5.9, 1.25, C.accent6, "scheduler", H.accent1);
  txt(s, [{ text: "Dynamic scheduler", options: { bold: true, color: H.accent1, breakLine: true } },
          { text: "A priority queue on one card: live perception keeps its 33 ms deadline, the between-point brief preempts batch work, post-match jobs and the nightly research and reflection fill idle time. ", options: {} },
          { text: "Today, on our test GPU, one 4B model serves every agent: coach chat, the round table, booking with its browser, research and reflection.", options: { bold: true, color: H.lt1 } }],
      { x: .8, y: 5.7, w: 5.55, h: 1.12, fontSize: 10.5 });
  card(s, 6.7, 5.62, 6.0, 1.25, "0D2A1D", "4B model", H.accent4);
  txt(s, [{ text: "Measured today on our test GPU (Qwen3-4B, 4-bit)", options: { bold: true, color: H.accent4, breakLine: true } },
          { text: "Coach reply 0.8 s median · round-table meeting 4.0 s for 9–10 verified turns · “I want to play” to a court offer 3.3 s, fitness coach included · booking agent in its browser: 28 steps, 9.4 s · tests 23/23 booking, 21/21 end to end. On the B70: INT4 ≈ 2.5 GB, decode ceiling about 240 tokens/s.", options: {} }],
      { x: 6.9, y: 5.7, w: 5.65, h: 1.12, fontSize: 10.5 });

  pres.addSection({ title: SECTIONS[3] });
  // Expected benefits and outcomes
  s = content("Expected benefits and outcomes", 4);
  [["Players", ["Where points are won and lost, by zone and stroke", "A weekly plan tied to their own footage", "Measurable progress per session"]],
   ["Coaches", ["Hours of video review cut to minutes", "Advice backed by cited shots", "Test tactics in simulation first"]],
   ["Clubs and schools", ["Analytics on every court, minors' video stays local", "One station, no per-upload fees", "A differentiated coaching service"]],
   ["Other sports", ["Same pipeline: ball tracking, court calibration, 3D reconstruction, agents", "Tennis, table tennis, pickleball, volleyball", "New sport = new tracker + court model"]]].forEach(([h, items], i) => {
    const x = .6 + i * 3.07;
    card(s, x, 1.7, 2.9, 2.85, i === 3 ? C.accent6 : C.text2, "benefit " + i, i === 3 ? H.accent1 : H.accent6);
    txt(s, h, { x: x + .25, y: 1.92, w: 2.45, h: .45, fontSize: 18, bold: true, color: C.accent1 });
    txt(s, items.map((t, k) => ({ text: t, options: { bullet: true, breakLine: k < items.length - 1 } })), { x: x + .25, y: 2.45, w: 2.5, h: 2.0, fontSize: 12.5, paraSpaceAfter: 4 });
  });
  tag(s, "Next deliverables", .6, 4.75);
  [["Working system", "Upload a match video on the B70 and get the full report, end to end, offline"],
   ["Open repository", "Code, system architecture diagram, README, model information and performance data"],
   ["Performance report", "Speed, accuracy and latency measured on the B70; 3D error against reference data"],
   ["Demo video", "Real operation on the provided environment, 10 minutes, in English"]].forEach(([h, b], i) => {
    const x = .6 + i * 3.07;
    txt(s, h, { x, y: 5.15, w: 2.85, h: .4, fontSize: 15, bold: true, color: C.background1 });
    txt(s, b, { x, y: 5.55, w: 2.85, h: 1.1, fontSize: 12 });
  });

  // Business: who pays, three-year cost of ownership and payback (illustrative assumptions, stated on the slide)
  s = content("Who pays, what it costs, and when it pays back", 4);
  [[I.trophy, "B2B: club and venue", "One Station shared by every member. 60 members on a NT$300/month \u201cPro analysis\u201d add-on bring NT$18k a month against NT$7.5k a month of Station cost: hardware paid back in about 12 months, and a reason to join the club."],
   [I.person, "B2B2C: player subscription", "NT$199/month through the club's Station: highlight reels, round-table plans, season tracking. Revenue split 70% club, 30% ShuttleCoach."],
   [I.school, "Schools and university teams", "Same Station, no minors' video in the cloud; pilot with a university team and a local academy."]].forEach(([ic, h, b], i) => {
    const y = 2.28 + i * 1.5;
    card(s, .6, y, 4.45, 1.4, i === 0 ? C.accent6 : C.text2, "model " + i, i === 0 ? H.accent1 : H.accent6);
    s.addImage({ data: ic, x: .8, y: y + .17, w: .36, h: .36, objectName: "segment icon " + i });
    txt(s, h, { x: 1.3, y: y + .14, w: 3.6, h: .38, fontSize: 15, bold: true, color: i === 0 ? C.accent1 : C.background1 });
    txt(s, b, { x: .8, y: y + .52, w: 4.1, h: .85, fontSize: 10.5 });
  });
  // market size: sourced figures for TAM and SAM, our target for SOM
  [["TAM", "384 M", "people play badminton weekly worldwide (BWF, 2024); sports analytics US$2.3 B in 2025"],
   ["SAM", "\u2248 2 M", "players in Taiwan: 9.4% of residents 13+ (Ministry of Sports, 2025); 113 commercial venues (MOF, May 2024), +16.5% a year"],
   ["SOM", "30 Stations", "year-3 target in Taiwan venues and school teams, about 1,800 subscribing players"]].forEach(([k, n, d], i) => {
    const x = .6 + i * 4.1;
    card(s, x, 1.42, 3.95, .75, C.accent6, "market " + k, i === 2 ? H.accent4 : H.accent6);
    txt(s, k, { x: x + .15, y: 1.47, w: .6, h: .3, fontSize: 10, bold: true, fontFace: MONO, color: i === 2 ? C.accent4 : C.accent1 });
    txt(s, n, { x: x + .15, y: 1.72, w: 1.3, h: .4, fontSize: 17, bold: true, fontFace: "Bahnschrift", color: C.background1 });
    txt(s, d, { x: x + 1.45, y: 1.47, w: 2.42, h: .66, fontSize: 8.5, valign: "middle" });
  });
  // cumulative three-year cost for a club of 20 players, NT$ thousands
  const analyst = [154, 307, 461], cloud = [96, 192, 288], station = [210, 240, 270];
  s.addChart(pres.charts.BAR, [
    { name: "Part-time video analyst", labels: ["Year 1", "Year 2", "Year 3"], values: analyst },
    { name: "Cloud app, per player", labels: ["Year 1", "Year 2", "Year 3"], values: cloud },
    { name: "ShuttleCoach Station", labels: ["Year 1", "Year 2", "Year 3"], values: station },
  ], {
    x: 5.3, y: 2.25, w: 7.4, h: 2.95, barDir: "col", barGrouping: "clustered", barGapWidthPct: 60, chartColors: [H.accent5, H.accent3, H.accent1],
    showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 11, dataLabelColor: H.lt2, dataLabelFontFace: "+mn-lt",
    catAxisLabelColor: H.lt2, catAxisLabelFontSize: 12, catAxisLabelFontFace: "+mn-lt", valAxisHidden: true, valAxisMinVal: 0, valAxisMaxVal: 520,
    valGridLine: { style: "none" }, catGridLine: { style: "none" },
    showLegend: true, legendPos: "b", legendColor: H.lt2, legendFontSize: 12, legendFontFace: "+mn-lt",
    showTitle: true, title: "Cumulative cost for a 20-player club, NT$ thousand (illustrative)", titleFontSize: 12, titleColor: H.lt2, titleFontFace: "+mn-lt", objectName: "tco chart",
  });
  [["1.5 years", "payback against a part-time analyst"], ["2.7 years", "break-even against per-player cloud apps, with the video kept local"], ["~12 months", "club payback with 60 members on the NT$300 add-on"]].forEach(([n, l], i) => {
    const x = 5.3 + i * 2.5;
    txt(s, n, { x, y: 5.3, w: 2.35, h: .55, fontSize: 26, bold: true, color: i === 2 ? C.accent4 : C.accent1, fontFace: "Bahnschrift" });
    txt(s, l, { x, y: 5.85, w: 2.3, h: .65, fontSize: 11.5 });
  });
  txt(s, "Illustrative assumptions: analyst 8 h/week at NT$400/h, 48 weeks; cloud NT$400/player/month; Station NT$180k + NT$30k/year (NT$7.5k/month over 3 years). Replace with quotes.",
    { x: 5.3, y: 6.5, w: 7.4, h: .35, fontSize: 9.5, italic: true, color: C.accent5 });

  pres.addSection({ title: SECTIONS[4] });
  // References and source code (part of the main body, as the brief requires)
  s = content("References and source code", 5);
  card(s, .6, 1.6, 12.1, .8, C.accent6, "github card", H.accent1);
  tag(s, "Source code", .9, 1.87, C.accent1, 2);
  txt(s, [{ text: GH_URL, options: { hyperlink: { url: GH_URL }, color: H.accent1 } }], { x: 2.7, y: 1.8, w: 9.8, h: .45, fontSize: 18, bold: true, fontFace: MONO });
  txt(s, [
    { text: "TrackNetV3: shuttlecock tracking with augmentations and trajectory rectification. ACM MMAsia 2023. Code: MIT licence.", options: { bullet: true, breakLine: true } },
    { text: "TrackNetV5: robust shuttlecock tracking via motion prompts and spatiotemporal attentive fusion (backbone used frozen). Code: ", options: { bullet: true } },
    { text: "github.com/gino6178/TrackNetV5", options: { hyperlink: { url: "https://github.com/gino6178/TrackNetV5" }, color: H.accent1, breakLine: true } },
    { text: "ShuttleSet: a human-annotated stroke-level singles dataset for badminton tactical analysis. KDD 2023.", options: { bullet: true, breakLine: true } },
    { text: "Monocular 3D reconstruction and intent detection: shown as closed blocks.", options: { bullet: true, breakLine: true } },
    { text: "3D anatomy: BodyParts3D 4.0, © The Database Center for Life Science, CC BY 4.0; adapted via Human Atlas (MIT).", options: { bullet: true, breakLine: true } },
    { text: "Sample match: Thailand Masters 2025 R32 broadcast footage and hand annotations, used for a research prototype only.", options: { bullet: true, breakLine: true } },
    { text: "Libraries: Whisper tiny.en (MIT) via Transformers.js (Apache-2.0); MediaPipe Pose Landmarker (Apache-2.0). Feature ideas from Good-Badminton (yo-WASSUP): annotated video, court calibration, position maps.", options: { bullet: true, breakLine: true } },
    { text: "Agents: Qwen3-4B (Apache-2.0) served locally; OpenVINO GenAI path for the B70; Qwen3-Embedding for the knowledge base. Papers found through the OpenAlex, arXiv and Semantic Scholar APIs; messaging via the Telegram Bot API.", options: { bullet: true, breakLine: true } },
    { text: "Prototype status: coach agents answer on a local 4B model from computed match facts, every figure verified; tested on an RTX 3090 server, moving to the B70 next. Coach portraits are AI-generated, fictional people.", options: { bullet: true } },
  ], { x: .6, y: 2.5, w: 12.1, h: 4.0, fontSize: 12, paraSpaceAfter: 3 });
  txt(s, "Team rm-rf-2", { x: .6, y: 6.55, w: 12.1, h: .35, fontSize: 13, color: C.accent5 });

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})();

