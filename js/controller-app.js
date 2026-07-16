// CouchPlay controller — the player's phone/tablet/laptop becomes the gamepad.
// PlayStation-style face buttons (their shape language, drawn from scratch).
const PS_SHAPES = {
  cross: '<svg viewBox="0 0 24 24" fill="none"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="#7db9ff" stroke-width="2.6" stroke-linecap="round"/></svg>',
  circle: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="7.2" stroke="#ff6673" stroke-width="2.6"/></svg>',
  square: '<svg viewBox="0 0 24 24" fill="none"><rect x="5.8" y="5.8" width="12.4" height="12.4" stroke="#ffa3d7" stroke-width="2.6"/></svg>',
  triangle: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 5.6l7.6 13H4.4z" stroke="#2fd573" stroke-width="2.6" stroke-linejoin="round"/></svg>',
};
function psDiamond(opts) {
  // opts: {a: {label, rep}, b: {label, rep}} — cross = primary, circle = secondary
  const a = opts.a, b = opts.b;
  return `
    <div class="ps-diamond">
      <button class="ps-btn pos-t off" tabindex="-1">${PS_SHAPES.triangle}</button>
      <button class="ps-btn pos-l off" tabindex="-1">${PS_SHAPES.square}</button>
      <button class="ps-btn pos-r ${b ? '' : 'off'}" ${b ? `data-btn="b" ${b.rep ? `data-rep="${b.rep}"` : ''}` : 'tabindex="-1"'}>${PS_SHAPES.circle}</button>
      <button class="ps-btn pos-b ${a ? '' : 'off'}" ${a ? `data-btn="a" ${a.rep ? `data-rep="${a.rep}"` : ''}` : 'tabindex="-1"'}>${PS_SHAPES.cross}</button>
    </div>
    <div class="act-label">
      ${a ? `<span>${PS_SHAPES.cross} ${esc(a.label)}</span>` : ''}
      ${b ? `<span>${PS_SHAPES.circle} ${esc(b.label)}</span>` : ''}
    </div>`;
}

