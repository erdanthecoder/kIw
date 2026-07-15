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
  navCool: 0,

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
      document.getElementById('netBadge').textContent = '⚠ ' + e.message;
      document.getElementById('roomCode').textContent = '----';
      return;
    }
    requestAnimationFrame((ts) => this.loop(ts));
  },

  onReady({ code, modes }) {
    document.getElementById('roomCode').textContent = code;
    const badge = document.getElementById('netBadge');
    if (modes.includes('p2p')) {
      badge.textContent = '⚡ P2P direct — ultra low lag' + (modes.includes('relay') ? ' (+ relay backup)' : '');
      badge.classList.add('p2p');
    } else {
      badge.textContent = '🔁 Server relay mode';
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
    this.net.sendTo(cid, { t: 'welcome', slot, color: p.color, name: p.name });
    if (this.state === 'lobby') {
      this.net.sendTo(cid, { t: 'scene', s: 'wait', msg: 'Look at the big screen — waiting for the host to pick a game.' });
    } else {
      p.spectating = true;
      this.net.sendTo(cid, { t: 'scene', s: 'wait', msg: 'Game in progress — you join in the next round!' });
    }
    this.toast(`${p.name} joined 🎮`);
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
      `<div class="player-chip"><span class="dot" style="background:${p.color}"></span>${esc(p.name)}<span class="wins">🏆 ${p.wins}</span></div>`
    ).join('') || '<div class="slots-hint">No players yet — scan the QR or enter the code on your phone.</div>';
  },

  // ---------- lobby ----------
  renderGrid() {
    const grid = document.getElementById('gameGrid');
    grid.innerHTML = GAMES.map((g, i) =>
      `<div class="game-tile ${i === this.selIdx ? 'sel' : ''}" data-i="${i}">
        <span class="tag">${g.players}</span>
        <div class="icon">${g.icon}</div><h4>${g.title}</h4><p>${g.desc}</p>
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
    document.getElementById('hudTitle').textContent = def.icon + ' ' + def.title;

    const canvas = document.getElementById('gameCanvas');
    const glWrap = document.getElementById('glWrap');
    canvas.style.display = def.is3d ? 'none' : 'block';
    glWrap.style.display = def.is3d ? 'block' : 'none';

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
    document.getElementById('countGame').textContent = def.icon + ' ' + def.title;
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
      try {
        this.game.update(dt, this.G);
        if (this.game.draw) {
          const ctx = document.getElementById('gameCanvas').getContext('2d');
          this.game.draw(ctx, this.G);
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
    const medals = ['🥇', '🥈', '🥉', '4.', '5.', '6.', '7.', '8.'];
    podium.innerHTML = (rows || []).map((r, i) => {
      const p = this.players.get(r.pid);
      if (!p) return '';
      if (i === 0) p.wins++;
      return `<div class="row"><span class="place">${medals[i] || (i + 1) + '.'}</span><span class="dot" style="background:${p.color}"></span>${esc(p.name)}<span class="pts">${esc(r.label || '')}</span></div>`;
    }).join('') || '<div class="row">No results</div>';
    document.getElementById('resultsOverlay').classList.add('active');
    this.G.setScheme(null, 'wait', { msg: 'Round over! Check the big screen 🏆' });
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

// Shared 2D drawing helpers for games
const Draw2 = {
  bg(ctx, G, c1 = '#0a1020', c2 = '#101a33') {
    const g = ctx.createLinearGradient(0, 0, 0, G.H);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, G.W, G.H);
  },
  label(ctx, txt, x, y, size = 16, color = '#fff', align = 'center') {
    ctx.font = `700 ${size}px -apple-system, Segoe UI, sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, x, y);
  },
  timer(ctx, G, left) {
    this.label(ctx, '⏱ ' + Math.max(0, Math.ceil(left)) + 's', G.W / 2, 26, 20, 'rgba(255,255,255,.8)');
  },
};
