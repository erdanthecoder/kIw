// Laser Tag Arena — instant bouncing beams, freeze your rivals.
registerGame({
  id: 'laser', title: 'Laser Tag', icon: 'laser', desc: 'Fire bouncing laser beams. Tag rivals to freeze them. Most tags in 75 seconds.',
  players: '1-8', minPlayers: 1, TIME: 75,
  S: null,
  init(G) {
    G.setScheme(null, 'stick1', { a: 'LASER' });
    const S = this.S = { units: new Map(), beams: [], walls: [] };
    S.walls = [
      { x: 200, y: 200, w: 240, h: 30 }, { x: 840, y: 200, w: 240, h: 30 },
      { x: 200, y: 490, w: 240, h: 30 }, { x: 840, y: 490, w: 240, h: 30 },
      { x: 610, y: 140, w: 30, h: 180 }, { x: 610, y: 400, w: 30, h: 180 },
    ];
    G.players.forEach((p, i) => {
      const spots = [[100, 100], [1180, 100], [100, 620], [1180, 620], [640, 70], [640, 650], [70, 360], [1210, 360]];
      S.units.set(p.pid, { x: spots[i % 8][0], y: spots[i % 8][1], a: 0, tags: 0, frozen: 0, cd: 0 });
    });
  },
  castBeam(S, x, y, a, maxBounce) {
    const segs = [];
    let dx = Math.cos(a), dy = Math.sin(a);
    for (let b = 0; b <= maxBounce; b++) {
      let t = 0, hit = null;
      const step = 6;
      let px = x, py = y;
      for (t = 0; t < 1600; t += step) {
        px = x + dx * t; py = y + dy * t;
        if (px < 0 || px > 1280) { hit = 'x'; break; }
        if (py < 0 || py > 720) { hit = 'y'; break; }
        let hw = null;
        for (const w of S.walls) if (px > w.x && px < w.x + w.w && py > w.y && py < w.y + w.h) { hw = w; break; }
        if (hw) {
          const pxd = Math.min(Math.abs(px - hw.x), Math.abs(px - hw.x - hw.w));
          const pyd = Math.min(Math.abs(py - hw.y), Math.abs(py - hw.y - hw.h));
          hit = pxd < pyd ? 'x' : 'y';
          break;
        }
      }
      segs.push([x, y, px, py]);
      if (!hit) break;
      x = px - dx * step; y = py - dy * step;
      if (hit === 'x') dx *= -1; else dy *= -1;
    }
    return segs;
  },
  onBtn(p, b, G) {
    const S = this.S, u = S.units.get(p.pid);
    if (!u || u.frozen > 0 || u.cd > 0 || b !== 'a') return;
    u.cd = 0.7;
    const segs = this.castBeam(S, u.x, u.y, u.a, 1);
    const color = G.players.find(q => q.pid === p.pid).color;
    S.beams.push({ segs, t: 0.28, color });
    const last = segs[segs.length - 1];
    Draw2.boom(last[2], last[3], color, 8, 140, 0.3, 3);
    for (const [x1, y1, x2, y2] of segs) {
      for (const q of G.players) {
        if (q.pid === p.pid) continue;
        const v = S.units.get(q.pid);
        if (!v || v.frozen > 0) continue;
        const L2 = (x2 - x1) ** 2 + (y2 - y1) ** 2 || 1;
        const tt = clamp(((v.x - x1) * (x2 - x1) + (v.y - y1) * (y2 - y1)) / L2, 0, 1);
        const d = dist(v.x, v.y, x1 + tt * (x2 - x1), y1 + tt * (y2 - y1));
        if (d < 22) {
          v.frozen = 2.5;
          u.tags++;
          Draw2.boom(v.x, v.y, '#9ecfff', 14, 180, 0.6);
          G.vib(q, 250);
        }
      }
    }
  },
  update(dt, G) {
    const S = this.S;
    for (const p of G.players) {
      const u = S.units.get(p.pid);
      if (!u) continue;
      u.cd -= dt;
      if (u.frozen > 0) { u.frozen -= dt; continue; }
      const mag = Math.hypot(p.in.x, p.in.y);
      if (mag > 0.2) {
        u.a = Math.atan2(p.in.y, p.in.x);
        let nx = clamp(u.x + p.in.x * 230 * dt, 20, 1260);
        let ny = clamp(u.y + p.in.y * 230 * dt, 20, 700);
        let blocked = false;
        for (const w of S.walls) if (nx > w.x - 18 && nx < w.x + w.w + 18 && ny > w.y - 18 && ny < w.y + w.h + 18) { blocked = true; break; }
        if (!blocked) { u.x = nx; u.y = ny; }
      }
    }
    for (let i = S.beams.length - 1; i >= 0; i--) {
      S.beams[i].t -= dt;
      if (S.beams[i].t <= 0) S.beams.splice(i, 1);
    }
    if (G.time > this.TIME) {
      const rows = [...S.units.entries()].sort((a, b) => b[1].tags - a[1].tags)
        .map(([pid, u]) => ({ pid, label: u.tags + ' tags' }));
      G.finish(rows);
    }
  },
  draw(ctx, G) {
    const S = this.S;
    Draw2.bg(ctx, G, '#0a0714', '#150e2a');
    // neon floor grid
    ctx.strokeStyle = 'rgba(122,92,255,.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= G.W; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, G.H); ctx.stroke(); }
    for (let y = 0; y <= G.H; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(G.W, y); ctx.stroke(); }
    // glowing walls
    for (const w of S.walls) {
      ctx.shadowColor = '#7a5cff'; ctx.shadowBlur = 18;
      const wg = ctx.createLinearGradient(w.x, w.y, w.x, w.y + w.h);
      wg.addColorStop(0, '#3c2f78'); wg.addColorStop(1, '#241c4a');
      ctx.fillStyle = wg;
      ctx.beginPath(); ctx.roundRect(w.x, w.y, w.w, w.h, 6); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(160,130,255,.6)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(w.x, w.y, w.w, w.h, 6); ctx.stroke();
    }
    // beams: outer glow + hot core
    for (const beam of S.beams) {
      const k = beam.t / 0.28;
      for (const [w, col, alpha] of [[9, beam.color, 0.35], [4.5, beam.color, 0.8], [1.8, '#ffffff', 1]]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.globalAlpha = k * alpha;
        ctx.lineCap = 'round';
        ctx.shadowColor = beam.color; ctx.shadowBlur = 16;
        ctx.beginPath();
        for (const [x1, y1, x2, y2] of beam.segs) { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
    for (const p of G.players) {
      const u = S.units.get(p.pid);
      if (!u) continue;
      const frozen = u.frozen > 0;
      // aim cone
      if (!frozen) {
        const cg = ctx.createRadialGradient(u.x, u.y, 6, u.x, u.y, 90);
        cg.addColorStop(0, 'rgba(255,255,255,.10)');
        cg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.moveTo(u.x, u.y);
        ctx.arc(u.x, u.y, 90, u.a - 0.22, u.a + 0.22);
        ctx.closePath(); ctx.fill();
      }
      Draw2.dropShadow(ctx, u.x, u.y + 15, 17);
      // metallic ring
      ctx.strokeStyle = frozen ? '#9ecfff' : '#c9ccd4';
      ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(u.x, u.y, 18, 0, 7); ctx.stroke();
      Draw2.orb(ctx, u.x, u.y, 13, frozen ? '#9ecfff' : p.color, !frozen);
      // barrel tick
      if (!frozen) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(u.x + Math.cos(u.a) * 14, u.y + Math.sin(u.a) * 14);
        ctx.lineTo(u.x + Math.cos(u.a) * 24, u.y + Math.sin(u.a) * 24); ctx.stroke();
      } else {
        // ice cracks
        ctx.strokeStyle = 'rgba(255,255,255,.75)';
        ctx.lineWidth = 1.5;
        for (let a = 0; a < 6; a++) {
          const ang = a * 1.05 + 0.3;
          ctx.beginPath(); ctx.moveTo(u.x, u.y);
          ctx.lineTo(u.x + Math.cos(ang) * 15, u.y + Math.sin(ang) * 15);
          ctx.stroke();
        }
      }
      // recharge arc
      if (u.cd > 0 && !frozen) {
        ctx.strokeStyle = 'rgba(255,255,255,.55)';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(u.x, u.y, 23, -Math.PI / 2, -Math.PI / 2 + (1 - u.cd / 0.7) * Math.PI * 2);
        ctx.stroke();
      }
      Draw2.tag(ctx, p, u.x, u.y - 34, '· ' + u.tags + (frozen ? ' · FROZEN' : ''));
    }
    Draw2.vignette(ctx, G, 0.5);
    Draw2.timer(ctx, G, this.TIME - G.time, this.TIME);
  },
});
