// Draw & Guess — one player sketches on their phone, everyone else guesses.
registerGame({
  id: 'draw', title: 'Draw & Guess', icon: 'draw', desc: 'Sketch on your phone — it appears on the TV. Others race to guess.',
  players: '2-8', minPlayers: 2,
  WORDS: ['cat', 'pizza', 'rocket', 'ghost', 'rainbow', 'castle', 'robot', 'banana', 'dragon', 'snowman', 'guitar', 'shark', 'cactus', 'crown', 'spider', 'burger', 'lighthouse', 'unicorn', 'volcano', 'penguin', 'wizard', 'submarine', 'tornado', 'dinosaur'],
  ROUND_TIME: 45,
  S: null, cvs: null,
  init(G) {
    this.S = {
      order: shuffle(G.players.map(p => p.pid)).slice(0, 6),
      ri: -1, phase: 'next', phaseT: 1,
      scores: new Map(G.players.map(p => [p.pid, 0])),
      word: '', options: [], guessed: new Map(), drawer: null,
      usedWords: [],
    };
    this.cvs = document.createElement('canvas');
    this.cvs.width = 800; this.cvs.height = 560;
    this.nextRound(G);
  },
  nextRound(G) {
    const S = this.S;
    S.ri++;
    if (S.ri >= S.order.length) return this.gameOver(G);
    S.drawer = S.order[S.ri];
    const drawerP = G.players.find(p => p.pid === S.drawer);
    if (!drawerP || drawerP.gone) return this.nextRound(G);
    const pool = this.WORDS.filter(w => !S.usedWords.includes(w));
    S.word = pool[Math.random() * pool.length | 0];
    S.usedWords.push(S.word);
    const decoys = shuffle(this.WORDS.filter(w => w !== S.word)).slice(0, 3);
    S.options = shuffle([S.word, ...decoys]);
    S.guessed = new Map();
    S.phase = 'draw'; S.phaseT = this.ROUND_TIME;
    const ctx = this.cvs.getContext('2d');
    ctx.fillStyle = '#fdfbf5'; ctx.fillRect(0, 0, 800, 560);
    for (const p of G.players) {
      if (p.pid === S.drawer) G.setScheme(p, 'draw', { word: S.word });
      else G.setScheme(p, 'quiz', { labels: S.options, msg: `${drawerP.name} is drawing — what is it?` });
    }
  },
  onMsg(p, m, G) {
    const S = this.S;
    if (m.t !== 'stroke' || p.pid !== S.drawer || S.phase !== 'draw') return;
    const ctx = this.cvs.getContext('2d');
    if (m.clear) { ctx.fillStyle = '#fdfbf5'; ctx.fillRect(0, 0, 800, 560); return; }
    if (!Array.isArray(m.pts) || m.pts.length < 2) return;
    ctx.strokeStyle = typeof m.c === 'string' ? m.c : '#111';
    ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(m.pts[0][0] * 800, m.pts[0][1] * 560);
    for (let i = 1; i < m.pts.length; i++) ctx.lineTo(m.pts[i][0] * 800, m.pts[i][1] * 560);
    ctx.stroke();
  },
  onBtn(p, b, G) {
    const S = this.S;
    if (S.phase !== 'draw' || p.pid === S.drawer || typeof b !== 'number' || S.guessed.has(p.pid)) return;
    const pick = S.options[b];
    S.guessed.set(p.pid, pick);
    if (pick === S.word) {
      const speed = Math.round(60 * (S.phaseT / this.ROUND_TIME));
      S.scores.set(p.pid, (S.scores.get(p.pid) || 0) + 100 + speed);
      S.scores.set(S.drawer, (S.scores.get(S.drawer) || 0) + 40);
      G.vib(p, 80);
    }
  },
  update(dt, G) {
    const S = this.S;
    S.phaseT -= dt;
    if (S.phase === 'draw') {
      const guessers = G.players.filter(p => p.pid !== S.drawer && !p.gone);
      const allGuessed = guessers.length > 0 && guessers.every(p => S.guessed.has(p.pid));
      if (S.phaseT <= 0 || allGuessed) {
        S.phase = 'reveal'; S.phaseT = 3;
        G.setScheme(null, 'wait', { msg: `It was "${S.word}"` });
      }
    } else if (S.phaseT <= 0) {
      this.nextRound(G);
    }
  },
  gameOver(G) {
    const rows = [...this.S.scores.entries()].sort((a, b) => b[1] - a[1]).map(([pid, sc]) => ({ pid, label: sc + ' pts' }));
    G.finish(rows);
  },
  draw(ctx, G) {
    const S = this.S;
    Draw2.bg(ctx, G, '#111726', '#182238');
    const drawerP = G.players.find(p => p.pid === S.drawer);
    // easel frame: wooden border with inner mat
    const fx = 236, fy = 86, fw = 808, fh = 568;
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(fx + 8, fy + 10, fw, fh);
    const wg = ctx.createLinearGradient(fx, fy, fx + fw, fy + fh);
    wg.addColorStop(0, '#8a6437'); wg.addColorStop(0.5, '#a5763f'); wg.addColorStop(1, '#6e4c26');
    ctx.fillStyle = wg;
    ctx.fillRect(fx - 14, fy - 14, fw + 28, fh + 28);
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2;
    ctx.strokeRect(fx - 14, fy - 14, fw + 28, fh + 28);
    ctx.drawImage(this.cvs, fx, fy, fw - 8, fh - 8);
    ctx.strokeStyle = 'rgba(0,0,0,.25)';
    ctx.strokeRect(fx, fy, fw - 8, fh - 8);
    // header
    Draw2.label(ctx, S.phase === 'reveal' ? `It was "${S.word}"` : `${drawerP ? drawerP.name : '?'} is drawing  ·  round ${S.ri + 1} of ${S.order.length}`, G.W / 2, 40, 24);
    if (S.phase === 'draw') {
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      ctx.beginPath(); ctx.roundRect(fx, 668, fw - 8, 8, 4); ctx.fill();
      ctx.fillStyle = S.phaseT < 10 ? '#ff5a66' : '#2f9bff';
      ctx.beginPath(); ctx.roundRect(fx, 668, (fw - 8) * clamp(S.phaseT / this.ROUND_TIME, 0, 1), 8, 4); ctx.fill();
    }
    // scoreboard
    Draw2.panel(ctx, 24, 90, 190, G.players.length * 74 + 16, 14);
    let y = 122;
    for (const p of G.players) {
      Draw2.pawn(ctx, 58, y, 13, p.color);
      const isDrawer = p.pid === S.drawer;
      const g = S.guessed.get(p.pid);
      let status = isDrawer ? 'drawing' : (g ? (g === S.word ? 'guessed it' : 'wrong') : 'thinking');
      if (S.phase === 'reveal' && !isDrawer && !g) status = 'no guess';
      Draw2.label(ctx, p.name, 84, y - 8, 14, '#fff', 'left');
      Draw2.label(ctx, status, 84, y + 10, 11, isDrawer ? '#ffcf3f' : (g === S.word ? '#2fd573' : '#8b94ad'), 'left');
      Draw2.label(ctx, (S.scores.get(p.pid) || 0) + '', 196, y, 15, '#ffcf3f', 'right');
      y += 74;
    }
  },
});
