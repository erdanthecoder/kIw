// CouchPlay console — PS5-style home screen, room hosting, game lifecycle.
// Games register themselves via registerGame(def); see js/games/*.js
const GAMES = [];
function registerGame(def) { GAMES.push(def); }

// hero glow accent per game
const MOODS_BY_GAME = {
  minecraft: 'chill', obby: 'chill', flappy: 'race', snake: 'chill',
  tanks: 'action', bomber: 'action', laser: 'action', trivia: 'party',
  draw: 'party', reaction: 'party', soccer: 'party', race: 'race',
  pong: 'chill', tetris: 'action', blob: 'chill', dodge: 'action',
};

const ACCENTS = {
  minecraft: '#4caf50', obby: '#ff9800', flappy: '#ffca28', snake: '#66bb6a',
  tanks: '#a1887f', bomber: '#ef5350', laser: '#ab47bc', trivia: '#7e57c2',
  draw: '#ec407a', reaction: '#ffee58', soccer: '#43a047', race: '#ef6c00',
  pong: '#29b6f6', tetris: '#5c6bc0', blob: '#26a69a', dodge: '#e53935',
};

const App = {
  state: 'lobby',          // lobby | count | game | results
  players: new Map(),      // cid -> player
  net: null,
  game: null,
  G: null,
  selIdx: 0,
  lastTs: 0,

  async boot() {
    // browsers only allow audio after a user gesture
    const unlock = () => {
      AudioSys.unlock();
      AudioSys.playMusic(this.state === 'lobby' || this.state === 'results' ? 'menu' : (MOODS_BY_GAME[this.game && this.game.id] || 'menu'));
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    this.bindSettings();
    this.bindMusicBar();
    this.applyLang();
    this.renderRow();
    this.renderHero();
    this.renderPlayers();
    this.bindKeys();
    document.getElementById('endBtn').onclick = () => this.endGame();
    document.getElementById('langBtn').onclick = () => {
      I18N.set(I18N.lang === 'ru' ? 'en' : 'ru');
      this.applyLang();
      this.renderRow(); this.renderHero(); this.renderPlayers();
      if (this.net) {
        this.net.broadcast({ t: 'lang', lang: I18N.lang });
        if (this.state === 'lobby') this.net.broadcast({ t: 'scene', s: 'wait', msg: T('waitingPick') });
      }
    };
    setInterval(() => {
      const d = new Date();
      document.getElementById('clock').textContent =
        String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }, 1000);

    try {
      this.net = await Net.host({
        onReady: (info) => this.onReady(info),
        onJoin: (cid) => { /* wait for hello */ },
        onLeave: (cid) => this.onLeave(cid),
        onMsg: (cid, m) => this.onMsg(cid, m),
      });
    } catch (e) {
      document.getElementById('roomCode').textContent = '----';
      document.getElementById('joinUrl').textContent = e.message;
      return;
    }
    requestAnimationFrame((ts) => this.loop(ts));
  },

  applyLang() {
    document.getElementById('langBtn').textContent = I18N.lang === 'ru' ? 'EN' : 'RU';
    document.getElementById('joinHead').textContent = T('joinRoom');
    document.getElementById('lbHead').textContent = T('leaderboard');
    document.getElementById('resultsLbHead').textContent = T('leaderboard');
    document.getElementById('resultsTitle').textContent = T('results');
    document.getElementById('backBtn').textContent = T('backToLobby');
    document.getElementById('endBtn').textContent = T('endGame');
    document.getElementById('psHint').textContent = T('hint');
    document.getElementById('setHead').textContent = T('settings');
    document.getElementById('setMusic').textContent = T('music');
    document.getElementById('setSfx').textContent = T('sfxLabel');
    document.getElementById('setPerf').textContent = T('performance');
    document.getElementById('setBots').textContent = T('bots');
    const botLabels = { 1: T('on'), 0: T('off') };
    document.querySelectorAll('#botSeg button').forEach(b => { b.textContent = botLabels[b.dataset.v]; });
    document.getElementById('setNote').textContent = T('perfNote');
    document.getElementById('setClose').textContent = T('close');
    const segLabels = { auto: T('auto'), high: T('high'), low: T('low') };
    document.querySelectorAll('#perfSeg button').forEach(b => { b.textContent = segLabels[b.dataset.v]; });
  },

  bindMusicBar() {
    const bar = document.getElementById('musicBar');
    const name = document.getElementById('mbName');
    AudioSys.setOnTrack((p) => {
      if (p) name.textContent = p.composer + ' — ' + p.name;
      bar.classList.toggle('mb-paused', AudioSys.paused);
    });
    document.getElementById('mbPrev').onclick = (e) => { e.stopPropagation(); AudioSys.unlock(); AudioSys.next(-1); };
    document.getElementById('mbNext').onclick = (e) => { e.stopPropagation(); AudioSys.unlock(); AudioSys.next(1); };
    document.getElementById('mbPlay').onclick = (e) => {
      e.stopPropagation();
      AudioSys.unlock();
      const paused = AudioSys.togglePause();
      document.getElementById('mbPlay').innerHTML = paused ? '&#9205;' : '&#9208;';
    };
  },

  bindSettings() {
    const ov = document.getElementById('settingsOverlay');
    document.getElementById('setBtn').onclick = () => { ov.classList.add('active'); };
    document.getElementById('setClose').onclick = () => { ov.classList.remove('active'); };
    ov.addEventListener('click', (e) => { if (e.target === ov) ov.classList.remove('active'); });
    const vm = document.getElementById('volMusic');
    const vs = document.getElementById('volSfx');
    vm.value = Math.round(AudioSys.getVol('music') * 100);
    vs.value = Math.round(AudioSys.getVol('sfx') * 100);
    vm.oninput = () => AudioSys.setVol('music', vm.value / 100);
    vs.oninput = () => { AudioSys.setVol('sfx', vs.value / 100); AudioSys.sfx('pop'); };
    const seg = document.getElementById('perfSeg');
    const paint = () => seg.querySelectorAll('button').forEach(b => b.classList.toggle('sel', b.dataset.v === PERF.mode));
    paint();
    seg.querySelectorAll('button').forEach(b => {
      b.onclick = () => { PERF.set(b.dataset.v); paint(); this.toast(T('perfApplied')); };
    });
    const bseg = document.getElementById('botSeg');
    const bpaint = () => bseg.querySelectorAll('button').forEach(b =>
      b.classList.toggle('sel', b.dataset.v === (localStorage.getItem('cp-bots') || '1')));
    bpaint();
    bseg.querySelectorAll('button').forEach(b => {
      b.onclick = () => { try { localStorage.setItem('cp-bots', b.dataset.v); } catch (e) {} bpaint(); };
    });
  },

  botsEnabled() { return (localStorage.getItem('cp-bots') || '1') !== '0'; },

  removeBots() {
    let removed = false;
    for (const [cid, p] of this.players) if (p.isBot) { this.players.delete(cid); removed = true; }
    return removed;
  },

  // fill empty seats with AI opponents so small groups always get a real match
  spawnBots(def) {
    if (!this.botsEnabled() || def.noBots || !def.bot) return;
    const names = T('botNames');
    const target = Math.max(def.minPlayers, 4);
    let n = 0;
    while (this.players.size < Math.min(target, 8)) {
      const slot = this.freeSlot();
      if (slot < 0) break;
      this.players.set('bot:' + (++n) + ':' + slot, {
        pid: 'bot:' + n + ':' + slot, slot,
        name: names[slot % names.length], color: COLORS[slot], colorName: COLOR_NAMES[slot],
        in: { x: 0, y: 0 }, wins: 0, gone: false, spectating: false, cam: null, isBot: true,
      });
    }
  },

  onReady({ code, modes }) {
    document.getElementById('roomCode').textContent = code;
    const dot = document.getElementById('netBadge');
    if (modes.includes('p2p')) {
      dot.className = 'net-dot p2p';
      dot.title = T('netP2P') + (modes.includes('relay') ? ' ' + T('netBackup') : '');
    } else {
      dot.className = 'net-dot relay';
      dot.title = T('netRelay');
    }
    const url = new URL('controller.html', location.href);
    url.search = '?room=' + code;
    document.getElementById('joinUrl').textContent = url.href;
    if (typeof QRCode !== 'undefined') {
      new QRCode(document.getElementById('qr'), { text: url.href, width: 128, height: 128, correctLevel: QRCode.CorrectLevel.M });
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
    let slot = this.freeSlot();
    if (slot < 0) {
      const bot = [...this.players.values()].find(p => p.isBot);
      if (bot) { this.players.delete(bot.pid); slot = bot.slot; }
    }
    if (slot < 0) {
      this.net.sendTo(cid, { t: 'full' });
      setTimeout(() => this.net.kick(cid), 400);
      return;
    }
    const p = {
      pid: cid, slot,
      name: (name || '').trim().slice(0, 12) || 'Player ' + (slot + 1),
      color: COLORS[slot], colorName: COLOR_NAMES[slot],
      in: { x: 0, y: 0 }, wins: 0, gone: false, spectating: false, cam: null,
    };
    this.players.set(cid, p);
    this.net.sendTo(cid, { t: 'welcome', slot, color: p.color, name: p.name, pid: cid, lang: I18N.lang });
    if (this.state === 'lobby') {
      this.net.sendTo(cid, { t: 'scene', s: 'wait', msg: T('waitingPick') });
    } else {
      p.spectating = true;
      this.net.sendTo(cid, { t: 'scene', s: 'wait', msg: T('gameInProgress') });
    }
    this.toast(T('joined', p.name));
    this.renderPlayers();
  },

  onLeave(cid) {
    const p = this.players.get(cid);
    if (!p) return;
    p.gone = true;
    this.players.delete(cid);
    this.toast(T('left', p.name));
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
    if (m.t === 'cam') {
      // small self-portrait from the phone camera, shown on the player card
      if (typeof m.img === 'string' && m.img.startsWith('data:image/jpeg') && m.img.length < 80000) {
        p.cam = m.img;
        if (this.state === 'lobby' || this.state === 'results') this.renderPlayers();
      } else if (m.img === null) {
        p.cam = null;
        this.renderPlayers();
      }
      return;
    }
    if (m.t === 'btn') {
      if (this.state === 'lobby' && p.slot === 0) return this.lobbyBtn(m.b);
      if (this.state === 'game' && this.game && !p.spectating && this.game.onBtn) this.game.onBtn(p, m.b, this.G);
      return;
    }
    if (this.state === 'game' && this.game && !p.spectating && this.game.onMsg) this.game.onMsg(p, m, this.G);
  },

  sortedByWins() {
    return [...this.players.values()].sort((a, b) => b.wins - a.wins || a.slot - b.slot);
  },

  renderPlayers() {
    // bottom player cards (PS profile-card style)
    const cards = document.getElementById('playerCards');
    const ps = [...this.players.values()].sort((a, b) => a.slot - b.slot);
    let html = ps.map(p => `
      <div class="pcard">
        <div class="ava" style="border-color:${p.color};background:${p.cam ? '#000' : p.color}">
          ${p.cam ? `<img src="${p.cam}" alt="">` : esc(p.name[0].toUpperCase())}
        </div>
        <div><div class="nm">${esc(p.name)}</div><div class="st">P${p.slot + 1} · ${p.wins} ${p.wins === 1 ? T('win') : T('wins')}</div></div>
      </div>`).join('');
    for (let i = ps.length; i < 8; i++) html += '<div class="pcard-empty">+</div>';
    cards.innerHTML = html;
    this.renderLeaderboard(document.getElementById('leaderboard'));
  },

  renderLeaderboard(el) {
    if (!el) return;
    const ranked = this.sortedByWins();
    el.innerHTML = ranked.length ? ranked.map((p, i) =>
      `<div class="lb-row"><span class="pos">${i + 1}</span><span class="dot" style="background:${p.color}"></span>${esc(p.name)}<span class="w">${p.wins} ${p.wins === 1 ? T('win') : T('wins')}</span></div>`
    ).join('') : `<div class="lb-empty">${T('noPlayers')}</div>`;
  },

  // ---------- PS5 home ----------
  renderRow() {
    const row = document.getElementById('gameRow');
    row.innerHTML = GAMES.map((g, i) =>
      `<div class="game-ico ${i === this.selIdx ? 'sel' : ''}" data-i="${i}" title="${esc(I18N.game(g.id, g).title)}">${ICONS[g.id] || ICONS.logo}</div>`).join('');
    row.querySelectorAll('.game-ico').forEach(el => {
      el.onclick = () => {
        const i = +el.dataset.i;
        if (i === this.selIdx) this.startGame(GAMES[i]);
        else { this.selIdx = i; this.renderRow(); this.renderHero(); }
      };
    });
    const sel = row.querySelector('.game-ico.sel');
    if (sel) sel.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  },

  renderHero() {
    const g = GAMES[this.selIdx];
    if (!g) return;
    const meta = I18N.game(g.id, g);
    document.getElementById('heroIcon').innerHTML = ICONS[g.id] || ICONS.logo;
    document.getElementById('heroTitle').textContent = meta.title;
    document.getElementById('heroDesc').textContent = meta.desc;
    document.getElementById('heroMeta').textContent = (g.players + ' ' + T('players')).toUpperCase();
    const hint = document.getElementById('heroHint');
    hint.textContent = T('pressStart');
    hint.onclick = () => this.startGame(g);
    const a = ACCENTS[g.id] || '#2f9bff';
    document.getElementById('psGlow').style.background =
      `radial-gradient(900px 620px at 24% 38%, ${a}2e, transparent 70%)`;
  },

  moveSel(d) {
    this.selIdx = clamp(this.selIdx + d, 0, GAMES.length - 1);
    AudioSys.sfx('move');
    this.renderRow();
    this.renderHero();
  },

  lobbyBtn(b) {
    if (b === 'a' || b === 'tap') this.startGame(GAMES[this.selIdx]);
  },

  bindKeys() {
    window.addEventListener('keydown', (e) => {
      if (this.state === 'lobby') {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') this.moveSel(-1);
        else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') this.moveSel(1);
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
    const meta = I18N.game(def.id, def);
    const real = [...this.players.values()].filter(p => !p.isBot);
    if (real.length >= 1) this.spawnBots(def);
    const ps = [...this.players.values()];
    if (ps.length < def.minPlayers || !real.length) {
      this.removeBots();
      this.toast(T('needsPlayers', meta.title, def.minPlayers, ps.length));
      return;
    }
    this.renderPlayers();
    this.game = def;
    this.state = 'count';
    ps.forEach(p => { p.spectating = false; p.in.x = 0; p.in.y = 0; });

    document.getElementById('lobby').style.display = 'none';
    document.getElementById('stage').classList.add('active');
    document.getElementById('gameHud').style.display = 'flex';
    document.getElementById('hudTitle').textContent = meta.title;

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

    AudioSys.sfx('select');
    AudioSys.playMusic(MOODS_BY_GAME[def.id] || 'action');
    const co = document.getElementById('countOverlay');
    const num = document.getElementById('countNum');
    document.getElementById('countGame').textContent = meta.title;
    co.classList.add('active');
    let n = 3;
    num.textContent = n;
    AudioSys.sfx('count');
    const iv = setInterval(() => {
      n--;
      if (n > 0) { num.textContent = n; AudioSys.sfx('count'); return; }
      clearInterval(iv);
      co.classList.remove('active');
      if (this.state !== 'count') return;
      AudioSys.sfx('go');
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
        if (this.game.bot) {
          for (const p of this.G.players) if (p.isBot) this.game.bot(p, this.G, dt);
        }
        this.game.update(dt, this.G);
        if (this.game.draw) {
          const ctx = document.getElementById('gameCanvas').getContext('2d');
          ctx.save();
          if (Draw2.shake > 0.5) ctx.translate(rand(-1, 1) * Draw2.shake, rand(-1, 1) * Draw2.shake);
          this.game.draw(ctx, this.G);
          Draw2.drawParts(ctx);
          ctx.restore();
        }
      } catch (e) {
        console.error(e);
        this.toast(T('gameError'));
        this.endGame();
      }
    }
    requestAnimationFrame((t) => this.loop(t));
  },

  showResults(rows) {
    if (this.state !== 'game') return;
    this.cleanupGame();
    this.state = 'results';
    AudioSys.sfx('win');
    AudioSys.playMusic('results');
    const podium = document.getElementById('podium');
    const places = T('place');
    podium.innerHTML = (rows || []).map((r, i) => {
      const p = this.players.get(r.pid);
      if (!p) return '';
      if (i === 0) p.wins++;
      return `<div class="row ${i === 0 ? 'gold' : ''}"><span class="place">${places[i] || (i + 1)}</span><span class="dot" style="background:${p.color}"></span>${esc(p.name)}<span class="pts">${esc(r.label || '')}</span></div>`;
    }).join('') || `<div class="row">${T('noResults')}</div>`;
    this.renderLeaderboard(document.getElementById('resultsLb'));
    document.getElementById('resultsOverlay').classList.add('active');
    this.G.setScheme(null, 'wait', { msg: T('roundOver') });
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
    document.getElementById('glWrap').innerHTML = '';
  },

  toLobby() {
    AudioSys.playMusic('menu');
    clearTimeout(this._resT);
    if (this.state === 'game' || this.state === 'count') this.cleanupGame();
    this.state = 'lobby';
    this.game = null;
    document.getElementById('resultsOverlay').classList.remove('active');
    document.getElementById('countOverlay').classList.remove('active');
    document.getElementById('stage').classList.remove('active');
    document.getElementById('gameHud').style.display = 'none';
    document.getElementById('lobby').style.display = 'flex';
    this.removeBots();
    for (const p of this.players.values()) p.spectating = false;
    if (this.net) this.net.broadcast({ t: 'scene', s: 'wait', msg: T('waitingPick') });
    this.renderPlayers();
    this.renderRow();
    this.renderHero();
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
  shake: 0,
  reset() { this.parts = []; this.shake = 0; },
  addShake(a) { this.shake = Math.min(14, this.shake + a); },

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

  orb(ctx, x, y, r, color, glowing = false) {
    if (glowing && !PERF.low) { ctx.shadowColor = color; ctx.shadowBlur = r * 1.6; }
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

  boom(x, y, color, n = 16, speed = 240, life = 0.55, size = 5) {
    this.addShake(n >= 20 ? 7 : n >= 12 ? 4 : 2);
    if (PERF.low) n = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(speed * 0.3, speed);
      this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(life * 0.5, life), max: life, color, size: rand(size * 0.5, size) });
    }
  },
  confetti(x, y, n = 40) {
    const cols = ['#ff4655', '#2f9bff', '#2fd573', '#ffcf3f', '#b06cff', '#ff8c3a'];
    for (let i = 0; i < n; i++) {
      const a = rand(-Math.PI, 0), sp = rand(120, 420);
      this.parts.push({ x: x + rand(-30, 30), y, vx: Math.cos(a) * sp * 0.6, vy: Math.sin(a) * sp, life: rand(0.7, 1.4), max: 1.4, color: cols[i % 6], size: rand(3, 6) });
    }
  },
  trail(x, y, color, size = 3, life = 0.3) {
    if (PERF.low && this.parts.length > 120) return;
    this.parts.push({ x, y, vx: rand(-15, 15), vy: rand(-15, 15), life, max: life, color, size });
  },
  tick(dt) {
    this.shake = Math.max(0, this.shake - dt * 26);
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.96; p.vy = p.vy * 0.96 + 60 * dt;
    }
    if (this.parts.length > 450) this.parts.splice(0, this.parts.length - 450);
  },
  drawParts(ctx) {
    for (const p of this.parts) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (p.life / p.max), 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  },

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
