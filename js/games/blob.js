// Blob Arena — agar-style. Eat orbs, eat smaller players, get huge.
registerGame({
  id: 'blob', title: 'Blob Arena', icon: 'blob', desc: 'Eat orbs to grow. Big blobs eat small blobs. Biggest after 90 seconds wins.',
  players: '1-8', minPlayers: 1, TIME: 90,
  S: null,
  init(G) {
    G.setScheme(null, 'stick', { msg: 'Steer your blob — eat everything smaller than you' });
    const S = this.S = { blobs: new Map(), food: [], t: 0 };
    G.players.forEach((p, i) => {
      const spots = [[160, 160], [1120, 160], [160, 560], [1120, 560], [640, 120], [640, 600], [120, 360], [1160, 360]];
      S.blobs.set(p.pid, { x: spots[i % 8][0], y: spots[i % 8][1], r: 20, best: 20, respawn: 0, vx: 0, vy: 0, lx: 1, ly: 0 });
    });
    for (let i = 0; i < 120; i++) S.food.push(this.newFood());
  },
  newFood() { return { x: rand(20, 1260), y: rand(50, 700), r: 5, c: ['#ffcf3f', '#2fe0d0', '#ff7ab8', '#b06cff'][irand(0, 3)] }; },
  update(dt, G) {
    const S = this.S;
    S.t += dt;
    for (const p of G.players) {
      const b = S.blobs.get(p.pid);
      if (!b) continue;
      if (b.respawn > 0) {
        b.respawn -= dt;
        if (b.respawn <= 0 && !p.gone) { b.x = rand(100, 1180); b.y = rand(100, 620); b.r = 20; }
        continue;
      }
      const speed = 260 * Math.pow(20 / b.r, 0.35);
      // smooth acceleration for weighty feel
      b.vx = lerp(b.vx, p.in.x * speed, dt * 6);
      b.vy = lerp(b.vy, p.in.y * speed, dt * 6);
      if (Math.hypot(b.vx, b.vy) > 12) { b.lx = b.vx; b.ly = b.vy; }
      b.x = clamp(b.x + b.vx * dt, b.r, 1280 - b.r);
      b.y = clamp(b.y + b.vy * dt, b.r, 720 - b.r);
      for (let i = S.food.length - 1; i >= 0; i--) {
        if (dist(b.x, b.y, S.food[i].x, S.food[i].y) < b.r) {
          Draw2.boom(S.food[i].x, S.food[i].y, S.food[i].c, 5, 80, 0.3, 2.5);
          S.food.splice(i, 1);
          S.food.push(this.newFood());
          b.r = Math.min(130, Math.sqrt(b.r * b.r + 28));
          b.best = Math.max(b.best, b.r);
        }
      }
    }
    for (const p of G.players) {
      const b = S.blobs.get(p.pid);
      if (!b || b.respawn > 0) continue;
      for (const q of G.players) {
        if (q.pid === p.pid) continue;
        const o = S.blobs.get(q.pid);
        if (!o || o.respawn > 0) continue;
        if (b.r > o.r * 1.18 && dist(b.x, b.y, o.x, o.y) < b.r - o.r * 0.4) {
          b.r = Math.min(140, Math.sqrt(b.r * b.r + o.r * o.r * 0.7));
          b.best = Math.max(b.best, b.r);
          Draw2.boom(o.x, o.y, q.color, 20, 220, 0.7);
          o.respawn = 2.5;
          G.vib(q, 250);
          G.vib(p, 60);
        }
      }
    }
    if (G.time > this.TIME) {
      const rows = [...S.blobs.entries()].sort((a, b) => b[1].best - a[1].best)
        .map(([pid, b]) => ({ pid, label: 'size ' + Math.round(b.best) }));
      G.finish(rows);
    }
  },
  draw(ctx, G) {
    const S = this.S;
    Draw2.bg(ctx, G, '#0a1420', '#0f1e30');
    ctx.strokeStyle = 'rgba(255,255,255,.04)';
    for (let x = 0; x < 1280; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 720); ctx.stroke(); }
    for (let y = 0; y < 720; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1280, y); ctx.stroke(); }
    for (const f of S.food) Draw2.orb(ctx, f.x, f.y, f.r, f.c, true);
    const sorted = G.players.slice().sort((a, b) => ((S.blobs.get(a.pid) || {}).r || 0) - ((S.blobs.get(b.pid) || {}).r || 0));
    for (const p of sorted) {
      const b = S.blobs.get(p.pid);
      if (!b || b.respawn > 0) continue;
      // wobbly membrane
      ctx.beginPath();
      const wob = Math.min(4, b.r * 0.08);
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.16) {
        const rr = b.r + Math.sin(a * 6 + S.t * 4 + b.x * 0.01) * wob;
        const x = b.x + Math.cos(a) * rr, y = b.y + Math.sin(a) * rr;
        if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      const g = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.35, b.r * 0.15, b.x, b.y, b.r);
      g.addColorStop(0, Draw2.lighten(p.color, 0.45));
      g.addColorStop(0.75, p.color);
      g.addColorStop(1, Draw2.darken(p.color, 0.4));
      ctx.fillStyle = g;
      ctx.globalAlpha = 0.92;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = Draw2.lighten(p.color, 0.35);
      ctx.lineWidth = 2;
      ctx.stroke();
      // nucleus + specular
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.beginPath(); ctx.ellipse(b.x - b.r * 0.3, b.y - b.r * 0.38, b.r * 0.22, b.r * 0.12, -0.6, 0, 7); ctx.fill();
      // eyes look toward travel direction
      const lm = Math.hypot(b.lx, b.ly) || 1;
      const ex = b.lx / lm, ey = b.ly / lm;
      const px = -ey, py = ex;
      const er = Math.max(3.5, b.r * 0.14);
      for (const side of [-1, 1]) {
        const ox = b.x + ex * b.r * 0.34 + px * b.r * 0.3 * side;
        const oy = b.y + ey * b.r * 0.34 + py * b.r * 0.3 * side;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(ox, oy, er, 0, 7); ctx.fill();
        ctx.fillStyle = '#101418';
        ctx.beginPath(); ctx.arc(ox + ex * er * 0.4, oy + ey * er * 0.4, er * 0.52, 0, 7); ctx.fill();
      }
      Draw2.tag(ctx, p, b.x, b.y - b.r - 14, '· ' + Math.round(b.r));
    }
    Draw2.vignette(ctx, G, 0.4);
    Draw2.timer(ctx, G, this.TIME - G.time, this.TIME);
  },
});
