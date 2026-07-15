// CouchPlay console — lobby, room hosting, game lifecycle.
// Games register themselves via registerGame(def); see js/games/*.js
const GAMES = [];
function registerGame(def) { GAMES.push(def); }

const App = {
  state: 'lobby',          // lobby | count | game | results
  players: new Map(),      // cid -> player
  net: null,
  game: null,              // active game def
  G: null,                 // game context passed to game hooks
  selIdx: 0,
  lastTs: 0,

  async boot() {
    this.renderGrid();
    this.bindKeys();
    document.getElementById('endBtn').onclick = () => this.endGame();

    try {
      this.net = await Net.host({
        onReady: (info) => this.onReady(info),
        onJoin: (cid) => { /* wait for hello */ },
        onLeave: (cid) => this.onLeave(cid),
        onMsg: (cid, m) => this.onMsg(cid, m),
      });
    } catch (e) {
      document.getElementById('netBadge').textContent = 'Offline: ' + e.message;
      document.getElementById('roomCode').textContent = '----';
      return;
    }
    requestAnimationFrame((ts) => this.loop(ts));
  },

  onReady({ code, modes }) {
    document.getElementById('roomCode').textContent = code;
    const badge = document.getElementById('netBadge');
    if (modes.includes('p2p')) {
      badge.textContent = 'P2P direct — ultra low lag' + (modes.includes('relay') ? ' (+ relay backup)' : '');
      badge.classList.add('p2p');
    } else {
      badge.textContent = 'Server relay mode';
    }
    const url = new URL('controller.html', location.href);
    url.search = '?room=' + code;
    document.getElementById('joinUrl').textContent = url.href;
    if (typeof QRCode !== 'undefined') {
      new QRCode(document.getElementById('qr'), { text: url.href, width: 170, height: 170, correctLevel: QRCode.CorrectLevel.M });
    }
  },

  // ---------- players ----------
  freeSlot() {
    const used = new Set([...this.players.values()].map(p => p.slot));
    for (let s = 0; s < 8; s++) if (!used.has(s)) return s;
    return -1;
  },

  onHello(cid, name) {
    if (this.players.has(cid)) return;
    const slot = this.freeSlot();
    if (slot < 0) {
      this.net.sendTo(cid, { t: 'full' });
      setTimeout(() => this.net.kick(cid), 400);
      return;
    }
    const p = {
      pid: cid, slot,
      name: (name || '').trim().slice(0, 12) || 'Player ' + (slot + 1),
      color: COLORS[slot], colorName: COLOR_NAMES[slot],
      in: { x: 0, y: 0 }, wins: 0, gone: false, spectating: false,
    };
    this.players.set(cid, p);
    this.net.sendTo(cid, { t: 'welcome', slot, color: p.color, name: p.name, pid: cid });
    if (this.state === 'lobby') {
      this.net.sendTo(cid, { t: 'scene', s: 'wait', msg: 'Look at the big screen — waiting for the host to pick a game.' });
    } else {
      p.spectating = true;
      this.net.sendTo(cid, { t: 'scene', s: 'wait', msg: 'Game in progress — you join in the next round.' });
    }
    this.toast(`${p.name} joined`);
    this.renderPlayers();
  },

  onLeave(cid) {
    const p = this.players.get(cid);
    if (!p) return;
    p.gone = true;
    this.players.delete(cid);
    this.toast(`${p.name} left`);
    this.renderPlayers();
  },

  onMsg(cid, m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'hello') return this.onHello(cid, m.name);
    const p = this.players.get(cid);
    if (!p) return;

    if (m.t === 'in') {
      p.in.x = clamp(+m.x || 0, -1, 1);
      p.in.y = clamp(+m.y || 0, -1, 1);
      return;
    }
    if (m.t === 'btn') {
      if (this.state === 'lobby' && p.slot === 0) return this.lobbyBtn(m.b);
      if (this.state === 'game' && this.game && !p.spectating && this.game.onBtn) this.game.onBtn(p, m.b, this.G);
      return;
    }
    // everything else goes to the running game (strokes, 3D positions, block edits…)
    if (this.state === 'game' && this.game && !p.spectating && this.game.onMsg) this.game.onMsg(p, m, this.G);
  },

  renderPlayers() {
    const list = document.getElementById('playerList');
    const ps = [...this.players.values()].sort((a, b) => a.slot - b.slot);
    document.getElementById('playerCount').textContent = ps.length;
    list.innerHTML = ps.map(p =>
      `<div class="player-chip"><span class="dot" style="background:${p.color}"></span>${esc(p.name)}<span class="wins">${p.wins} win${p.wins === 1 ? '' : 's'}</span></div>`
    ).join('') || '<div class="slots-hint">No players yet — scan the QR or enter the code on your phone.</div>';
  },

  // ---------- lobby ----------
  renderGrid() {
    const grid = document.getElementById('gameGrid');
    grid.innerHTML = GAMES.map((g, i) =>
      `<div class="game-tile ${i === this.selIdx ? 'sel' : ''}" data-i="${i}">
        <span class="tag">${g.players}</span>
        <div class="icon">${ICONS[g.id] || ICONS.logo}</div><h4>${g.title}</h4><p>${g.desc}</p>
      </div>`).join('');
    grid.querySelectorAll('.game-tile').forEach(el => {
      el.onclick = () => { this.selIdx = +el.dataset.i; this.startGame(GAMES[this.selIdx]); };
    });
  },

  moveSel(dx, dy) {
    const cols = 4;
    let r = Math.floor(this.selIdx / cols), c = this.selIdx % cols;
    c = clamp(c + dx, 0, cols - 1);
    r = clamp(r + dy, 0, Math.ceil(GAMES.length / cols) - 1);
    this.selIdx = clamp(r * cols + c, 0, GAMES.length - 1);
    this.renderGrid();
    const el = document.querySelector('.game-tile.sel');
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  },

  lobbyBtn(b) {
    if (b === 'a' || b === 'tap') this.startGame(GAMES[this.selIdx]);
  },

  bindKeys() {
    window.addEventListener('keydown', (e) => {
      if (this.state === 'lobby') {
        if (e.key === 'ArrowLeft') this.moveSel(-1, 0);
        else if (e.key === 'ArrowRight') this.moveSel(1, 0);
        else if (e.key === 'ArrowUp') this.moveSel(0, -1);
        else if (e.key === 'ArrowDown') this.moveSel(0, 1);
        else if (e.key === 'Enter') this.startGame(GAMES[this.selIdx]);
      } else if (this.state === 'game' && e.key === 'Escape') {
        this.endGame();
      } else if (this.state === 'results' && e.key === 'Enter') {
        this.toLobby();
      }
    });
  },

  // ---------- game lifecycle ----------
  startGame(def) {
    if (!def || this.state !== 'lobby') return;
    const ps = [...this.players.values()];
    if (ps.length < def.minPlayers) {
      this.toast(`${def.title} needs at least ${def.minPlayers} player${def.minPlayers > 1 ? 's' : ''} — ${ps.length} joined`);
      return;
    }
    this.game = def;
    this.state = 'count';
    ps.forEach(p => { p.spectating = false; p.in.x = 0; p.in.y = 0; });

    document.getElementById('lobby').style.display = 'none';
    document.getElementById('stage').classList.add('active');
    document.getElementById('gameHud').style.display = 'flex';
    document.getElementById('hudTitle').textContent = def.title;

    const canvas = document.getElementById('gameCanvas');
    const glWrap = document.getElementById('glWrap');
    canvas.style.display = def.is3d ? 'none' : 'block';
    glWrap.style.display = def.is3d ? 'block' : 'none';

    Draw2.reset();
    const self = this;
    this.G = {
      W: 1280, H: 720,
      canvas, glWrap,
      time: 0,
      get players() { return [...self.players.values()].filter(p => !p.spectating).sort((a, b) => a.slot - b.slot); },
      send(p, m) { self.net.sendTo(typeof p === 'string' ? p : p.pid, m); },
      broadcast(m) { for (const p of this.players) self.net.sendTo(p.pid, m); },
      setScheme(p, s, data) {
        const msg = Object.assign({ t: 'scene', s, game: self.game.id }, data || {});
        if (p) self.net.sendTo(typeof p === 'string' ? p : p.pid, msg); else this.broadcast(msg);
      },
      vib(p, ms) { self.net.sendTo(typeof p === 'string' ? p : p.pid, { t: 'vib', ms: ms || 60 }); },
      finish(rows) { self.showResults(rows); },
      toast(msg) { self.toast(msg); },
    };

    // countdown 3-2-1
    const co = document.getElementById('countOverlay');
    const num = document.getElementById('countNum');
    document.getElementById('countGame').textContent = def.title;
    co.classList.add('active');
    let n = 3;
    num.textContent = n;
    const iv = setInterval(() => {
      n--;
      if (n > 0) { num.textContent = n; return; }
      clearInterval(iv);
      co.classList.remove('active');
      if (this.state !== 'count') return;  // aborted
      this.state = 'game';
      this.G.time = 0;
      def.init(this.G);
    }, 900);
  },

  loop(ts) {
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000 || 0.016);
    this.lastTs = ts;
    if (this.state === 'game' && this.game) {
      this.G.time += dt;
      Draw2.tick(dt);
      try {
        this.game.update(dt, this.G);
        if (this.game.draw) {
          const ctx = document.getElementById('gameCanvas').getContext('2d');
          this.game.draw(ctx, this.G);
          Draw2.drawParts(ctx);
        }
      } catch (e) {
        console.error(e);
        this.toast('Game error — returning to lobby');
        this.endGame();
      }
    }
    requestAnimationFrame((t) => this.loop(t));
  },

  showResults(rows) {
    if (this.state !== 'game') return;
    this.cleanupGame();
    this.state = 'results';
    const podium = document.getElementById('podium');
    const place = (i) => ['1st', '2nd', '3rd'][i] || (i + 1) + 'th';
    podium.innerHTML = (rows || []).map((r, i) => {
      const p = this.players.get(r.pid);
      if (!p) return '';
      if (i === 0) p.wins++;
      return `<div class="row ${i === 0 ? 'gold' : ''}"><span class="place">${place(i)}</span><span class="dot" style="background:${p.color}"></span>${esc(p.name)}<span class="pts">${esc(r.label || '')}</span></div>`;
    }).join('') || '<div class="row">No results</div>';
    document.getElementById('resultsOverlay').classList.add('active');
    this.G.setScheme(null, 'wait', { msg: 'Round over — check the big screen for standings.' });
    this.renderPlayers();
    clearTimeout(this._resT);
    this._resT = setTimeout(() => this.toLobby(), 12000);
  },

  endGame() {
    if (this.state !== 'game' && this.state !== 'count') return;
    this.cleanupGame();
    this.toLobby();
  },

  cleanupGame() {
    if (this.game && this.game.end) { try { this.game.end(this.G); } catch (e) {} }
    const glWrap = document.getElementById('glWrap');
    glWrap.innerHTML = '';
  },

  toLobby() {
    clearTimeout(this._resT);
    if (this.state === 'game' || this.state === 'count') this.cleanupGame();
    this.state = 'lobby';
    this.game = null;
    document.getElementById('resultsOverlay').classList.remove('active');
    document.getElementById('countOverlay').classList.remove('active');
    document.getElementById('stage').classList.remove('active');
    document.getElementById('gameHud').style.display = 'none';
    document.getElementById('lobby').style.display = 'flex';
    for (const p of this.players.values()) p.spectating = false;
    if (this.net) this.net.broadcast({ t: 'scene', s: 'wait', msg: 'Look at the big screen — waiting for the host to pick a game.' });
    this.renderPlayers();
    this.renderGrid();
  },

  toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => { el.style.display = 'none'; }, 2600);
  },
};

