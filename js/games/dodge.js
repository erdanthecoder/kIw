// Dodgeball Panic — the arena fills with bouncing balls. Don't get hit!
registerGame({
  id: 'dodge', title: 'Dodgeball Panic', icon: '🔴', desc: 'Balls keep spawning and speeding up. Last player standing wins!',
  players: '1-8', minPlayers: 1, TIME: 120,
  S: null,
  init(G) {
    G.setScheme(null, 'stick', { msg: 'Dodge the balls!' });
    const S = this.S = { units: new Map(), balls: [], spawnT: 0, deathOrder: [] };
    G.players.forEach((p, i) => {
      const spots = [[200, 200], [1080, 200], [200, 520], [1080, 520], [640, 160], [640, 560], [160, 360], [1120, 360]];
      S.units.set(p.pid, { x: spots[i % 8][0], y: spots[i % 8][1], alive: true, t: 0 });
    });
    for (let i = 0; i < 3; i++) this.spawnBall(S);
  },
  spawnBall(S) {
    // spawn at an edge aimed inward
    const edge = irand(0, 3);
    const x = edge === 0 ? 10 : edge === 1 ? 1270 : rand(40, 1240);
    const y = edge === 2 ? 10 : edge === 3 ? 710 : rand(40, 680);
    const a = Math.atan2(360 - y, 640 - x) + rand(-0.6, 0.6);
    const sp = rand(180, 260);
    S.balls.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(14, 26) });
  },
  update(dt, G) {
    const S = this.S;
    S.spawnT -= dt;
    if (S.spawnT <= 0 && S.balls.length < 26) { S.spawnT = 3.2; this.spawnBall(S); }
    for (const b of S.balls) {
      b.vx *= 1 + dt * 0.012; b.vy *= 1 + dt * 0.012;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < b.r) { b.x = b.r; b.vx *= -1; }
      if (b.x > 1280 - b.r) { b.x = 1280 - b.r; b.vx *= -1; }
      if (b.y < b.r) { b.y = b.r; b.vy *= -1; }
      if (b.y > 720 - b.r) { b.y = 720 - b.r; b.vy *= -1; }
    }
    let alive = 0;
    for (const p of G.players) {
      const u = S.units.get(p.pid);
      if (!u || !u.alive) continue;
      if (p.gone) { u.alive = false; S.deathOrder.push(p.pid); continue; }
      u.t += dt;
      u.x = clamp(u.x + p.in.x * 280 * dt, 14, 1266);
      u.y = clamp(u.y + p.in.y * 280 * dt, 14, 706);
      for (const b of S.balls) {
        if (dist(u.x, u.y, b.x, b.y) < b.r + 13) {
          u.alive = false;
          S.deathOrder.push(p.pid);
          G.vib(p, 300);
          break;
        }
      }
      if (u.alive) alive++;
    }
    const total = S.units.size;
    if ((total > 1 && alive <= 1) || (total === 1 && !alive) || G.time > this.TIME) {
      const rows = [
        ...[...S.units.entries()].filter(([, u]) => u.alive).map(([pid, u]) => ({ pid, label: `👑 ${u.t.toFixed(1)}s` })),
        ...[...S.deathOrder].reverse().map(pid => ({ pid, label: S.units.get(pid).t.toFixed(1) + 's' })),
      ];
      G.finish(rows);
    }
  },
  draw(ctx, G) {
    const S = this.S;
    Draw2.bg(ctx, G, '#160b10', '#241018');
    for (const b of S.balls) {
      ctx.fillStyle = '#ff4655';
      ctx.shadowColor = '#ff4655'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      ctx.beginPath(); ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.3, 0, 7); ctx.fill();
    }
    for (const p of G.players) {
      const u = S.units.get(p.pid);
      if (!u) continue;
      ctx.globalAlpha = u.alive ? 1 : 0.15;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(u.x, u.y, 13, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      Draw2.label(ctx, p.name, u.x, u.y - 26, 12);
      ctx.globalAlpha = 1;
    }
    const alive = [...S.units.values()].filter(u => u.alive).length;
    Draw2.label(ctx, `${alive} alive · ${S.balls.length} balls`, G.W / 2, 26, 18, 'rgba(255,255,255,.75)');
  },
});
