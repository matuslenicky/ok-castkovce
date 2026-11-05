// Statický server s live reloadom pre dist/ (node scripts/serve.mjs dist 5260; ?nolr vypne reload)
// node serve.mjs <priečinok> [port]   ·   ?nolr vypne reload skript (na audit)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = path.resolve(process.argv[2] || '.');
const port = Number(process.argv[3]) || 5250;
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ics': 'text/calendar; charset=utf-8', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ico': 'image/x-icon'
};
const clients = new Set();
const snippet = '<script>(()=>{const s=new EventSource("/__lr");s.onmessage=()=>location.reload();})()</script>';

http.createServer((req, res) => {
  // „//?x“ by new URL() prečítalo ako adresu bez hostiteľa a server by spadol
  let url;
  try { url = new URL(req.url.replace(/^\/{2,}/, '/'), 'http://localhost'); } catch { res.writeHead(400); res.end(); return; }
  if (url.pathname === '/__lr') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(': ok\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  let p;
  try { p = decodeURIComponent(url.pathname); } catch { res.writeHead(400); res.end(); return; } // zlé %xx
  if (p.endsWith('/')) p += 'index.html';
  const file = path.resolve(path.join(root, p));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; } // aj súrodenec „dist2“ je mimo
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('404'); return; }
    const ext = path.extname(file).toLowerCase();
    res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    let body = buf;
    if (ext === '.html' && !url.searchParams.has('nolr')) {
      const s = buf.toString('utf8');
      // živé obnovovanie je inline skript: lokálne sa CSP vynechá (s ?nolr, napr. pri audite, ostáva ako na webe)
      const t = s.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\n?/, '');
      body = Buffer.from(t.includes('</body>') ? t.replace('</body>', snippet + '</body>') : t + snippet);
    }
    // textové súbory gzipom ako na skutočnom hostingu (GitHub Pages), aby Lighthouse meral reálne veľkosti
    if (/\.(html|css|m?js|svg|json)$/.test(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
      body = zlib.gzipSync(body);
    }
    res.end(body);
  });
}).listen(port, '127.0.0.1', () => console.log(`OK Častkovce: http://127.0.0.1:${port}/`));

let t;
fs.watch(root, { recursive: true }, () => {
  clearTimeout(t);
  t = setTimeout(() => { for (const c of clients) c.write('data: reload\n\n'); }, 150);
});
