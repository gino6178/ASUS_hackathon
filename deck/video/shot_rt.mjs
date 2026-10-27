// A still of the live round table for the deck: waits for the agents' meeting to finish, then shoots the table and the talk.
//   node shot_rt.mjs  -> ../shots/rt_conflict.png
import puppeteer from "puppeteer-core";
import path from "node:path";

const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 2 });
for (let k = 0; k < 4; k++) {
  await page.goto("http://127.0.0.1:5190/#/coaches", { waitUntil: "domcontentloaded" });
  await page.goto("http://127.0.0.1:5190/#/roundtable", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector(".rt-msg.conflict"), { timeout: 120000 }).catch(() => {});
  const who = await page.evaluate(() => document.querySelector(".rt-msg.conflict .rt-tag")?.innerText ?? "");
  console.log("meeting", k, who);
  if (/Lin/.test(who)) break;
}
// let the replay finish on the ruling
await page.waitForFunction(() => /Plan agreed/.test(document.body.innerText), { timeout: 120000 }).catch(() => {});
await new Promise((r) => setTimeout(r, 1500));
const box = await page.evaluate(() => {
  // the talk scrolls in its own box: bring Ren's challenge to the top of it, so the clash, the answer and the ruling show
  const chat = document.querySelector(".rt-chat"), m = document.querySelector(".rt-msg.conflict");
  chat.scrollTop += m.getBoundingClientRect().top - chat.getBoundingClientRect().top - 8;
  const c = chat.getBoundingClientRect();
  return { x: 40, y: c.top + scrollY, w: c.right + 20 - 40, h: c.height, st: chat.scrollTop, sh: chat.scrollHeight, n: chat.querySelectorAll(".rt-msg").length };
});
await new Promise((r) => setTimeout(r, 600));
console.log("scroll now", await page.evaluate(() => document.querySelector(".rt-chat").scrollTop));
await page.screenshot({ path: path.resolve("../shots/rt_conflict.png"), clip: { x: box.x, y: box.y, width: box.w, height: box.h }, captureBeyondViewport: false });
console.log("wrote ../shots/rt_conflict.png", box);
await browser.close();
