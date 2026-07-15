// Pong Royale — everyone guards an arc of the circle. Lose 3 balls and you're out.
registerGame({
  id: 'pong', title: 'Pong Royale', icon: '🏓', desc: 'Guard your slice of the circle. 3 lives. Ball keeps getting faster!',
  players: '1-8', minPlayers: 1,
  CX: 640, CY: 370, R: 300,
  S: null,
  init(G) {
    G.setScheme(null, 'stick', { msg: 'Slide your paddle left/right along your arc' });
    const S = this.S = { pads: new Map(), ball: null, speed: 260, deathOrder: [], serveT: 1.5 };
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
    const d = dist(b.x, b.y, this.CX, this.CY);
    if (d >= this.R - 12) {
      let ang = Math.atan2(b.y - this.CY, b.x - this.CX);
      if (ang < 0) ang += Math.PI * 2;
      // whose segment?
      let hitPad = null, owner = null;
      for (const [pid, pad] of S.pads) {
        let rel = ang - pad.segStart;
        while (rel < 0) rel += Math.PI * 2;
        if (rel < pad.segLen) { owner = pid; hitPad = pad; break; }
      }
      const alive = [...S.pads.values()].filter(pd => pd.alive).length;
      let bounce = false;
      if (hitPad && hitPad.alive) {
        // paddle covers [pos - width/2, pos + width/2] of the segment
        let rel = (ang - hitPad.segStart);
        while (rel < 0) rel += Math.PI * 2;
        const frac = rel / hitPad.segLen;
        if (Math.abs(frac - hitPad.pos) < hitPad.width / 2 + 0.02) {
          bounce = true;
        } else {
          hitPad.lives--;
          const p = G.players.find(q => q.pid === owner);
          if (p) G.vib(p, 200);
          if (hitPad.lives <= 0) {
            hitPad.alive = false;
            S.deathOrder.push(owner);
            if (p) G.toast(`${p.name} is out!`);
          }
          this.serve();
          const stillAlive = [...S.pads.entries()].filter(([, pd]) => pd.alive);
          if ((S.pads.size > 1 && stillAlive.length <= 1) || (S.pads.size === 1 && !stillAlive.length)) {
            const rows = [
              ...stillAlive.map(([pid]) => ({ pid, label: '👑 last standing' })),
              ...[...S.deathOrder].reverse().map(pid => ({ pid, label: '' })),
            ];
            G.finish(rows);
          }
          return;
        }
      } else {
        bounce = true; // dead segments become walls
      }
      if (bounce) {
        const nx = (b.x - this.CX) / d, ny = (b.y - this.CY) / d;
        const dot = b.vx * nx + b.vy * ny;
        b.vx -= 2 * dot * nx;
        b.vy -= 2 * dot * ny;
        // small random deflection keeps it interesting
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
    ctx.strokeStyle = 'rgba(255,255,255,.15)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(this.CX, this.CY, this.R, 0, 7); ctx.stroke();
    for (const p of G.players) {
      const pad = S.pads.get(p.pid);
      if (!pad) continue;
      // segment guide
      ctx.strokeStyle = pad.alive ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.35)';
      ctx.lineWidth = pad.alive ? 6 : 10;
      ctx.beginPath();
      ctx.arc(this.CX, this.CY, this.R, pad.segStart + 0.02, pad.segStart + pad.segLen - 0.02);
      ctx.stroke();
      if (pad.alive) {
        const a1 = pad.segStart + (pad.pos - pad.width / 2) * pad.segLen;
        const a2 = pad.segStart + (pad.pos + pad.width / 2) * pad.segLen;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(this.CX, this.CY, this.R - 6, a1, a2); ctx.stroke();
        // label at segment middle
        const mid = pad.segStart + pad.segLen / 2;
        const lx = this.CX + Math.cos(mid) * (this.R + 40);
        const ly = this.CY + Math.sin(mid) * (this.R + 40);
        Draw2.label(ctx, `${p.name} ${'❤️'.repeat(pad.lives)}`, lx, ly, 13);
      }
    }
    if (S.ball && S.serveT <= 0) {
      ctx.fillStyle = '#fff';
      ctx.shadowColor = '#fff'; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(S.ball.x, S.ball.y, 11, 0, 7); ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      Draw2.label(ctx, 'Serve in ' + Math.ceil(S.serveT * 10) / 10 + '…', this.CX, this.CY, 22, 'rgba(255,255,255,.6)');
    }
    Draw2.label(ctx, 'Ball speed: ' + Math.round(S.speed), G.W / 2, 26, 16, 'rgba(255,255,255,.5)');
  },
});
