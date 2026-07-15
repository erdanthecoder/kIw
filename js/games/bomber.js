// Bomber Blast — classic grid bomber. Last one standing wins.
registerGame({
  id: 'bomber', title: 'Bomber Blast', icon: '💣', desc: 'Drop bombs, blast crates, grab power-ups. Last one standing!',
  players: '1-8', minPlayers: 1, TIME: 150,
  COLS: 15, ROWS: 9, CELL: 72,
  S: null,
  ox() { return (1280 - this.COLS * this.CELL) / 2; },
  oy() { return (720 - this.ROWS * this.CELL) / 2 + 10; },
  init(G) {
    G.setScheme(null, 'dpad1', { a: '💣', asub: 'BOMB' });
    const S = this.S = { grid: [], bombs: [], blasts: [], powers: [], players: new Map(), deathOrder: [] };
    // 0 empty, 1 solid pillar, 2 crate
    for (let y = 0; y < this.ROWS; y++) {
      S.grid[y] = [];
      for (let x = 0; x < this.COLS; x++) {
        if (x % 2 === 1 && y % 2 === 1) S.grid[y][x] = 1;
        else S.grid[y][x] = Math.random() < 0.62 ? 2 : 0;
      }
    }
    const corners = [[0, 0], [this.COLS - 1, 0], [0, this.ROWS - 1], [this.COLS - 1, this.ROWS - 1], [Math.floor(this.COLS / 2), 0], [Math.floor(this.COLS / 2), this.ROWS - 1], [0, Math.floor(this.ROWS / 2)], [this.COLS - 1, Math.floor(this.ROWS / 2)]];
    G.players.forEach((p, i) => {
      const [cx, cy] = corners[i % 8];
      // clear spawn + neighbours
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const gx = cx + dx, gy = cy + dy;
        if (gx >= 0 && gx < this.COLS && gy >= 0 && gy < this.ROWS && S.grid[gy][gx] === 2) S.grid[gy][gx] = 0;
      }
      S.players.set(p.pid, { gx: cx, gy: cy, x: cx, y: cy, tx: cx, ty: cy, moveT: 0, alive: true, maxBombs: 1, range: 2, bombs: 0, crates: 0 });
    });
  },
  onBtn(p, b, G) {
    const S = this.S, bp = S.players.get(p.pid);
    if (!bp || !bp.alive) return;
    if (b === 'a') {
      if (bp.bombs >= bp.maxBombs) return;
      if (S.bombs.some(bb => bb.gx === bp.gx && bb.gy === bp.gy)) return;
      bp.bombs++;
      S.bombs.push({ gx: bp.gx, gy: bp.gy, fuse: 2.1, owner: p.pid, range: bp.range });
      return;
    }
    const dir = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] }[b];
    if (!dir || bp.moveT > 0) return;
    const nx = bp.gx + dir[0], ny = bp.gy + dir[1];
    if (nx < 0 || nx >= this.COLS || ny < 0 || ny >= this.ROWS) return;
    if (S.grid[ny][nx] !== 0) return;
    if (S.bombs.some(bb => bb.gx === nx && bb.gy === ny)) return;
    bp.tx = nx; bp.ty = ny; bp.moveT = 0.16;
  },
  update(dt, G) {
    const S = this.S;
    for (const p of G.players) {
      const bp = S.players.get(p.pid);
      if (!bp || !bp.alive) continue;
      if (p.gone) { bp.alive = false; S.deathOrder.push(p.pid); continue; }
      if (bp.moveT > 0) {
        bp.moveT -= dt;
        const t = 1 - Math.max(0, bp.moveT) / 0.16;
        bp.x = lerp(bp.gx, bp.tx, t);
        bp.y = lerp(bp.gy, bp.ty, t);
        if (bp.moveT <= 0) { bp.gx = bp.tx; bp.gy = bp.ty; bp.x = bp.gx; bp.y = bp.gy; }
      }
      // pick up power-ups
      for (let i = S.powers.length - 1; i >= 0; i--) {
        const pw = S.powers[i];
        if (pw.gx === bp.gx && pw.gy === bp.gy) {
          if (pw.kind === 0) bp.maxBombs = Math.min(5, bp.maxBombs + 1);
          else bp.range = Math.min(6, bp.range + 1);
          S.powers.splice(i, 1);
          G.vib(p, 40);
        }
      }
    }
    // bombs
    for (let i = S.bombs.length - 1; i >= 0; i--) {
      const b = S.bombs[i];
      b.fuse -= dt;
      if (b.fuse <= 0) this.explode(b, G);
    }
    // blasts
    for (let i = S.blasts.length - 1; i >= 0; i--) {
      const bl = S.blasts[i];
      bl.t -= dt;
      if (bl.t <= 0) { S.blasts.splice(i, 1); continue; }
      for (const p of G.players) {
        const bp = S.players.get(p.pid);
        if (!bp || !bp.alive) continue;
        if (Math.round(bp.x) === bl.gx && Math.round(bp.y) === bl.gy) {
          bp.alive = false;
          S.deathOrder.push(p.pid);
          G.vib(p, 300);
        }
      }
    }
    const alive = [...S.players.entries()].filter(([pid, bp]) => bp.alive);
    const totalPlayers = S.players.size;
    if ((totalPlayers > 1 && alive.length <= 1) || (totalPlayers === 1 && alive.length === 0) || G.time > this.TIME) {
      const rows = [];
      alive.sort((a, b) => b[1].crates - a[1].crates).forEach(([pid, bp]) => rows.push({ pid, label: '💪 survived · ' + bp.crates + ' crates' }));
      [...S.deathOrder].reverse().forEach(pid => rows.push({ pid, label: S.players.get(pid).crates + ' crates' }));
      G.finish(rows);
    }
  },
  explode(bomb, G) {
    const S = this.S;
    const idx = S.bombs.indexOf(bomb);
    if (idx < 0) return;
    S.bombs.splice(idx, 1);
    const owner = S.players.get(bomb.owner);
    if (owner) owner.bombs = Math.max(0, owner.bombs - 1);
    const cells = [[bomb.gx, bomb.gy]];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let r = 1; r <= bomb.range; r++) {
        const gx = bomb.gx + dx * r, gy = bomb.gy + dy * r;
        if (gx < 0 || gx >= this.COLS || gy < 0 || gy >= this.ROWS) break;
        if (S.grid[gy][gx] === 1) break;
        cells.push([gx, gy]);
        if (S.grid[gy][gx] === 2) {
          S.grid[gy][gx] = 0;
          if (owner) owner.crates++;
          if (Math.random() < 0.3) S.powers.push({ gx, gy, kind: Math.random() < 0.5 ? 0 : 1 });
          break;
        }
        // chain reaction
        const other = S.bombs.find(b => b.gx === gx && b.gy === gy);
        if (other) other.fuse = Math.min(other.fuse, 0.05);
      }
    }
    for (const [gx, gy] of cells) S.blasts.push({ gx, gy, t: 0.45 });
  },
  draw(ctx, G) {
    const S = this.S, C = this.CELL, ox = this.ox(), oy = this.oy();
    Draw2.bg(ctx, G, '#101528', '#182040');
    for (let y = 0; y < this.ROWS; y++) for (let x = 0; x < this.COLS; x++) {
      const px = ox + x * C, py = oy + y * C;
      ctx.fillStyle = (x + y) % 2 ? '#1a2440' : '#1e294a';
      ctx.fillRect(px, py, C, C);
      if (S.grid[y][x] === 1) {
        ctx.fillStyle = '#39456e'; ctx.fillRect(px + 3, py + 3, C - 6, C - 6);
        ctx.fillStyle = '#4a578a'; ctx.fillRect(px + 3, py + 3, C - 6, 10);
      } else if (S.grid[y][x] === 2) {
        ctx.fillStyle = '#8a6437'; ctx.fillRect(px + 6, py + 6, C - 12, C - 12);
        ctx.strokeStyle = '#a87f4c'; ctx.strokeRect(px + 6, py + 6, C - 12, C - 12);
        ctx.beginPath(); ctx.moveTo(px + 6, py + 6); ctx.lineTo(px + C - 6, py + C - 6); ctx.stroke();
      }
    }
    for (const pw of S.powers) {
      const px = ox + pw.gx * C + C / 2, py = oy + pw.gy * C + C / 2;
      ctx.font = '28px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(pw.kind === 0 ? '💣' : '🔥', px, py);
    }
    for (const b of S.bombs) {
      const px = ox + b.gx * C + C / 2, py = oy + b.gy * C + C / 2;
      const pulse = 1 + 0.15 * Math.sin(b.fuse * 12);
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(px, py, 20 * pulse, 0, 7); ctx.fill();
      ctx.strokeStyle = '#ffcf3f'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px + 8, py - 16); ctx.lineTo(px + 16, py - 26); ctx.stroke();
    }
    for (const bl of S.blasts) {
      ctx.fillStyle = `rgba(255,${140 + Math.random() * 80 | 0},40,${bl.t / 0.45})`;
      ctx.fillRect(ox + bl.gx * C + 4, oy + bl.gy * C + 4, C - 8, C - 8);
    }
    for (const p of G.players) {
      const bp = S.players.get(p.pid);
      if (!bp || !bp.alive) continue;
      const px = ox + bp.x * C + C / 2, py = oy + bp.y * C + C / 2;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(px, py - 6, 16, 0, 7); ctx.fill();
      ctx.fillRect(px - 12, py - 4, 24, 20);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(px - 6, py - 8, 3.5, 0, 7); ctx.arc(px + 6, py - 8, 3.5, 0, 7); ctx.fill();
      Draw2.label(ctx, p.name, px, py - 32, 12);
    }
    Draw2.timer(ctx, G, this.TIME - G.time);
  },
});
