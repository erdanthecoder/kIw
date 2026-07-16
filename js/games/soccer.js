// Rocket Soccer — stadium edition: crowd stands, boost pads on the pitch,
// goal confetti, kickoff countdown, and a chaotic second ball in the last 30s.
registerGame({
  id: 'soccer', title: 'Rocket Soccer', icon: 'soccer', desc: 'Auto-teams, boost pads, and a second ball in the final 30 seconds. First to 5.',
  players: '2-8', minPlayers: 2, TIME: 120, GOALS: 5,
  F: { x1: 70, y1: 60, x2: 1210, y2: 660 }, GT: 255, GB: 465,
  S: null,
  init(G) {
    G.setScheme(null, 'stick1', { a: T('boost') });
    const S = this.S = {
      cars: new Map(), balls: [this.newBall()],
      score: [0, 0], resetT: 0, goalFlash: 0, goalTeam: 0, overtime: false,
      pads: [{ x: 640, y: 150, cd: 0 }, { x: 640, y: 570, cd: 0 }],
      crowd: [],
    };
    // seeded crowd rows around the pitch
    const rnd = mulberry(4242);
    for (let i = 0; i < 260; i++) {
      const side = i % 4;
      let x, y;
      if (side === 0) { x = 90 + rnd() * 1100; y = 14 + rnd() * 30; }
      else if (side === 1) { x = 90 + rnd() * 1100; y = 676 + rnd() * 30; }
      else if (side === 2) { x = 10 + rnd() * 44; y = 80 + rnd() * 560; }
      else { x = 1226 + rnd() * 44; y = 80 + rnd() * 560; }
      S.crowd.push({ x, y, c: ['#c9d4f0', '#8fa3cc', '#e8b98a', '#a3c98f', '#cc8fa3'][i % 5], ph: rnd() * 6.28 });
    }
    G.players.forEach((p, i) => {
      S.cars.set(p.pid, this.spawnCar(i % 2, Math.floor(i / 2)));
    });
  },
  newBall() { return { x: 640, y: 360, vx: 0, vy: 0, rot: 0, spin: 0 }; },
  spawnCar(team, row) {
    return { team, x: team === 0 ? 320 : 960, y: 230 + row * 90, vx: 0, vy: 0, boost: 0, touches: 0, boostFx: 0 };
  },
  onBtn(p, b, G) {
    const c = this.S.cars.get(p.pid);
    if (c && b === 'a' && c.boost <= 0) {
      c.boost = 2.5;
      c.boostFx = 0.35;
      const mag = Math.hypot(p.in.x, p.in.y) || 1;
      c.vx += (p.in.x / mag) * 430;
      c.vy += (p.in.y / mag) * 430;
      G.vib(p, 60);
    }
  },
  resetKickoff(S, G) {
    S.balls = [this.newBall()];
    if (S.overtime) S.balls.push(Object.assign(this.newBall(), { y: 300 }));
    let rows = [0, 0];
    for (const p of G.players) {
      const c = S.cars.get(p.pid);
      if (!c) continue;
      Object.assign(c, this.spawnCar(c.team, rows[c.team]++), { touches: c.touches, team: c.team });
    }
  },
  update(dt, G) {
    const S = this.S, F = this.F;
    S.goalFlash -= dt;
    // overtime chaos: second ball for the final 30 seconds
    if (!S.overtime && this.TIME - G.time <= 30) {
      S.overtime = true;
      S.balls.push(Object.assign(this.newBall(), { y: 300 }));
      G.toast(T('overtime'));
    }
    if (S.resetT > 0) {
      S.resetT -= dt;
      if (S.resetT <= 0) this.resetKickoff(S, G);
      return;
    }
    const R = 22, BR = 16;
    for (const pad of S.pads) pad.cd -= dt;
    for (const p of G.players) {
      const c = S.cars.get(p.pid);
      if (!c) continue;
      c.boost -= dt; c.boostFx -= dt;
      c.vx += p.in.x * 900 * dt;
      c.vy += p.in.y * 900 * dt;
      c.vx *= Math.pow(0.12, dt); c.vy *= Math.pow(0.12, dt);
      const sp = Math.hypot(c.vx, c.vy), MAX = 330;
      if (sp > MAX) { c.vx *= MAX / sp; c.vy *= MAX / sp; }
      c.x = clamp(c.x + c.vx * dt, F.x1 + R, F.x2 - R);
      c.y = clamp(c.y + c.vy * dt, F.y1 + R, F.y2 - R);
      if (c.boostFx > 0) Draw2.trail(c.x - c.vx * 0.05, c.y - c.vy * 0.05, '#ffb02f', 4, 0.3);
      // boost pads: instant recharge + burst
      for (const pad of S.pads) {
        if (pad.cd <= 0 && dist(c.x, c.y, pad.x, pad.y) < 30) {
          pad.cd = 5;
          c.boost = 0;
          Draw2.boom(pad.x, pad.y, '#ffb02f', 12, 200, 0.5, 4);
          G.vib(p, 40);
        }
      }
      for (const b of S.balls) {
        const d = dist(c.x, c.y, b.x, b.y);
        if (d < R + BR) {
          const nx = (b.x - c.x) / (d || 1), ny = (b.y - c.y) / (d || 1);
          const push = Math.max(150, Math.hypot(c.vx, c.vy) * 1.4);
          b.vx = nx * push + c.vx * 0.4;
          b.vy = ny * push + c.vy * 0.4;
          b.x = c.x + nx * (R + BR + 1);
          b.y = c.y + ny * (R + BR + 1);
          b.spin = (Math.random() - 0.5) * 12;
          c.touches++;
          Draw2.boom(b.x, b.y, '#ffffff', 5, 90, 0.25, 2.5);
        }
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
    for (const b of S.balls) {
      b.vx *= Math.pow(0.35, dt); b.vy *= Math.pow(0.35, dt);
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.rot += (Math.hypot(b.vx, b.vy) / 40 + b.spin * 0.1) * dt;
      if (b.y < F.y1 + BR) { b.y = F.y1 + BR; b.vy *= -0.85; }
      if (b.y > F.y2 - BR) { b.y = F.y2 - BR; b.vy *= -0.85; }
      if (b.x < F.x1 + BR) {
        if (b.y > this.GT && b.y < this.GB) return this.goal(1, b, G);
        b.x = F.x1 + BR; b.vx *= -0.85;
      }
      if (b.x > F.x2 - BR) {
        if (b.y > this.GT && b.y < this.GB) return this.goal(0, b, G);
        b.x = F.x2 - BR; b.vx *= -0.85;
      }
    }
    if (G.time > this.TIME) this.gameOver(G);
  },
  goal(team, ball, G) {
    const S = this.S;
    S.score[team]++;
    S.goalFlash = 1.6;
    S.goalTeam = team;
    AudioSys.sfx('goal');
    const gx = team === 1 ? this.F.x1 : this.F.x2;
    Draw2.boom(gx, (this.GT + this.GB) / 2, team === 0 ? '#2f9bff' : '#ff4655', 30, 400, 1, 6);
    Draw2.confetti(640, 80, 60);
    G.toast(T('goalFor', team === 0 ? T('blueTeam') : T('redTeam')));
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
      .map(([pid, c]) => ({ pid, label: `${c.team === 0 ? T('blue') : T('red')} · ${c.touches} ${T('touches')}${c.team === winner ? ' · ' + T('win2') : winner === -1 ? ' · ' + T('draw2') : ''}` }));
    G.finish(rows);
  },
  draw(ctx, G) {
    const S = this.S, F = this.F;
    // stadium surround
    Draw2.bg(ctx, G, '#0c101c', '#131a2c');
    // crowd
    const t = G.time;
    for (const cd of S.crowd) {
      const jump = S.goalFlash > 0 ? Math.abs(Math.sin(t * 10 + cd.ph)) * 5 : Math.sin(t * 2 + cd.ph) * 1;
      ctx.fillStyle = cd.c;
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.arc(cd.x, cd.y - jump, 3.2, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // pitch: mowed stripes
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#0d5228' : '#0f5c2d';
      ctx.fillRect(F.x1 + i * (F.x2 - F.x1) / 8, F.y1, (F.x2 - F.x1) / 8, F.y2 - F.y1);
    }
    const lg = ctx.createRadialGradient(640, 360, 100, 640, 360, 640);
    lg.addColorStop(0, 'rgba(255,255,255,.05)');
    lg.addColorStop(1, 'rgba(0,0,0,.24)');
    ctx.fillStyle = lg;
    ctx.fillRect(F.x1, F.y1, F.x2 - F.x1, F.y2 - F.y1);
    // markings
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3;
    ctx.strokeRect(F.x1, F.y1, F.x2 - F.x1, F.y2 - F.y1);
    ctx.beginPath(); ctx.moveTo(640, F.y1); ctx.lineTo(640, F.y2); ctx.stroke();
    ctx.beginPath(); ctx.arc(640, 360, 85, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath(); ctx.arc(640, 360, 5, 0, 7); ctx.fill();
    ctx.strokeRect(F.x1, 210, 120, 300);
    ctx.strokeRect(F.x2 - 120, 210, 120, 300);
    // boost pads
    for (const pad of S.pads) {
      const ready = pad.cd <= 0;
      ctx.globalAlpha = ready ? 1 : 0.25;
      ctx.shadowColor = '#ffb02f'; ctx.shadowBlur = ready ? 16 : 0;
      ctx.strokeStyle = '#ffb02f'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(pad.x, pad.y, 24, 0, 7); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffb02f';
      ctx.beginPath();
      ctx.moveTo(pad.x + 4, pad.y - 12); ctx.lineTo(pad.x - 8, pad.y + 3); ctx.lineTo(pad.x - 1, pad.y + 3);
      ctx.lineTo(pad.x - 4, pad.y + 12); ctx.lineTo(pad.x + 8, pad.y - 3); ctx.lineTo(pad.x + 1, pad.y - 3);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // goals with nets
    for (const [gx, team] of [[F.x1 - 30, 0], [F.x2, 1]]) {
      ctx.fillStyle = team === 0 ? 'rgba(47,155,255,.16)' : 'rgba(255,70,85,.16)';
      ctx.fillRect(gx, this.GT, 30, this.GB - this.GT);
      ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1;
      for (let y = this.GT; y <= this.GB; y += 14) { ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx + 30, y); ctx.stroke(); }
      for (let x = gx; x <= gx + 30; x += 10) { ctx.beginPath(); ctx.moveTo(x, this.GT); ctx.lineTo(x, this.GB); ctx.stroke(); }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
      const postX = team === 0 ? gx + 30 : gx;
      ctx.beginPath(); ctx.moveTo(postX, this.GT); ctx.lineTo(postX, this.GB); ctx.stroke();
    }
    // cars
    for (const p of G.players) {
      const c = S.cars.get(p.pid);
      if (!c) continue;
      Draw2.dropShadow(ctx, c.x, c.y + 18, 22);
      const teamC = c.team === 0 ? '#2f9bff' : '#ff4655';
      Draw2.orb(ctx, c.x, c.y, 22, teamC);
      Draw2.orb(ctx, c.x, c.y, 12, p.color);
      Draw2.label(ctx, String(p.slot + 1), c.x, c.y + 0.5, 13, '#fff');
      if (c.boost <= 0) {
        ctx.fillStyle = '#ffb02f';
        ctx.beginPath(); ctx.moveTo(c.x + 24, c.y - 18); ctx.lineTo(c.x + 30, c.y - 26); ctx.lineTo(c.x + 28, c.y - 19); ctx.lineTo(c.x + 33, c.y - 19); ctx.lineTo(c.x + 25, c.y - 10); ctx.lineTo(c.x + 27, c.y - 17); ctx.closePath(); ctx.fill();
      }
      Draw2.tag(ctx, p, c.x, c.y - 36);
    }
    // balls
    for (const b of S.balls) {
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 320) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 18; }
      Draw2.dropShadow(ctx, b.x, b.y + 14, 15);
      Draw2.orb(ctx, b.x, b.y, 16, '#f2f2f2');
      ctx.shadowBlur = 0;
      ctx.save();
      ctx.translate(b.x, b.y); ctx.rotate(b.rot || 0);
      ctx.fillStyle = '#20242c';
      ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, 7); ctx.fill();
      for (let a = 0; a < 5; a++) {
        const ang = a * (Math.PI * 2 / 5);
        ctx.beginPath(); ctx.ellipse(Math.cos(ang) * 11, Math.sin(ang) * 11, 3.6, 2.6, ang, 0, 7); ctx.fill();
      }
      ctx.restore();
    }
    // scoreboard
    ctx.fillStyle = 'rgba(5,8,16,.72)';
    ctx.beginPath(); ctx.roundRect(G.W / 2 - 120, 6, 240, 46, 22); ctx.fill();
    Draw2.label(ctx, T('blue'), G.W / 2 - 76, 29, 12, '#7db9ff');
    Draw2.label(ctx, T('red'), G.W / 2 + 76, 29, 12, '#ff8a93');
    Draw2.label(ctx, `${S.score[0]}   -   ${S.score[1]}`, G.W / 2, 29, 24);
    const left = Math.max(0, this.TIME - G.time);
    Draw2.label(ctx, Math.floor(left / 60) + ':' + String(Math.ceil(left % 60) % 60).padStart(2, '0'), G.W / 2, 66, 14, S.overtime ? '#ffcf3f' : left < 11 ? '#ff5a66' : 'rgba(255,255,255,.75)');
    if (S.resetT > 0 || S.goalFlash > 0) {
      Draw2.label(ctx, T('goal'), G.W / 2, 340, 110, S.goalTeam === 0 ? '#7db9ff' : '#ff8a93');
    }
  },
});
