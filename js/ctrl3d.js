// Ctrl3D — first-person 3D client that runs ON THE PLAYER'S DEVICE for
// CraftWorld (minecraft) and Obby Rush. The phone shows your own 3D view;
// the console shows the spectator/overview. Positions sync through the host.
const Ctrl3D = {
  running: false,
  renderer: null, scene: null, camera: null,
  mode: null, world: null, course: null,
  pos: null, vel: null, yaw: 0, pitch: 0, onGround: false,
  peers: new Map(),
  sendFn: null, me: null,
  keys: {}, stick: { x: 0, y: 0 }, jumpQueued: false,
  hotbarSel: 0, cpIndex: 0, finished: false,
  lastNet: 0, raf: 0, lastTs: 0,

  start(msg, send, me) {
    this.stop();
    this.running = true;
    this.mode = msg.mode;
    this.sendFn = send;
    this.me = me || { slot: 0, color: '#fff' };
    this.peers = new Map();
    this.yaw = 0; this.pitch = 0;
    this.vel = { x: 0, y: 0, z: 0 };
    this.finished = false; this.cpIndex = 0;

    const canvas = document.getElementById('c3d');
    if (!this.renderer) {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
      this.renderer.setPixelRatio(Math.min(1.6, window.devicePixelRatio));
    }
    this.scene = E3D.makeScene(this.mode === 'obby' ? 0xe89b6a : 0x87b7e8);
    this.camera = new THREE.PerspectiveCamera(78, 1, 0.1, 300);
    this.resize();
    window.addEventListener('resize', this._rs = () => this.resize());

    if (this.mode === 'minecraft') {
      this.world = new E3D.World(msg.seed);
      for (const [x, y, z, id] of (msg.edits || [])) this.world.set(x, y, z, id);
      this.world.buildAll(this.scene);
      const slot = this.me.slot || 0;
      const sx = 16 + (slot % 4) * 5, sz = 16 + Math.floor(slot / 4) * 5;
      this.pos = { x: sx + 0.5, y: this.world.topY(sx, sz) + 1.05, z: sz + 0.5 };
      this.yaw = Math.PI / 4;
    } else {
      this.course = E3D.obbyCourse(msg.seed);
      E3D.obbyBoxMeshes(this.course, this.scene);
      this.pos = { x: 0, y: 0.05, z: 0 };
    }
    this.buildUI();
    this.bindInput();
    this.lastTs = 0;
    this.raf = requestAnimationFrame((t) => this.loop(t));
  },

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    if (this._rs) window.removeEventListener('resize', this._rs);
    if (document.pointerLockElement) document.exitPointerLock();
    if (this.scene) { this.scene.clear(); this.scene = null; }
    this.world = null; this.course = null;
    const ui = document.getElementById('c3dUi');
    if (ui) ui.innerHTML = '';
  },

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  },

  // ---------- UI ----------
  buildUI() {
    const ui = document.getElementById('c3dUi');
    const mc = this.mode === 'minecraft';
    ui.innerHTML = `
      <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);color:#fff;font-size:22px;text-shadow:0 0 4px #000;pointer-events:none">+</div>
      <div id="c3dMsg" style="position:absolute;top:${mc ? 64 : 10}px;left:0;right:0;text-align:center;color:#fff;font-size:13px;text-shadow:0 1px 3px #000;pointer-events:none"></div>
      <button class="c3d-btn" id="jumpBtn" style="right:18px;bottom:24px">JUMP</button>
      ${mc ? `
        <button class="c3d-btn" id="breakBtn" style="right:118px;bottom:70px;width:70px;height:70px">MINE</button>
        <button class="c3d-btn" id="placeBtn" style="right:34px;bottom:124px;width:70px;height:70px">BUILD</button>
        <div class="hotbar" id="hotbar"></div>` : ''}
    `;
    const hold = (id, fn) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(); });
    };
    hold('jumpBtn', () => { this.jumpQueued = true; });
    if (mc) {
      hold('breakBtn', () => this.dig(0));
      hold('placeBtn', () => this.dig(1));
      const hb = document.getElementById('hotbar');
      hb.innerHTML = E3D.HOTBAR.map((id, i) =>
        `<button data-i="${i}" class="${i === 0 ? 'sel' : ''}" style="background:#${E3D.BLOCKS[id].c.toString(16).padStart(6, '0')}"></button>`).join('');
      hb.querySelectorAll('button').forEach(b => {
        b.addEventListener('pointerdown', (e) => {
          e.preventDefault(); e.stopPropagation();
          this.hotbarSel = +b.dataset.i;
          hb.querySelectorAll('button').forEach(x => x.classList.remove('sel'));
          b.classList.add('sel');
        });
      });
      this.msg('Drag right side to look · left side to move · MINE breaks · BUILD places');
    } else {
      this.msg('Race to the gold platform. Green = checkpoint. Don\'t touch the lava.');
    }
  },
  msg(t) {
    const el = document.getElementById('c3dMsg');
    if (el) el.textContent = t;
  },

  // ---------- input ----------
  bindInput() {
    const canvas = document.getElementById('c3d');
    if (this._bound) return;
    this._bound = true;
    let moveId = null, lookId = null, mx = 0, my = 0, lx = 0, ly = 0;
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (e.pointerType === 'mouse') {
        if (!document.pointerLockElement) canvas.requestPointerLock();
        else if (this.mode === 'minecraft') this.dig(e.button === 2 ? 1 : 0);
        return;
      }
      if (e.clientX < window.innerWidth * 0.42 && moveId === null) {
        moveId = e.pointerId; mx = e.clientX; my = e.clientY;
      } else if (lookId === null) {
        lookId = e.pointerId; lx = e.clientX; ly = e.clientY;
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.running) return;
      if (e.pointerId === moveId) {
        this.stick.x = clamp((e.clientX - mx) / 55, -1, 1);
        this.stick.y = clamp((e.clientY - my) / 55, -1, 1);
      } else if (e.pointerId === lookId) {
        this.yaw -= (e.clientX - lx) * 0.006;
        this.pitch = clamp(this.pitch - (e.clientY - ly) * 0.006, -1.45, 1.45);
        lx = e.clientX; ly = e.clientY;
      } else if (e.pointerType === 'mouse' && document.pointerLockElement) {
        this.yaw -= e.movementX * 0.0026;
        this.pitch = clamp(this.pitch - e.movementY * 0.0026, -1.45, 1.45);
      }
    });
    const up = (e) => {
      if (e.pointerId === moveId) { moveId = null; this.stick.x = 0; this.stick.y = 0; }
      if (e.pointerId === lookId) lookId = null;
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (this.running && e.code === 'Space') { this.jumpQueued = true; e.preventDefault(); }
      if (this.running && this.mode === 'minecraft' && /Digit[1-6]/.test(e.code)) {
        this.hotbarSel = +e.code.slice(-1) - 1;
        document.querySelectorAll('#hotbar button').forEach((b, i) => b.classList.toggle('sel', i === this.hotbarSel));
      }
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
  },

  dig(place) {
    if (!this.world) return;
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    const eye = { x: this.pos.x, y: this.pos.y + 1.62, z: this.pos.z };
    const r = this.world.raycast(eye, dir, 6);
    if (!r) return;
    if (place) {
      if (!r.prev) return;
      const [x, y, z] = r.prev;
      // don't place a block inside yourself
      if (Math.abs(x + 0.5 - this.pos.x) < 0.8 && y > this.pos.y - 1 && y < this.pos.y + 1.9 && Math.abs(z + 0.5 - this.pos.z) < 0.8) return;
      const id = E3D.HOTBAR[this.hotbarSel];
      if (this.world.applyEdit(x, y, z, id)) this.sendFn({ t: 'blk', x, y, z, id });
    } else {
      const [x, y, z] = r.hit;
      if (y === 0) return; // keep the bedrock layer
      if (this.world.applyEdit(x, y, z, 0)) this.sendFn({ t: 'blk', x, y, z, id: 0 });
    }
    if (navigator.vibrate) navigator.vibrate(15);
  },

  // ---------- network ----------
  onMsg(m) {
    if (!this.running) return;
    if (m.t === 'pp') {
      let av = this.peers.get(m.pid);
      if (!av) {
        av = { group: E3D.makeAvatar(new THREE.Color(m.color || '#fff').getHex(), m.name), tx: 0, ty: 0, tz: 0, ry: 0 };
        this.scene.add(av.group);
        this.peers.set(m.pid, av);
      }
      av.tx = m.p[0]; av.ty = m.p[1]; av.tz = m.p[2]; av.ry = m.ry || 0;
    } else if (m.t === 'pgone') {
      const av = this.peers.get(m.pid);
      if (av) { this.scene.remove(av.group); this.peers.delete(m.pid); }
    } else if (m.t === 'blk' && this.world) {
      this.world.applyEdit(m.x, m.y, m.z, m.id);
    }
  },

  // ---------- main loop ----------
  loop(ts) {
    if (!this.running) return;
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000 || 0.016);
    this.lastTs = ts;

    // keyboard movement
    let ix = this.stick.x, iy = this.stick.y;
    const k = this.keys;
    if (k.KeyW || k.ArrowUp) iy = -1;
    if (k.KeyS || k.ArrowDown) iy = 1;
    if (k.KeyA || k.ArrowLeft) ix = -1;
    if (k.KeyD || k.ArrowRight) ix = 1;

    const SPEED = this.mode === 'obby' ? 6.2 : 5.4;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const wishX = (ix * cos - iy * sin) * SPEED;
    const wishZ = (-iy * cos - ix * sin) * SPEED;

    this.vel.y -= 24 * dt;
    if (this.jumpQueued) {
      if (this.onGround) this.vel.y = 8.6;
      this.jumpQueued = false;
    }

    if (this.mode === 'minecraft') {
      this.vel.x = wishX; this.vel.z = wishZ;
      const w = this.world;
      const solid = (x, y, z) => (y < 0) || (x >= 0 && x < w.sx && z >= 0 && z < w.sz && y < w.sy && w.get(x, y, z) !== 0);
      this.onGround = E3D.moveAABB(this.pos, this.vel, dt, { w: 0.6, h: 1.8 }, solid);
      // keep inside the island
      this.pos.x = clamp(this.pos.x, 0.4, w.sx - 0.4);
      this.pos.z = clamp(this.pos.z, 0.4, w.sz - 0.4);
      if (this.pos.y < -8) { this.pos.y = w.topY(Math.floor(this.pos.x), Math.floor(this.pos.z)) + 1.1; this.vel.y = 0; }
    } else {
      E3D.obbyTick(this.course, ts / 1000);
      const onIce = this.groundKind === 'ice';
      if (onIce) {
        this.vel.x = lerp(this.vel.x, wishX, dt * 1.6);
        this.vel.z = lerp(this.vel.z, wishZ, dt * 1.6);
      } else {
        this.vel.x = wishX; this.vel.z = wishZ;
      }
      const res = E3D.moveBoxes(this.pos, this.vel, dt, { w: 0.6, h: 1.8 }, this.course.boxes);
      this.onGround = res.onGround;
      this.groundKind = res.ground ? res.ground.kind : null;
      // carried by moving platforms
      if (res.ground && res.ground.move) {
        this.pos.x += res.ground.x - (res.ground.prevX !== undefined ? res.ground.prevX : res.ground.x);
        this.pos.y += res.ground.y - (res.ground.prevY !== undefined ? res.ground.prevY : res.ground.y);
      }
      if (res.ground) {
        if (res.ground.kind === 'cp') {
          const i = this.course.checkpoints.findIndex(c => Math.abs(c.z - res.ground.z) < 3);
          if (i > this.cpIndex) { this.cpIndex = i; this.msg('Checkpoint ' + i + ' reached'); if (navigator.vibrate) navigator.vibrate(80); }
        } else if (res.ground.kind === 'finish' && !this.finished) {
          this.finished = true;
          this.msg('YOU FINISHED — check the TV for standings.');
          this.sendFn({ t: 'fin' });
          if (navigator.vibrate) navigator.vibrate([100, 60, 100, 60, 200]);
        }
      }
      // lava / falling
      if (this.pos.y < -6) {
        const cp = this.course.checkpoints[this.cpIndex];
        this.pos = { x: cp.x, y: cp.y + 0.6, z: cp.z };
        this.vel = { x: 0, y: 0, z: 0 };
        this.msg('Into the lava — back to checkpoint ' + this.cpIndex);
        if (navigator.vibrate) navigator.vibrate(200);
      }
    }

    // camera
    this.camera.position.set(this.pos.x, this.pos.y + 1.62, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

    // interpolate peer avatars
    for (const av of this.peers.values()) {
      av.group.position.x = lerp(av.group.position.x, av.tx, dt * 10);
      av.group.position.y = lerp(av.group.position.y, av.ty, dt * 10);
      av.group.position.z = lerp(av.group.position.z, av.tz, dt * 10);
      av.group.rotation.y = av.ry;
    }

    // network updates ~12 Hz
    if (ts - this.lastNet > 85) {
      this.lastNet = ts;
      this.sendFn({ t: 'p3', p: [+this.pos.x.toFixed(2), +this.pos.y.toFixed(2), +this.pos.z.toFixed(2)], ry: +this.yaw.toFixed(2) });
    }

    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame((t) => this.loop(t));
  },
};
