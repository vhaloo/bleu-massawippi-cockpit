import http from "node:http";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8766);
const allowed = new Set(["workspace-fixture.html","workspace-test-fixture.mjs","workspace-v2.js","workspace-v2.css","workspace-model.mjs","motion.js","theme.js","feedback-widget.mjs"]);
const mime = {".html":"text/html; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".webp":"image/webp",".png":"image/png",".jpg":"image/jpeg"};
const server = http.createServer(async(req,res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "workspace-fixture.html";
    if (!allowed.has(relative) && !/^media-previews\/[a-zA-Z0-9_./-]+\.(webp|png|jpg)$/.test(relative)) { res.writeHead(404).end(); return; }
    const target = path.resolve(root, relative);
    if (!target.startsWith(root + path.sep) || relative.split("/").includes("..")) { res.writeHead(403).end(); return; }
    const content = await fs.readFile(target);
    res.writeHead(200, {"Content-Type":mime[path.extname(target)] || "application/octet-stream","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}).end(content);
  } catch { res.writeHead(404).end(); }
});
server.listen(port,"127.0.0.1",()=>console.log(`Aperçu local synthétique : http://127.0.0.1:${port}/workspace-fixture.html?interface=v2#/publications/test-first — aucun accès Firebase.`));
