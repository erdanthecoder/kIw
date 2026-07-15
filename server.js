// CouchPlay server — static file hosting + WebSocket relay fallback.
// Optional: the site also works fully static (e.g. GitHub Pages) using pure P2P.
// Run: npm install && npm start   (default port 8080, override with PORT env var)
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const file = path.normalize(path.join(ROOT, urlPath));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

// ---- WebSocket relay (fallback transport when P2P is blocked) ----
let WebSocketServer = null;
try { WebSocketServer = require('ws').WebSocketServer; } catch (e) {
  console.log('[relay] "ws" package not installed — serving static files only (P2P still works). Run: npm install');
}

if (WebSocketServer) {
  const wss = new WebSocketServer({ server });
  const rooms = new Map(); // code -> { host: ws, clients: Map<cid, ws>, nextCid }

  wss.on('connection', (ws) => {
    ws.role = null;
    ws.on('message', (raw) => {
      let m; try { m = JSON.parse(raw); } catch (e) { return; }

      if (m.t === 'host' && !ws.role) {
        const code = String(m.code || '').toUpperCase().slice(0, 8);
        if (!code || rooms.has(code)) return ws.send(JSON.stringify({ t: 'err', e: 'code-taken' }));
        rooms.set(code, { host: ws, clients: new Map(), nextCid: 1 });
        ws.role = 'host'; ws.room = code;
        ws.send(JSON.stringify({ t: 'ok' }));

      } else if (m.t === 'join' && !ws.role) {
        const code = String(m.code || '').toUpperCase().slice(0, 8);
        const room = rooms.get(code);
        if (!room) return ws.send(JSON.stringify({ t: 'err', e: 'no-room' }));
        const cid = String(room.nextCid++);
        room.clients.set(cid, ws);
        ws.role = 'client'; ws.room = code; ws.cid = cid;
        ws.send(JSON.stringify({ t: 'ok' }));
        room.host.send(JSON.stringify({ t: 'join', cid }));

      } else if (ws.role === 'host') {
        const room = rooms.get(ws.room);
        if (!room) return;
        if (m.t === 'to') {
          const c = room.clients.get(String(m.cid));
          if (c) c.send(JSON.stringify({ t: 'm', m: m.m }));
        } else if (m.t === 'all') {
          const payload = JSON.stringify({ t: 'm', m: m.m });
          for (const c of room.clients.values()) c.send(payload);
        } else if (m.t === 'kick') {
          const c = room.clients.get(String(m.cid));
          if (c) c.close();
        }

      } else if (ws.role === 'client' && m.t === 'm') {
        const room = rooms.get(ws.room);
        if (room) room.host.send(JSON.stringify({ t: 'from', cid: ws.cid, m: m.m }));
      }
    });

    ws.on('close', () => {
      if (ws.role === 'host') {
        const room = rooms.get(ws.room);
        if (room && room.host === ws) {
          for (const c of room.clients.values()) c.close();
          rooms.delete(ws.room);
        }
      } else if (ws.role === 'client') {
        const room = rooms.get(ws.room);
        if (room && room.clients.get(ws.cid) === ws) {
          room.clients.delete(ws.cid);
          room.host.send(JSON.stringify({ t: 'leave', cid: ws.cid }));
        }
      }
    });
  });
}

server.listen(PORT, () => {
  console.log(`CouchPlay running at http://localhost:${PORT}`);
  console.log(`Console (big screen): http://localhost:${PORT}/console.html`);
  console.log(`Controller (phones):  http://localhost:${PORT}/controller.html`);
});
