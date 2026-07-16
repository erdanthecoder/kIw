// CouchPlay i18n — English + Russian. Auto-detects the browser language,
// persists the choice, and the console pushes its language to controllers.
const I18N = (() => {
  const D = {
    en: {
      // landing / controller
      tagline: 'Your free living-room console. One big screen, everyone\'s phone is a controller.',
      openConsole: 'Open Console', openConsoleDesc: 'Put this on the TV, laptop, or any big screen. It creates a room code + QR code and runs the games.',
      joinPlayer: 'Join as Player', joinPlayerDesc: 'Open this on your phone or tablet. Type the room code (or scan the QR on the TV) and it becomes your controller.',
      enterCode: 'Enter the room code from the TV', yourName: 'Your name', join: 'JOIN', connecting: 'Connecting…',
      checkCode: 'Enter the room code shown on the TV.', roomFull: 'Room is full (8 players max).', connLost: 'Connection lost — join again.',
      youreIn: 'You\'re in. Look at the big screen.<br>The host picks the game — your controller will change automatically.',
      cameraOn: 'Camera avatar: ON', cameraOff: 'Enable camera avatar',
      settings: 'SETTINGS', music: 'Music', sfxLabel: 'Sound effects', performance: 'Performance',
      auto: 'Auto', high: 'High', low: 'Low', close: 'Close', perfApplied: 'Performance mode updated',
      perfNote: 'Auto lowers effects on smart TVs (webOS, Tizen) so games stay smooth. All music is composed by CouchPlay itself — original, copyright-free.',
      // console chrome
      joinRoom: 'JOIN THE ROOM', players: 'Players', wins: 'wins', win: 'win',
      leaderboard: 'LEADERBOARD', noPlayers: 'No players yet — scan the QR or enter the code on your phone.',
      hint: 'Click a game or use arrows + Enter. Player 1 can browse with the joystick and press A.',
      pressStart: 'PRESS A / ENTER TO START',
      netP2P: 'P2P direct — ultra low lag', netRelay: 'Server relay mode', netBackup: '(+ relay backup)',
      results: 'Results', backToLobby: 'Back to lobby', endGame: 'End game (Esc)', noResults: 'No results',
      joined: '{0} joined', left: '{0} left', needsPlayers: '{0} needs at least {1} players — {2} joined',
      waitingPick: 'Look at the big screen — waiting for the host to pick a game.',
      gameInProgress: 'Game in progress — you join in the next round.',
      roundOver: 'Round over — check the big screen for standings.',
      gameError: 'Game error — returning to lobby', place: ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'],
      // shared game words
      goal: 'GOAL', tapNow: 'TAP NOW', wait: 'WAIT...', waitGreen: 'WAIT FOR GREEN', flap: 'FLAP',
      fire: 'FIRE', boost: 'BOOST', nitro: 'NITRO', bomb: 'BOMB', laser: 'LASER', jump: 'JUMP', mine: 'MINE', build: 'BUILD', drop: 'DROP',
      alive: 'alive', pipes: 'pipes', kills: 'kills', tags: 'tags', pts: 'pts', lines: 'lines', lap: 'lap', laps: 'laps',
      survived: 'survived', finishedN: 'finished #{0}', lastStanding: 'last standing', size: 'size', length: 'length',
      touches: 'touches', crates: 'crates', ballSpeed: 'Ball speed', serving: 'Serving...', ballsN: 'balls', frozen: 'FROZEN', out: 'OUT', roundN: 'Round {0} of {1}',
      steerSnake: 'Steer your snake with the joystick — push to the edge for a speed boost',
      steerBlob: 'Steer your blob — eat everything smaller than you', dodgeBalls: 'Dodge the balls',
      slidePaddle: 'Slide your paddle left/right along your arc', clearLines: 'Clear lines — garbage goes to your rivals',
      lapsWin: '{0} laps — first across the line wins', win2: 'WIN', draw2: 'DRAW', overtime: 'OVERTIME — second ball!',
      blue: 'BLUE', red: 'RED', goalFor: 'GOAL for {0} team', blueTeam: 'Blue', redTeam: 'Red',
      finishedToast: '{0} finished #{1}', isOut: '{0} is out', toppedOut: '{0} topped out', roundResults: 'Round results', nobodyTapped: 'Nobody tapped',
      // trivia / draw
      getReady: 'Get ready...', pickAnswer: 'Question {0}: pick your answer', revealed: 'Answer revealed on the TV',
      questionN: 'Question {0} / {1}', isDrawing: '{0} is drawing — what is it?', itWas: 'It was "{0}"',
      drawWord: 'Draw', roundOf: 'round {0} of {1}', drawing: 'drawing', guessedIt: 'guessed it', wrong: 'wrong', thinking: 'thinking', noGuess: 'no guess',
      // 3d
      mcHud: '<b>CraftWorld</b> — sandbox, build together (host presses End to finish)', blocks: 'blocks',
      obbyHud: '<b>Obby Rush</b> — first to the gold pad', sLeft: '{0}s left', lastCall: 'last call {0}s',
      mcHelp: 'Drag right side to look · left side to move · MINE breaks · BUILD places',
      obbyHelp: 'Race to the gold platform. Green = checkpoint. Don\'t touch the lava.',
      checkpoint: 'Checkpoint {0} reached', youFinished: 'YOU FINISHED — check the TV for standings.', intoLava: 'Into the lava — back to checkpoint {0}',
    },
    ru: {
      tagline: 'Ваша бесплатная домашняя консоль. Один большой экран, телефон каждого — геймпад.',
      openConsole: 'Открыть консоль', openConsoleDesc: 'Откройте на телевизоре, ноутбуке или любом большом экране. Создаёт код комнаты + QR-код и запускает игры.',
      joinPlayer: 'Присоединиться', joinPlayerDesc: 'Откройте на телефоне или планшете. Введите код комнаты (или отсканируйте QR с телевизора) — и он станет вашим геймпадом.',
      enterCode: 'Введите код комнаты с телевизора', yourName: 'Ваше имя', join: 'ВОЙТИ', connecting: 'Подключение…',
      checkCode: 'Введите код комнаты, показанный на ТВ.', roomFull: 'Комната заполнена (максимум 8 игроков).', connLost: 'Связь потеряна — подключитесь снова.',
      youreIn: 'Вы в игре. Смотрите на большой экран.<br>Хост выбирает игру — ваш геймпад изменится автоматически.',
      cameraOn: 'Камера-аватар: ВКЛ', cameraOff: 'Включить камеру-аватар',
      settings: 'НАСТРОЙКИ', music: 'Музыка', sfxLabel: 'Звуковые эффекты', performance: 'Производительность',
      auto: 'Авто', high: 'Высокая', low: 'Низкая', close: 'Закрыть', perfApplied: 'Режим производительности обновлён',
      perfNote: 'Авто снижает эффекты на смарт-ТВ (webOS, Tizen), чтобы игры шли плавно. Вся музыка сочинена самим CouchPlay — оригинальная, без авторских прав.',
      joinRoom: 'ВХОД В КОМНАТУ', players: 'Игроки', wins: 'побед', win: 'победа',
      leaderboard: 'ТАБЛИЦА ЛИДЕРОВ', noPlayers: 'Пока нет игроков — отсканируйте QR или введите код на телефоне.',
      hint: 'Кликните по игре или стрелки + Enter. Игрок 1 может листать джойстиком и нажать A.',
      pressStart: 'НАЖМИТЕ A / ENTER ДЛЯ СТАРТА',
      netP2P: 'P2P напрямую — минимальная задержка', netRelay: 'Режим сервера-ретранслятора', netBackup: '(+ резервный сервер)',
      results: 'Результаты', backToLobby: 'В лобби', endGame: 'Закончить (Esc)', noResults: 'Нет результатов',
      joined: '{0} присоединился', left: '{0} вышел', needsPlayers: '{0}: нужно минимум {1} игрока — есть {2}',
      waitingPick: 'Смотрите на большой экран — хост выбирает игру.',
      gameInProgress: 'Игра идёт — вы вступите в следующем раунде.',
      roundOver: 'Раунд окончен — смотрите итоги на большом экране.',
      gameError: 'Ошибка игры — возвращаемся в лобби', place: ['1-е', '2-е', '3-е', '4-е', '5-е', '6-е', '7-е', '8-е'],
      goal: 'ГОЛ', tapNow: 'ЖМИ', wait: 'ЖДИ...', waitGreen: 'ЖДИ ЗЕЛЁНЫЙ', flap: 'МАХ',
      fire: 'ОГОНЬ', boost: 'БУСТ', nitro: 'НИТРО', bomb: 'БОМБА', laser: 'ЛАЗЕР', jump: 'ПРЫЖОК', mine: 'ЛОМАТЬ', build: 'СТАВИТЬ', drop: 'ВНИЗ',
      alive: 'в игре', pipes: 'труб', kills: 'фрагов', tags: 'попаданий', pts: 'очков', lines: 'линий', lap: 'круг', laps: 'кругов',
      survived: 'выжил', finishedN: 'финишировал #{0}', lastStanding: 'последний выживший', size: 'размер', length: 'длина',
      touches: 'касаний', crates: 'ящиков', ballSpeed: 'Скорость мяча', serving: 'Подача...', ballsN: 'мячей', frozen: 'ЗАМОРОЖЕН', out: 'ВЫБЫЛ', roundN: 'Раунд {0} из {1}',
      steerSnake: 'Управляйте змейкой джойстиком — до упора для ускорения',
      steerBlob: 'Управляйте шаром — ешьте всё, что меньше вас', dodgeBalls: 'Уклоняйтесь от мячей',
      slidePaddle: 'Двигайте платформу влево/вправо по своей дуге', clearLines: 'Собирайте линии — мусор летит соперникам',
      lapsWin: '{0} круга — побеждает первый на финише', win2: 'ПОБЕДА', draw2: 'НИЧЬЯ', overtime: 'ОВЕРТАЙМ — второй мяч!',
      blue: 'СИНИЕ', red: 'КРАСНЫЕ', goalFor: 'ГОЛ команды {0}', blueTeam: 'синих', redTeam: 'красных',
      finishedToast: '{0} финишировал #{1}', isOut: '{0} выбыл', toppedOut: '{0} проиграл', roundResults: 'Итоги раунда', nobodyTapped: 'Никто не нажал',
      getReady: 'Приготовьтесь...', pickAnswer: 'Вопрос {0}: выберите ответ', revealed: 'Ответ показан на ТВ',
      questionN: 'Вопрос {0} / {1}', isDrawing: '{0} рисует — что это?', itWas: 'Это было «{0}»',
      drawWord: 'Нарисуйте', roundOf: 'раунд {0} из {1}', drawing: 'рисует', guessedIt: 'угадал', wrong: 'мимо', thinking: 'думает', noGuess: 'нет ответа',
      mcHud: '<b>CraftWorld</b> — песочница, стройте вместе (хост нажимает «Закончить»)', blocks: 'блоков',
      obbyHud: '<b>Obby Rush</b> — первым к золотой платформе', sLeft: 'осталось {0}с', lastCall: 'финальный отсчёт {0}с',
      mcHelp: 'Правая половина — камера · левая — движение · ЛОМАТЬ / СТАВИТЬ блоки',
      obbyHelp: 'Бегите к золотой платформе. Зелёное — чекпоинт. Не касайтесь лавы.',
      checkpoint: 'Чекпоинт {0} пройден', youFinished: 'ВЫ ФИНИШИРОВАЛИ — итоги на ТВ.', intoLava: 'В лаву — назад на чекпоинт {0}',
    },
  };

  // game titles + descriptions
  const GM = {
    ru: {
      minecraft: ['CraftWorld 3D', 'Общий воксельный остров: стройте и ломайте вместе от первого лица на своём телефоне.'],
      obby: ['Обби-забег 3D', 'Гонка по 3D полосе препятствий над лавой. Чекпоинты, движущиеся платформы.'],
      flappy: ['Flappy-рояль', 'Тапайте, чтобы махать крыльями. Уворачивайтесь от труб. Последняя живая птица побеждает.'],
      snake: ['Змейка.io', 'Управляйте джойстиком, ешьте сферы и растите. Столкновение — потеря сфер.'],
      tanks: ['Танковый бой', 'Езда джойстиком, снаряды рикошетят. Больше всех фрагов за 90 секунд.'],
      bomber: ['Бомбер', 'Ставьте бомбы, ломайте ящики, собирайте бонусы. Побеждает последний выживший.'],
      laser: ['Лазертаг', 'Лазерные лучи с рикошетом. Замораживайте соперников. Больше попаданий за 75 секунд.'],
      trivia: ['Викторина', 'Вопросы на ТВ, ответы на телефоне. Скорость даёт очки.'],
      draw: ['Крокодил', 'Рисуйте на телефоне — появляется на ТВ. Остальные угадывают наперегонки.'],
      reaction: ['Дуэль реакции', 'Ждите ЗЕЛЁНЫЙ и жмите первым. Фальстарт отнимает очки.'],
      soccer: ['Ракетный футбол', 'Автокоманды. Забейте мяч в чужие ворота. До 5 голов (или 2 минуты).'],
      race: ['Картинг', 'Проходите трассу, жмите НИТРО на прямых. Первый до 3 кругов.'],
      pong: ['Понг-рояль', 'Защищайте свою дугу круга. 3 жизни. Мяч всё быстрее.'],
      tetris: ['Тетрис-батл', 'Собирайте линии и заваливайте соперников мусором. Побеждает последняя доска.'],
      blob: ['Арена шаров', 'Ешьте сферы и растите. Большие шары едят маленьких. Самый большой за 90 секунд.'],
      dodge: ['Вышибалы', 'Мячи множатся и ускоряются. Побеждает последний выживший.'],
    },
  };

  let lang = localStorage.getItem('cp-lang') ||
    ((navigator.language || '').toLowerCase().startsWith('ru') ? 'ru' : 'en');

  return {
    get lang() { return lang; },
    set(l) { lang = D[l] ? l : 'en'; localStorage.setItem('cp-lang', lang); },
    t(key, ...a) {
      let s = (D[lang] && D[lang][key] !== undefined) ? D[lang][key] : (D.en[key] !== undefined ? D.en[key] : key);
      if (Array.isArray(s)) return s;
      a.forEach((v, i) => { s = s.replace('{' + i + '}', v); });
      return s;
    },
    game(id, def) {
      if (lang !== 'en' && GM[lang] && GM[lang][id]) return { title: GM[lang][id][0], desc: GM[lang][id][1] };
      return { title: def.title, desc: def.desc };
    },
  };
})();
const T = (k, ...a) => I18N.t(k, ...a);
