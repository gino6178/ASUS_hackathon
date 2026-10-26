import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 });
for (const h of ["", "analyze", "coaches", "coach/tactics", "match", "report", "memory", "live", "roundtable", "scout"]) {
  await p.goto("http://127.0.0.1:5190/#/" + h, { waitUntil: "networkidle2" }); await new Promise((r) => setTimeout(r, 2500));
  await p.screenshot({ path: `verify/audit_${h.replace("/", "_") || "home"}.png`, fullPage: true });
}
await b.close();
