// Snake.io — steer your snake, eat glow pellets, don't hit other snakes.
registerGame({
  id: 'snake', title: 'Snake.io', icon: '🐍', desc: 'Steer with the joystick, eat orbs to grow. Crashing drops your orbs!',
  players: '1-8', minPlayers: 1, TIME: 150,
  S: null,
  init(G) {
    G.setScheme(null, 'stick', { msg: 'Steer your snake with the joystick' });
    const S = this.S = { snakes: new Map(), food: [] };
    G.players.forEach((p, i) => S.snakes.set(p.pid, this.spawn(G, i)));
    for (let i = 0; i < 45; i++) S.food.push({ x: rand(30, G.W - 30), y: rand(60, G.H - 30), r: 6 });
  },
  spawn(G, i) {
    const x = 140 + (i % 4) * 320, y = i < 4 ? 180 : 540;
    const pts = [];
    for (let k = 0; k < 14; k++) pts.push({ x: x - k * 6, y });
    return { pts, dir: 0, len: 14, best: 14, alive: true, respawn: 0, speed: 150 };
  },
  update(dt, G) {
    const S = this.S;
    for (const p of G.players) {
      const s = S.snakes.get(p.pid);
      if (!s) continue;
      if (!s.alive) {
        s.respawn -= dt;
        if (s.respawn <= 0 && !p.gone) Object.assign(s, this.spawn(G, p.slot));
        continue;
      }
      // steer toward stick direction
      if (Math.hypot(p.in.x, p.in.y) > 0.25) {
        const target = Math.atan2(p.in.y, p.in.x);
        let d = target - s.dir;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        s.dir += clamp(d, -4.2 * dt, 4.2 * dt);
      }
      const head = s.pts[0];
      const boost = Math.hypot(p.in.x, p.in.y) > 0.95 ? 1.25 : 1;
      let nx = head.x + Math.cos(s.dir) * s.speed * boost * dt;
      let ny = head.y + Math.sin(s.dir) * s.speed * boost * dt;
      // wrap around edges (io style)
      if (nx < 0) nx += G.W; if (nx > G.W) nx -= G.W;
      if (ny < 0) ny += G.H; if (ny > G.H) ny -= G.H;
      if (dist(nx, ny, head.x, head.y) > 4.5) s.pts.unshift({ x: nx, y: ny });
      else { head.x = nx; head.y = ny; }
      while (s.pts.length > s.len) s.pts.pop();

      // eat food
      for (let i = S.food.length - 1; i >= 0; i--) {
        if (dist(nx, ny, S.food[i].x, S.food[i].y) < 16) {
          S.food.splice(i, 1);
          s.len += 4;
          s.best = Math.max(s.best, s.len);
          G.vib(p, 25);
          S.food.push({ x: rand(30, G.W - 30), y: rand(60, G.H - 30), r: 6 });
        }
      }
      // collide with other snakes' bodies
      for (const [opid, o] of S.snakes) {
        if (!o.alive) continue;
        const startIdx = opid === p.pid ? 8 : 0;
        for (let i = startIdx; i < o.pts.length; i += 2) {
          if (dist(nx, ny, o.pts[i].x, o.pts[i].y) < 9) {
            s.alive = false; s.respawn = 2.5;
            for (let k = 0; k < s.pts.length; k += 3) S.food.push({ x: s.pts[k].x, y: s.pts[k].y, r: 6 });
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
        .map(([pid, s]) => ({ pid, label: 'length ' + s.best }));
      G.finish(rows);
    }
  },
  draw(ctx, G) {
    const S = this.S;
    Draw2.bg(ctx, G, '#070d18', '#0d1a30');
    for (const f of S.food) {
      ctx.fillStyle = '#ffcf3f';
      ctx.shadowColor = '#ffcf3f'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill();
      ctx.shadowBlur = 0;
    }
    for (const p of G.players) {
      const s = S.snakes.get(p.pid);
      if (!s || !s.alive) continue;
      for (let i = s.pts.length - 1; i >= 0; i--) {
        const pt = s.pts[i];
        const r = i === 0 ? 10 : 8 - 3 * (i / s.pts.length);
        ctx.fillStyle = i === 0 ? '#fff' : p.color;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, 7); ctx.fill();
        if (i === 0) {
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(pt.x, pt.y, 6.5, 0, 7); ctx.fill();
        }
      }
      Draw2.label(ctx, `${p.name} · ${s.len}`, s.pts[0].x, s.pts[0].y - 20, 13);
    }
    Draw2.timer(ctx, G, this.TIME - G.time);
  },
});
