// Trivia Quiz Show — answer fast on your phone.
registerGame({
  id: 'trivia', title: 'Trivia Show', icon: 'trivia', desc: 'Questions on the TV, answers on your phone. Speed earns points.',
  players: '1-8', minPlayers: 1,
  QS: [
    ['What is the largest planet in our solar system?', ['Jupiter', 'Saturn', 'Earth', 'Neptune'], 0],
    ['How many legs does a spider have?', ['6', '8', '10', '12'], 1],
    ['What color do you get mixing blue and yellow?', ['Purple', 'Orange', 'Green', 'Brown'], 2],
    ['Which animal is the fastest on land?', ['Lion', 'Horse', 'Cheetah', 'Ostrich'], 2],
    ['What is the capital of Japan?', ['Seoul', 'Beijing', 'Bangkok', 'Tokyo'], 3],
    ['How many minutes are in 2 hours?', ['60', '90', '120', '240'], 2],
    ['What gas do plants breathe in?', ['Oxygen', 'CO2', 'Nitrogen', 'Helium'], 1],
    ['Which ocean is the biggest?', ['Atlantic', 'Indian', 'Pacific', 'Arctic'], 2],
    ['In Minecraft, what do Creepers do?', ['Dance', 'Explode', 'Fly', 'Sing'], 1],
    ['How many sides does a hexagon have?', ['5', '6', '7', '8'], 1],
    ['What is the hottest planet?', ['Mercury', 'Venus', 'Mars', 'Jupiter'], 1],
    ['Which country invented pizza?', ['France', 'USA', 'Italy', 'Greece'], 2],
    ['What is 9 x 7?', ['56', '63', '72', '81'], 1],
    ['Which bird cannot fly?', ['Penguin', 'Eagle', 'Owl', 'Parrot'], 0],
    ['What is the smallest prime number?', ['0', '1', '2', '3'], 2],
    ['Which console does the DualSense belong to?', ['Xbox', 'Switch', 'PS5', 'PC'], 2],
    ['How many continents are there?', ['5', '6', '7', '8'], 2],
    ['What do bees make?', ['Milk', 'Honey', 'Silk', 'Butter'], 1],
    ['Which is the longest river?', ['Amazon', 'Nile', 'Yangtze', 'Mississippi'], 1],
    ['Which is heavier: 1kg of steel or 1kg of feathers?', ['Steel', 'Feathers', 'Same', 'Depends'], 2],
    ['How many players fit in one CouchPlay room?', ['4', '6', '8', '100'], 2],
    ['What does WWW stand for?', ['World Wide Web', 'Wild West World', 'We Want Wifi', 'World War Web'], 0],
    ['What is H2O better known as?', ['Salt', 'Water', 'Air', 'Acid'], 1],
    ['Which shape has three sides?', ['Square', 'Circle', 'Triangle', 'Hexagon'], 2],
  ],
  QS_RU: [
    ['Какая самая большая планета Солнечной системы?', ['Юпитер', 'Сатурн', 'Земля', 'Нептун'], 0],
    ['Сколько ног у паука?', ['6', '8', '10', '12'], 1],
    ['Какой цвет получится из синего и жёлтого?', ['Фиолетовый', 'Оранжевый', 'Зелёный', 'Коричневый'], 2],
    ['Какое животное самое быстрое на суше?', ['Лев', 'Лошадь', 'Гепард', 'Страус'], 2],
    ['Столица Японии?', ['Сеул', 'Пекин', 'Бангкок', 'Токио'], 3],
    ['Сколько минут в 2 часах?', ['60', '90', '120', '240'], 2],
    ['Какой газ вдыхают растения?', ['Кислород', 'CO2', 'Азот', 'Гелий'], 1],
    ['Какой океан самый большой?', ['Атлантический', 'Индийский', 'Тихий', 'Северный Ледовитый'], 2],
    ['Что делают криперы в Minecraft?', ['Танцуют', 'Взрываются', 'Летают', 'Поют'], 1],
    ['Сколько сторон у шестиугольника?', ['5', '6', '7', '8'], 1],
    ['Какая планета самая горячая?', ['Меркурий', 'Венера', 'Марс', 'Юпитер'], 1],
    ['Какая страна придумала пиццу?', ['Франция', 'США', 'Италия', 'Греция'], 2],
    ['Сколько будет 9 x 7?', ['56', '63', '72', '81'], 1],
    ['Какая птица не умеет летать?', ['Пингвин', 'Орёл', 'Сова', 'Попугай'], 0],
    ['Какое самое маленькое простое число?', ['0', '1', '2', '3'], 2],
    ['К какой консоли относится DualSense?', ['Xbox', 'Switch', 'PS5', 'ПК'], 2],
    ['Сколько на Земле континентов?', ['5', '6', '7', '8'], 2],
    ['Что делают пчёлы?', ['Молоко', 'Мёд', 'Шёлк', 'Масло'], 1],
    ['Какая река самая длинная?', ['Амазонка', 'Нил', 'Янцзы', 'Миссисипи'], 1],
    ['Что тяжелее: 1 кг стали или 1 кг перьев?', ['Сталь', 'Перья', 'Одинаково', 'Зависит'], 2],
    ['Сколько игроков помещается в комнату CouchPlay?', ['4', '6', '8', '100'], 2],
    ['Что означает WWW?', ['World Wide Web', 'Wild West World', 'We Want Wifi', 'World War Web'], 0],
    ['Как ещё называют H2O?', ['Соль', 'Вода', 'Воздух', 'Кислота'], 1],
    ['У какой фигуры три стороны?', ['Квадрат', 'Круг', 'Треугольник', 'Шестиугольник'], 2],
  ],
  ROUNDS: 8, QTIME: 12,
  S: null,
  init(G) {
    const picked = shuffle([...(I18N.lang === 'ru' ? this.QS_RU : this.QS)]).slice(0, this.ROUNDS);
    this.S = {
      qs: picked, qi: -1, phase: 'next', phaseT: 1.5,
      scores: new Map(G.players.map(p => [p.pid, 0])),
      answers: new Map(),
    };
    G.setScheme(null, 'quiz', { labels: ['', '', '', ''], msg: T('getReady') });
  },
  nextQ(G) {
    const S = this.S;
    S.qi++;
    if (S.qi >= S.qs.length) {
      const rows = [...S.scores.entries()].sort((a, b) => b[1] - a[1]).map(([pid, sc]) => ({ pid, label: sc + ' ' + T('pts') }));
      G.finish(rows);
      return;
    }
    S.phase = 'question'; S.phaseT = this.QTIME;
    S.answers = new Map();
    const [q, opts] = S.qs[S.qi];
    G.broadcast({ t: 'qnew', labels: opts, msg: T('pickAnswer', S.qi + 1) });
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
      const correct = S.qs[S.qi][2];
      for (const [pid, a] of S.answers) {
        if (a.i === correct) {
          const bonus = Math.round(50 * (1 - a.time / this.QTIME));
          S.scores.set(pid, (S.scores.get(pid) || 0) + 100 + bonus);
        }
      }
      S.phase = 'reveal'; S.phaseT = 2.8;
      G.broadcast({ t: 'qnew', msg: T('revealed') });
    } else if ((S.phase === 'reveal' || S.phase === 'next') && S.phaseT <= 0) {
      this.nextQ(G);
    }
  },
  draw(ctx, G) {
    const S = this.S;
    Draw2.bg(ctx, G, '#140a26', '#1e1140');
    // stage spotlights
    for (const [sx, dir] of [[300, 1], [980, -1]]) {
      const sg = ctx.createLinearGradient(sx, 0, sx + dir * 200, 720);
      sg.addColorStop(0, 'rgba(122,92,255,.10)');
      sg.addColorStop(1, 'rgba(122,92,255,0)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.moveTo(sx, -10); ctx.lineTo(sx + dir * 320, 720); ctx.lineTo(sx + dir * 120, 720);
      ctx.closePath(); ctx.fill();
    }
    if (S.qi < 0 || S.qi >= S.qs.length) return;
    const [q, opts, correct] = S.qs[S.qi];
    // progress dots
    for (let i = 0; i < S.qs.length; i++) {
      ctx.fillStyle = i < S.qi ? '#7a5cff' : i === S.qi ? '#fff' : 'rgba(255,255,255,.18)';
      ctx.beginPath(); ctx.arc(G.W / 2 - (S.qs.length - 1) * 11 + i * 22, 46, 5, 0, 7); ctx.fill();
    }
    // question card
    Draw2.panel(ctx, 180, 82, 920, 100, 18);
    ctx.fillStyle = '#7a5cff';
    ctx.beginPath(); ctx.roundRect(180, 82, 6, 100, 3); ctx.fill();
    Draw2.label(ctx, q, G.W / 2, 132, 30);
    // timer bar under the card
    if (S.phase === 'question') {
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      ctx.beginPath(); ctx.roundRect(340, 196, 600, 8, 4); ctx.fill();
      ctx.fillStyle = S.phaseT < 4 ? '#ff5a66' : '#2f9bff';
      ctx.beginPath(); ctx.roundRect(340, 196, 600 * clamp(S.phaseT / this.QTIME, 0, 1), 8, 4); ctx.fill();
    }
    const cols = ['#ff4655', '#2f9bff', '#2fd573', '#ffcf3f'];
    const letters = ['A', 'B', 'C', 'D'];
    opts.forEach((o, i) => {
      const x = 200 + (i % 2) * 460, y = 240 + Math.floor(i / 2) * 120, w = 420, h = 92;
      const dim = S.phase === 'reveal' && i !== correct;
      ctx.globalAlpha = dim ? 0.22 : 1;
      const ag = ctx.createLinearGradient(x, y, x, y + h);
      ag.addColorStop(0, Draw2.lighten(cols[i], 0.12));
      ag.addColorStop(1, Draw2.darken(cols[i], 0.28));
      ctx.fillStyle = ag;
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 16); ctx.fill();
      if (S.phase === 'reveal' && i === correct) {
        ctx.shadowColor = '#fff'; ctx.shadowBlur = 22;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.roundRect(x, y, w, h, 16); ctx.stroke();
        ctx.shadowBlur = 0;
      }
      // letter chip
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath(); ctx.arc(x + 42, y + h / 2, 22, 0, 7); ctx.fill();
      Draw2.label(ctx, letters[i], x + 42, y + h / 2, 20);
      Draw2.label(ctx, o, x + 78, y + h / 2, 22, '#fff', 'left');
      ctx.globalAlpha = 1;
    });
    // player strip
    let sx = G.W / 2 - (G.players.length - 1) * 72;
    for (const p of G.players) {
      const answered = S.answers.has(p.pid);
      Draw2.pawn(ctx, sx, 622, 15, p.color);
      if (answered && S.phase === 'question') {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(sx - 5, 622); ctx.lineTo(sx - 1, 627); ctx.lineTo(sx + 6, 616); ctx.stroke();
      } else if (!answered && S.phase === 'question') {
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(sx, 622, 15, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      }
      Draw2.label(ctx, p.name, sx, 652, 12);
      Draw2.label(ctx, (S.scores.get(p.pid) || 0) + '', sx, 674, 15, '#ffcf3f');
      sx += 144;
    }
  },
});
