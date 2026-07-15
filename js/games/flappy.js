// Flappy Royale — everyone is a bird, last one flapping wins.
registerGame({
  id: 'flappy', title: 'Flappy Royale', icon: 'flappy', desc: 'Tap to flap. Dodge the pipes. Last bird alive wins.',
  players: '1-8', minPlayers: 1,
  S: null,
  init(G) {
    G.setScheme(null, 'tap', { label: 'FLAP' });
    const clouds = [];
    for (let i = 0; i < 7; i++) clouds.push({ x: rand(0, G.W), y: rand(40, 260), s: rand(0.5, 1.2), v: rand(8, 18) });
    const hills = [];
    for (let i = 0; i < 24; i++) hills.push(rand(40, 110));
    this.S = {
      birds: new Map(G.players.map((p, i) => [p.pid, { y: 300 + i * 20, vy: 0, alive: true, pipes: 0, t: 0, flapT: 0 }])),
      pipes: [], spawnT: 0, speed: 210, over: false, clouds, hills, scroll: 0,
    };
  },
  onBtn(p, b, G) {
    const bd = this.S && this.S.birds.get(p.pid);
    if (bd && bd.alive) { bd.vy = -340; bd.flapT = 0.22; }
  },
  update(dt, G) {
    const S = this.S;
    if (S.over) return;
    S.speed += dt * 4;
    S.scroll += S.speed * dt;
    for (const c of S.clouds) { c.x -= c.v * dt; if (c.x < -160) { c.x = G.W + 120; c.y = rand(40, 260); } }
    S.spawnT -= dt;
    if (S.spawnT <= 0) {
      S.spawnT = 1.7;
      const gap = 200, cy = rand(140, G.H - 140 - gap);
      S.pipes.push({ x: G.W + 40, top: cy, bot: cy + gap, w: 90 });
    }
    for (const pp of S.pipes) pp.x -= S.speed * dt;
    S.pipes = S.pipes.filter(pp => pp.x > -100);

    let aliveCount = 0;
    for (const p of G.players) {
      const b = S.birds.get(p.pid);
      if (!b || !b.alive) continue;
      if (p.gone) { b.alive = false; continue; }
      b.t += dt;
      b.flapT -= dt;
      b.vy += 950 * dt;
      b.y += b.vy * dt;
      const bx = 220, br = 17;
      if (b.y < br || b.y > G.H - 46 - br) { this.kill(p, b, G); continue; }
      for (const pp of S.pipes) {
        if (bx + br > pp.x && bx - br < pp.x + pp.w) {
          if (b.y - br < pp.top || b.y + br > pp.bot) { this.kill(p, b, G); break; }
        }
      }
      if (b.alive) aliveCount++;
    }
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
  kill(p, b, G) {
    b.alive = false;
    Draw2.boom(220, b.y, p.color, 14, 200, 0.6);
    G.vib(p, 150);
  },
  drawPipe(ctx, x, y0, y1, w) {
    // shaded metal-green pipe body
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#1e6b3c'); g.addColorStop(0.25, '#3fae6c'); g.addColorStop(0.6, '#2a8a50'); g.addColorStop(1, '#175530');
    ctx.fillStyle = g;
    ctx.fillRect(x, y0, w, y1 - y0);
    ctx.fillStyle = 'rgba(255,255,255,.14)';
    ctx.fillRect(x + w * 0.16, y0, 5, y1 - y0);
  },
  drawCap(ctx, x, y, w, h) {
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#237a46'); g.addColorStop(0.3, '#4cc27c'); g.addColorStop(1, '#1b5e36');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1.5; ctx.stroke();
  },
  draw(ctx, G) {
    const S = this.S;
    // dusk sky
    const sky = ctx.createLinearGradient(0, 0, 0, G.H);
    sky.addColorStop(0, '#10254a'); sky.addColorStop(0.62, '#2c4a7c'); sky.addColorStop(1, '#c46a3c');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, G.W, G.H);
    // clouds
    for (const c of S.clouds) {
      ctx.fillStyle = 'rgba(255,255,255,.10)';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, 70 * c.s, 20 * c.s, 0, 0, 7);
      ctx.ellipse(c.x + 40 * c.s, c.y + 6 * c.s, 45 * c.s, 15 * c.s, 0, 0, 7);
      ctx.fill();
    }
    // distant hills (parallax)
    ctx.fillStyle = '#1a2f52';
    ctx.beginPath();
    ctx.moveTo(0, G.H - 46);
    for (let i = 0; i < S.hills.length; i++) {
      const hx = (i * 120 - (S.scroll * 0.15) % 120);
      ctx.quadraticCurveTo(hx + 60, G.H - 46 - S.hills[i], hx + 120, G.H - 46);
    }
    ctx.lineTo(G.W, G.H); ctx.lineTo(0, G.H);
    ctx.fill();
    // pipes
    for (const pp of S.pipes) {
      this.drawPipe(ctx, pp.x, 0, pp.top, pp.w);
      this.drawCap(ctx, pp.x - 6, pp.top - 26, pp.w + 12, 26);
      this.drawPipe(ctx, pp.x, pp.bot, G.H - 46, pp.w);
      this.drawCap(ctx, pp.x - 6, pp.bot, pp.w + 12, 26);
    }
    // scrolling ground strip
    ctx.fillStyle = '#3c2c1c';
    ctx.fillRect(0, G.H - 46, G.W, 46);
    ctx.fillStyle = '#57a34e';
    ctx.fillRect(0, G.H - 46, G.W, 8);
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    for (let x = -((S.scroll) % 48); x < G.W; x += 48) ctx.fillRect(x, G.H - 38, 24, 38);
    // birds
    for (const p of G.players) {
      const b = S.birds.get(p.pid);
      if (!b) continue;
      const bx = 220;
      ctx.save();
      ctx.globalAlpha = b.alive ? 1 : 0.15;
      ctx.translate(bx, b.y);
      ctx.rotate(clamp(b.vy / 700, -0.5, 0.9));
      // body
      const bg = ctx.createRadialGradient(-5, -6, 3, 0, 0, 19);
      bg.addColorStop(0, Draw2.lighten(p.color, 0.5));
      bg.addColorStop(1, Draw2.darken(p.color, 0.25));
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.ellipse(0, 0, 19, 15, 0, 0, 7); ctx.fill();
      // tail
      ctx.fillStyle = Draw2.darken(p.color, 0.35);
      ctx.beginPath(); ctx.moveTo(-16, -3); ctx.lineTo(-27, -8); ctx.lineTo(-25, 4); ctx.closePath(); ctx.fill();
      // wing (flaps)
      const wingA = b.flapT > 0 ? -0.9 : 0.35 + Math.sin(b.t * 9) * 0.12;
      ctx.save();
      ctx.translate(-3, 0); ctx.rotate(wingA);
      ctx.fillStyle = Draw2.darken(p.color, 0.2);
      ctx.beginPath(); ctx.ellipse(-4, 5, 11, 6.5, 0.4, 0, 7); ctx.fill();
      ctx.restore();
      // belly
      ctx.fillStyle = 'rgba(255,240,220,.85)';
      ctx.beginPath(); ctx.ellipse(2, 6, 10, 6.5, 0, 0, 7); ctx.fill();
      // eye
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(8, -5, 5.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(9.6, -5, 2.6, 0, 7); ctx.fill();
      // beak
      const bk = ctx.createLinearGradient(14, -2, 26, 4);
      bk.addColorStop(0, '#ffb02f'); bk.addColorStop(1, '#e08a12');
      ctx.fillStyle = bk;
      ctx.beginPath(); ctx.moveTo(14, -2); ctx.lineTo(27, 2); ctx.lineTo(14, 7); ctx.closePath(); ctx.fill();
      ctx.restore();
      if (b.alive) Draw2.tag(ctx, p, bx, b.y - 32);
      ctx.globalAlpha = 1;
    }
    const alive = [...S.birds.values()].filter(b => b.alive).length;
    const best = [...S.birds.values()].reduce((a, c) => Math.max(a, c.pipes), 0);
    ctx.fillStyle = 'rgba(5,8,16,.55)';
    ctx.beginPath(); ctx.roundRect(G.W / 2 - 110, 10, 220, 30, 15); ctx.fill();
    Draw2.label(ctx, `${alive} alive   |   ${best} pipes`, G.W / 2, 25, 15, 'rgba(255,255,255,.9)');
  },
});
