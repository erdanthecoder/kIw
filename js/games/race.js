// Kart Dash — top-down oval racing, 3 laps, nitro button.
registerGame({
  id: 'race', title: 'Kart Dash', icon: 'race', desc: 'Steer around the track, hit NITRO on straights. First to 3 laps.',
  players: '1-8', minPlayers: 1, LAPS: 3, TIME: 180,
  CX: 640, CY: 370, RX: 520, RY: 270, IRX: 280, IRY: 120,
  S: null,
  init(G) {
    G.setScheme(null, 'stick1', { a: 'NITRO' });
    const S = this.S = { karts: new Map(), finished: [], finishedAt: 0 };
    G.players.forEach((p, i) => {
      S.karts.set(p.pid, {
        x: this.CX - 30 - (i % 4) * 42, y: this.CY + (this.RY + this.IRY) / 2 + (i < 4 ? -22 : 22),
        a: -Math.PI / 2, v: 0, lap: 0, cp: 0, nitro: 0, done: false, progress: 0,
      });
    });
  },
  onTrack(x, y) {
    const dxO = (x - this.CX) / this.RX, dyO = (y - this.CY) / this.RY;
    const dxI = (x - this.CX) / this.IRX, dyI = (y - this.CY) / this.IRY;
    return dxO * dxO + dyO * dyO <= 1 && dxI * dxI + dyI * dyI >= 1;
  },
  checkpointOf(x, y) {
    let ang = Math.atan2(y - this.CY, x - this.CX);
    return ((Math.floor((-ang + Math.PI / 2) / (Math.PI / 4)) % 8) + 8) % 8;
  },
  onBtn(p, b, G) {
    const k = this.S.karts.get(p.pid);
    if (k && b === 'a' && k.nitro <= 0 && !k.done) { k.nitro = 3; k.v += 180; G.vib(p, 80); }
  },
  update(dt, G) {
    const S = this.S;
    for (const p of G.players) {
      const k = S.karts.get(p.pid);
      if (!k || k.done) continue;
      k.nitro -= dt;
      const mag = Math.hypot(p.in.x, p.in.y);
      if (mag > 0.25) {
        const target = Math.atan2(p.in.y, p.in.x);
        let d = target - k.a;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        k.a += clamp(d, -3.4 * dt, 3.4 * dt);
        k.v += 300 * dt * mag;
      } else {
        k.v -= 260 * dt;
      }
      const onT = this.onTrack(k.x, k.y);
      const max = (k.nitro > 2 ? 420 : 280) * (onT ? 1 : 0.42);
      k.v = clamp(k.v, 0, max);
      k.x = clamp(k.x + Math.cos(k.a) * k.v * dt, 20, 1260);
      k.y = clamp(k.y + Math.sin(k.a) * k.v * dt, 20, 700);
      if (k.nitro > 2) Draw2.trail(k.x - Math.cos(k.a) * 20, k.y - Math.sin(k.a) * 20, '#ff8c3a', 4, 0.3);
      const cp = this.checkpointOf(k.x, k.y);
      if (cp === (k.cp + 1) % 8) {
        k.cp = cp;
        if (cp === 0) {
          k.lap++;
          if (k.lap >= this.LAPS) {
            k.done = true;
            S.finished.push(p.pid);
            Draw2.boom(k.x, k.y, p.color, 24, 300, 0.9);
            G.vib(p, 300);
            G.toast(`${p.name} finished #${S.finished.length}`);
          }
        }
      }
      k.progress = k.lap * 8 + k.cp;
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
      ...S.finished.map((pid, i) => ({ pid, label: 'finished #' + (i + 1) })),
      ...[...S.karts.entries()].filter(([pid]) => !S.finished.includes(pid))
        .sort((a, b) => b[1].progress - a[1].progress)
        .map(([pid, k]) => ({ pid, label: `lap ${Math.min(k.lap + 1, this.LAPS)}` })),
    ];
    G.finish(rows);
  },
  ellipsePath(ctx, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(this.CX, this.CY, rx, ry, 0, 0, Math.PI * 2);
  },
  draw(ctx, G) {
    const S = this.S;
    // grass with mow rings
    Draw2.bg(ctx, G, '#0d3a1c', '#0a3018');
    ctx.strokeStyle = 'rgba(255,255,255,.03)';
    ctx.lineWidth = 24;
    for (let r = 0; r < 4; r++) { this.ellipsePath(ctx, this.RX + 60 + r * 60, this.RY + 45 + r * 45); ctx.stroke(); }
    // asphalt ring
    ctx.fillStyle = '#33363e';
    this.ellipsePath(ctx, this.RX, this.RY); ctx.fill();
    ctx.fillStyle = '#0a3018';
    this.ellipsePath(ctx, this.IRX, this.IRY); ctx.fill();
    // asphalt texture speckle
    ctx.save();
    this.ellipsePath(ctx, this.RX, this.RY);
    this.ellipsePath(ctx, this.IRX, this.IRY);
    ctx.clip('evenodd');
    ctx.fillStyle = 'rgba(255,255,255,.025)';
    for (let i = 0; i < 160; i++) {
      const a = (i * 2.4) % (Math.PI * 2), rr = 0.55 + ((i * 7919) % 100) / 220;
      ctx.fillRect(this.CX + Math.cos(a) * this.RX * rr, this.CY + Math.sin(a) * this.RY * rr, 3, 3);
    }
    // center dashed line
    ctx.setLineDash([26, 22]);
    ctx.strokeStyle = 'rgba(255,255,255,.4)';
    ctx.lineWidth = 4;
    this.ellipsePath(ctx, (this.RX + this.IRX) / 2, (this.RY + this.IRY) / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    // red/white kerbs
    for (const [rx, ry] of [[this.RX, this.RY], [this.IRX, this.IRY]]) {
      for (let a = 0; a < Math.PI * 2; a += 0.09) {
        ctx.fillStyle = Math.floor(a / 0.09) % 2 ? '#c8352b' : '#e8e8e8';
        const x = this.CX + Math.cos(a) * rx, y = this.CY + Math.sin(a) * ry;
        ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill();
      }
    }
    // start/finish checker strip
    ctx.save();
    this.ellipsePath(ctx, this.RX, this.RY);
    this.ellipsePath(ctx, this.IRX, this.IRY);
    ctx.clip('evenodd');
    const bandH = (this.RY - this.IRY);
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 3; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#111' : '#eee';
        ctx.fillRect(this.CX - 13.5 + j * 9, this.CY + this.IRY + i * (bandH / 8), 9, bandH / 8);
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
        const fl = ctx.createLinearGradient(-16, 0, -34, 0);
        fl.addColorStop(0, 'rgba(255,200,80,.95)');
        fl.addColorStop(1, 'rgba(255,80,20,0)');
        ctx.fillStyle = fl;
        ctx.beginPath(); ctx.moveTo(-15, -5); ctx.lineTo(-34 - Math.random() * 6, 0); ctx.lineTo(-15, 5); ctx.closePath(); ctx.fill();
      }
      // tires
      ctx.fillStyle = '#15171b';
      for (const [tx, ty] of [[-11, -13], [7, -13], [-11, 8], [7, 8]]) ctx.beginPath(), ctx.roundRect(tx, ty, 9, 6, 2), ctx.fill();
      // body
      const bg = ctx.createLinearGradient(0, -10, 0, 10);
      bg.addColorStop(0, Draw2.lighten(p.color, 0.35));
      bg.addColorStop(0.5, p.color);
      bg.addColorStop(1, Draw2.darken(p.color, 0.4));
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.roundRect(-15, -9, 32, 18, 6); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1.2; ctx.stroke();
      // nose cone + cockpit
      ctx.fillStyle = Draw2.darken(p.color, 0.2);
      ctx.beginPath(); ctx.moveTo(17, -6); ctx.lineTo(24, 0); ctx.lineTo(17, 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(140,200,255,.9)';
      ctx.beginPath(); ctx.ellipse(2, 0, 5.5, 4.5, 0, 0, 7); ctx.fill();
      ctx.restore();
      Draw2.tag(ctx, p, k.x, k.y - 26, k.done ? '· FIN' : '· lap ' + Math.min(k.lap + 1, this.LAPS));
    }
    Draw2.vignette(ctx, G, 0.35);
    Draw2.label(ctx, this.LAPS + ' laps — first across the line wins', G.W / 2, 700, 15, 'rgba(255,255,255,.65)');
    Draw2.timer(ctx, G, this.TIME - G.time, this.TIME);
  },
});
