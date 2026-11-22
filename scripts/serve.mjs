// Serve dist/ the way GitHub Pages does: under the repository path, with 404.html for misses.
//   node scripts/serve.mjs [port] [basePath]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8" };

export function createServer(basePath = "/startup-college-startups-101/", dir = path.join(ROOT, process.env.SC_OUT || "dist")) {
  const base = basePath.replace(/\/?$/, "/");
  return http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    if (base !== "/" && (url.pathname === "/" || !url.pathname.startsWith(base))) { res.writeHead(302, { location: base }); return res.end(); }
    let file = path.join(dir, decodeURIComponent(url.pathname.slice(base.length)));
    if (!file.startsWith(dir)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      if (!url.pathname.endsWith("/")) { res.writeHead(301, { location: url.pathname + "/" + url.search }); return res.end(); }
      file = path.join(file, "index.html");
    }
    if (!fs.existsSync(file)) {
      res.writeHead(404, { "content-type": TYPES[".html"] });
      return res.end(fs.existsSync(path.join(dir, "404.html")) ? fs.readFileSync(path.join(dir, "404.html")) : "not found");
    }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-cache" });
    fs.createReadStream(file).pipe(res);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.argv[2] || 4863);
  const base = process.argv[3] || "/startup-college-startups-101/";
  createServer(base).listen(port, "127.0.0.1", () => console.log(`serving dist/ at http://127.0.0.1:${port}${base}`));
}
