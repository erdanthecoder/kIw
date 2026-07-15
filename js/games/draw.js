// Draw & Guess — one player sketches on their phone, everyone else guesses.
registerGame({
  id: 'draw', title: 'Draw & Guess', icon: '🎨', desc: 'Sketch on your phone — it appears on the TV. Others race to guess!',
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
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 800, 560);
    for (const p of G.players) {
      if (p.pid === S.drawer) G.setScheme(p, 'draw', { word: S.word });
      else G.setScheme(p, 'quiz', { labels: S.options, msg: `${drawerP.name} is drawing — what is it?` });
    }
  },
  onMsg(p, m, G) {
    const S = this.S;
    if (m.t !== 'stroke' || p.pid !== S.drawer || S.phase !== 'draw') return;
    const ctx = this.cvs.getContext('2d');
    if (m.clear) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 800, 560); return; }
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
        G.setScheme(null, 'wait', { msg: `It was “${S.word}”!` });
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
    ctx.drawImage(this.cvs, 240, 90, 800, 560);
    ctx.strokeStyle = '#2f9bff'; ctx.lineWidth = 3;
    ctx.strokeRect(240, 90, 800, 560);
    Draw2.label(ctx, S.phase === 'reveal' ? `It was “${S.word}”!` : `${drawerP ? drawerP.name : '?'} is drawing… (round ${S.ri + 1}/${S.order.length})`, G.W / 2, 50, 26);
    if (S.phase === 'draw') Draw2.timer(ctx, G, S.phaseT);
    // side scores
    let y = 120;
    for (const p of G.players) {
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(120, y, 12, 0, 7); ctx.fill();
      const mark = p.pid === S.drawer ? '✏️' : (S.guessed.has(p.pid) ? (S.guessed.get(p.pid) === S.word ? '✅' : '❌') : '');
      Draw2.label(ctx, `${p.name} ${mark}`, 120, y + 26, 13);
      Draw2.label(ctx, (S.scores.get(p.pid) || 0) + '', 120, y + 44, 14, '#ffcf3f');
      y += 74;
    }
  },
});
