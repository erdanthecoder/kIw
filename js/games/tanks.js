// Tank Battle Arena — drive, aim with movement, fire bouncing shells.
registerGame({
  id: 'tanks', title: 'Tank Battle', icon: '🛡️', desc: 'Drive with the stick, hold FIRE to shoot bouncing shells. Most kills in 90s.',
  players: '1-8', minPlayers: 1, TIME: 90,
  S: null,
  init(G) {
    G.setScheme(null, 'stick1', { a: '💥', asub: 'FIRE', arep: 380 });
    const S = this.S = { tanks: new Map(), bullets: [], walls: [] };
    // arena walls
    S.walls = [
      { x: 300, y: 160, w: 40, h: 180 }, { x: 940, y: 160, w: 40, h: 180 },
      { x: 300, y: 400, w: 40, h: 180 }, { x: 940, y: 400, w: 40, h: 180 },
      { x: 540, y: 320, w: 200, h: 40 }, { x: 140, y: 60, w: 160, h: 36 }, { x: 980, y: 620, w: 160, h: 36 },
    ];
    G.players.forEach((p, i) => S.tanks.set(p.pid, this.spawn(G, i)));
  },
  spawn(G, i) {
    const spots = [[90, 90], [1190, 90], [90, 630], [1190, 630], [640, 80], [640, 640], [80, 360], [1200, 360]];
    return { x: spots[i % 8][0], y: spots[i % 8][1], a: 0, hp: 3, kills: 0, cd: 0, respawn: 0 };
  },
  hitWall(S, x, y, r) {
    if (x < r || x > 1280 - r || y < r || y > 720 - r) return true;
    for (const w of S.walls) {
      if (x + r > w.x && x - r < w.x + w.w && y + r > w.y && y - r < w.y + w.h) return true;
    }
    return false;
  },
  onBtn(p, b, G) {
    const S = this.S, t = S.tanks.get(p.pid);
    if (!t || t.respawn > 0 || t.cd > 0 || b !== 'a') return;
    t.cd = 0.45;
    S.bullets.push({ x: t.x + Math.cos(t.a) * 26, y: t.y + Math.sin(t.a) * 26, vx: Math.cos(t.a) * 430, vy: Math.sin(t.a) * 430, owner: p.pid, bounces: 1, life: 3 });
  },
  update(dt, G) {
    const S = this.S;
    for (const p of G.players) {
      const t = S.tanks.get(p.pid);
      if (!t) continue;
      t.cd -= dt;
      if (t.respawn > 0) {
        t.respawn -= dt;
        if (t.respawn <= 0 && !p.gone) Object.assign(t, this.spawn(G, p.slot), { kills: t.kills });
        continue;
      }
      const mag = Math.hypot(p.in.x, p.in.y);
      if (mag > 0.2) {
        t.a = Math.atan2(p.in.y, p.in.x);
        const nx = t.x + p.in.x * 190 * dt, ny = t.y + p.in.y * 190 * dt;
        if (!this.hitWall(S, nx, t.y, 20)) t.x = nx;
        if (!this.hitWall(S, t.x, ny, 20)) t.y = ny;
      }
    }
    // bullets
    for (let i = S.bullets.length - 1; i >= 0; i--) {
      const b = S.bullets[i];
      b.life -= dt;
      let nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
      if (nx < 6 || nx > 1274) { if (b.bounces-- > 0) { b.vx *= -1; nx = b.x; } else { S.bullets.splice(i, 1); continue; } }
      if (ny < 6 || ny > 714) { if (b.bounces-- > 0) { b.vy *= -1; ny = b.y; } else { S.bullets.splice(i, 1); continue; } }
      for (const w of S.walls) {
        if (nx > w.x - 6 && nx < w.x + w.w + 6 && ny > w.y - 6 && ny < w.y + w.h + 6) {
          if (b.bounces-- > 0) {
            // bounce off the nearer axis
            const px = Math.min(Math.abs(nx - w.x), Math.abs(nx - w.x - w.w));
            const py = Math.min(Math.abs(ny - w.y), Math.abs(ny - w.y - w.h));
            if (px < py) b.vx *= -1; else b.vy *= -1;
            nx = b.x; ny = b.y;
          } else { S.bullets.splice(i, 1); }
          break;
        }
      }
      if (!S.bullets.includes(b)) continue;
      b.x = nx; b.y = ny;
      if (b.life <= 0) { S.bullets.splice(i, 1); continue; }
      // hit tanks
      for (const p of G.players) {
        const t = S.tanks.get(p.pid);
        if (!t || t.respawn > 0 || p.pid === b.owner) continue;
        if (dist(b.x, b.y, t.x, t.y) < 22) {
          S.bullets.splice(i, 1);
          t.hp--;
          G.vib(p, 120);
          if (t.hp <= 0) {
            t.respawn = 2.2; t.hp = 3;
            const killer = S.tanks.get(b.owner);
            if (killer) killer.kills++;
          }
          break;
        }
      }
    }
    if (G.time > this.TIME) {
      const rows = [...S.tanks.entries()].sort((a, b) => b[1].kills - a[1].kills)
        .map(([pid, t]) => ({ pid, label: t.kills + ' kills' }));
      G.finish(rows);
    }
  },
  draw(ctx, G) {
    const S = this.S;
    Draw2.bg(ctx, G, '#12100b', '#1c1a12');
    ctx.fillStyle = '#3a3527';
    for (const w of S.walls) { ctx.fillRect(w.x, w.y, w.w, w.h); ctx.strokeStyle = '#575138'; ctx.strokeRect(w.x, w.y, w.w, w.h); }
    for (const p of G.players) {
      const t = S.tanks.get(p.pid);
      if (!t || t.respawn > 0) continue;
      ctx.save();
      ctx.translate(t.x, t.y); ctx.rotate(t.a);
      ctx.fillStyle = p.color;
      ctx.fillRect(-18, -14, 36, 28);
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillRect(-18, -16, 36, 6); ctx.fillRect(-18, 10, 36, 6);
      ctx.fillStyle = '#ddd';
      ctx.fillRect(0, -4, 28, 8);
      ctx.restore();
      // hp pips
      for (let h = 0; h < t.hp; h++) { ctx.fillStyle = '#2fd573'; ctx.fillRect(t.x - 15 + h * 11, t.y - 30, 8, 5); }
      Draw2.label(ctx, `${p.name} · ${t.kills}⚔`, t.x, t.y + 34, 12);
    }
    ctx.fillStyle = '#ffd76b';
    for (const b of S.bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, 7); ctx.fill(); }
    Draw2.timer(ctx, G, this.TIME - G.time);
  },
});
