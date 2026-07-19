// Pong Royale — everyone guards an arc of the circle. Lose 3 balls and you're out.
registerGame({
  id: 'pong', title: 'Pong Royale', icon: 'pong', desc: 'Guard your slice of the circle. 3 lives. The ball keeps getting faster.',
  players: '1-8', minPlayers: 1,
  CX: 640, CY: 370, R: 300,
  S: null,
  init(G) {
    G.setScheme(null, 'stick', { msg: T('slidePaddle') });
    const S = this.S = { pads: new Map(), ball: null, speed: 260, deathOrder: [], serveT: 1.5, hist: [] };
    const n = G.players.length;
    G.players.forEach((p, i) => {
      S.pads.set(p.pid, {
        segStart: (i / n) * Math.PI * 2, segLen: (Math.PI * 2) / n,
        pos: 0.5, lives: 3, alive: true, width: Math.min(0.5, 1.6 / n),
      });
    });
    this.serve();
  },
  serve() {
    const a = rand(0, Math.PI * 2);
    this.S.ball = { x: this.CX, y: this.CY, vx: Math.cos(a), vy: Math.sin(a) };
    this.S.serveT = 1.2;
    this.S.hist = [];
  },
  bot(p, G, dt) {
    const S = this.S, pad = S.pads.get(p.pid);
    if (!pad || !pad.alive || !S.ball) return;
    let ang = Math.atan2(S.ball.y - this.CY, S.ball.x - this.CX);
    if (ang < 0) ang += Math.PI * 2;
    let rel = ang - pad.segStart;
    while (rel < 0) rel += Math.PI * 2;
    const target = rel < pad.segLen ? rel / pad.segLen : 0.5;
    p.in.x = clamp((target - pad.pos) * 5, -1, 1) * 0.85;
    p.in.y = 0;
  },
  update(dt, G) {
    const S = this.S;
    for (const p of G.players) {
      const pad = S.pads.get(p.pid);
      if (!pad || !pad.alive) continue;
      pad.pos = clamp(pad.pos + p.in.x * 1.6 * dt, pad.width / 2, 1 - pad.width / 2);
    }
    if (S.serveT > 0) { S.serveT -= dt; return; }
    const b = S.ball;
    S.speed += dt * 14;
    b.x += b.vx * S.speed * dt;
    b.y += b.vy * S.speed * dt;
    S.hist.unshift({ x: b.x, y: b.y });
    if (S.hist.length > 10) S.hist.pop();
    const d = dist(b.x, b.y, this.CX, this.CY);
    if (d >= this.R - 12) {
      let ang = Math.atan2(b.y - this.CY, b.x - this.CX);
      if (ang < 0) ang += Math.PI * 2;
      let hitPad = null, owner = null;
      for (const [pid, pad] of S.pads) {
        let rel = ang - pad.segStart;
        while (rel < 0) rel += Math.PI * 2;
        if (rel < pad.segLen) { owner = pid; hitPad = pad; break; }
      }
      let bounce = false;
      if (hitPad && hitPad.alive) {
        let rel = (ang - hitPad.segStart);
        while (rel < 0) rel += Math.PI * 2;
        const frac = rel / hitPad.segLen;
        if (Math.abs(frac - hitPad.pos) < hitPad.width / 2 + 0.02) {
          bounce = true;
          Draw2.boom(b.x, b.y, '#ffffff', 6, 120, 0.3, 3);
        } else {
          hitPad.lives--;
          const p = G.players.find(q => q.pid === owner);
          Draw2.boom(b.x, b.y, p ? p.color : '#fff', 18, 260, 0.7);
          AudioSys.sfx('boom');
          if (p) G.vib(p, 200);
          if (hitPad.lives <= 0) {
            hitPad.alive = false;
            S.deathOrder.push(owner);
            if (p) G.toast(T('isOut', p.name));
          }
          this.serve();
          const stillAlive = [...S.pads.entries()].filter(([, pd]) => pd.alive);
          if ((S.pads.size > 1 && stillAlive.length <= 1) || (S.pads.size === 1 && !stillAlive.length)) {
            const rows = [
              ...stillAlive.map(([pid]) => ({ pid, label: T('lastStanding') })),
              ...[...S.deathOrder].reverse().map(pid => ({ pid, label: '' })),
            ];
            G.finish(rows);
          }
          return;
        }
      } else {
        bounce = true;
      }
      if (bounce) {
        const nx = (b.x - this.CX) / d, ny = (b.y - this.CY) / d;
        const dot = b.vx * nx + b.vy * ny;
        b.vx -= 2 * dot * nx;
        b.vy -= 2 * dot * ny;
        const a2 = Math.atan2(b.vy, b.vx) + rand(-0.15, 0.15);
        b.vx = Math.cos(a2); b.vy = Math.sin(a2);
        b.x = this.CX + nx * (this.R - 14);
        b.y = this.CY + ny * (this.R - 14);
      }
    }
  },
  draw(ctx, G) {
    const S = this.S;
    Draw2.bg(ctx, G, '#0a1220', '#101b33');
    // arena floor: concentric rings
    for (let r = this.R; r > 0; r -= 50) {
      ctx.strokeStyle = `rgba(255,255,255,${0.03 + (r === this.R ? 0.05 : 0)})`;
      ctx.lineWidth = r === this.R ? 2 : 1;
      ctx.beginPath(); ctx.arc(this.CX, this.CY, r, 0, 7); ctx.stroke();
    }
    const rg = ctx.createRadialGradient(this.CX, this.CY, 40, this.CX, this.CY, this.R);
    rg.addColorStop(0, 'rgba(47,155,255,.05)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(this.CX, this.CY, this.R, 0, 7); ctx.fill();
    for (const p of G.players) {
      const pad = S.pads.get(p.pid);
      if (!pad) continue;
      // segment guide / dead wall
      ctx.strokeStyle = pad.alive ? 'rgba(255,255,255,.1)' : 'rgba(170,180,200,.5)';
      ctx.lineWidth = pad.alive ? 5 : 11;
      ctx.beginPath();
      ctx.arc(this.CX, this.CY, this.R, pad.segStart + 0.02, pad.segStart + pad.segLen - 0.02);
      ctx.stroke();
      if (pad.alive) {
        const a1 = pad.segStart + (pad.pos - pad.width / 2) * pad.segLen;
        const a2 = pad.segStart + (pad.pos + pad.width / 2) * pad.segLen;
        // glowing capsule paddle
        ctx.shadowColor = p.color; ctx.shadowBlur = 18;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 15;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(this.CX, this.CY, this.R - 6, a1, a2); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,.65)';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(this.CX, this.CY, this.R - 10, a1 + 0.015, a2 - 0.015); ctx.stroke();
        const mid = pad.segStart + pad.segLen / 2;
        const lx = this.CX + Math.cos(mid) * (this.R + 44);
        const ly = this.CY + Math.sin(mid) * (this.R + 44);
        Draw2.tag(ctx, p, lx, ly - 8);
        // lives as pips
        for (let l = 0; l < 3; l++) {
          ctx.fillStyle = l < pad.lives ? p.color : 'rgba(255,255,255,.15)';
          ctx.beginPath(); ctx.arc(lx - 14 + l * 14, ly + 10, 4, 0, 7); ctx.fill();
        }
      }
    }
    if (S.ball && S.serveT <= 0) {
      // trail
      for (let i = S.hist.length - 1; i >= 0; i--) {
        const h = S.hist[i];
        ctx.globalAlpha = 0.25 * (1 - i / S.hist.length);
        ctx.fillStyle = '#9fd7ff';
        ctx.beginPath(); ctx.arc(h.x, h.y, 9 * (1 - i / S.hist.length) + 2, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
      Draw2.orb(ctx, S.ball.x, S.ball.y, 11, '#e8f4ff', true);
    } else {
      Draw2.label(ctx, T('serving'), this.CX, this.CY, 22, 'rgba(255,255,255,.6)');
    }
    Draw2.vignette(ctx, G, 0.45);
    Draw2.label(ctx, T('ballSpeed') + ' ' + Math.round(S.speed), G.W / 2, 26, 14, 'rgba(255,255,255,.5)');
  },
});
