// Storyboard for the demo video: one row per shot with its timecode, a frame from the finished video, what is on
// screen, the narration and the on-screen text. Reads the cut pieces (build/p###.mp4) and subtitles (build/subs.ass)
// that assemble.mjs left behind, and writes ShuttleCoach_storyboard.pdf (and .html).
//   node storyboard.mjs
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import puppeteer from "puppeteer-core";

const B = path.resolve("build"), T = path.join(B, "thumbs");
fs.mkdirSync(T, { recursive: true });
const dur = (f) => +execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString();
const VIDEO = path.resolve("ShuttleCoach_demo.mp4");

// [scene, title on screen, what happens (中文), note]
const SHOTS = [
  [1, "On-device architecture", "架構動畫：Match video → Perception（2D/3D）→ Analytics → 四位教練 + 總教練圓桌（讀 Player memory / RAG）→ Sparring simulator → Coach sessions；右上 NO CLOUD，外框 Intel Arc Pro B70 · 32 GB。", "開場：架構一覽，旁白從第一秒開始"],
  [2, "SHUTTLE COACH", "3D 重建球場與飛行軌跡緩慢重播，左側依序浮現：SHUTTLE COACH → One camera in. A full coaching staff out. 100% offline. → BUILT FOR INTEL ARC PRO B70 · 32 GB。", "標題"],
  [3, "Perception & 3D replay", "Rally 3D 頁：轉播畫面與 3D 球場同步，拖曳轉視角。", "四大節點之一；唸到「Four specialist」時切走"],
  [3, "Round table", "圓桌會議進行中，鏡頭緩慢推近發言串。", "節點二"],
  [3, "Voice coach · Auto highlights", "左右分割：左邊打字問「Where is my opponent beating me?」得到答案並跳到 Lin 的熱區；右邊是自動精華清單與 9:16 預覽。", "節點三"],
  [3, "24-hour coach on Telegram", "立體手機與 Telegram 對話，右側功能卡滑入。", "節點四"],
  [3, "", "九宮格由中央放大狀態拉遠，九個功能同時出現。", "總覽收束，旁白留白", ""],
  [4, "", "拖入 sample_rally.mp4 → 顯示本機檔案資訊 → 按 Start on-device analysis → 處理步驟依序打勾。", "Zero bytes leave your machine"],
  [4, "", "Rally 3D：播放、轉視角；上方 Demo mode 提示。", "旁白：This demo opens a sample match the station has already analysed"],
  [5, "Rear forehand: 7 of 24 winners conceded", "Coach Lin：鏡頭推近防守失分熱區，HUD 卡引用頁面上的真實數字。", "數字取自比賽資料"],
  [5, "Every shot graded A / B / C from its 3D flight", "Coach Kai：推近逐拍評分列。", ""],
  [5, "Memory: right knee sore → no jump drills", "Coach Ren：推近 3D 人體肌肉，記憶裡的右膝痠。", "與圓桌衝突呼應"],
  [5, "After a lift or clear, WANG smashes 38%", "Coach Ada：推近「Reply to a lift or clear」統計。", "數字取自比賽資料"],
  [6, "Conflict → Head coach ruling", "圓桌（由本地 LLM 即時產生，每一句都過驗證器）：鏡頭推近紅色衝突卡（Conflict: Ren challenges Lin — right knee sore vs smash-defence blocks）→ 拉遠、跳到計畫 → 推近裁決（Head coach ruling: health first, then the points at stake）。", "全片第一個亮點"],
  [6, "Local model · 0.89 s · ✓ every figure verified", "Coach Kai 聊天：輸入問題，本地模型回答，鏡頭推近回覆，HUD 卡顯示實際測得的 0.89 秒與驗證結果。", "時間是錄影當下的真實數字（RTX 3090 測試機）"],
  [7, "", "Lab：狀態列 → 知識庫搜尋「knee pain after lunges」列出論文結論。", "Every night a research agent…"],
  [7, "Safety gate → Declined by the human coach", "Playbooks → 推近待審提案「膝痛時做前跨步」，HUD 卡：Safety gate: health changes need a human coach → 按 Decline → HUD 卡：Declined by the human coach · rule not adopted。", "第二個亮點：Human-in-the-loop；真的在 station 上拒絕"],
  [8, "", "立體手機的 Telegram 對話：買了雞胸與花椰菜 → /meal 由 Coach Mei 配餐 → 晚上主動詢問並記錄 45 分鐘訓練 →「I want to play doubles with Amy and Ben on Saturday evening」。", "訊息取自端到端測試的真實輸出"],
  [8, "Fairest: Zhongzheng · longest trip 7.7 km", "Find a court 地圖（OpenStreetMap）：依序出現三人的大略位置（Hyeok 內湖、Amy 大安、Ben 板橋）→「the middle」→ 18 個運動中心（有空場為白點）→ 前三名 → 中正運動中心勝出，三條虛線標出每人距離 7.7 / 2.3 / 6.8 km。", "代理開地圖、考量每個人的距離、找中間有空的場館；場地時段為範例資料"],
  [8, "", "回到手機：Telegram 地圖釘（Zhongzheng Sports Center）→ 球場暫留、邀請 Amy 與 Ben（各附離自己的距離）→ 兩人都 I'm in → 問主揪確認（NT$1000，每人 NT$334）→ Book it → Booked。", "下單前一定要主揪按確認"],
  [9, "Read → Plan → Act → Check → Ask → Done", "代理架構動畫（取自 station 上的真實執行）：Telegram 訊息 → 本地 LLM 讀成結構化請求 → Booking agent 呼叫工具：三人行事曆（週六晚上都有空 ✓）→ 地圖：三人大略位置、中間點、18 個運動中心（灰色為沒空場）→ 公平性排序（最遠的人最短：中正 7.7 km；中山較近但已滿）→ 問主揪、朋友回覆 I'm in → Booked。", "強調大語言模型代理：看每個人的行事曆與地點，找到中間有空的場館"],
  [9, "Booking agent · its own browser", "代理自己用無頭瀏覽器操作場館的訂場網站（本機模擬站）：開網站 → 登入（密碼由程式填入，模型看不到）→ 中正運動中心 · 10/31 週六 18:00 有空的場 → 填 2 小時、3 人、Hyeok → 確認頁停下等主揪 OK → 主揪說好後按 Confirm booking，讀回訂位編號 TS-MVQ3BQ。", "每張圖都是代理在 station 上自己存的截圖"],
  [9, "", "Agent trace 頁：同一次執行的每一步（LLM、open the map、search venues near the middle、rank by fairness、ask the player…）。", "Every step is logged on the station"],
  [10, "", "結尾卡：SHUTTLECOACH、標語，三個銘牌依序亮起：100% local processing / Multi-agent round table / Built for Intel Arc Pro B70 · 32 GB；上方是隊名與 GitHub 網址。", "隊名 rm-rf-2；QR code 尚未加入"],
];
const SCENE_NAME = { 1: "開場：系統架構", 2: "開場：平台定位", 3: "功能總覽：四大節點", 4: "怎麼運作、隱私", 5: "四位專科教練", 6: "亮點一：圓桌會議", 7: "亮點二：自我進化與安全審查", 8: "延伸：24 小時教練", 9: "大語言模型代理：真實執行紀錄", 10: "結尾" };

