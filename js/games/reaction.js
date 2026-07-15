// Reaction Duel — wait for green… TAP! False starts cost you.
registerGame({
  id: 'reaction', title: 'Reaction Duel', icon: '⚡', desc: 'Wait for GREEN, then tap fastest. Jump the gun and lose points!',
  players: '1-8', minPlayers: 1, ROUNDS: 7,
  S: null,
  init(G) {
    G.setScheme(null, 'tap', { label: 'WAIT…' });
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
  update(dt, G) {
    const S = this.S;
    S.phaseT -= dt;
    if (S.phase === 'go') S.goTime += dt;
    if (S.phase === 'wait' && S.phaseT <= 0) {
      S.phase = 'go'; S.goTime = 0; S.phaseT = 2.5;
      G.broadcast({ t: 'scene', s: 'tap', game: 'reaction', label: 'TAP NOW! ⚡' });
    } else if (S.phase === 'go' && S.phaseT <= 0) {
      // score round: fastest gets 100, second 70, third 50, rest 25
      const ranked = [...S.taps.entries()].sort((a, b) => a[1] - b[1]);
      const ptsTable = [100, 70, 50, 35, 25, 20, 15, 10];
      ranked.forEach(([pid], i) => S.scores.set(pid, (S.scores.get(pid) || 0) + (ptsTable[i] || 10)));
      S.lastRanked = ranked;
      S.phase = 'reveal'; S.phaseT = 2.5;
    } else if (S.phase === 'reveal' && S.phaseT <= 0) {
      S.round++;
      if (S.round >= this.ROUNDS) {
        const rows = [...S.scores.entries()].sort((a, b) => b[1] - a[1]).map(([pid, sc]) => ({ pid, label: sc + ' pts' }));
        return G.finish(rows);
      }
      S.phase = 'wait'; S.phaseT = rand(1.2, 4.5);
      S.taps = new Map(); S.fouls = new Set();
      G.broadcast({ t: 'scene', s: 'tap', game: 'reaction', label: 'WAIT…' });
    }
  },
  draw(ctx, G) {
    const S = this.S;
    if (S.phase === 'go') Draw2.bg(ctx, G, '#0c4d2b', '#12a35a');
    else if (S.phase === 'wait') Draw2.bg(ctx, G, '#4d0c14', '#7a1420');
    else Draw2.bg(ctx, G, '#101528', '#182040');
    Draw2.label(ctx, `Round ${S.round + 1} / ${this.ROUNDS}`, G.W / 2, 50, 22, 'rgba(255,255,255,.7)');
    if (S.phase === 'wait') Draw2.label(ctx, 'WAIT FOR IT…', G.W / 2, 300, 72);
    if (S.phase === 'go') Draw2.label(ctx, 'TAP!! ⚡', G.W / 2, 300, 110);
    if (S.phase === 'reveal') {
      Draw2.label(ctx, 'Round results', G.W / 2, 160, 40);
      (S.lastRanked || []).slice(0, 5).forEach(([pid, t], i) => {
        const p = G.players.find(q => q.pid === pid);
        if (p) Draw2.label(ctx, `${i + 1}. ${p.name} — ${(t * 1000).toFixed(0)}ms`, G.W / 2, 230 + i * 46, 28, p.color);
      });
      if (!S.lastRanked || !S.lastRanked.length) Draw2.label(ctx, 'Nobody tapped 😅', G.W / 2, 260, 30);
    }
    let sx = G.W / 2 - (G.players.length - 1) * 70;
    for (const p of G.players) {
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(sx, 620, 16, 0, 7); ctx.fill();
      if (S.fouls.has(p.pid)) Draw2.label(ctx, '🚫', sx, 620, 16);
      Draw2.label(ctx, p.name, sx, 650, 12);
      Draw2.label(ctx, (S.scores.get(p.pid) || 0) + '', sx, 672, 14, '#ffcf3f');
      sx += 140;
    }
  },
});
