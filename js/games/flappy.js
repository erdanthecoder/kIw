// Flappy Royale — everyone is a bird, last one flapping wins.
registerGame({
  id: 'flappy', title: 'Flappy Royale', icon: '🐦', desc: 'Tap to flap. Dodge the pipes. Last bird alive wins.',
  players: '1-8', minPlayers: 1,
  S: null,
  init(G) {
    G.setScheme(null, 'tap', { label: 'FLAP 🐦' });
    this.S = {
      birds: new Map(G.players.map((p, i) => [p.pid, { y: 300 + i * 20, vy: 0, alive: true, pipes: 0, t: 0 }])),
      pipes: [], spawnT: 0, speed: 210, over: false,
    };
  },
  onBtn(p, b, G) {
    const bd = this.S && this.S.birds.get(p.pid);
    if (bd && bd.alive) bd.vy = -340;
  },
  update(dt, G) {
    const S = this.S;
    if (S.over) return;
    S.speed += dt * 4;
    S.spawnT -= dt;
    if (S.spawnT <= 0) {
      S.spawnT = 1.7;
      const gap = 200, cy = rand(140, G.H - 140 - gap);
      S.pipes.push({ x: G.W + 40, top: cy, bot: cy + gap, w: 90, passed: false });
    }
    for (const pp of S.pipes) pp.x -= S.speed * dt;
    S.pipes = S.pipes.filter(pp => pp.x > -100);

    let aliveCount = 0;
    for (const p of G.players) {
      const b = S.birds.get(p.pid);
      if (!b || !b.alive) continue;
      if (p.gone) { b.alive = false; continue; }
      b.t += dt;
      b.vy += 950 * dt;
      b.y += b.vy * dt;
      const bx = 220, br = 17;
      if (b.y < br || b.y > G.H - br) { this.kill(p, b, G); continue; }
      for (const pp of S.pipes) {
        if (bx + br > pp.x && bx - br < pp.x + pp.w) {
          if (b.y - br < pp.top || b.y + br > pp.bot) { this.kill(p, b, G); break; }
        }
        if (!pp.passed && pp.x + pp.w < bx) { pp.passed = true; }
      }
      if (b.alive) aliveCount++;
    }
    // count pipes passed (shared)
    for (const pp of S.pipes) {
      if (!pp.counted && pp.x + pp.w < 220) {
        pp.counted = true;
        for (const b of S.birds.values()) if (b.alive) b.pipes++;
      }
    }
    const total = G.players.filter(p => !p.gone).length;
    if ((total > 1 && aliveCount <= 1) || (total === 1 && aliveCount === 0) || G.time > 150) {
      S.over = true;
      const rows = [...S.birds.entries()]
        .map(([pid, b]) => ({ pid, t: b.alive ? 1e9 : b.t, pipes: b.pipes }))
        .sort((a, b2) => b2.t - a.t || b2.pipes - a.pipes)
        .map(r => ({ pid: r.pid, label: r.pipes + ' pipes' }));
      setTimeout(() => G.finish(rows), 1200);
    }
  },
  kill(p, b, G) { b.alive = false; G.vib(p, 150); },
  draw(ctx, G) {
    const S = this.S;
    Draw2.bg(ctx, G, '#0b1a2e', '#123');
    ctx.fillStyle = '#1f7a4d';
    for (const pp of S.pipes) {
      ctx.fillStyle = '#2fae6b';
      ctx.fillRect(pp.x, 0, pp.w, pp.top);
      ctx.fillRect(pp.x, pp.bot, pp.w, G.H - pp.bot);
      ctx.fillStyle = '#37c97c';
      ctx.fillRect(pp.x - 6, pp.top - 24, pp.w + 12, 24);
      ctx.fillRect(pp.x - 6, pp.bot, pp.w + 12, 24);
    }
    for (const p of G.players) {
      const b = S.birds.get(p.pid);
      if (!b) continue;
      ctx.globalAlpha = b.alive ? 1 : 0.18;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(220, b.y, 17, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(227, b.y - 5, 5, 0, 7); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(228, b.y - 5, 2.4, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffb02f';
      ctx.beginPath(); ctx.moveTo(235, b.y); ctx.lineTo(249, b.y + 3); ctx.lineTo(235, b.y + 8); ctx.fill();
      Draw2.label(ctx, p.name, 220, b.y - 30, 13, b.alive ? '#fff' : 'rgba(255,255,255,.4)');
      ctx.globalAlpha = 1;
    }
    const alive = [...S.birds.values()].filter(b => b.alive).length;
    Draw2.label(ctx, `${alive} alive · ${Math.max(0, [...S.birds.values()].map(b => b.pipes).reduce((a, c) => Math.max(a, c), 0))} pipes`, G.W / 2, 26, 20, 'rgba(255,255,255,.85)');
  },
});
