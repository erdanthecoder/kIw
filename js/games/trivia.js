// Trivia Quiz Show — answer fast on your phone.
registerGame({
  id: 'trivia', title: 'Trivia Show', icon: '🧠', desc: 'Questions on the TV, answers on your phone. Speed = points!',
  players: '1-8', minPlayers: 1,
  QS: [
    ['What is the largest planet in our solar system?', ['Jupiter', 'Saturn', 'Earth', 'Neptune'], 0],
    ['How many legs does a spider have?', ['6', '8', '10', '12'], 1],
    ['What color do you get mixing blue and yellow?', ['Purple', 'Orange', 'Green', 'Brown'], 2],
    ['Which animal is the fastest on land?', ['Lion', 'Horse', 'Cheetah', 'Ostrich'], 2],
    ['What is the capital of Japan?', ['Seoul', 'Beijing', 'Bangkok', 'Tokyo'], 3],
    ['How many minutes are in 2 hours?', ['60', '90', '120', '240'], 2],
    ['Which one is NOT a programming language?', ['Python', 'Java', 'Cobra', 'HTML... wait all are!'], 3],
    ['What gas do plants breathe in?', ['Oxygen', 'CO2', 'Nitrogen', 'Helium'], 1],
    ['Which ocean is the biggest?', ['Atlantic', 'Indian', 'Pacific', 'Arctic'], 2],
    ['In Minecraft, what do Creepers do?', ['Dance', 'Explode', 'Fly', 'Sing'], 1],
    ['How many sides does a hexagon have?', ['5', '6', '7', '8'], 1],
    ['What is the hottest planet?', ['Mercury', 'Venus', 'Mars', 'Jupiter'], 1],
    ['Which country invented pizza?', ['France', 'USA', 'Italy', 'Greece'], 2],
    ['What is 9 × 7?', ['56', '63', '72', '81'], 1],
    ['Which bird cannot fly?', ['Penguin', 'Eagle', 'Owl', 'Parrot'], 0],
    ['What is the smallest prime number?', ['0', '1', '2', '3'], 2],
    ['Which console does the DualSense belong to?', ['Xbox', 'Switch', 'PS5', 'PC'], 2],
    ['How many continents are there?', ['5', '6', '7', '8'], 2],
    ['What do bees make?', ['Milk', 'Honey', 'Silk', 'Butter'], 1],
    ['Which is the longest river?', ['Amazon', 'Nile', 'Yangtze', 'Mississippi'], 1],
    ['What year did the year 2000 start?', ['1999', '2000', '2001', 'Trick question'], 1],
    ['Which is heavier: 1kg of steel or 1kg of feathers?', ['Steel', 'Feathers', 'Same', 'Depends'], 2],
    ['How many players fit in one CouchPlay room?', ['4', '6', '8', '100'], 2],
    ['What does WWW stand for?', ['World Wide Web', 'Wild West World', 'We Want Wifi', 'World War Web'], 0],
  ],
  ROUNDS: 8, QTIME: 12,
  S: null,
  init(G) {
    const picked = shuffle([...this.QS]).slice(0, this.ROUNDS);
    this.S = {
      qs: picked, qi: -1, phase: 'next', phaseT: 1.5,
      scores: new Map(G.players.map(p => [p.pid, 0])),
      answers: new Map(), // pid -> {i, time}
    };
    G.setScheme(null, 'quiz', { labels: ['', '', '', ''], msg: 'Get ready…' });
  },
  nextQ(G) {
    const S = this.S;
    S.qi++;
    if (S.qi >= S.qs.length) {
      const rows = [...S.scores.entries()].sort((a, b) => b[1] - a[1]).map(([pid, sc]) => ({ pid, label: sc + ' pts' }));
      G.finish(rows);
      return;
    }
    S.phase = 'question'; S.phaseT = this.QTIME;
    S.answers = new Map();
    const [q, opts] = S.qs[S.qi];
    G.broadcast({ t: 'qnew', labels: opts, msg: `Q${S.qi + 1}: pick your answer!` });
  },
  onBtn(p, b, G) {
    const S = this.S;
    if (S.phase !== 'question' || typeof b !== 'number') return;
    if (!S.answers.has(p.pid)) {
      S.answers.set(p.pid, { i: b, time: this.QTIME - S.phaseT });
      G.vib(p, 30);
    }
  },
  update(dt, G) {
    const S = this.S;
    S.phaseT -= dt;
    if (S.phase === 'question' && (S.phaseT <= 0 || S.answers.size >= G.players.filter(p => !p.gone).length)) {
      // score it
      const correct = S.qs[S.qi][2];
      for (const [pid, a] of S.answers) {
        if (a.i === correct) {
          const bonus = Math.round(50 * (1 - a.time / this.QTIME));
          S.scores.set(pid, (S.scores.get(pid) || 0) + 100 + bonus);
        }
      }
      S.phase = 'reveal'; S.phaseT = 2.8;
      G.broadcast({ t: 'qnew', msg: 'Answer revealed on the TV!' });
    } else if ((S.phase === 'reveal' || S.phase === 'next') && S.phaseT <= 0) {
      this.nextQ(G);
    }
  },
  draw(ctx, G) {
    const S = this.S;
    Draw2.bg(ctx, G, '#140a26', '#1e1140');
    if (S.qi < 0 || S.qi >= S.qs.length) return;
    const [q, opts, correct] = S.qs[S.qi];
    Draw2.label(ctx, `Question ${S.qi + 1} / ${S.qs.length}`, G.W / 2, 60, 20, '#8b94ad');
    // wrap question text
    ctx.font = '700 36px -apple-system, Segoe UI, sans-serif';
    Draw2.label(ctx, q, G.W / 2, 140, 36);
    const cols = ['#ff4655', '#2f9bff', '#2fd573', '#ffcf3f'];
    opts.forEach((o, i) => {
      const x = 200 + (i % 2) * 460, y = 240 + Math.floor(i / 2) * 120, w = 420, h = 90;
      const dim = S.phase === 'reveal' && i !== correct;
      ctx.globalAlpha = dim ? 0.25 : 1;
      ctx.fillStyle = cols[i];
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 16); ctx.fill();
      if (S.phase === 'reveal' && i === correct) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.stroke();
      }
      Draw2.label(ctx, o, x + w / 2, y + h / 2, 24, '#fff');
      ctx.globalAlpha = 1;
    });
    if (S.phase === 'question') Draw2.timer(ctx, G, S.phaseT);
    // score strip + who answered
    let sx = 100;
    for (const p of G.players) {
      const answered = S.answers.has(p.pid);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = answered || S.phase === 'reveal' ? 1 : 0.4;
      ctx.beginPath(); ctx.arc(sx, 640, 16, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
      Draw2.label(ctx, p.name, sx, 668, 12);
      Draw2.label(ctx, (S.scores.get(p.pid) || 0) + '', sx, 690, 14, '#ffcf3f');
      if (answered && S.phase === 'question') Draw2.label(ctx, '✓', sx, 640, 16, '#fff');
      sx += 140;
    }
  },
});
