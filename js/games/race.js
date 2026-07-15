// Kart Dash — top-down oval racing, 3 laps, nitro button.
registerGame({
  id: 'race', title: 'Kart Dash', icon: '🏎️', desc: 'Steer around the track, hit NITRO on straights. First to 3 laps.',
  players: '1-8', minPlayers: 1, LAPS: 3, TIME: 180,
  CX: 640, CY: 370, RX: 520, RY: 270, IRX: 280, IRY: 120,
  S: null,
  init(G) {
    G.setScheme(null, 'stick1', { a: '🔥', asub: 'NITRO' });
    const S = this.S = { karts: new Map(), finished: [] };
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
    // 8 angular checkpoints around the oval, counter-clockwise from the start line
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
      // steering: stick points where you want to go
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
      // lap counting via checkpoints
      const cp = this.checkpointOf(k.x, k.y);
      if (cp === (k.cp + 1) % 8) {
        k.cp = cp;
        if (cp === 0) {
          k.lap++;
          if (k.lap >= this.LAPS) {
            k.done = true;
            S.finished.push(p.pid);
            G.vib(p, 300);
            G.toast(`🏁 ${p.name} finished #${S.finished.length}!`);
          }
        }
      }
      k.progress = k.lap * 8 + k.cp;
    }
    const racing = G.players.filter(p => !p.gone && !S.karts.get(p.pid).done);
    if (!racing.length || G.time > this.TIME || (S.finished.length && G.time > this.TIME - 150 && racing.length && S.finishedAt && G.time - S.finishedAt > 30)) {
      return this.gameOver(G);
    }
    if (S.finished.length && !S.finishedAt) S.finishedAt = G.time;
    if (S.finishedAt && G.time - S.finishedAt > 30) return this.gameOver(G);
  },
  gameOver(G) {
    const S = this.S;
    const rows = [
      ...S.finished.map((pid, i) => ({ pid, label: '🏁 finished #' + (i + 1) })),
      ...[...S.karts.entries()].filter(([pid]) => !S.finished.includes(pid))
        .sort((a, b) => b[1].progress - a[1].progress)
        .map(([pid, k]) => ({ pid, label: `lap ${Math.min(k.lap + 1, this.LAPS)}` })),
    ];
    G.finish(rows);
  },
  draw(ctx, G) {
    const S = this.S;
    Draw2.bg(ctx, G, '#0c2413', '#123018');
    // track
    ctx.fillStyle = '#3a3f4a';
    ctx.beginPath(); ctx.ellipse(this.CX, this.CY, this.RX, this.RY, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#123018';
    ctx.beginPath(); ctx.ellipse(this.CX, this.CY, this.IRX, this.IRY, 0, 0, 7); ctx.fill();
    // start line
    ctx.save();
    ctx.beginPath(); ctx.ellipse(this.CX, this.CY, this.RX, this.RY, 0, 0, 7);
    ctx.ellipse(this.CX, this.CY, this.IRX, this.IRY, 0, 0, 7, true);
    ctx.clip();
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#fff' : '#222';
      ctx.fillRect(this.CX - 4, this.CY + this.IRY + i * ((this.RY - this.IRY) / 8), 8, (this.RY - this.IRY) / 8);
    }
    ctx.restore();
    for (const p of G.players) {
      const k = S.karts.get(p.pid);
      if (!k) continue;
      ctx.save();
      ctx.translate(k.x, k.y); ctx.rotate(k.a);
      if (k.nitro > 2) {
        ctx.fillStyle = '#ff8c3a';
        ctx.beginPath(); ctx.moveTo(-16, -5); ctx.lineTo(-30 - Math.random() * 8, 0); ctx.lineTo(-16, 5); ctx.fill();
      }
      ctx.fillStyle = p.color;
      ctx.fillRect(-14, -10, 28, 20);
      ctx.fillStyle = '#111';
      ctx.fillRect(-12, -13, 8, 5); ctx.fillRect(4, -13, 8, 5);
      ctx.fillRect(-12, 8, 8, 5); ctx.fillRect(4, 8, 8, 5);
      ctx.restore();
      Draw2.label(ctx, `${p.name} · L${Math.min(k.lap + 1, this.LAPS)}${k.done ? ' 🏁' : ''}`, k.x, k.y - 24, 12);
    }
    Draw2.label(ctx, `${this.LAPS} laps — first across wins!`, G.W / 2, 26, 18, 'rgba(255,255,255,.7)');
    Draw2.timer(ctx, G, this.TIME - G.time);
  },
});