const pieces = fs.readdirSync(B).filter((f) => /^q\d{3}\.mp4$/.test(f)).sort();
if (pieces.length !== SHOTS.length) throw new Error(`expected ${SHOTS.length} pieces, found ${pieces.length}`);
// subtitles: start, end, text
const subs = fs.readFileSync(path.join(B, "subs.ass"), "utf8").split("\n").filter((l) => l.startsWith("Dialogue:")).map((l) => {
  const f = l.slice(10).split(","), s = (x) => { const [h, m, sec] = x.split(":"); return +h * 3600 + +m * 60 + +sec; };
  return { a: s(f[1]), b: s(f[2]), text: f.slice(9).join(",") };
});
const tc = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
let t = 0;
const rows = pieces.map((p, i) => {
  const d = dur(path.join(B, p)), a = t, b = t + d; t = b;
  const thumb = path.join(T, `shot${String(i + 1).padStart(2, "0")}.jpg`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", (a + d * .6).toFixed(2), "-i", VIDEO, "-frames:v", "1", "-vf", "scale=480:-2", "-q:v", "3", thumb]);
  // narration lines that start in this shot (the first shot of a scene also takes a line starting just before it)
  const said = subs.filter((x) => x.a >= a - 0.05 && x.a < b - 0.05).map((x) => x.text).join(" ");
  // the montage cuts inside sentences, so its rows carry the exact words spoken over each shot
  return { n: i + 1, a, b, d, thumb, said: SHOTS[i][4] ?? said, scene: SHOTS[i][0], title: SHOTS[i][1], what: SHOTS[i][2], note: SHOTS[i][3] };
});

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const img = (f) => "data:image/jpeg;base64," + fs.readFileSync(f).toString("base64");
let html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>ShuttleCoach 示範影片分鏡稿</title><style>
@page { size: A4 landscape; margin: 12mm 12mm 14mm; }
* { box-sizing: border-box; }
body { font: 10.5pt/1.45 "Microsoft JhengHei", "Segoe UI", sans-serif; color: #15191c; margin: 0; }
h1 { font: 700 20pt/1.2 "Segoe UI", "Microsoft JhengHei", sans-serif; margin: 0 0 4px; }
.meta { color: #5b656b; margin: 0 0 12px; }
.scene { break-inside: avoid; margin: 14px 0 4px; font-weight: 700; font-size: 12pt; border-bottom: 2px solid #15191c; padding-bottom: 3px; display: flex; justify-content: space-between; }
.scene span { font-weight: 400; color: #5b656b; font-size: 10pt; }
table { width: 100%; border-collapse: collapse; }
td { vertical-align: top; padding: 7px 8px; border-bottom: 1px solid #d8dde0; }
tr { break-inside: avoid; }
.n { width: 34px; font-weight: 700; font-size: 13pt; color: #8a6d1f; }
.tc { width: 92px; font: 9.5pt Consolas, monospace; color: #3d464b; }
.tc b { display: block; font-size: 8.5pt; color: #7a8489; font-weight: 400; }
.th { width: 236px; } .th img { width: 228px; border-radius: 4px; display: block; }
.what { width: 30%; }
.label { display: inline-block; background: #15191c; color: #f2e6c9; font-size: 8.5pt; padding: 1px 7px; border-radius: 3px; margin-bottom: 4px; }
.vo { font-family: "Segoe UI", sans-serif; color: #1d3b57; }
.note { width: 15%; color: #6b5b2e; font-size: 9.5pt; }
.k { font-size: 8pt; color: #7a8489; text-transform: uppercase; letter-spacing: .5px; display: block; margin-bottom: 2px; }
</style></head><body>
<h1>ShuttleCoach · Stage I 示範影片分鏡稿</h1>
<p class="meta">總長 ${tc(t)}（1920×1080, 30 fps）· ${rows.length} 個鏡頭 · 8 個段落 · 旁白：英文（Kokoro 神經語音 af_heart，本機生成）· 音效：開場殺球破空聲與擊球聲（合成）· 字幕：英文，一次一行，依語音逐句對時 · 檔案：deck/video/ShuttleCoach_demo.mp4</p>`;
let last = 0;
for (const r of rows) {
  if (r.scene !== last) {
    const sc = rows.filter((x) => x.scene === r.scene), a = sc[0].a, b = sc.at(-1).b;
    if (last) html += "</table>";
    html += `<div class="scene">${r.scene} · ${SCENE_NAME[r.scene]}<span>${tc(a)} – ${tc(b)}（${(b - a).toFixed(1)} 秒）</span></div><table>`;
    last = r.scene;
  }
  html += `<tr><td class="n">${r.n}</td><td class="tc">${tc(r.a)}<br>${tc(r.b)}<b>${r.d.toFixed(1)} 秒</b></td><td class="th"><img src="${img(r.thumb)}"></td>
<td class="what"><span class="k">畫面 / 操作</span>${r.title ? `<span class="label">${esc(r.title)}</span><br>` : ""}${esc(r.what)}</td>
<td><span class="k">旁白（英文）</span><span class="vo">${esc(r.said) || "—"}</span></td><td class="note"><span class="k">備註</span>${esc(r.note) || "—"}</td></tr>`;
}
html += "</table></body></html>";
const HTML = path.resolve("ShuttleCoach_storyboard.html");
fs.writeFileSync(HTML, html);
const br = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new" });
const pg = await br.newPage();
await pg.goto("file:///" + HTML.replace(/\\/g, "/"), { waitUntil: "load" });
await pg.pdf({ path: path.resolve("ShuttleCoach_storyboard.pdf"), format: "A4", landscape: true, printBackground: true,
  displayHeaderFooter: true, headerTemplate: "<span></span>", footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#888">ShuttleCoach storyboard · <span class="pageNumber"></span> / <span class="totalPages"></span></div>', margin: { top: "12mm", bottom: "14mm", left: "12mm", right: "12mm" } });
await br.close();
console.log("wrote ShuttleCoach_storyboard.pdf,", rows.length, "shots,", tc(t));