const Ctrl = {
  conn: null,
  me: null,           // {slot, color, name}
  scheme: null,
  stick: { x: 0, y: 0 },
  lastSent: { x: 0, y: 0 },
  keys: {},

  cam: { on: false, stream: null, timer: null },

  applyLang() {
    document.querySelector('#joinScreen p').textContent = T('enterCode');
    document.getElementById('name').placeholder = T('yourName');
    document.getElementById('joinBtn').textContent = T('join');
    const cb = document.getElementById('camBtn');
    if (cb) cb.textContent = this.cam.on ? T('cameraOn') : T('cameraOff');
  },

  init() {
    this.applyLang();
    document.getElementById('camBtn').onclick = () => this.toggleCam();
    const params = new URLSearchParams(location.search);
    const codeEl = document.getElementById('code');
    const nameEl = document.getElementById('name');
    if (params.get('room')) codeEl.value = params.get('room').toUpperCase();
    nameEl.value = localStorage.getItem('cp-name') || '';
    document.getElementById('joinBtn').onclick = () => this.join();
    codeEl.addEventListener('keydown', e => { if (e.key === 'Enter') nameEl.focus(); });
    nameEl.addEventListener('keydown', e => { if (e.key === 'Enter') this.join(); });
    if (params.get('room')) setTimeout(() => nameEl.focus(), 100);

    // keyboard players (laptops)
    window.addEventListener('keydown', (e) => this.key(e, true));
    window.addEventListener('keyup', (e) => this.key(e, false));
    setInterval(() => this.pumpStick(), 33);
  },

  async join() {
    const code = document.getElementById('code').value.trim().toUpperCase();
    const name = document.getElementById('name').value.trim();
    const err = document.getElementById('joinErr');
    if (code.length < 3) { err.textContent = T('checkCode'); return; }
    localStorage.setItem('cp-name', name);
    err.textContent = '';
    document.getElementById('joinBtn').textContent = T('connecting');
    try {
      this.conn = await Net.join(code, {
        onOpen: (mode) => {
          document.getElementById('connPill').textContent = mode === 'p2p' ? 'P2P direct' : 'relay';
        },
        onMsg: (m) => this.onMsg(m),
        onClose: () => {
          this.show('joinScreen');
          document.getElementById('joinBtn').textContent = T('join');
          document.getElementById('joinErr').textContent = T('connLost');
          if (window.Ctrl3D) Ctrl3D.stop();
        },
      });
      this.conn.send({ t: 'hello', name });
    } catch (e) {
      err.textContent = e.message;
      document.getElementById('joinBtn').textContent = T('join');
    }
  },

  send(m) { if (this.conn) this.conn.send(m); },

  onMsg(m) {
    if (!m || typeof m !== 'object') return;
    switch (m.t) {
      case 'welcome':
        this.me = m;
        if (m.lang) { I18N.set(m.lang); this.applyLang(); }
        document.getElementById('waitMsg').innerHTML = T('youreIn');
        const badge = document.getElementById('meBadge');
        badge.style.background = m.color;
        badge.textContent = 'P' + (m.slot + 1);
        document.getElementById('meName').textContent = m.name;
        this.show('waitScreen');
        break;
      case 'full':
        this.show('joinScreen');
        document.getElementById('joinErr').textContent = T('roomFull');
        document.getElementById('joinBtn').textContent = T('join');
        break;
      case 'scene':
        this.setScene(m);
        break;
      case 'vib':
        if (navigator.vibrate) navigator.vibrate(m.ms || 60);
        break;
      case 'qnew':
        this.quizUpdate(m);
        break;
      case 'lang':
        I18N.set(m.lang);
        this.applyLang();
        break;
      default:
        if (this.scheme === '3d' && window.Ctrl3D) Ctrl3D.onMsg(m);
    }
  },

  show(id) {
    for (const s of ['joinScreen', 'waitScreen', 'pad', 'c3dWrap']) {
      document.getElementById(s).style.display = 'none';
    }
    const el = document.getElementById(id);
    el.style.display = (id === 'joinScreen' || id === 'waitScreen') ? 'flex' : 'block';
  },

  // ---------- scenes / schemes ----------
  setScene(m) {
    if (this.scheme === '3d' && m.s !== '3d' && window.Ctrl3D) Ctrl3D.stop();
    this.scheme = m.s;
    this.stick = { x: 0, y: 0 };
    const pad = document.getElementById('pad');
    pad.innerHTML = '';

    if (m.s === 'wait') {
      this.show('waitScreen');
      document.getElementById('waitMsg').innerHTML = esc(m.msg || T('youreIn'));
      return;
    }
    if (m.s === '3d') {
      this.show('c3dWrap');
      Ctrl3D.start(m, (msg) => this.send(msg), this.me);
      return;
    }
    this.show('pad');
    const msgBar = `<div class="pad-msg" id="padMsg">${esc(m.msg || '')}</div>`;

    if (m.s === 'stick' || m.s === 'stick1' || m.s === 'stick2') {
      const a = m.s !== 'stick' ? { label: m.a || 'A', rep: m.arep } : null;
      const b = m.s === 'stick2' ? { label: m.b || 'B', rep: m.brep } : null;
      pad.innerHTML = msgBar + `
        <div class="stick-zone" id="stickZone" style="${m.s === 'stick' ? 'width:100%' : ''}">
          <div class="stick-base2" id="stickBase2"><div class="stick-nub2" id="stickNub2"></div></div>
        </div>
        ${a ? `<div class="btn-zone ps-zone">${psDiamond({ a, b })}</div>` : ''}
        <div class="ctrl-grip"></div>`;
      this.bindStick();
      this.bindButtons();

    } else if (m.s === 'tap') {
      pad.innerHTML = msgBar + `<button class="tap-btn" data-btn="tap">${esc(m.label || 'TAP!')}</button>`;
      this.bindButtons();

    } else if (m.s === 'dpad1') {
      pad.innerHTML = msgBar + `
        <div class="dpad-zone"><div class="dpad">
          <button class="blank"></button><button data-btn="u" data-rep="170">▲</button><button class="blank"></button>
          <button data-btn="l" data-rep="170">◀</button><button class="blank"></button><button data-btn="r" data-rep="170">▶</button>
          <button class="blank"></button><button data-btn="d" data-rep="170">▼</button><button class="blank"></button>
        </div></div>
        <div class="btn-zone ps-zone" style="width:44%">${psDiamond({ a: { label: m.a || 'A' } })}</div>
        <div class="ctrl-grip"></div>`;
      this.bindButtons();

    } else if (m.s === 'quiz') {
      const cols = ['#ff4655', '#2f9bff', '#2fd573', '#ffcf3f'];
      pad.innerHTML = msgBar + `<div class="quiz-grid">${(m.labels || []).map((l, i) =>
        `<button class="quiz-btn" data-btn="${i}" style="background:${cols[i]}">${esc(l)}</button>`).join('')}</div>`;
      this.bindButtons({ once: true });

    } else if (m.s === 'draw') {
      pad.innerHTML = `<div class="pad-msg">${T('drawWord')}: <b style="color:#fff;font-size:16px">${esc(m.word || '')}</b></div>
        <div id="drawWrap">
          <canvas id="drawCanvas"></canvas>
          <div class="draw-tools" id="drawTools"></div>
        </div>`;
      this.bindDraw();

    } else if (m.s === 'tetris') {
      pad.innerHTML = msgBar + `<div class="tetris-pad">
        <button data-btn="L" data-rep="130">◀</button>
        <button data-btn="ROT">⟳</button>
        <button data-btn="R" data-rep="130">▶</button>
        <button data-btn="SD" data-rep="70">▼</button>
        <button data-btn="HD">⤓<br><small style="font-size:11px">DROP</small></button>
        <button data-btn="ROT">⟳</button>
      </div>`;
      this.bindButtons();
    }
  },

  quizUpdate(m) {
    if (this.scheme !== 'quiz') return;
    document.querySelectorAll('.quiz-btn').forEach((b, i) => {
      if (m.labels && m.labels[i] !== undefined) b.textContent = m.labels[i];
      b.disabled = false;
    });
    const bar = document.getElementById('padMsg');
    if (bar && m.msg !== undefined) bar.textContent = m.msg;
  },

  // ---------- input plumbing ----------
  bindButtons(opts = {}) {
    document.querySelectorAll('#pad [data-btn]').forEach(el => {
      let repT = null;
      const fire = () => {
        this.send({ t: 'btn', b: isNaN(+el.dataset.btn) ? el.dataset.btn : +el.dataset.btn });
        if (navigator.vibrate) navigator.vibrate(12);
      };
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (el.disabled) return;
        fire();
        el.classList.add('down');
        if (opts.once) document.querySelectorAll('#pad [data-btn]').forEach(b => b.disabled = true);
        const rep = +el.dataset.rep;
        if (rep) repT = setInterval(fire, rep);
      });
      const up = () => { el.classList.remove('down'); if (repT) { clearInterval(repT); repT = null; } };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('pointerleave', up);
    });
  },

  bindStick() {
    // fixed joystick with a visible base, like a real console stick
    const zone = document.getElementById('stickZone');
    const base = document.getElementById('stickBase2');
    const nub = document.getElementById('stickNub2');
    let active = null;
    const R = 52;
    const center = () => {
      const r = base.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    const apply = (e) => {
      const c = center();
      let dx = e.clientX - c.x, dy = e.clientY - c.y;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      nub.style.transform = `translate(${dx}px, ${dy}px)`;
      this.stick.x = +(dx / R).toFixed(2);
      this.stick.y = +(dy / R).toFixed(2);
    };
    zone.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      active = e.pointerId;
      zone.setPointerCapture(e.pointerId);
      nub.classList.add('live');
      apply(e);
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== active) return;
      apply(e);
    });
    const end = (e) => {
      if (e.pointerId !== active) return;
      active = null;
      nub.classList.remove('live');
      nub.style.transform = '';
      this.stick.x = 0; this.stick.y = 0;
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  },

  pumpStick() {
    // keyboard → stick
    if (['stick', 'stick1', 'stick2'].includes(this.scheme)) {
      const k = this.keys;
      let kx = (k.ArrowRight || k.KeyD ? 1 : 0) - (k.ArrowLeft || k.KeyA ? 1 : 0);
      let ky = (k.ArrowDown || k.KeyS ? 1 : 0) - (k.ArrowUp || k.KeyW ? 1 : 0);
      if (kx || ky) { const d = Math.hypot(kx, ky); this.stick.x = kx / d; this.stick.y = ky / d; }
    }
    if (this.stick.x !== this.lastSent.x || this.stick.y !== this.lastSent.y) {
      this.lastSent = { ...this.stick };
      this.send({ t: 'in', x: this.stick.x, y: this.stick.y });
    }
  },

  key(e, down) {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    this.keys[e.code] = down;
    if (!down || e.repeat) return;
    const s = this.scheme;
    if (!s || s === 'wait' || s === '3d') return;
    if (e.code === 'Space' || e.code === 'Enter') this.send({ t: 'btn', b: s === 'tap' ? 'tap' : 'a' });
    else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.send({ t: 'btn', b: 'b' });
    else if (s === 'quiz' && ['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) this.send({ t: 'btn', b: +e.code.slice(-1) - 1 });
    else if (s === 'dpad1') {
      const map = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', KeyW: 'u', KeyS: 'd', KeyA: 'l', KeyD: 'r' };
      if (map[e.code]) this.send({ t: 'btn', b: map[e.code] });
    } else if (s === 'tetris') {
      const map = { ArrowLeft: 'L', ArrowRight: 'R', ArrowUp: 'ROT', ArrowDown: 'SD', Space: 'HD' };
      if (map[e.code]) this.send({ t: 'btn', b: map[e.code] });
    }
  },

  // ---------- camera avatar (PlayStation-style player card) ----------
  async toggleCam() {
    const btn = document.getElementById('camBtn');
    if (this.cam.on) {
      this.cam.on = false;
      clearInterval(this.cam.timer);
      if (this.cam.stream) this.cam.stream.getTracks().forEach(t => t.stop());
      this.cam.stream = null;
      this.send({ t: 'cam', img: null });
      btn.classList.remove('on');
      this.applyLang();
      return;
    }
    try {
      this.cam.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 320, height: 320 } });
    } catch (e) {
      btn.textContent = e.name === 'NotAllowedError' ? 'Camera blocked' : 'No camera';
      return;
    }
    const video = document.getElementById('camVideo');
    video.srcObject = this.cam.stream;
    await video.play();
    this.cam.on = true;
    btn.classList.add('on');
    this.applyLang();
    const cvs = document.createElement('canvas');
    cvs.width = 96; cvs.height = 96;
    const snap = () => {
      if (!this.cam.on || !video.videoWidth) return;
      const c = cvs.getContext('2d');
      const s = Math.min(video.videoWidth, video.videoHeight);
      c.save();
      c.translate(96, 0); c.scale(-1, 1); // mirror like a selfie
      c.drawImage(video, (video.videoWidth - s) / 2, (video.videoHeight - s) / 2, s, s, 0, 0, 96, 96);
      c.restore();
      this.send({ t: 'cam', img: cvs.toDataURL('image/jpeg', 0.55) });
    };
    setTimeout(snap, 600);
    this.cam.timer = setInterval(snap, 4000);
  },

  // ---------- drawing (Draw & Guess) ----------
  bindDraw() {
    const canvas = document.getElementById('drawCanvas');
    const tools = document.getElementById('drawTools');
    const colors = ['#111111', '#ff4655', '#2f9bff', '#2fd573', '#ffcf3f', '#8e5a2f'];
    let color = colors[0];
    tools.innerHTML = colors.map((c, i) =>
      `<button data-c="${c}" class="${i === 0 ? 'sel' : ''}" style="background:${c}"></button>`).join('') +
      `<button data-clear="1" style="background:#fff;color:#111;font-size:11px;font-weight:800">CLR</button>`;
    tools.querySelectorAll('button').forEach(b => {
      b.onclick = () => {
        if (b.dataset.clear) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          this.send({ t: 'stroke', clear: true });
          return;
        }
        color = b.dataset.c;
        tools.querySelectorAll('button').forEach(x => x.classList.remove('sel'));
        b.classList.add('sel');
      };
    });
    const fit = () => { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; };
    setTimeout(fit, 50);
    const ctx = canvas.getContext('2d');
    let drawing = false, batch = [], last = null;
    const norm = (e) => {
      const r = canvas.getBoundingClientRect();
      return [+( (e.clientX - r.left) / r.width ).toFixed(3), +(((e.clientY - r.top)) / r.height).toFixed(3)];
    };
    const flush = () => {
      if (batch.length > 1) this.send({ t: 'stroke', pts: batch, c: color });
      batch = last ? [last] : [];
    };
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault(); drawing = true;
      canvas.setPointerCapture(e.pointerId);
      last = norm(e); batch = [last];
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      const pt = norm(e);
      ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(last[0] * canvas.width, last[1] * canvas.height);
      ctx.lineTo(pt[0] * canvas.width, pt[1] * canvas.height);
      ctx.stroke();
      last = pt; batch.push(pt);
      if (batch.length >= 8) flush();
    });
    const up = () => { if (drawing) { drawing = false; flush(); last = null; batch = []; } };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  },
};

Ctrl.init();
