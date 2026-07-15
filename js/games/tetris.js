// Tetris Battle — everyone gets a board, cleared lines send garbage to rivals.
registerGame({
  id: 'tetris', title: 'Tetris Battle', icon: '🧱', desc: 'Clear lines to dump garbage on rivals. Last board alive wins.',
  players: '1-8', minPlayers: 1, TIME: 240,
  PIECES: [
    [[1, 1, 1, 1]], [[1, 1], [1, 1]], [[0, 1, 0], [1, 1, 1]],
    [[1, 0, 0], [1, 1, 1]], [[0, 0, 1], [1, 1, 1]], [[1, 1, 0], [0, 1, 1]], [[0, 1, 1], [1, 1, 0]],
  ],
  PCOLORS: ['#2fe0d0', '#ffcf3f', '#b06cff', '#2f9bff', '#ff8c3a', '#ff4655', '#2fd573'],
  S: null,
  init(G) {
    G.setScheme(null, 'tetris', { msg: 'Clear lines — garbage goes to your rivals!' });
    const S = this.S = { boards: new Map(), deathOrder: [] };
    G.players.forEach(p => S.boards.set(p.pid, this.newBoard()));
  },
  newBoard() {
    return {
      grid: Array.from({ length: 20 }, () => Array(10).fill(0)),
      piece: this.spawnPiece(), next: this.spawnPiece(),
      dropT: 0, gravity: 0.85, lines: 0, alive: true, pendingGarbage: 0,
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
    // clear lines
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
      board.gravity = Math.max(0.18, 0.85 - board.lines * 0.02);
      // send garbage to a random living rival
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
    // apply pending garbage
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
    if (p) { G.vib(p, 300); G.toast(`${p.name} topped out!`); }
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
        ...alive.sort((a, b) => b[1].lines - a[1].lines).map(([pid, b]) => ({ pid, label: `👑 ${b.lines} lines` })),
        ...[...S.deathOrder].reverse().map(pid => ({ pid, label: S.boards.get(pid).lines + ' lines' })),
      ];
      G.finish(rows);
    }
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
    G.players.forEach((p, i) => {
      const board = S.boards.get(p.pid);
      if (!board) return;
      const bx = gapX + (i % 4) * (bw + gapX);
      const by = 40 + gapY + Math.floor(i / 4) * (bh + gapY);
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
      ctx.strokeStyle = board.alive ? p.color : '#333';
      ctx.lineWidth = 3;
      ctx.strokeRect(bx - 2, by - 2, bw + 4, bh + 4);
      const colorsAll = ['', ...this.PCOLORS, '#666'];
      for (let y = 0; y < 20; y++) for (let x = 0; x < 10; x++) {
        const c = board.grid[y][x];
        if (!c) continue;
        ctx.fillStyle = board.alive ? colorsAll[c] : '#444';
        ctx.fillRect(bx + x * cell, by + y * cell, cell - 1, cell - 1);
      }
      if (board.alive) {
        const pc = board.piece;
        ctx.fillStyle = colorsAll[pc.c];
        for (let y = 0; y < pc.shape.length; y++) for (let x = 0; x < pc.shape[y].length; x++) {
          if (pc.shape[y][x] && pc.y + y >= 0) ctx.fillRect(bx + (pc.x + x) * cell, by + (pc.y + y) * cell, cell - 1, cell - 1);
        }
      } else {
        Draw2.label(ctx, '💀', bx + bw / 2, by + bh / 2, 40);
      }
      Draw2.label(ctx, `${p.name} · ${board.lines}`, bx + bw / 2, by - 14, 13, board.alive ? '#fff' : '#666');
    });
    Draw2.timer(ctx, G, this.TIME - G.time);
  },
});
