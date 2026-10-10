import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { watch } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const clients = new Set();
let reloadTimer;
watch(root, { recursive: true }, (_event, filename) => {
  const file = filename?.replaceAll('\\', '/');
  if (file !== 'index.html' && !file?.startsWith('src/')) return;
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => { for (const client of clients) client.write('data: reload\n\n'); }, 200);
});
const reloadScript = `<script>const paceReload = new EventSource('/__pace_reload'); paceReload.onmessage = () => location.reload();</script>`;
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/__pace_reload') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(': connected\n\n'); clients.add(res);
      const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15000);
      req.on('close', () => { clients.delete(res); clearInterval(heartbeat); }); return;
    }
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep) || !types[path.extname(file)]) { res.writeHead(404); res.end('Not found'); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)], 'Cache-Control': 'no-store' });
    res.end(path.extname(file) === '.html' ? body.toString().replace('</body>', reloadScript + '</body>') : body);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(Number(process.env.PORT || 5173), '127.0.0.1', () => console.log('PACE: http://127.0.0.1:' + server.address().port));
