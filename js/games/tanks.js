// Tank Battle Arena — drive, aim with movement, fire bouncing shells.
registerGame({
  id: 'tanks', title: 'Tank Battle', icon: 'tanks', desc: 'Drive with the stick, FIRE bouncing shells. Most kills in 90 seconds.',
  players: '1-8', minPlayers: 1, TIME: 90,
  S: null,
  init(G) {
    G.setScheme(null, 'stick1', { a: T('fire'), arep: 380 });
    const S = this.S = { tanks: new Map(), bullets: [], walls: [], patches: [], scorch: [], drums: [], pickup: null, pickupT: 6 };
    S.drums = [{ x: 640, y: 180, r: 22 }, { x: 640, y: 540, r: 22 }, { x: 200, y: 360, r: 22 }, { x: 1080, y: 360, r: 22 }];
    S.walls = [
      { x: 300, y: 160, w: 40, h: 180 }, { x: 940, y: 160, w: 40, h: 180 },
      { x: 300, y: 400, w: 40, h: 180 }, { x: 940, y: 400, w: 40, h: 180 },
      { x: 540, y: 320, w: 200, h: 40 }, { x: 140, y: 60, w: 160, h: 36 }, { x: 980, y: 620, w: 160, h: 36 },
    ];
    for (let i = 0; i < 26; i++) S.patches.push({ x: rand(0, 1280), y: rand(0, 720), r: rand(20, 70), a: rand(0.03, 0.09) });
    G.players.forEach((p, i) => S.tanks.set(p.pid, this.spawn(G, i)));
  },
  spawn(G, i) {
    const spots = [[90, 90], [1190, 90], [90, 630], [1190, 630], [640, 80], [640, 640], [80, 360], [1200, 360]];
    return { x: spots[i % 8][0], y: spots[i % 8][1], a: 0, hp: 3, kills: 0, cd: 0, respawn: 0, tread: 0, flash: 0 };
  },
  hitWall(S, x, y, r) {
    if (x < r || x > 1280 - r || y < r || y > 720 - r) return true;
    for (const w of S.walls) {
      if (x + r > w.x && x - r < w.x + w.w && y + r > w.y && y - r < w.y + w.h) return true;
    }
    for (const d of S.drums) if (dist(x, y, d.x, d.y) < r + d.r) return true;
    return false;
  },
  onBtn(p, b, G) {
    const S = this.S, t = S.tanks.get(p.pid);
    if (!t || t.respawn > 0 || t.cd > 0 || b !== 'a') return;
    t.cd = t.rapid > 0 ? 0.16 : 0.45;
    t.flash = 0.08;
    const mx = t.x + Math.cos(t.a) * 30, my = t.y + Math.sin(t.a) * 30;
    Draw2.boom(mx, my, '#ffd76b', 6, 120, 0.2, 3);
    S.bullets.push({ x: mx, y: my, vx: Math.cos(t.a) * 430, vy: Math.sin(t.a) * 430, owner: p.pid, bounces: 1, life: 3, px: mx, py: my });
  },
  bot(p, G, dt) {
    const S = this.S, t = S.tanks.get(p.pid);
    if (!t || t.respawn > 0) return;
    let tgt = null, bd = 1e9;
    for (const q of G.players) {
      if (q.pid === p.pid) continue;
      const o = S.tanks.get(q.pid);
      if (!o || o.respawn > 0) continue;
      const d = dist(t.x, t.y, o.x, o.y);
      if (d < bd) { bd = d; tgt = o; }
    }
    // grab the rapid-fire crate when it's closer than the fight
    if (S.pickup && dist(t.x, t.y, S.pickup.x, S.pickup.y) < 300) tgt = S.pickup;
    if (!tgt) { p.in.x = 0; p.in.y = 0; return; }
    const dx = (tgt.x - t.x) / (bd || 1), dy = (tgt.y - t.y) / (bd || 1);
    const k = bd > 300 ? 1 : bd < 170 ? -0.6 : 0.2;
    p.bt = (p.bt || 0) + dt;
    if (p.bt > 0.8) { p.bt = 0; p.jx = rand(-0.55, 0.55); p.jy = rand(-0.55, 0.55); }
    let fx = dx * k + (p.jx || 0), fy = dy * k + (p.jy || 0);
    const m = Math.hypot(fx, fy) || 1;
    p.in.x = fx / m; p.in.y = fy / m;
    const aim = Math.atan2(dy, dx);
    let da = Math.abs(aim - t.a);
    while (da > Math.PI) da = Math.abs(da - Math.PI * 2);
    if (da < 0.3 && t.cd <= 0 && Math.random() < 0.4) this.onBtn(p, 'a', G);
  },
  update(dt, G) {
    const S = this.S;
    // rapid-fire crate spawns periodically at a clear spot
    S.pickupT -= dt;
    if (!S.pickup && S.pickupT <= 0) {
      for (let tries = 0; tries < 20; tries++) {
        const x = rand(80, 1200), y = rand(80, 640);
        if (!this.hitWall(S, x, y, 26)) { S.pickup = { x, y, bob: 0 }; break; }
      }
      S.pickupT = 12;
    }
    if (S.pickup) S.pickup.bob += dt;
    for (const p of G.players) {
      const t = S.tanks.get(p.pid);
      if (!t) continue;
      t.cd -= dt; t.flash -= dt; t.rapid = (t.rapid || 0) - dt;
      if (S.pickup && t.respawn <= 0 && dist(t.x, t.y, S.pickup.x, S.pickup.y) < 34) {
        t.rapid = 6;
        Draw2.boom(S.pickup.x, S.pickup.y, '#ffcf3f', 14, 200, 0.5, 4);
        S.pickup = null;
        G.vib(p, 80);
      }
      if (t.respawn > 0) {
        t.respawn -= dt;
        if (t.respawn <= 0 && !p.gone) Object.assign(t, this.spawn(G, p.slot), { kills: t.kills });
        continue;
      }
      const mag = Math.hypot(p.in.x, p.in.y);
      if (mag > 0.2) {
        // smooth turret/hull turn toward stick
        const target = Math.atan2(p.in.y, p.in.x);
        let d = target - t.a;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        t.a += clamp(d, -6 * dt, 6 * dt);
        const nx = t.x + p.in.x * 190 * dt, ny = t.y + p.in.y * 190 * dt;
        if (!this.hitWall(S, nx, t.y, 20)) { t.x = nx; t.tread += Math.abs(p.in.x) * dt * 12; }
        if (!this.hitWall(S, t.x, ny, 20)) { t.y = ny; t.tread += Math.abs(p.in.y) * dt * 12; }
      }
    }
    for (let i = S.bullets.length - 1; i >= 0; i--) {
      const b = S.bullets[i];
      b.life -= dt;
      b.px = b.x; b.py = b.y;
      let nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
      if (nx < 6 || nx > 1274) { if (b.bounces-- > 0) { b.vx *= -1; nx = b.x; } else { S.bullets.splice(i, 1); continue; } }
      if (ny < 6 || ny > 714) { if (b.bounces-- > 0) { b.vy *= -1; ny = b.y; } else { S.bullets.splice(i, 1); continue; } }
      for (const w of S.walls) {
        if (nx > w.x - 6 && nx < w.x + w.w + 6 && ny > w.y - 6 && ny < w.y + w.h + 6) {
          if (b.bounces-- > 0) {
            const px = Math.min(Math.abs(nx - w.x), Math.abs(nx - w.x - w.w));
            const py = Math.min(Math.abs(ny - w.y), Math.abs(ny - w.y - w.h));
            if (px < py) b.vx *= -1; else b.vy *= -1;
            nx = b.x; ny = b.y;
          } else { S.bullets.splice(i, 1); }
          break;
        }
      }
      if (!S.bullets.includes(b)) continue;
      let hitDrum = false;
      for (const d of S.drums) {
        if (dist(nx, ny, d.x, d.y) < d.r + 5) {
          Draw2.boom(nx, ny, '#c9ccd4', 6, 120, 0.3, 3);
          S.bullets.splice(i, 1);
          hitDrum = true;
          break;
        }
      }
      if (hitDrum) continue;
      b.x = nx; b.y = ny;
      if (b.life <= 0) { S.bullets.splice(i, 1); continue; }
      for (const p of G.players) {
        const t = S.tanks.get(p.pid);
        if (!t || t.respawn > 0 || p.pid === b.owner) continue;
        if (dist(b.x, b.y, t.x, t.y) < 22) {
          S.bullets.splice(i, 1);
          t.hp--;
          Draw2.boom(b.x, b.y, '#ff8c3a', 10, 180, 0.4);
          G.vib(p, 120);
          if (t.hp <= 0) {
            Draw2.boom(t.x, t.y, '#ff8c3a', 26, 300, 0.8, 6);
            Draw2.boom(t.x, t.y, '#5a5a5a', 14, 160, 1.1, 7);
            AudioSys.sfx('boom');
            S.scorch.push({ x: t.x, y: t.y, r: rand(24, 34) });
            if (S.scorch.length > 24) S.scorch.shift();
            t.respawn = 2.2; t.hp = 3;
            const killer = S.tanks.get(b.owner);
            if (killer) killer.kills++;
          }
          break;
        }
      }
    }
    if (G.time > this.TIME) {
      const rows = [...S.tanks.entries()].sort((a, b) => b[1].kills - a[1].kills)
        .map(([pid, t]) => ({ pid, label: t.kills + ' ' + T('kills') }));
      G.finish(rows);
    }
  },
  draw(ctx, G) {
    const S = this.S;
    // cracked concrete arena
    const g = ctx.createLinearGradient(0, 0, 0, G.H);
    g.addColorStop(0, '#3d4046'); g.addColorStop(1, '#2e3136');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, G.W, G.H);
    // concrete slabs
    ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 2;
    for (let x = 0; x <= G.W; x += 160) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, G.H); ctx.stroke(); }
    for (let y = 0; y <= G.H; y += 160) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(G.W, y); ctx.stroke(); }
    for (const pa of S.patches) {
      ctx.fillStyle = `rgba(0,0,0,${pa.a})`;
      ctx.beginPath(); ctx.arc(pa.x, pa.y, pa.r, 0, 7); ctx.fill();
    }
    // painted center ring + hazard corners
    ctx.strokeStyle = 'rgba(230,200,60,.16)'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(640, 360, 120, 0, 7); ctx.stroke();
    ctx.setLineDash([18, 14]);
    ctx.strokeStyle = 'rgba(230,200,60,.14)'; ctx.lineWidth = 5;
    ctx.strokeRect(26, 26, G.W - 52, G.H - 52);
    ctx.setLineDash([]);
    // scorch marks from destroyed tanks
    for (const sc of S.scorch) {
      const sg = ctx.createRadialGradient(sc.x, sc.y, 2, sc.x, sc.y, sc.r);
      sg.addColorStop(0, 'rgba(10,8,6,.55)');
      sg.addColorStop(1, 'rgba(10,8,6,0)');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(sc.x, sc.y, sc.r, 0, 7); ctx.fill();
    }
    // walls: riveted steel blocks
    for (const w of S.walls) {
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillRect(w.x + 4, w.y + 6, w.w, w.h);
      const wg = ctx.createLinearGradient(w.x, w.y, w.x, w.y + w.h);
      wg.addColorStop(0, '#6a6f7a'); wg.addColorStop(0.5, '#4a4f58'); wg.addColorStop(1, '#33373e');
      ctx.fillStyle = wg;
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(w.x + 1, w.y + 1, w.w - 2, w.h - 2);
      ctx.fillStyle = 'rgba(0,0,0,.4)';
      for (let rx = w.x + 8; rx < w.x + w.w - 4; rx += 16)
        for (let ry = w.y + 8; ry < w.y + w.h - 4; ry += 16) {
          ctx.beginPath(); ctx.arc(rx, ry, 1.6, 0, 7); ctx.fill();
        }
    }
    // oil drums
    for (const d of S.drums) {
      Draw2.dropShadow(ctx, d.x, d.y + d.r * 0.8, d.r);
      const dg = ctx.createRadialGradient(d.x - 8, d.y - 8, 3, d.x, d.y, d.r);
      dg.addColorStop(0, '#7a8494'); dg.addColorStop(0.7, '#4a525f'); dg.addColorStop(1, '#343a44');
      ctx.fillStyle = dg;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.18)';
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r - 7, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r - 14, 0, 7); ctx.stroke();
    }
    // rapid-fire crate
    if (S.pickup) {
      const py = S.pickup.y + Math.sin(S.pickup.bob * 3) * 4;
      ctx.shadowColor = '#ffcf3f'; ctx.shadowBlur = 18;
      ctx.fillStyle = '#1c1a10';
      ctx.beginPath(); ctx.roundRect(S.pickup.x - 17, py - 17, 34, 34, 8); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffcf3f'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.roundRect(S.pickup.x - 17, py - 17, 34, 34, 8); ctx.stroke();
      // triple-shot glyph
      ctx.fillStyle = '#ffcf3f';
      for (const ox of [-8, 0, 8]) { ctx.beginPath(); ctx.arc(S.pickup.x + ox, py, 3.2, 0, 7); ctx.fill(); }
    }
    // bullets with tracer trail
    for (const b of S.bullets) {
      ctx.strokeStyle = 'rgba(255,215,107,.5)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(b.px - (b.x - b.px) * 2, b.py - (b.y - b.py) * 2); ctx.lineTo(b.x, b.y); ctx.stroke();
      Draw2.orb(ctx, b.x, b.y, 5, '#ffd76b', true);
    }
    for (const p of G.players) {
      const t = S.tanks.get(p.pid);
      if (!t || t.respawn > 0) continue;
      Draw2.dropShadow(ctx, t.x, t.y + 16, 20);
      ctx.save();
      ctx.translate(t.x, t.y); ctx.rotate(t.a);
      // treads with animated links
      for (const side of [-16, 10]) {
        ctx.fillStyle = '#23262b';
        ctx.beginPath(); ctx.roundRect(-20, side, 40, 7, 3); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.14)';
        for (let lx = -18 + (t.tread % 6); lx < 18; lx += 6) ctx.fillRect(lx, side + 1, 2, 5);
      }
      // hull
      const hg = ctx.createLinearGradient(0, -14, 0, 14);
      hg.addColorStop(0, Draw2.lighten(p.color, 0.28));
      hg.addColorStop(0.5, p.color);
      hg.addColorStop(1, Draw2.darken(p.color, 0.4));
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.roundRect(-18, -12, 36, 24, 5); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1.5; ctx.stroke();
      // turret + barrel
      ctx.fillStyle = Draw2.darken(p.color, 0.15);
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.stroke();
      const bg2 = ctx.createLinearGradient(0, -3, 0, 3);
      bg2.addColorStop(0, '#c9ccd4'); bg2.addColorStop(1, '#7c8087');
      ctx.fillStyle = bg2;
      ctx.fillRect(6, -3, 26, 6);
      ctx.fillStyle = '#3a3d43';
      ctx.fillRect(28, -3.5, 5, 7);
      // muzzle flash
      if (t.flash > 0) {
        ctx.fillStyle = 'rgba(255,220,120,.9)';
        ctx.beginPath(); ctx.moveTo(33, 0); ctx.lineTo(46, -6); ctx.lineTo(42, 0); ctx.lineTo(46, 6); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      // hp bar
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      ctx.beginPath(); ctx.roundRect(t.x - 18, t.y - 34, 36, 6, 3); ctx.fill();
      ctx.fillStyle = t.hp > 1 ? '#2fd573' : '#ff4655';
      ctx.beginPath(); ctx.roundRect(t.x - 17, t.y - 33, 34 * (t.hp / 3), 4, 2); ctx.fill();
      Draw2.tag(ctx, p, t.x, t.y + 36, '· ' + t.kills + (t.rapid > 0 ? ' ···' : ''));
    }
    Draw2.vignette(ctx, G, 0.45);
    Draw2.timer(ctx, G, this.TIME - G.time, this.TIME);
  },
});
