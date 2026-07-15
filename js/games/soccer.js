// Rocket Soccer — two teams, one ball, pure chaos.
registerGame({
  id: 'soccer', title: 'Rocket Soccer', icon: 'soccer', desc: 'Auto-teams. Smash the ball into the other goal. First to 5 (or 2 minutes).',
  players: '2-8', minPlayers: 2, TIME: 120, GOALS: 5,
  S: null,
  init(G) {
    G.setScheme(null, 'stick1', { a: 'BOOST' });
    const S = this.S = {
      cars: new Map(), ball: { x: 640, y: 360, vx: 0, vy: 0, spin: 0 },
      score: [0, 0], resetT: 0, goalFlash: 0,
    };
    G.players.forEach((p, i) => {
      const team = i % 2;
      S.cars.set(p.pid, this.spawnCar(team, Math.floor(i / 2)));
    });
  },
  spawnCar(team, row) {
    return { team, x: team === 0 ? 300 : 980, y: 220 + row * 100, vx: 0, vy: 0, boost: 0, touches: 0, boostFx: 0 };
  },
  onBtn(p, b, G) {
    const c = this.S.cars.get(p.pid);
    if (c && b === 'a' && c.boost <= 0) {
      c.boost = 2.5;
      c.boostFx = 0.35;
      const mag = Math.hypot(p.in.x, p.in.y) || 1;
      c.vx += (p.in.x / mag) * 420;
      c.vy += (p.in.y / mag) * 420;
      G.vib(p, 60);
    }
  },
  resetKickoff(S, G) {
    S.ball = { x: 640, y: 360, vx: 0, vy: 0, spin: 0 };
    let rows = [0, 0];
    for (const p of G.players) {
      const c = S.cars.get(p.pid);
      if (!c) continue;
      Object.assign(c, this.spawnCar(c.team, rows[c.team]++), { touches: c.touches, team: c.team });
    }
  },
  update(dt, G) {
    const S = this.S;
    S.goalFlash -= dt;
    if (S.resetT > 0) {
      S.resetT -= dt;
      if (S.resetT <= 0) this.resetKickoff(S, G);
      return;
    }
    const R = 22, BR = 16;
    for (const p of G.players) {
      const c = S.cars.get(p.pid);
      if (!c) continue;
      c.boost -= dt; c.boostFx -= dt;
      c.vx += p.in.x * 900 * dt;
      c.vy += p.in.y * 900 * dt;
      c.vx *= Math.pow(0.12, dt); c.vy *= Math.pow(0.12, dt);
      const sp = Math.hypot(c.vx, c.vy), MAX = 330;
      if (sp > MAX) { c.vx *= MAX / sp; c.vy *= MAX / sp; }
      c.x = clamp(c.x + c.vx * dt, R, 1280 - R);
      c.y = clamp(c.y + c.vy * dt, R, 720 - R);
      if (c.boostFx > 0) Draw2.trail(c.x - c.vx * 0.05, c.y - c.vy * 0.05, '#ffb02f', 4, 0.3);
      const b = S.ball;
      const d = dist(c.x, c.y, b.x, b.y);
      if (d < R + BR) {
        const nx = (b.x - c.x) / (d || 1), ny = (b.y - c.y) / (d || 1);
        const push = Math.max(140, Math.hypot(c.vx, c.vy) * 1.35);
        b.vx = nx * push + c.vx * 0.4;
        b.vy = ny * push + c.vy * 0.4;
        b.x = c.x + nx * (R + BR + 1);
        b.y = c.y + ny * (R + BR + 1);
        b.spin = (Math.random() - 0.5) * 12;
        c.touches++;
        Draw2.boom(b.x, b.y, '#ffffff', 5, 90, 0.25, 2.5);
      }
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
    const b = S.ball;
    b.vx *= Math.pow(0.35, dt); b.vy *= Math.pow(0.35, dt);
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.rot = (b.rot || 0) + (Math.hypot(b.vx, b.vy) / 40 + b.spin * 0.1) * dt;
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
    S.goalFlash = 1.6;
    Draw2.boom(team === 1 ? 30 : 1250, 360, team === 0 ? '#2f9bff' : '#ff4655', 40, 420, 1.1, 6);
    G.toast(`GOAL for ${team === 0 ? 'Blue' : 'Red'} team`);
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
      .map(([pid, c]) => ({ pid, label: `${c.team === 0 ? 'Blue' : 'Red'} · ${c.touches} touches${c.team === winner ? ' · WIN' : winner === -1 ? ' · DRAW' : ''}` }));
    G.finish(rows);
  },
  draw(ctx, G) {
    const S = this.S;
    // mowed-stripe pitch
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#0d5228' : '#0f5c2d';
      ctx.fillRect(i * 160, 0, 160, 720);
    }
    // soft center lighting
    const lg = ctx.createRadialGradient(640, 360, 100, 640, 360, 700);
    lg.addColorStop(0, 'rgba(255,255,255,.05)');
    lg.addColorStop(1, 'rgba(0,0,0,.22)');
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, 1280, 720);
    // pitch markings
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3;
    ctx.strokeRect(30, 30, 1220, 660);
    ctx.beginPath(); ctx.moveTo(640, 30); ctx.lineTo(640, 690); ctx.stroke();
    ctx.beginPath(); ctx.arc(640, 360, 90, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath(); ctx.arc(640, 360, 5, 0, 7); ctx.fill();
    // penalty boxes
    ctx.strokeRect(30, 200, 130, 320);
    ctx.strokeRect(1120, 200, 130, 320);
    // goals with nets
    for (const [gx, team] of [[0, 0], [1250, 1]]) {
      ctx.fillStyle = team === 0 ? 'rgba(47,155,255,.16)' : 'rgba(255,70,85,.16)';
      ctx.fillRect(gx, 250, 30, 220);
      ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1;
      for (let y = 250; y <= 470; y += 14) { ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx + 30, y); ctx.stroke(); }
      for (let x = gx; x <= gx + 30; x += 10) { ctx.beginPath(); ctx.moveTo(x, 250); ctx.lineTo(x, 470); ctx.stroke(); }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(gx + (team === 0 ? 30 : 0), 250); ctx.lineTo(gx + (team === 0 ? 30 : 0), 470); ctx.stroke();
    }
    // cars
    for (const p of G.players) {
      const c = S.cars.get(p.pid);
      if (!c) continue;
      Draw2.dropShadow(ctx, c.x, c.y + 18, 22);
      const teamC = c.team === 0 ? '#2f9bff' : '#ff4655';
      Draw2.orb(ctx, c.x, c.y, 22, teamC);
      // player-color center cap + jersey number
      Draw2.orb(ctx, c.x, c.y, 12, p.color);
      Draw2.label(ctx, String(p.slot + 1), c.x, c.y + 0.5, 13, '#fff');
      if (c.boost <= 0) {
        ctx.fillStyle = '#ffb02f';
        ctx.beginPath(); ctx.moveTo(c.x + 24, c.y - 18); ctx.lineTo(c.x + 30, c.y - 26); ctx.lineTo(c.x + 28, c.y - 19); ctx.lineTo(c.x + 33, c.y - 19); ctx.lineTo(c.x + 25, c.y - 10); ctx.lineTo(c.x + 27, c.y - 17); ctx.closePath(); ctx.fill();
      }
      Draw2.tag(ctx, p, c.x, c.y - 36);
    }
    // ball: classic panels + rotation
    const b = S.ball;
    Draw2.dropShadow(ctx, b.x, b.y + 14, 15);
    Draw2.orb(ctx, b.x, b.y, 16, '#f2f2f2');
    ctx.save();
    ctx.translate(b.x, b.y); ctx.rotate(b.rot || 0);
    ctx.fillStyle = '#20242c';
    ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, 7); ctx.fill();
    for (let a = 0; a < 5; a++) {
      const ang = a * (Math.PI * 2 / 5);
      ctx.beginPath(); ctx.ellipse(Math.cos(ang) * 11, Math.sin(ang) * 11, 3.6, 2.6, ang, 0, 7); ctx.fill();
    }
    ctx.restore();
    // scoreboard
    ctx.fillStyle = 'rgba(5,8,16,.65)';
    ctx.beginPath(); ctx.roundRect(G.W / 2 - 120, 8, 240, 44, 22); ctx.fill();
    Draw2.label(ctx, 'BLUE', G.W / 2 - 78, 30, 13, '#7db9ff');
    Draw2.label(ctx, 'RED', G.W / 2 + 78, 30, 13, '#ff8a93');
    Draw2.label(ctx, `${S.score[0]}   -   ${S.score[1]}`, G.W / 2, 30, 24);
    const left = Math.max(0, this.TIME - G.time);
    Draw2.label(ctx, Math.floor(left / 60) + ':' + String(Math.ceil(left % 60) % 60).padStart(2, '0'), G.W / 2, 64, 14, left < 11 ? '#ff5a66' : 'rgba(255,255,255,.75)');
    if (S.resetT > 0 || S.goalFlash > 0) Draw2.label(ctx, 'GOAL', G.W / 2, 340, 110, '#ffcf3f');
  },
});
