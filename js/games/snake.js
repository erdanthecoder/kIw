// Snake.io — steer your snake, eat glow orbs, don't hit other snakes.
registerGame({
  id: 'snake', title: 'Snake.io', icon: 'snake', desc: 'Steer with the joystick, eat orbs to grow. Crashing drops your orbs.',
  players: '1-8', minPlayers: 1, TIME: 150,
  S: null,
  init(G) {
    G.setScheme(null, 'stick', { msg: T('steerSnake') });
    const S = this.S = { snakes: new Map(), food: [], pulse: 0 };
    G.players.forEach((p, i) => S.snakes.set(p.pid, this.spawn(G, i)));
    for (let i = 0; i < 45; i++) S.food.push({ x: rand(30, G.W - 30), y: rand(60, G.H - 30), r: 6, hue: irand(0, 3) });
  },
  spawn(G, i) {
    const x = 140 + (i % 4) * 320, y = i < 4 ? 180 : 540;
    const pts = [];
    for (let k = 0; k < 14; k++) pts.push({ x: x - k * 6, y });
    return { pts, dir: 0, len: 14, best: 14, alive: true, respawn: 0, speed: 150 };
  },
  update(dt, G) {
    const S = this.S;
    S.pulse += dt;
    for (const p of G.players) {
      const s = S.snakes.get(p.pid);
      if (!s) continue;
      if (!s.alive) {
        s.respawn -= dt;
        if (s.respawn <= 0 && !p.gone) Object.assign(s, this.spawn(G, p.slot));
        continue;
      }
      if (Math.hypot(p.in.x, p.in.y) > 0.25) {
        const target = Math.atan2(p.in.y, p.in.x);
        let d = target - s.dir;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        s.dir += clamp(d, -4.2 * dt, 4.2 * dt);
      }
      const head = s.pts[0];
      const boosting = Math.hypot(p.in.x, p.in.y) > 0.95;
      const boost = boosting ? 1.25 : 1;
      if (boosting) Draw2.trail(head.x, head.y, p.color, 3, 0.25);
      let nx = head.x + Math.cos(s.dir) * s.speed * boost * dt;
      let ny = head.y + Math.sin(s.dir) * s.speed * boost * dt;
      if (nx < 0) nx += G.W; if (nx > G.W) nx -= G.W;
      if (ny < 0) ny += G.H; if (ny > G.H) ny -= G.H;
      if (dist(nx, ny, head.x, head.y) > 4.5) s.pts.unshift({ x: nx, y: ny });
      else { head.x = nx; head.y = ny; }
      while (s.pts.length > s.len) s.pts.pop();

      for (let i = S.food.length - 1; i >= 0; i--) {
        if (dist(nx, ny, S.food[i].x, S.food[i].y) < 16) {
          Draw2.boom(S.food[i].x, S.food[i].y, '#ffcf3f', 6, 90, 0.35, 3);
          S.food.splice(i, 1);
          s.len += 4;
          s.best = Math.max(s.best, s.len);
          G.vib(p, 25);
          S.food.push({ x: rand(30, G.W - 30), y: rand(60, G.H - 30), r: 6, hue: irand(0, 3) });
        }
      }
      for (const [opid, o] of S.snakes) {
        if (!o.alive) continue;
        const startIdx = opid === p.pid ? 8 : 0;
        for (let i = startIdx; i < o.pts.length; i += 2) {
          if (dist(nx, ny, o.pts[i].x, o.pts[i].y) < 9) {
            s.alive = false; s.respawn = 2.5;
            Draw2.boom(nx, ny, p.color, 20, 240, 0.7);
            for (let k = 0; k < s.pts.length; k += 3) S.food.push({ x: s.pts[k].x, y: s.pts[k].y, r: 6, hue: irand(0, 3) });
            if (S.food.length > 160) S.food.length = 160;
            G.vib(p, 200);
            break;
          }
        }
        if (!s.alive) break;
      }
    }
    if (G.time > this.TIME) {
      const rows = [...S.snakes.entries()]
        .sort((a, b) => b[1].best - a[1].best)
        .map(([pid, s]) => ({ pid, label: T('length') + ' ' + s.best }));
      G.finish(rows);
    }
  },
  draw(ctx, G) {
    const S = this.S;
    Draw2.bg(ctx, G, '#070d18', '#0d1a30');
    // subtle hex-ish dot grid
    ctx.fillStyle = 'rgba(255,255,255,.035)';
    for (let y = 30; y < G.H; y += 44)
      for (let x = 30 + (y % 88 === 30 ? 0 : 22); x < G.W; x += 44) {
        ctx.beginPath(); ctx.arc(x, y, 1.4, 0, 7); ctx.fill();
      }
    const FOOD_C = ['#ffcf3f', '#2fe0d0', '#ff7ab8', '#b06cff'];
    for (const f of S.food) {
      const r = f.r + Math.sin(S.pulse * 3 + f.x) * 1;
      Draw2.orb(ctx, f.x, f.y, r, FOOD_C[f.hue], true);
    }
    for (const p of G.players) {
      const s = S.snakes.get(p.pid);
      if (!s || !s.alive) continue;
      // body: taper + alternating stripes, drawn tail-to-head
      for (let i = s.pts.length - 1; i >= 1; i--) {
        const pt = s.pts[i];
        const t = i / s.pts.length;
        const r = 9 - 4 * t;
        const c = i % 4 < 2 ? p.color : Draw2.darken(p.color, 0.22);
        const g = ctx.createRadialGradient(pt.x - r * 0.3, pt.y - r * 0.3, r * 0.2, pt.x, pt.y, r);
        g.addColorStop(0, Draw2.lighten(c, 0.3));
        g.addColorStop(1, Draw2.darken(c, 0.3));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, 7); ctx.fill();
      }
      // head
      const h = s.pts[0];
      Draw2.orb(ctx, h.x, h.y, 10.5, p.color);
      // eyes look along direction of travel
      const ex = Math.cos(s.dir), ey = Math.sin(s.dir);
      const px = -ey, py = ex;
      for (const side of [-1, 1]) {
        const ox = h.x + ex * 4 + px * 4.6 * side, oy = h.y + ey * 4 + py * 4.6 * side;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(ox, oy, 3.4, 0, 7); ctx.fill();
        ctx.fillStyle = '#101010';
        ctx.beginPath(); ctx.arc(ox + ex * 1.4, oy + ey * 1.4, 1.7, 0, 7); ctx.fill();
      }
      Draw2.tag(ctx, p, h.x, h.y - 24, '· ' + s.len);
    }
    Draw2.vignette(ctx, G, 0.4);
    Draw2.timer(ctx, G, this.TIME - G.time, this.TIME);
  },
});
