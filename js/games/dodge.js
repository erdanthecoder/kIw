// Dodgeball Panic — the arena fills with bouncing balls. Don't get hit.
registerGame({
  id: 'dodge', title: 'Dodgeball Panic', icon: 'dodge', desc: 'Balls keep spawning and speeding up. Last player standing wins.',
  players: '1-8', minPlayers: 1, TIME: 120,
  S: null,
  init(G) {
    G.setScheme(null, 'stick', { msg: T('dodgeBalls') });
    const S = this.S = { units: new Map(), balls: [], spawnT: 0, deathOrder: [] };
    G.players.forEach((p, i) => {
      const spots = [[200, 200], [1080, 200], [200, 520], [1080, 520], [640, 160], [640, 560], [160, 360], [1120, 360]];
      S.units.set(p.pid, { x: spots[i % 8][0], y: spots[i % 8][1], alive: true, t: 0, vx: 0, vy: 0 });
    });
    for (let i = 0; i < 3; i++) this.spawnBall(S);
  },
  spawnBall(S) {
    const edge = irand(0, 3);
    const x = edge === 0 ? 10 : edge === 1 ? 1270 : rand(40, 1240);
    const y = edge === 2 ? 10 : edge === 3 ? 710 : rand(40, 680);
    const a = Math.atan2(360 - y, 640 - x) + rand(-0.6, 0.6);
    const sp = rand(180, 260);
    S.balls.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(14, 26), fade: 0.8, rot: rand(0, 6) });
  },
  bot(p, G, dt) {
    const S = this.S, u = S.units.get(p.pid);
    if (!u || !u.alive) return;
    let fx = (640 - u.x) / 640 * 0.35, fy = (360 - u.y) / 360 * 0.35;
    for (const b of S.balls) {
      const d = dist(u.x, u.y, b.x, b.y);
      if (d < 170 && d > 1) {
        const w = (170 - d) / 170 * 2.4;
        fx -= (b.x - u.x) / d * w;
        fy -= (b.y - u.y) / d * w;
      }
    }
    const m = Math.hypot(fx, fy) || 1;
    p.in.x = fx / m; p.in.y = fy / m;
  },
  update(dt, G) {
    const S = this.S;
    S.spawnT -= dt;
    if (S.spawnT <= 0 && S.balls.length < 26) { S.spawnT = 3.2; this.spawnBall(S); }
    for (const b of S.balls) {
      b.fade = Math.max(0, b.fade - dt);
      b.vx *= 1 + dt * 0.012; b.vy *= 1 + dt * 0.012;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.rot += dt * Math.hypot(b.vx, b.vy) / b.r * 0.6;
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
      u.vx = lerp(u.vx, p.in.x * 280, dt * 10);
      u.vy = lerp(u.vy, p.in.y * 280, dt * 10);
      u.x = clamp(u.x + u.vx * dt, 14, 1266);
      u.y = clamp(u.y + u.vy * dt, 14, 706);
      for (const b of S.balls) {
        if (b.fade > 0) continue; // grace period while a new ball fades in
        if (dist(u.x, u.y, b.x, b.y) < b.r + 13) {
          u.alive = false;
          S.deathOrder.push(p.pid);
          Draw2.boom(u.x, u.y, p.color, 22, 280, 0.8);
          AudioSys.sfx('boom');
          G.vib(p, 300);
          break;
        }
      }
      if (u.alive) alive++;
    }
    const total = S.units.size;
    if ((total > 1 && alive <= 1) || (total === 1 && !alive) || G.time > this.TIME) {
      const rows = [
        ...[...S.units.entries()].filter(([, u]) => u.alive).map(([pid, u]) => ({ pid, label: u.t.toFixed(1) + 's · ' + T('survived') })),
        ...[...S.deathOrder].reverse().map(pid => ({ pid, label: S.units.get(pid).t.toFixed(1) + 's' })),
      ];
      G.finish(rows);
    }
  },
  draw(ctx, G) {
    const S = this.S;
    Draw2.bg(ctx, G, '#151018', '#201622');
    // caution stripes along the walls
    ctx.save();
    ctx.strokeStyle = 'rgba(255,207,63,.18)';
    ctx.lineWidth = 10;
    ctx.setLineDash([26, 26]);
    ctx.strokeRect(8, 8, 1264, 704);
    ctx.restore();
    // floor tiles
    ctx.strokeStyle = 'rgba(255,255,255,.03)';
    for (let x = 0; x < 1280; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 720); ctx.stroke(); }
    for (let y = 0; y < 720; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1280, y); ctx.stroke(); }
    for (const b of S.balls) {
      ctx.globalAlpha = 1 - b.fade;
      // motion blur streak
      ctx.strokeStyle = 'rgba(255,70,85,.25)';
      ctx.lineWidth = b.r * 1.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.05, b.y - b.vy * 0.05);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      Draw2.dropShadow(ctx, b.x, b.y + b.r * 0.85, b.r);
      Draw2.orb(ctx, b.x, b.y, b.r, '#d8333f');
      // rotating seam lines
      ctx.save();
      ctx.translate(b.x, b.y); ctx.rotate(b.rot);
      ctx.strokeStyle = 'rgba(120,10,20,.55)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, b.r * 0.7, 0.4, 2.6); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, b.r * 0.7, 3.5, 5.8); ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    for (const p of G.players) {
      const u = S.units.get(p.pid);
      if (!u || !u.alive) continue;
      Draw2.pawn(ctx, u.x, u.y, 13, p.color);
      Draw2.tag(ctx, p, u.x, u.y - 28);
    }
    Draw2.vignette(ctx, G, 0.45);
    const alive = [...S.units.values()].filter(u => u.alive).length;
    ctx.fillStyle = 'rgba(5,8,16,.55)';
    ctx.beginPath(); ctx.roundRect(G.W / 2 - 100, 10, 200, 30, 15); ctx.fill();
    Draw2.label(ctx, `${alive} ${T('alive')}   |   ${S.balls.length} ${T('ballsN')}`, G.W / 2, 25, 14, 'rgba(255,255,255,.9)');
  },
});
