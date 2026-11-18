// Serves the built web app (web/dist) with byte ranges, so rally videos can seek. No dependencies.
//   node server/static.mjs [dir] [port]      defaults: web/dist, 5190 (listens on 127.0.0.1 only)
// On the B70 cloud instance the page is reached through Jupyter's proxy (/<n>/proxy/5190/), which strips the
// prefix before the request gets here, so files are served from the root.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.argv[2] || "web/dist");
const PORT = +(process.argv[3] || process.env.WEB_PORT || 5190);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".mp4": "video/mp4", ".webm": "video/webm", ".bin": "application/octet-stream", ".onnx": "application/octet-stream",
  ".wasm": "application/wasm", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon", ".txt": "text/plain" };

http.createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.join(ROOT, path.normalize(rel));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end("not found"); }
    const type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
    const cache = rel.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache";
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
    if (m) {
      const start = m[1] ? +m[1] : Math.max(0, st.size - +m[2]), end = m[1] && m[2] ? Math.min(+m[2], st.size - 1) : st.size - 1;
      if (start > end || start >= st.size) { res.writeHead(416, { "content-range": `bytes */${st.size}` }); return res.end(); }
      res.writeHead(206, { "content-type": type, "content-length": end - start + 1, "content-range": `bytes ${start}-${end}/${st.size}`, "accept-ranges": "bytes", "cache-control": cache });
      return req.method === "HEAD" ? res.end() : fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { "content-type": type, "content-length": st.size, "accept-ranges": "bytes", "cache-control": cache });
    req.method === "HEAD" ? res.end() : fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, "127.0.0.1", () => console.log(`web app ${ROOT} on http://127.0.0.1:${PORT}`));
