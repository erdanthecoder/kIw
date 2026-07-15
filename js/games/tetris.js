// Tetris Battle — everyone gets a board, cleared lines send garbage to rivals.
registerGame({
  id: 'tetris', title: 'Tetris Battle', icon: 'tetris', desc: 'Clear lines to dump garbage on rivals. Last board alive wins.',
  players: '1-8', minPlayers: 1, TIME: 240,
  PIECES: [
    [[1, 1, 1, 1]], [[1, 1], [1, 1]], [[0, 1, 0], [1, 1, 1]],
    [[1, 0, 0], [1, 1, 1]], [[0, 0, 1], [1, 1, 1]], [[1, 1, 0], [0, 1, 1]], [[0, 1, 1], [1, 1, 0]],
  ],
  PCOLORS: ['#2fe0d0', '#ffcf3f', '#b06cff', '#2f9bff', '#ff8c3a', '#ff4655', '#2fd573'],
  S: null,
  init(G) {
    G.setScheme(null, 'tetris', { msg: T('clearLines') });
    const S = this.S = { boards: new Map(), deathOrder: [] };
    G.players.forEach(p => S.boards.set(p.pid, this.newBoard()));
  },
  newBoard() {
    return {
      grid: Array.from({ length: 20 }, () => Array(10).fill(0)),
      piece: this.spawnPiece(), next: this.spawnPiece(),
      dropT: 0, gravity: 0.85, lines: 0, alive: true, pendingGarbage: 0, clearFx: 0,
    };
  },
  spawnPiece() {
    const i = Math.random() * 7 | 0;
    return { shape: this.PIECES[i].map(r => [...r]), c: i + 1, x: 3, y: 0 };
  },
  fits(board, shape, px, py) {
    for (let y = 0; y < shape.length; y++) for (let x = 0; x < shape[y].length; x++) {
      if (!shape[y][x]) continue;
      const gx = px + x, gy = py + y;
      if (gx < 0 || gx >= 10 || gy >= 20) return false;
      if (gy >= 0 && board.grid[gy][gx]) return false;
    }
    return true;
  },
  rotate(shape) {
    const h = shape.length, w = shape[0].length;
    const out = Array.from({ length: w }, () => Array(h).fill(0));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[x][h - 1 - y] = shape[y][x];
    return out;
  },
  lock(board, pid, G) {
    const pc = board.piece;
    for (let y = 0; y < pc.shape.length; y++) for (let x = 0; x < pc.shape[y].length; x++) {
      if (!pc.shape[y][x]) continue;
      const gy = pc.y + y;
      if (gy < 0) { this.die(board, pid, G); return; }
      board.grid[gy][pc.x + x] = pc.c;
    }
    let cleared = 0;
    for (let y = 19; y >= 0; y--) {
      if (board.grid[y].every(c => c)) {
        board.grid.splice(y, 1);
        board.grid.unshift(Array(10).fill(0));
        cleared++; y++;
      }
    }
    if (cleared) {
      board.lines += cleared;
      board.clearFx = 0.3;
      board.gravity = Math.max(0.18, 0.85 - board.lines * 0.02);
      if (cleared > 1) {
        const rivals = [...this.S.boards.entries()].filter(([qid, b]) => qid !== pid && b.alive);
        if (rivals.length) {
          const [, rb] = rivals[Math.random() * rivals.length | 0];
          rb.pendingGarbage += cleared - 1;
        }
      }
      const p = G.players.find(q => q.pid === pid);
      if (p) G.vib(p, 60);
    }
    while (board.pendingGarbage > 0) {
      board.pendingGarbage--;
      board.grid.shift();
      const row = Array(10).fill(8);
      row[Math.random() * 10 | 0] = 0;
      board.grid.push(row);
    }
    board.piece = board.next;
    board.next = this.spawnPiece();
    if (!this.fits(board, board.piece.shape, board.piece.x, board.piece.y)) this.die(board, pid, G);
  },
  die(board, pid, G) {
    if (!board.alive) return;
    board.alive = false;
    this.S.deathOrder.push(pid);
    const p = G.players.find(q => q.pid === pid);
    if (p) { G.vib(p, 300); G.toast(T('toppedOut', p.name)); }
  },
  onBtn(p, b, G) {
    const board = this.S.boards.get(p.pid);
    if (!board || !board.alive) return;
    const pc = board.piece;
    if (b === 'L' && this.fits(board, pc.shape, pc.x - 1, pc.y)) pc.x--;
    else if (b === 'R' && this.fits(board, pc.shape, pc.x + 1, pc.y)) pc.x++;
    else if (b === 'ROT') {
      const r = this.rotate(pc.shape);
      for (const kick of [0, -1, 1, -2, 2]) {
        if (this.fits(board, r, pc.x + kick, pc.y)) { pc.shape = r; pc.x += kick; break; }
      }
    } else if (b === 'SD') {
      if (this.fits(board, pc.shape, pc.x, pc.y + 1)) pc.y++;
    } else if (b === 'HD') {
      while (this.fits(board, pc.shape, pc.x, pc.y + 1)) pc.y++;
      this.lock(board, p.pid, G);
    }
  },
  update(dt, G) {
    const S = this.S;
    for (const p of G.players) {
      const board = S.boards.get(p.pid);
      if (!board || !board.alive) continue;
      if (p.gone) { this.die(board, p.pid, G); continue; }
      board.clearFx -= dt;
      board.dropT += dt;
      if (board.dropT >= board.gravity) {
        board.dropT = 0;
        if (this.fits(board, board.piece.shape, board.piece.x, board.piece.y + 1)) board.piece.y++;
        else this.lock(board, p.pid, G);
      }
    }
    const alive = [...S.boards.entries()].filter(([, b]) => b.alive);
    if ((S.boards.size > 1 && alive.length <= 1) || (S.boards.size === 1 && !alive.length) || G.time > this.TIME) {
      const rows = [
        ...alive.sort((a, b) => b[1].lines - a[1].lines).map(([pid, b]) => ({ pid, label: b.lines + ' ' + T('lines') + ' · ' + T('survived') })),
        ...[...S.deathOrder].reverse().map(pid => ({ pid, label: S.boards.get(pid).lines + ' ' + T('lines') })),
      ];
      G.finish(rows);
    }
  },
  cell(ctx, x, y, size, color, ghost) {
    if (ghost) {
      ctx.strokeStyle = 'rgba(255,255,255,.22)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 1.5, y + 1.5, size - 4, size - 4);
      return;
    }
    // beveled block: base, light top-left, dark bottom-right
    ctx.fillStyle = color;
    ctx.fillRect(x, y, size - 1, size - 1);
    ctx.fillStyle = 'rgba(255,255,255,.32)';
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + size - 1, y); ctx.lineTo(x + size - 1 - size * 0.2, y + size * 0.2);
    ctx.lineTo(x + size * 0.2, y + size * 0.2); ctx.lineTo(x + size * 0.2, y + size - 1 - size * 0.2); ctx.lineTo(x, y + size - 1);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath();
    ctx.moveTo(x + size - 1, y + size - 1); ctx.lineTo(x, y + size - 1); ctx.lineTo(x + size * 0.2, y + size - 1 - size * 0.2);
    ctx.lineTo(x + size - 1 - size * 0.2, y + size - 1 - size * 0.2); ctx.lineTo(x + size - 1 - size * 0.2, y + size * 0.2); ctx.lineTo(x + size - 1, y);
    ctx.closePath(); ctx.fill();
  },
  draw(ctx, G) {
    const S = this.S;
    Draw2.bg(ctx, G, '#0c0c1e', '#141430');
    const n = G.players.length;
    const cols = Math.min(4, n), rows = Math.ceil(n / 4);
    const cell = rows > 1 ? 15 : 24;
    const bw = 10 * cell, bh = 20 * cell;
    const gapX = (1280 - cols * bw) / (cols + 1);
    const gapY = (720 - rows * bh - 40) / (rows + 1);
    const colorsAll = ['', ...this.PCOLORS, '#5b6068'];
    G.players.forEach((p, i) => {
      const board = S.boards.get(p.pid);
      if (!board) return;
      const bx = gapX + (i % 4) * (bw + gapX);
      const by = 40 + gapY + Math.floor(i / 4) * (bh + gapY);
      // glass well
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      ctx.beginPath(); ctx.roundRect(bx - 6, by - 6, bw + 12, bh + 12, 8); ctx.fill();
      ctx.strokeStyle = board.alive ? p.color : 'rgba(255,255,255,.15)';
      ctx.lineWidth = 2.5;
      if (board.clearFx > 0) { ctx.shadowColor = p.color; ctx.shadowBlur = 24; }
      ctx.beginPath(); ctx.roundRect(bx - 6, by - 6, bw + 12, bh + 12, 8); ctx.stroke();
      ctx.shadowBlur = 0;
      // faint grid
      ctx.strokeStyle = 'rgba(255,255,255,.04)';
      ctx.lineWidth = 1;
      for (let gx = 1; gx < 10; gx++) { ctx.beginPath(); ctx.moveTo(bx + gx * cell, by); ctx.lineTo(bx + gx * cell, by + bh); ctx.stroke(); }
      for (let y = 0; y < 20; y++) for (let x = 0; x < 10; x++) {
        const c = board.grid[y][x];
        if (!c) continue;
        this.cell(ctx, bx + x * cell, by + y * cell, cell, board.alive ? colorsAll[c] : '#3a3d45');
      }
      if (board.alive) {
        const pc = board.piece;
        // ghost landing preview
        let gy = pc.y;
        while (this.fits(board, pc.shape, pc.x, gy + 1)) gy++;
        for (let y = 0; y < pc.shape.length; y++) for (let x = 0; x < pc.shape[y].length; x++) {
          if (pc.shape[y][x] && gy + y >= 0 && gy !== pc.y) this.cell(ctx, bx + (pc.x + x) * cell, by + (gy + y) * cell, cell, '', true);
        }
        for (let y = 0; y < pc.shape.length; y++) for (let x = 0; x < pc.shape[y].length; x++) {
          if (pc.shape[y][x] && pc.y + y >= 0) this.cell(ctx, bx + (pc.x + x) * cell, by + (pc.y + y) * cell, cell, colorsAll[pc.c]);
        }
      } else {
        ctx.fillStyle = 'rgba(0,0,0,.45)';
        ctx.fillRect(bx, by, bw, bh);
        Draw2.label(ctx, T('out'), bx + bw / 2, by + bh / 2, 26, 'rgba(255,255,255,.6)');
      }
      Draw2.tag(ctx, p, bx + bw / 2, by - 18, '· ' + board.lines);
      if (board.pendingGarbage) Draw2.label(ctx, '+' + board.pendingGarbage, bx + bw + 2, by + 10, 15, '#ff5a66', 'left');
    });
    Draw2.timer(ctx, G, this.TIME - G.time, this.TIME);
  },
});