// ---------------------------------------------------------------------------
// Draw2 — shared 2D renderer toolkit: gradients, glossy shapes, name tags,
// particles and timers. Gives every game a consistent, polished look.
// ---------------------------------------------------------------------------
const Draw2 = {
  parts: [],
  reset() { this.parts = []; },

  bg(ctx, G, c1 = '#0a1020', c2 = '#101a33') {
    const g = ctx.createLinearGradient(0, 0, 0, G.H);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, G.W, G.H);
  },

  vignette(ctx, G, strength = 0.5) {
    const g = ctx.createRadialGradient(G.W / 2, G.H / 2, G.H * 0.42, G.W / 2, G.H / 2, G.H * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${strength})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, G.W, G.H);
  },

  label(ctx, txt, x, y, size = 16, color = '#fff', align = 'center', weight = 700) {
    ctx.font = `${weight} ${size}px -apple-system, Segoe UI, sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,.6)';
    ctx.shadowBlur = 4;
    ctx.fillText(txt, x, y);
    ctx.shadowBlur = 0;
  },

  // name plate: dark pill with color dot + name
  tag(ctx, p, x, y, extra = '') {
    const txt = extra ? `${p.name} ${extra}` : p.name;
    ctx.font = '600 12px -apple-system, Segoe UI, sans-serif';
    const w = ctx.measureText(txt).width + 26;
    ctx.fillStyle = 'rgba(5,8,16,.66)';
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - 10, w, 20, 10); ctx.fill();
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(x - w / 2 + 11, y, 4.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(txt, x - w / 2 + 20, y + 0.5);
  },

  // glossy sphere (balls, orbs, pellets)
  orb(ctx, x, y, r, color, glowing = false) {
    if (glowing) { ctx.shadowColor = color; ctx.shadowBlur = r * 1.6; }
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, this.lighten(color, 0.55));
    g.addColorStop(0.55, color);
    g.addColorStop(1, this.darken(color, 0.45));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.beginPath(); ctx.ellipse(x - r * 0.32, y - r * 0.42, r * 0.28, r * 0.16, -0.6, 0, 7); ctx.fill();
  },

  // player pawn: soft drop shadow + glossy body + rim
  pawn(ctx, x, y, r, color) {
    this.dropShadow(ctx, x, y + r * 0.82, r);
    this.orb(ctx, x, y, r, color);
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
  },

  dropShadow(ctx, x, y, r) {
    ctx.fillStyle = 'rgba(0,0,0,.32)';
    ctx.beginPath(); ctx.ellipse(x, y, r * 0.9, r * 0.34, 0, 0, 7); ctx.fill();
  },

  panel(ctx, x, y, w, h, r = 14) {
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    ctx.strokeStyle = 'rgba(255,255,255,.14)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); ctx.stroke();
  },

  timer(ctx, G, left, total) {
    left = Math.max(0, left);
    const m = Math.floor(left / 60), s = Math.ceil(left % 60) % 60;
    const txt = m + ':' + String(s).padStart(2, '0');
    ctx.fillStyle = 'rgba(5,8,16,.6)';
    ctx.beginPath(); ctx.roundRect(G.W / 2 - 44, 10, 88, 30, 15); ctx.fill();
    this.label(ctx, txt, G.W / 2, 25, 17, left < 11 ? '#ff5a66' : 'rgba(255,255,255,.92)');
    if (total) {
      ctx.fillStyle = 'rgba(255,255,255,.14)';
      ctx.fillRect(G.W / 2 - 40, 42, 80, 3);
      ctx.fillStyle = left < 11 ? '#ff5a66' : '#2f9bff';
      ctx.fillRect(G.W / 2 - 40, 42, 80 * clamp(left / total, 0, 1), 3);
    }
  },

  // ---- particles ----
  boom(x, y, color, n = 16, speed = 240, life = 0.55, size = 5) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(speed * 0.3, speed);
      this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(life * 0.5, life), max: life, color, size: rand(size * 0.5, size) });
    }
  },
  trail(x, y, color, size = 3, life = 0.3) {
    this.parts.push({ x, y, vx: rand(-15, 15), vy: rand(-15, 15), life, max: life, color, size });
  },
  tick(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.96; p.vy = p.vy * 0.96 + 60 * dt;
    }
    if (this.parts.length > 400) this.parts.splice(0, this.parts.length - 400);
  },
  drawParts(ctx) {
    for (const p of this.parts) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (p.life / p.max), 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  },

  // ---- color utils ----
  _hex(color) {
    if (color[0] === '#') {
      const n = parseInt(color.slice(1), 16);
      return [n >> 16 & 255, n >> 8 & 255, n & 255];
    }
    return [255, 255, 255];
  },
  lighten(color, k) {
    const [r, g, b] = this._hex(color);
    return `rgb(${Math.min(255, r + (255 - r) * k) | 0},${Math.min(255, g + (255 - g) * k) | 0},${Math.min(255, b + (255 - b) * k) | 0})`;
  },
  darken(color, k) {
    const [r, g, b] = this._hex(color);
    return `rgb(${r * (1 - k) | 0},${g * (1 - k) | 0},${b * (1 - k) | 0})`;
  },
};
