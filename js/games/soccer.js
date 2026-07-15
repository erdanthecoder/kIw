// Rocket Soccer — two teams, one ball, pure chaos.
registerGame({
  id: 'soccer', title: 'Rocket Soccer', icon: '⚽', desc: 'Auto-teams. Smash the ball into the other goal. First to 5 (or 2 min).',
  players: '2-8', minPlayers: 2, TIME: 120, GOALS: 5,
  S: null,
  init(G) {
    G.setScheme(null, 'stick1', { a: '🚀', asub: 'BOOST' });
    const S = this.S = {
      cars: new Map(), ball: { x: 640, y: 360, vx: 0, vy: 0 },
      score: [0, 0], resetT: 0,
    };
    G.players.forEach((p, i) => {
      const team = i % 2; // even slots = blue (left), odd = red (right)
      S.cars.set(p.pid, this.spawnCar(team, Math.floor(i / 2)));
    });
  },
  spawnCar(team, row) {
    return { team, x: team === 0 ? 300 : 980, y: 220 + row * 100, vx: 0, vy: 0, boost: 0, touches: 0 };
  },
  onBtn(p, b, G) {
    const c = this.S.cars.get(p.pid);
    if (c && b === 'a' && c.boost <= 0) {
      c.boost = 2.5; // cooldown
      const mag = Math.hypot(p.in.x, p.in.y) || 1;
      c.vx += (p.in.x / mag) * 420;
      c.vy += (p.in.y / mag) * 420;
      G.vib(p, 60);
    }
  },
  resetKickoff(S, G) {
    S.ball = { x: 640, y: 360, vx: 0, vy: 0 };
    let rows = [0, 0];
    for (const p of G.players) {
      const c = S.cars.get(p.pid);
      if (!c) continue;
      Object.assign(c, this.spawnCar(c.team, rows[c.team]++), { touches: c.touches, team: c.team });
    }
  },
  update(dt, G) {
    const S = this.S;
    if (S.resetT > 0) {
      S.resetT -= dt;
      if (S.resetT <= 0) this.resetKickoff(S, G);
      return;
    }
    const R = 22, BR = 16;
    for (const p of G.players) {
      const c = S.cars.get(p.pid);
      if (!c) continue;
      c.boost -= dt;
      c.vx += p.in.x * 900 * dt;
      c.vy += p.in.y * 900 * dt;
      c.vx *= Math.pow(0.12, dt); c.vy *= Math.pow(0.12, dt);
      const sp = Math.hypot(c.vx, c.vy), MAX = 330;
      if (sp > MAX) { c.vx *= MAX / sp; c.vy *= MAX / sp; }
      c.x = clamp(c.x + c.vx * dt, R, 1280 - R);
      c.y = clamp(c.y + c.vy * dt, R, 720 - R);
      // car ↔ ball
      const b = S.ball;
      const d = dist(c.x, c.y, b.x, b.y);
      if (d < R + BR) {
        const nx = (b.x - c.x) / (d || 1), ny = (b.y - c.y) / (d || 1);
        const push = Math.max(140, Math.hypot(c.vx, c.vy) * 1.35);
        b.vx = nx * push + c.vx * 0.4;
        b.vy = ny * push + c.vy * 0.4;
        b.x = c.x + nx * (R + BR + 1);
        b.y = c.y + ny * (R + BR + 1);
        c.touches++;
      }
      // car ↔ car
      for (const [opid, o] of S.cars) {
        if (opid === p.pid) continue;
        const dd = dist(c.x, c.y, o.x, o.y);
        if (dd < R * 2 && dd > 0) {
          const nx = (c.x - o.x) / dd, ny = (c.y - o.y) / dd;
          c.x += nx * (R * 2 - dd) / 2; c.y += ny * (R * 2 - dd) / 2;
          o.x -= nx * (R * 2 - dd) / 2; o.y -= ny * (R * 2 - dd) / 2;
        }
      }
    }
    // ball physics
    const b = S.ball;
    b.vx *= Math.pow(0.35, dt); b.vy *= Math.pow(0.35, dt);
    b.x += b.vx * dt; b.y += b.vy * dt;
    const goalTop = 250, goalBot = 470;
    if (b.y < BR) { b.y = BR; b.vy *= -0.85; }
    if (b.y > 720 - BR) { b.y = 720 - BR; b.vy *= -0.85; }
    if (b.x < BR) {
      if (b.y > goalTop && b.y < goalBot) return this.goal(1, G);
      b.x = BR; b.vx *= -0.85;
    }
    if (b.x > 1280 - BR) {
      if (b.y > goalTop && b.y < goalBot) return this.goal(0, G);
      b.x = 1280 - BR; b.vx *= -0.85;
    }
    if (G.time > this.TIME) this.gameOver(G);
  },
  goal(team, G) {
    const S = this.S;
    S.score[team]++;
    G.toast(`GOOOAL! ${team === 0 ? '🔵 Blue' : '🔴 Red'} team scores!`);
    for (const p of G.players) { const c = S.cars.get(p.pid); if (c && c.team === team) G.vib(p, 200); }
    if (S.score[team] >= this.GOALS) return this.gameOver(G);
    S.resetT = 1.6;
  },
  gameOver(G) {
    const S = this.S;
    const winner = S.score[0] === S.score[1] ? -1 : (S.score[0] > S.score[1] ? 0 : 1);
    const rows = [...S.cars.entries()]
      .sort((a, b) => {
        const aw = a[1].team === winner ? 1 : 0, bw = b[1].team === winner ? 1 : 0;
        return bw - aw || b[1].touches - a[1].touches;
      })
      .map(([pid, c]) => ({ pid, label: `${c.team === 0 ? '🔵' : '🔴'} ${c.touches} touches${c.team === winner ? ' · WIN' : winner === -1 ? ' · DRAW' : ''}` }));
    G.finish(rows);
  },
  draw(ctx, G) {
    const S = this.S;
    Draw2.bg(ctx, G, '#0b3d1f', '#0e5228');
    // pitch lines
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3;
    ctx.strokeRect(30, 30, 1220, 660);
    ctx.beginPath(); ctx.moveTo(640, 30); ctx.lineTo(640, 690); ctx.stroke();
    ctx.beginPath(); ctx.arc(640, 360, 90, 0, 7); ctx.stroke();
    // goals
    ctx.fillStyle = 'rgba(47,155,255,.3)'; ctx.fillRect(0, 250, 30, 220);
    ctx.fillStyle = 'rgba(255,70,85,.3)'; ctx.fillRect(1250, 250, 30, 220);
    for (const p of G.players) {
      const c = S.cars.get(p.pid);
      if (!c) continue;
      ctx.fillStyle = c.team === 0 ? '#2f9bff' : '#ff4655';
      ctx.beginPath(); ctx.arc(c.x, c.y, 22, 0, 7); ctx.fill();
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(c.x, c.y, 11, 0, 7); ctx.fill();
      Draw2.label(ctx, p.name, c.x, c.y - 34, 12);
      if (c.boost <= 0) Draw2.label(ctx, '🚀', c.x + 24, c.y - 20, 12);
    }
    const b = S.ball;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(b.x, b.y, 16, 0, 7); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(b.x, b.y, 6, 0, 7); ctx.fill();
    Draw2.label(ctx, `🔵 ${S.score[0]}  —  ${S.score[1]} 🔴`, G.W / 2, 60, 40);
    Draw2.timer(ctx, G, this.TIME - G.time);
    if (S.resetT > 0) Draw2.label(ctx, 'GOAL!', G.W / 2, 340, 100, '#ffcf3f');
  },
});
