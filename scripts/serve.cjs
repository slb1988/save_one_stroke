'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const arg = process.argv.indexOf('--port');
const PORT = Number(arg >= 0 ? process.argv[arg + 1] : process.env.PORT || 4173);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) { console.error('Invalid port. Example: npm start -- --port 4174'); process.exit(1); }
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8' };
const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end(); }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400); return res.end('Bad request'); }
  if (pathname === '/health') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); return res.end(req.method === 'HEAD' ? '' : JSON.stringify({ app: 'save-one-stroke', version: '1.0.0', pid: process.pid })); }
  if (pathname === '/') pathname = '/index.html';
  if (pathname.includes('..') || !(pathname === '/index.html' || pathname === '/styles.css' || /^\/(js|assets|vendor|levels|docs|schemas)\/[\w./-]+$/.test(pathname))) { res.writeHead(404); return res.end('Not found'); }
  const filename = path.resolve(ROOT, '.' + pathname);
  if (!filename.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(filename, (error, stat) => {
    if (error || !stat.isFile()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    if (req.method === 'HEAD') return res.end();
    const stream = fs.createReadStream(filename); stream.on('error', () => res.destroy()); stream.pipe(res);
  });
});
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `Port ${PORT} is in use. Try npm start -- --port ${PORT + 1}` : error.message); process.exit(1); });
server.listen(PORT, '127.0.0.1', () => console.log(`救一笔！ http://127.0.0.1:${PORT}/  (PID ${process.pid}; Ctrl+C stops this foreground server)`));
