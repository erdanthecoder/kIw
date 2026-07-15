// CouchPlay networking — PeerJS P2P primary (lowest lag), WebSocket relay fallback.
// The host registers the room on BOTH transports when available, so any player
// can join over whichever path works for them.
const Net = (() => {
  const PREFIX = 'couchplay-v1-';

  function wsURL() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${location.host}`;
  }
  const isFile = location.protocol === 'file:';

  // ---------- HOST ----------
  // cb: { onReady({code, modes}), onJoin(cid), onLeave(cid), onMsg(cid, m) }
  // Returns { sendTo(cid,m), broadcast(m), code, modes }
  async function host(cb) {
    const code = makeCode();
    const conns = new Map(); // cid -> {send(m), close()}
    const modes = [];

    const api = {
      code,
      modes,
      sendTo(cid, m) { const c = conns.get(cid); if (c) c.send(m); },
      broadcast(m) { for (const c of conns.values()) c.send(m); },
      kick(cid) { const c = conns.get(cid); if (c) c.close(); },
    };

    function addConn(cid, conn) {
      conns.set(cid, conn);
      cb.onJoin(cid);
    }
    function dropConn(cid) {
      if (conns.delete(cid)) cb.onLeave(cid);
    }

    // --- P2P (PeerJS cloud broker for signaling, then direct WebRTC) ---
    const p2p = new Promise((resolve) => {
      if (typeof Peer === 'undefined') return resolve(false);
      let settled = false;
      const timer = setTimeout(() => { if (!settled) { settled = true; try { peer.destroy(); } catch (e) {} resolve(false); } }, 8000);
      const peer = new Peer(PREFIX + code, { debug: 0 });
      peer.on('open', () => {
        if (settled) return; settled = true; clearTimeout(timer);
        peer.on('connection', (conn) => {
          const cid = 'p:' + conn.peer + ':' + (Math.random() * 1e6 | 0);
          conn.on('open', () => {
            addConn(cid, {
              send(m) { try { conn.send(m); } catch (e) {} },
              close() { try { conn.close(); } catch (e) {} },
            });
          });
          conn.on('data', (d) => cb.onMsg(cid, d));
          conn.on('close', () => dropConn(cid));
          conn.on('error', () => dropConn(cid));
        });
        resolve(true);
      });
      peer.on('error', (e) => {
        if (!settled) { settled = true; clearTimeout(timer); resolve(false); }
      });
    });

    // --- WS relay (same-origin server.js) ---
    const wsRelay = new Promise((resolve) => {
      if (isFile) return resolve(false);
      let ws;
      try { ws = new WebSocket(wsURL()); } catch (e) { return resolve(false); }
      let opened = false;
      const timer = setTimeout(() => { if (!opened) { try { ws.close(); } catch (e) {} resolve(false); } }, 5000);
      ws.onopen = () => { ws.send(JSON.stringify({ t: 'host', code })); };
      ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.t === 'ok' && !opened) {
          opened = true; clearTimeout(timer);
          resolve(true);
        } else if (m.t === 'join') {
          addConn('w:' + m.cid, {
            send(msg) { try { ws.send(JSON.stringify({ t: 'to', cid: m.cid, m: msg })); } catch (e) {} },
            close() { try { ws.send(JSON.stringify({ t: 'kick', cid: m.cid })); } catch (e) {} },
          });
        } else if (m.t === 'leave') {
          dropConn('w:' + m.cid);
        } else if (m.t === 'from') {
          cb.onMsg('w:' + m.cid, m.m);
        }
      };
      ws.onerror = () => { if (!opened) { clearTimeout(timer); resolve(false); } };
      ws.onclose = () => { if (!opened) { clearTimeout(timer); resolve(false); } };
    });

    const [hasP2P, hasWS] = await Promise.all([p2p, wsRelay]);
    if (hasP2P) modes.push('p2p');
    if (hasWS) modes.push('relay');
    if (!modes.length) throw new Error('No transport available (P2P blocked and no relay server).');
    cb.onReady({ code, modes });
    return api;
  }

  // ---------- CLIENT (controller) ----------
  // cb: { onOpen(mode), onMsg(m), onClose() }
  // Returns { send(m), close() }
  async function join(code, cb) {
    code = code.toUpperCase().trim();

    // Try P2P first
    const p2pConn = await new Promise((resolve) => {
      if (typeof Peer === 'undefined') return resolve(null);
      let settled = false;
      const peer = new Peer({ debug: 0 });
      const timer = setTimeout(() => { if (!settled) { settled = true; try { peer.destroy(); } catch (e) {} resolve(null); } }, 7000);
      peer.on('open', () => {
        const conn = peer.connect(PREFIX + code, { reliable: true });
        conn.on('open', () => {
          if (settled) return; settled = true; clearTimeout(timer);
          conn.on('data', (d) => cb.onMsg(d));
          conn.on('close', () => cb.onClose());
          resolve({
            mode: 'p2p',
            send(m) { try { conn.send(m); } catch (e) {} },
            close() { try { peer.destroy(); } catch (e) {} },
          });
        });
        conn.on('error', () => { if (!settled) { settled = true; clearTimeout(timer); try { peer.destroy(); } catch (e) {} resolve(null); } });
      });
      peer.on('error', () => { if (!settled) { settled = true; clearTimeout(timer); resolve(null); } });
    });
    if (p2pConn) { cb.onOpen('p2p'); return p2pConn; }

    // Fallback: WS relay
    const wsConn = await new Promise((resolve) => {
      if (isFile) return resolve(null);
      let ws;
      try { ws = new WebSocket(wsURL()); } catch (e) { return resolve(null); }
      let joined = false;
      const timer = setTimeout(() => { if (!joined) { try { ws.close(); } catch (e) {} resolve(null); } }, 5000);
      ws.onopen = () => ws.send(JSON.stringify({ t: 'join', code }));
      ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.t === 'ok' && !joined) {
          joined = true; clearTimeout(timer);
          resolve({
            mode: 'relay',
            send(msg) { try { ws.send(JSON.stringify({ t: 'm', m: msg })); } catch (e) {} },
            close() { try { ws.close(); } catch (e) {} },
          });
        } else if (m.t === 'm') {
          cb.onMsg(m.m);
        } else if (m.t === 'err' && !joined) {
          clearTimeout(timer); resolve(null);
        }
      };
      ws.onclose = () => { if (joined) cb.onClose(); else { clearTimeout(timer); resolve(null); } };
      ws.onerror = () => { if (!joined) { clearTimeout(timer); resolve(null); } };
    });
    if (wsConn) { cb.onOpen('relay'); return wsConn; }

    throw new Error('Could not find room "' + code + '". Check the code and make sure the console screen is open.');
  }

  return { host, join };
})();
