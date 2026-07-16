// Kart Dash — a real circuit with sweepers, a chicane and two hairpins.
// Waypoint-based track, skid marks, live position board, nitro.
registerGame({
  id: 'race', title: 'Kart Dash', icon: 'race', desc: 'A twisty circuit with hairpins and a chicane. NITRO on the straights. First to 3 laps.',
  players: '1-8', minPlayers: 1, LAPS: 3, TIME: 210,
  // hand-placed circuit centerline (closed loop, clockwise from start/finish)
  WP: [
    [300, 620], [560, 640], [820, 640], [1040, 600], [1170, 480], [1150, 330],
    [1020, 240], [880, 280], [790, 360], [660, 330], [610, 210], [460, 150],
    [300, 170], [175, 260], [130, 400], [170, 540],
  ],
  HW: 58, // road half-width
  S: null,
  init(G) {
    G.setScheme(null, 'stick1', { a: T('nitro') });
    const S = this.S = { karts: new Map(), finished: [], finishedAt: 0, skid: null };
    // persistent skid-mark layer
    S.skid = document.createElement('canvas');
    S.skid.width = 1280; S.skid.height = 720;
    const start = this.WP[0];
    const dir = this.segDir(0);
    const px = -dir[1], py = dir[0];
    G.players.forEach((p, i) => {
      const row = Math.floor(i / 2), side = i % 2 ? 1 : -1;
      S.karts.set(p.pid, {
        x: start[0] - dir[0] * (30 + row * 46), y: start[1] - dir[1] * (30 + row * 46) + py * side * 22 * (px ? 1 : 1),
        a: Math.atan2(dir[1], dir[0]), v: 0, lap: 0, wp: 0, nitro: 0, done: false, progress: 0, offroad: false,
      });
    });
  },
  segDir(i) {
    const a = this.WP[i], b = this.WP[(i + 1) % this.WP.length];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[0] - a[0]) / d, (b[1] - a[1]) / d];
  },
  // distance from point to the track centerline
  trackDist(x, y) {
    let best = 1e9;
    for (let i = 0; i < this.WP.length; i++) {
      const a = this.WP[i], b = this.WP[(i + 1) % this.WP.length];
      const L2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
      const t = clamp(((x - a[0]) * (b[0] - a[0]) + (y - a[1]) * (b[1] - a[1])) / L2, 0, 1);
      const d = dist(x, y, a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]));
      if (d < best) best = d;
    }
    return best;
  },
  onBtn(p, b, G) {
    const k = this.S.karts.get(p.pid);
    if (k && b === 'a' && k.nitro <= 0 && !k.done) { k.nitro = 3; k.v += 170; G.vib(p, 80); }
  },
  update(dt, G) {
    const S = this.S;
    const skidCtx = S.skid.getContext('2d');
    for (const p of G.players) {
      const k = S.karts.get(p.pid);
      if (!k || k.done) continue;
      k.nitro -= dt;
      const mag = Math.hypot(p.in.x, p.in.y);
      let turning = 0;
      if (mag > 0.25) {
        const target = Math.atan2(p.in.y, p.in.x);
        let d = target - k.a;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        turning = clamp(d, -3.6 * dt, 3.6 * dt);
        k.a += turning;
        k.v += 310 * dt * mag;
      } else {
        k.v -= 270 * dt;
      }
      k.offroad = this.trackDist(k.x, k.y) > this.HW;
      const max = (k.nitro > 2 ? 430 : 285) * (k.offroad ? 0.4 : 1);
      k.v = clamp(k.v, 0, max);
      k.x = clamp(k.x + Math.cos(k.a) * k.v * dt, 16, 1264);
      k.y = clamp(k.y + Math.sin(k.a) * k.v * dt, 16, 704);
      // skid marks on hard turns at speed
      if (Math.abs(turning) > 2.4 * dt && k.v > 180 && !k.offroad) {
        skidCtx.strokeStyle = 'rgba(10,10,12,.28)';
        skidCtx.lineWidth = 3;
        for (const side of [-1, 1]) {
          const sx = k.x - Math.cos(k.a) * 10 - Math.sin(k.a) * 8 * side;
          const sy = k.y - Math.sin(k.a) * 10 + Math.cos(k.a) * 8 * side;
          skidCtx.beginPath(); skidCtx.moveTo(sx, sy); skidCtx.lineTo(sx - Math.cos(k.a) * 6, sy - Math.sin(k.a) * 6); skidCtx.stroke();
        }
      }
      if (k.offroad && k.v > 60) Draw2.trail(k.x - Math.cos(k.a) * 14, k.y - Math.sin(k.a) * 14, '#4a5c33', 3, 0.35);
      if (k.nitro > 2) Draw2.trail(k.x - Math.cos(k.a) * 20, k.y - Math.sin(k.a) * 20, '#ff8c3a', 4, 0.3);
      // waypoint progress
      const next = this.WP[(k.wp + 1) % this.WP.length];
      if (dist(k.x, k.y, next[0], next[1]) < 95) {
        k.wp = (k.wp + 1) % this.WP.length;
        if (k.wp === 0) {
          k.lap++;
          if (k.lap >= this.LAPS) {
            k.done = true;
            S.finished.push(p.pid);
            Draw2.boom(k.x, k.y, p.color, 24, 300, 0.9);
            AudioSys.sfx('goal');
            G.vib(p, 300);
            G.toast(T('finishedToast', p.name, S.finished.length));
          }
        }
      }
      k.progress = k.lap * this.WP.length + k.wp;
    }
    const racing = G.players.filter(p => !p.gone && !S.karts.get(p.pid).done);
    if (S.finished.length && !S.finishedAt) S.finishedAt = G.time;
    if (!racing.length || G.time > this.TIME || (S.finishedAt && G.time - S.finishedAt > 30)) {
      return this.gameOver(G);
    }
  },
  gameOver(G) {
    const S = this.S;
    const rows = [
      ...S.finished.map((pid, i) => ({ pid, label: T('finishedN', i + 1) })),
      ...[...S.karts.entries()].filter(([pid]) => !S.finished.includes(pid))
        .sort((a, b) => b[1].progress - a[1].progress)
        .map(([pid, k]) => ({ pid, label: `${T('lap')} ${Math.min(k.lap + 1, this.LAPS)}` })),
    ];
    G.finish(rows);
  },
  roadPath(ctx) {
    ctx.beginPath();
    const W = this.WP;
    ctx.moveTo((W[0][0] + W[W.length - 1][0]) / 2, (W[0][1] + W[W.length - 1][1]) / 2);
    for (let i = 0; i < W.length; i++) {
      const cur = W[i], nxt = W[(i + 1) % W.length];
      ctx.quadraticCurveTo(cur[0], cur[1], (cur[0] + nxt[0]) / 2, (cur[1] + nxt[1]) / 2);
    }
    ctx.closePath();
  },
  draw(ctx, G) {
    const S = this.S;
    // grass
    Draw2.bg(ctx, G, '#12401f', '#0d3418');
    ctx.fillStyle = 'rgba(255,255,255,.025)';
    for (let i = 0; i < 90; i++) ctx.fillRect((i * 197) % 1280, (i * 89) % 720, 2.5, 2.5);
    // infield trees
    for (const [tx, ty, tr] of [[420, 420, 26], [520, 470, 20], [900, 460, 24], [340, 300, 18], [960, 130, 16], [80, 130, 20], [1220, 640, 18]]) {
      Draw2.dropShadow(ctx, tx + 4, ty + 8, tr);
      const tg = ctx.createRadialGradient(tx - tr * 0.3, ty - tr * 0.3, 2, tx, ty, tr);
      tg.addColorStop(0, '#3f8f47'); tg.addColorStop(1, '#1c5426');
      ctx.fillStyle = tg;
      ctx.beginPath(); ctx.arc(tx, ty, tr, 0, 7); ctx.fill();
    }
    // grandstand (top-left straight)
    ctx.fillStyle = '#232a3d';
    ctx.beginPath(); ctx.roundRect(280, 30, 260, 52, 8); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.1)';
    ctx.fillRect(288, 38, 244, 8);
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = ['#ff4655', '#2f9bff', '#ffcf3f', '#2fd573', '#b06cff'][i % 5];
      ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.arc(296 + i * 8, 58 + (i % 3) * 7, 2.6, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // road: dark outline, asphalt, skids, kerbs, centerline
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    this.roadPath(ctx);
    ctx.strokeStyle = '#15171c'; ctx.lineWidth = this.HW * 2 + 14; ctx.stroke();
    this.roadPath(ctx);
    const ag = ctx.createLinearGradient(0, 0, 0, 720);
    ag.addColorStop(0, '#3c4048'); ag.addColorStop(1, '#33363e');
    ctx.strokeStyle = ag; ctx.lineWidth = this.HW * 2; ctx.stroke();
    // red/white kerbs on the edges
    ctx.save();
    this.roadPath(ctx);
    ctx.setLineDash([16, 16]);
    ctx.strokeStyle = '#c8352b'; ctx.lineWidth = this.HW * 2 + 6; ctx.stroke();
    ctx.lineDashOffset = 16;
    ctx.strokeStyle = '#e8e8e8'; ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    this.roadPath(ctx);
    ctx.strokeStyle = ag; ctx.lineWidth = this.HW * 2 - 6; ctx.stroke();
    // skid layer clipped to road
    ctx.drawImage(S.skid, 0, 0);
    // dashed centerline
    this.roadPath(ctx);
    ctx.setLineDash([22, 26]);
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 4; ctx.stroke();
    ctx.setLineDash([]);
    // start/finish checker
    const sf = this.WP[0], d0 = this.segDir(0);
    ctx.save();
    ctx.translate(sf[0], sf[1]);
    ctx.rotate(Math.atan2(d0[1], d0[0]));
    for (let i = 0; i < Math.floor(this.HW * 2 / 12); i++) {
      for (let j = 0; j < 3; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#111' : '#eee';
        ctx.fillRect(-13 + j * 9, -this.HW + i * 12, 9, 12);
      }
    }
    ctx.restore();
    // karts
    for (const p of G.players) {
      const k = S.karts.get(p.pid);
      if (!k) continue;
      Draw2.dropShadow(ctx, k.x, k.y + 12, 16);
      ctx.save();
      ctx.translate(k.x, k.y); ctx.rotate(k.a);
      if (k.nitro > 2) {
        const fl = ctx.createLinearGradient(-16, 0, -36, 0);
        fl.addColorStop(0, 'rgba(255,200,80,.95)');
        fl.addColorStop(1, 'rgba(255,80,20,0)');
        ctx.fillStyle = fl;
        ctx.beginPath(); ctx.moveTo(-15, -5); ctx.lineTo(-36 - Math.random() * 6, 0); ctx.lineTo(-15, 5); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#15171b';
      for (const [tx, ty] of [[-11, -13], [7, -13], [-11, 8], [7, 8]]) { ctx.beginPath(); ctx.roundRect(tx, ty, 9, 6, 2); ctx.fill(); }
      const bg = ctx.createLinearGradient(0, -10, 0, 10);
      bg.addColorStop(0, Draw2.lighten(p.color, 0.35));
      bg.addColorStop(0.5, p.color);
      bg.addColorStop(1, Draw2.darken(p.color, 0.4));
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.roundRect(-15, -9, 32, 18, 6); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = Draw2.darken(p.color, 0.2);
      ctx.beginPath(); ctx.moveTo(17, -6); ctx.lineTo(24, 0); ctx.lineTo(17, 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(140,200,255,.9)';
      ctx.beginPath(); ctx.ellipse(2, 0, 5.5, 4.5, 0, 0, 7); ctx.fill();
      ctx.restore();
      Draw2.tag(ctx, p, k.x, k.y - 26, k.done ? '· FIN' : `· ${T('lap')} ${Math.min(k.lap + 1, this.LAPS)}`);
    }
    // live position board
    const order = [
      ...S.finished.map(pid => ({ pid, done: true })),
      ...[...S.karts.entries()].filter(([pid]) => !S.finished.includes(pid))
        .sort((a, b) => b[1].progress - a[1].progress).map(([pid]) => ({ pid, done: false })),
    ];
    Draw2.panel(ctx, 18, 60, 172, order.length * 30 + 20, 12);
    order.forEach((o, i) => {
      const p = G.players.find(q => q.pid === o.pid);
      if (!p) return;
      const y = 84 + i * 30;
      Draw2.label(ctx, 'P' + (i + 1), 40, y, 13, i === 0 ? '#ffcf3f' : '#8b94ad');
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(62, y, 6, 0, 7); ctx.fill();
      Draw2.label(ctx, p.name.slice(0, 10) + (o.done ? ' FIN' : ''), 74, y, 12.5, '#fff', 'left');
    });
    Draw2.vignette(ctx, G, 0.32);
    Draw2.timer(ctx, G, this.TIME - G.time, this.TIME);
  },
});
