// Reaction Duel — wait for green, then tap fastest. False starts cost points.
registerGame({
  id: 'reaction', title: 'Reaction Duel', icon: 'reaction', desc: 'Wait for GREEN, then tap fastest. Jump the gun and lose points.',
  players: '1-8', minPlayers: 1, ROUNDS: 7,
  S: null,
  init(G) {
    G.setScheme(null, 'tap', { label: T('wait') });
    this.S = {
      round: 0, phase: 'wait', phaseT: rand(1.5, 4),
      scores: new Map(G.players.map(p => [p.pid, 0])),
      taps: new Map(), fouls: new Set(),
    };
  },
  onBtn(p, b, G) {
    const S = this.S;
    if (S.phase === 'wait') {
      if (!S.fouls.has(p.pid)) {
        S.fouls.add(p.pid);
        S.scores.set(p.pid, (S.scores.get(p.pid) || 0) - 50);
        G.vib(p, 300);
      }
    } else if (S.phase === 'go' && !S.taps.has(p.pid) && !S.fouls.has(p.pid)) {
      S.taps.set(p.pid, S.goTime);
      G.vib(p, 40);
    }
  },
  bot(p, G, dt) {
    const S = this.S;
    if (S.phase !== 'go' || S.taps.has(p.pid) || S.fouls.has(p.pid)) return;
    if (p.rr !== S.round) { p.rr = S.round; p.rAcc = 0; p.rDelay = rand(0.25, 0.65); }
    p.rAcc += dt;
    if (p.rAcc >= p.rDelay) this.onBtn(p, 'tap', G);
  },
  update(dt, G) {
    const S = this.S;
    S.phaseT -= dt;
    if (S.phase === 'go') S.goTime += dt;
    if (S.phase === 'wait' && S.phaseT <= 0) {
      S.phase = 'go'; S.goTime = 0; S.phaseT = 2.5;
      G.broadcast({ t: 'scene', s: 'tap', game: 'reaction', label: T('tapNow') });
    } else if (S.phase === 'go' && S.phaseT <= 0) {
      const ranked = [...S.taps.entries()].sort((a, b) => a[1] - b[1]);
      const ptsTable = [100, 70, 50, 35, 25, 20, 15, 10];
      ranked.forEach(([pid], i) => S.scores.set(pid, (S.scores.get(pid) || 0) + (ptsTable[i] || 10)));
      S.lastRanked = ranked;
      S.phase = 'reveal'; S.phaseT = 2.5;
    } else if (S.phase === 'reveal' && S.phaseT <= 0) {
      S.round++;
      if (S.round >= this.ROUNDS) {
        const rows = [...S.scores.entries()].sort((a, b) => b[1] - a[1]).map(([pid, sc]) => ({ pid, label: sc + ' ' + T('pts') }));
        return G.finish(rows);
      }
      S.phase = 'wait'; S.phaseT = rand(1.2, 4.5);
      S.taps = new Map(); S.fouls = new Set();
      G.broadcast({ t: 'scene', s: 'tap', game: 'reaction', label: T('wait') });
    }
  },
  light(ctx, x, y, r, color, lit) {
    // traffic-light lamp with housing
    ctx.fillStyle = '#0c0e14';
    ctx.beginPath(); ctx.arc(x, y, r + 12, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r + 12, 0, 7); ctx.stroke();
    if (lit) { ctx.shadowColor = color; ctx.shadowBlur = 60; }
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, lit ? Draw2.lighten(color, 0.6) : Draw2.darken(color, 0.72));
    g.addColorStop(1, lit ? color : Draw2.darken(color, 0.86));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.shadowBlur = 0;
    if (lit) {
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - r * 0.4, r * 0.26, r * 0.14, -0.6, 0, 7); ctx.fill();
    }
  },
  draw(ctx, G) {
    const S = this.S;
    Draw2.bg(ctx, G, '#0a0d16', '#121628');
    Draw2.label(ctx, T('roundN', S.round + 1, this.ROUNDS), G.W / 2, 46, 20, 'rgba(255,255,255,.7)');
    // starting-light rig
    ctx.fillStyle = '#1a1e2c';
    ctx.beginPath(); ctx.roundRect(G.W / 2 - 90, 90, 180, 420, 26); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(G.W / 2 - 90, 90, 180, 420, 26); ctx.stroke();
    this.light(ctx, G.W / 2, 165, 46, '#ff4655', S.phase === 'wait');
    this.light(ctx, G.W / 2, 300, 46, '#ffcf3f', false);
    this.light(ctx, G.W / 2, 435, 46, '#2fd573', S.phase === 'go');
    if (S.phase === 'wait') Draw2.label(ctx, T('waitGreen'), G.W / 2, 560, 34, '#ff8a93');
    if (S.phase === 'go') Draw2.label(ctx, T('tapNow'), G.W / 2, 560, 46, '#7dffb0');
    if (S.phase === 'reveal') {
      Draw2.panel(ctx, G.W / 2 - 240, 120, 480, 320, 18);
      Draw2.label(ctx, T('roundResults'), G.W / 2, 152, 24);
      (S.lastRanked || []).slice(0, 5).forEach(([pid, t], i) => {
        const p = G.players.find(q => q.pid === pid);
        if (p) Draw2.label(ctx, `${i + 1}.  ${p.name}  —  ${(t * 1000).toFixed(0)} ms`, G.W / 2, 200 + i * 44, 22, p.color);
      });
      if (!S.lastRanked || !S.lastRanked.length) Draw2.label(ctx, T('nobodyTapped'), G.W / 2, 240, 24, '#8b94ad');
    }
    let sx = G.W / 2 - (G.players.length - 1) * 72;
    for (const p of G.players) {
      Draw2.pawn(ctx, sx, 630, 15, p.color);
      if (S.fouls.has(p.pid)) {
        ctx.strokeStyle = '#ff4655'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(sx - 8, 622); ctx.lineTo(sx + 8, 638); ctx.moveTo(sx + 8, 622); ctx.lineTo(sx - 8, 638); ctx.stroke();
      }
      Draw2.label(ctx, p.name, sx, 660, 12);
      Draw2.label(ctx, (S.scores.get(p.pid) || 0) + '', sx, 682, 15, '#ffcf3f');
      sx += 144;
    }
  },
});
