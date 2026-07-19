// Bomber Blast — classic grid bomber. Last one standing wins.
registerGame({
  id: 'bomber', title: 'Bomber Blast', icon: 'bomber', desc: 'Drop bombs, blast crates, grab power-ups. Last one standing.',
  players: '1-8', minPlayers: 1, TIME: 150,
  COLS: 15, ROWS: 9, CELL: 72,
  S: null,
  ox() { return (1280 - this.COLS * this.CELL) / 2; },
  oy() { return (720 - this.ROWS * this.CELL) / 2 + 10; },
  init(G) {
    G.setScheme(null, 'dpad1', { a: T('bomb') });
    const S = this.S = { grid: [], bombs: [], blasts: [], powers: [], players: new Map(), deathOrder: [] };
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
  bot(p, G, dt) {
    const S = this.S, bp = S.players.get(p.pid);
    if (!bp || !bp.alive || bp.moveT > 0) return;
    p.bt = (p.bt || 0) + dt;
    if (p.bt < 0.3) return;
    p.bt = 0;
    const dirs = [['u', 0, -1], ['d', 0, 1], ['l', -1, 0], ['r', 1, 0]];
    const unsafe = (gx, gy) =>
      S.bombs.some(b => (b.gx === gx && Math.abs(b.gy - gy) <= b.range) || (b.gy === gy && Math.abs(b.gx - gx) <= b.range)) ||
      S.blasts.some(bl => bl.gx === gx && bl.gy === gy);
    const open = dirs.filter(d => {
      const nx = bp.gx + d[1], ny = bp.gy + d[2];
      return nx >= 0 && nx < this.COLS && ny >= 0 && ny < this.ROWS &&
        S.grid[ny][nx] === 0 && !S.bombs.some(b => b.gx === nx && b.gy === ny);
    });
    const safeOpen = open.filter(d => !unsafe(bp.gx + d[1], bp.gy + d[2]));
    if (unsafe(bp.gx, bp.gy)) {
      const esc2 = safeOpen.length ? safeOpen : open;
      if (esc2.length) this.onBtn(p, esc2[Math.random() * esc2.length | 0][0], G);
      return;
    }
    const crateAdj = dirs.some(d => {
      const nx = bp.gx + d[1], ny = bp.gy + d[2];
      return S.grid[ny] && S.grid[ny][nx] === 2;
    });
    if (crateAdj && bp.bombs < bp.maxBombs && safeOpen.length && Math.random() < 0.55) {
      this.onBtn(p, 'a', G);
      this.onBtn(p, safeOpen[Math.random() * safeOpen.length | 0][0], G);
      return;
    }
    if (safeOpen.length && Math.random() < 0.85) {
      this.onBtn(p, safeOpen[Math.random() * safeOpen.length | 0][0], G);
    }
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
      for (let i = S.powers.length - 1; i >= 0; i--) {
        const pw = S.powers[i];
        if (pw.gx === bp.gx && pw.gy === bp.gy) {
          if (pw.kind === 0) bp.maxBombs = Math.min(5, bp.maxBombs + 1);
          else bp.range = Math.min(6, bp.range + 1);
          const px = this.ox() + pw.gx * this.CELL + this.CELL / 2, py = this.oy() + pw.gy * this.CELL + this.CELL / 2;
          Draw2.boom(px, py, pw.kind === 0 ? '#2f9bff' : '#ff8c3a', 10, 130, 0.4, 3);
          S.powers.splice(i, 1);
          G.vib(p, 40);
        }
      }
    }
    for (let i = S.bombs.length - 1; i >= 0; i--) {
      const b = S.bombs[i];
      b.fuse -= dt;
      if (b.fuse <= 0) this.explode(b, G);
    }
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
          const px = this.ox() + bp.x * this.CELL + this.CELL / 2, py = this.oy() + bp.y * this.CELL + this.CELL / 2;
          Draw2.boom(px, py, p.color, 22, 260, 0.8);
          G.vib(p, 300);
        }
      }
    }
    const alive = [...S.players.entries()].filter(([pid, bp]) => bp.alive);
    const totalPlayers = S.players.size;
    if ((totalPlayers > 1 && alive.length <= 1) || (totalPlayers === 1 && alive.length === 0) || G.time > this.TIME) {
      const rows = [];
      alive.sort((a, b) => b[1].crates - a[1].crates).forEach(([pid, bp]) => rows.push({ pid, label: T('survived') + ' · ' + bp.crates + ' ' + T('crates') }));
      [...S.deathOrder].reverse().forEach(pid => rows.push({ pid, label: S.players.get(pid).crates + ' ' + T('crates') }));
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
          const px = this.ox() + gx * this.CELL + this.CELL / 2, py = this.oy() + gy * this.CELL + this.CELL / 2;
          Draw2.boom(px, py, '#a87f4c', 10, 160, 0.5, 5);
          if (Math.random() < 0.3) S.powers.push({ gx, gy, kind: Math.random() < 0.5 ? 0 : 1 });
          break;
        }
        const other = S.bombs.find(b => b.gx === gx && b.gy === gy);
        if (other) other.fuse = Math.min(other.fuse, 0.05);
      }
    }
    AudioSys.sfx('boom');
    for (const [gx, gy] of cells) S.blasts.push({ gx, gy, t: 0.45 });
  },
  draw(ctx, G) {
    const S = this.S, C = this.CELL, ox = this.ox(), oy = this.oy();
    Draw2.bg(ctx, G, '#101528', '#182040');
    // floor tiles with bevel
    for (let y = 0; y < this.ROWS; y++) for (let x = 0; x < this.COLS; x++) {
      const px = ox + x * C, py = oy + y * C;
      ctx.fillStyle = (x + y) % 2 ? '#222c4e' : '#26315a';
      ctx.fillRect(px, py, C, C);
      ctx.fillStyle = 'rgba(255,255,255,.05)';
      ctx.fillRect(px, py, C, 3);
      ctx.fillStyle = 'rgba(0,0,0,.15)';
      ctx.fillRect(px, py + C - 3, C, 3);
      if (S.grid[y][x] === 1) {
        // stone pillar
        ctx.fillStyle = 'rgba(0,0,0,.4)';
        ctx.fillRect(px + 6, py + 8, C - 8, C - 8);
        const sg = ctx.createLinearGradient(px, py, px, py + C);
        sg.addColorStop(0, '#5b6890'); sg.addColorStop(0.5, '#454f75'); sg.addColorStop(1, '#333b5c');
        ctx.fillStyle = sg;
        ctx.beginPath(); ctx.roundRect(px + 4, py + 3, C - 8, C - 8, 6); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(px + 5, py + 4, C - 10, C - 10, 5); ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,.25)';
        ctx.beginPath(); ctx.moveTo(px + 4, py + C / 2); ctx.lineTo(px + C - 4, py + C / 2); ctx.stroke();
      } else if (S.grid[y][x] === 2) {
        // wooden crate with planks
        ctx.fillStyle = 'rgba(0,0,0,.35)';
        ctx.fillRect(px + 8, py + 10, C - 14, C - 14);
        const wg = ctx.createLinearGradient(px, py, px + C, py + C);
        wg.addColorStop(0, '#a5763f'); wg.addColorStop(1, '#7c5527');
        ctx.fillStyle = wg;
        ctx.fillRect(px + 6, py + 6, C - 12, C - 12);
        ctx.strokeStyle = 'rgba(60,38,14,.8)'; ctx.lineWidth = 2;
        ctx.strokeRect(px + 6, py + 6, C - 12, C - 12);
        ctx.beginPath();
        ctx.moveTo(px + 6, py + C / 3 + 2); ctx.lineTo(px + C - 6, py + C / 3 + 2);
        ctx.moveTo(px + 6, py + 2 * C / 3 - 2); ctx.lineTo(px + C - 6, py + 2 * C / 3 - 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,230,190,.25)';
        ctx.fillRect(px + 6, py + 6, C - 12, 3);
      }
    }
    // power-ups: glowing chips with drawn glyphs
    for (const pw of S.powers) {
      const px = ox + pw.gx * C + C / 2, py = oy + pw.gy * C + C / 2;
      const col = pw.kind === 0 ? '#2f9bff' : '#ff8c3a';
      ctx.shadowColor = col; ctx.shadowBlur = 14;
      ctx.fillStyle = 'rgba(10,14,26,.9)';
      ctx.beginPath(); ctx.roundRect(px - 16, py - 16, 32, 32, 8); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(px - 16, py - 16, 32, 32, 8); ctx.stroke();
      if (pw.kind === 0) {
        // extra bomb glyph
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(px, py + 2, 7, 0, 7); ctx.fill();
        ctx.strokeStyle = col;
        ctx.beginPath(); ctx.moveTo(px + 4, py - 4); ctx.lineTo(px + 9, py - 9); ctx.stroke();
      } else {
        // range glyph: flame triangle
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(px, py - 8); ctx.quadraticCurveTo(px + 8, py + 2, px, py + 8); ctx.quadraticCurveTo(px - 8, py + 2, px, py - 8); ctx.fill();
      }
    }
    // bombs
    for (const b of S.bombs) {
      const px = ox + b.gx * C + C / 2, py = oy + b.gy * C + C / 2;
      const pulse = 1 + 0.12 * Math.sin(b.fuse * 14);
      Draw2.dropShadow(ctx, px, py + 16, 16);
      const bg = ctx.createRadialGradient(px - 6, py - 8, 3, px, py, 20 * pulse);
      bg.addColorStop(0, '#4a4f58'); bg.addColorStop(0.6, '#1c1e23'); bg.addColorStop(1, '#0c0d10');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(px, py, 19 * pulse, 0, 7); ctx.fill();
      // red warning glow as fuse runs out
      if (b.fuse < 0.8) {
        ctx.fillStyle = `rgba(255,70,60,${(0.8 - b.fuse)})`;
        ctx.beginPath(); ctx.arc(px, py, 19 * pulse, 0, 7); ctx.fill();
      }
      ctx.strokeStyle = '#c9a13c'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(px + 7, py - 15); ctx.quadraticCurveTo(px + 13, py - 22, px + 17, py - 24); ctx.stroke();
      Draw2.trail(px + 17, py - 24, '#ffd76b', 2.5, 0.2);
    }
    // blasts: layered fire
    for (const bl of S.blasts) {
      const k = bl.t / 0.45;
      const px = ox + bl.gx * C, py = oy + bl.gy * C;
      const cxm = px + C / 2, cym = py + C / 2;
      const fg = ctx.createRadialGradient(cxm, cym, 2, cxm, cym, C * 0.55);
      fg.addColorStop(0, `rgba(255,245,200,${k})`);
      fg.addColorStop(0.4, `rgba(255,160,50,${k * 0.95})`);
      fg.addColorStop(1, `rgba(200,50,20,${k * 0.5})`);
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.roundRect(px + 4, py + 4, C - 8, C - 8, 12); ctx.fill();
    }
    // players
    for (const p of G.players) {
      const bp = S.players.get(p.pid);
      if (!bp || !bp.alive) continue;
      const px = ox + bp.x * C + C / 2, py = oy + bp.y * C + C / 2;
      Draw2.dropShadow(ctx, px, py + 20, 15);
      // body
      const bg = ctx.createLinearGradient(px, py - 20, px, py + 18);
      bg.addColorStop(0, Draw2.lighten(p.color, 0.3));
      bg.addColorStop(1, Draw2.darken(p.color, 0.35));
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.roundRect(px - 13, py - 6, 26, 24, 9); ctx.fill();
      // head
      Draw2.orb(ctx, px, py - 10, 14, p.color);
      // visor
      ctx.fillStyle = 'rgba(15,20,32,.85)';
      ctx.beginPath(); ctx.roundRect(px - 9, py - 15, 18, 9, 5); ctx.fill();
      ctx.fillStyle = 'rgba(160,220,255,.8)';
      ctx.beginPath(); ctx.roundRect(px - 7, py - 13.5, 6, 4, 2); ctx.fill();
      Draw2.tag(ctx, p, px, py - 32);
    }
    Draw2.vignette(ctx, G, 0.35);
    Draw2.timer(ctx, G, this.TIME - G.time, this.TIME);
  },
});
