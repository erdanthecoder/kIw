// Blob Arena — agar.io style. Eat orbs, eat smaller players, get huge.
registerGame({
  id: 'blob', title: 'Blob Arena', icon: '🟢', desc: 'Eat orbs to grow. Big blobs eat small blobs. Biggest after 90s wins.',
  players: '1-8', minPlayers: 1, TIME: 90,
  S: null,
  init(G) {
    G.setScheme(null, 'stick', { msg: 'Steer your blob — eat everything smaller than you' });
    const S = this.S = { blobs: new Map(), food: [] };
    G.players.forEach((p, i) => {
      const spots = [[160, 160], [1120, 160], [160, 560], [1120, 560], [640, 120], [640, 600], [120, 360], [1160, 360]];
      S.blobs.set(p.pid, { x: spots[i % 8][0], y: spots[i % 8][1], r: 20, best: 20, respawn: 0 });
    });
    for (let i = 0; i < 120; i++) S.food.push(this.newFood());
  },
  newFood() { return { x: rand(20, 1260), y: rand(50, 700), r: 5, c: ['#ffcf3f', '#2fe0d0', '#ff7ab8', '#b06cff'][irand(0, 3)] }; },
  update(dt, G) {
    const S = this.S;
    for (const p of G.players) {
      const b = S.blobs.get(p.pid);
      if (!b) continue;
      if (b.respawn > 0) {
        b.respawn -= dt;
        if (b.respawn <= 0 && !p.gone) { b.x = rand(100, 1180); b.y = rand(100, 620); b.r = 20; }
        continue;
      }
      // bigger = slower
      const speed = 260 * Math.pow(20 / b.r, 0.35);
      b.x = clamp(b.x + p.in.x * speed * dt, b.r, 1280 - b.r);
      b.y = clamp(b.y + p.in.y * speed * dt, b.r, 720 - b.r);
      for (let i = S.food.length - 1; i >= 0; i--) {
        if (dist(b.x, b.y, S.food[i].x, S.food[i].y) < b.r) {
          S.food.splice(i, 1);
          S.food.push(this.newFood());
          b.r = Math.min(130, Math.sqrt(b.r * b.r + 28));
          b.best = Math.max(b.best, b.r);
        }
      }
    }
    // blob eats blob
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
    // grid
    ctx.strokeStyle = 'rgba(255,255,255,.04)';
    for (let x = 0; x < 1280; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 720); ctx.stroke(); }
    for (let y = 0; y < 720; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1280, y); ctx.stroke(); }
    for (const f of S.food) {
      ctx.fillStyle = f.c;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill();
    }
    const sorted = G.players.slice().sort((a, b) => (S.blobs.get(a.pid) || {}).r - (S.blobs.get(b.pid) || {}).r);
    for (const p of sorted) {
      const b = S.blobs.get(p.pid);
      if (!b || b.respawn > 0) continue;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.stroke();
      Draw2.label(ctx, p.name, b.x, b.y, Math.max(11, b.r / 3));
    }
    Draw2.timer(ctx, G, this.TIME - G.time);
  },
});
