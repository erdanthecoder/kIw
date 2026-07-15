// Obby Rush (3D obstacle course) — HOST side. Players parkour in first person
// on their own device; the console shows a chase-cam of the leader + standings.
registerGame({
  id: 'obby', title: 'Obby Rush 3D', icon: 'obby', desc: 'Race a 3D obstacle course over lava. Checkpoints, moving platforms, glory.',
  players: '1-8', minPlayers: 1, TIME: 240, LAST_CALL: 40,
  S: null,
  init(G) {
    const seed = Date.now() % 100000 | 0;
    const S = this.S = {
      seed, course: E3D.obbyCourse(seed), avatars: new Map(),
      finished: [], firstFinishAt: 0,
      renderer: null, scene: null, camera: null,
    };
    S.scene = E3D.makeScene(0xe89b6a);
    E3D.obbyBoxMeshes(S.course, S.scene);
    S.camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 400);
    S.camera.position.set(0, 10, -14);

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%;height:100%;display:block';
    G.glWrap.appendChild(canvas);
    S.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.resize(G);
    window.addEventListener('resize', this._rs = () => this.resize(G));

    const hud = document.createElement('div');
    hud.style.cssText = 'position:absolute;right:16px;top:60px;color:#fff;font-size:15px;text-shadow:0 1px 3px #000;background:rgba(0,0,0,.35);padding:12px 16px;border-radius:12px;line-height:1.8';
    G.glWrap.appendChild(hud);
    S.hud = hud;

    G.setScheme(null, '3d', { mode: 'obby', seed });
  },
  resize(G) {
    const S = this.S;
    const w = G.glWrap.clientWidth || window.innerWidth, h = G.glWrap.clientHeight || window.innerHeight;
    S.renderer.setSize(w, h, false);
    S.camera.aspect = w / h;
    S.camera.updateProjectionMatrix();
  },
  onMsg(p, m, G) {
    const S = this.S;
    if (m.t === 'p3') {
      let av = S.avatars.get(p.pid);
      if (!av) {
        av = { group: E3D.makeAvatar(new THREE.Color(p.color).getHex(), p.name), tx: 0, ty: 0, tz: 0, ry: 0, prog: 0 };
        S.scene.add(av.group);
        S.avatars.set(p.pid, av);
      }
      av.tx = m.p[0]; av.ty = m.p[1]; av.tz = m.p[2]; av.ry = m.ry || 0;
      av.prog = Math.max(av.prog, m.p[2]);
      const out = { t: 'pp', pid: p.pid, name: p.name, color: p.color, p: m.p, ry: m.ry };
      for (const q of G.players) if (q.pid !== p.pid) G.send(q, out);
    } else if (m.t === 'fin' && !S.finished.includes(p.pid)) {
      S.finished.push(p.pid);
      if (!S.firstFinishAt) S.firstFinishAt = G.time;
      G.toast(`${p.name} finished #${S.finished.length}`);
      G.vib(p, 200);
    }
  },
  update(dt, G) {
    const S = this.S;
    E3D.obbyTick(S.course, performance.now() / 1000);
    for (const [pid, av] of S.avatars) {
      if (!G.players.some(p => p.pid === pid)) {
        S.scene.remove(av.group);
        S.avatars.delete(pid);
        G.broadcast({ t: 'pgone', pid });
      }
    }
    let leader = null;
    for (const av of S.avatars.values()) {
      av.group.position.x = lerp(av.group.position.x, av.tx, dt * 10);
      av.group.position.y = lerp(av.group.position.y, av.ty, dt * 10);
      av.group.position.z = lerp(av.group.position.z, av.tz, dt * 10);
      av.group.rotation.y = av.ry;
      if (!leader || av.prog > leader.prog) leader = av;
    }
    const look = leader ? leader.group.position : new THREE.Vector3(0, 1, 6);
    const camTarget = new THREE.Vector3(look.x + 7, look.y + 7, look.z - 11);
    S.camera.position.lerp(camTarget, dt * 2.2);
    S.camera.lookAt(look.x, look.y + 1, look.z + 3);
    S.renderer.render(S.scene, S.camera);

    // standings
    const rows = this.ranking(G);
    S.hud.innerHTML = '<b>Obby Rush</b> — first to the gold pad<br>' + rows.map((r, i) => {
      const p = G.players.find(q => q.pid === r.pid);
      return p ? `${i + 1}. <span style="color:${p.color}">●</span> ${esc(p.name)} <small>${esc(r.label)}</small>` : '';
    }).join('<br>') + `<br><small>${Math.max(0, Math.ceil(this.TIME - G.time))}s left${S.firstFinishAt ? ' · last call ' + Math.max(0, Math.ceil(this.LAST_CALL - (G.time - S.firstFinishAt))) + 's' : ''}</small>`;

    const everyoneDone = G.players.length > 0 && G.players.every(p => S.finished.includes(p.pid) || p.gone);
    const lastCallOver = S.firstFinishAt && (G.time - S.firstFinishAt > this.LAST_CALL);
    if (everyoneDone || lastCallOver || G.time > this.TIME) {
      G.finish(this.ranking(G));
    }
  },
  ranking(G) {
    const S = this.S;
    return [
      ...S.finished.map((pid, i) => ({ pid, label: 'finished #' + (i + 1) })),
      ...G.players.filter(p => !S.finished.includes(p.pid))
        .map(p => ({ pid: p.pid, prog: (S.avatars.get(p.pid) || { prog: 0 }).prog }))
        .sort((a, b) => b.prog - a.prog)
        .map(r => ({ pid: r.pid, label: Math.round(100 * r.prog / S.course.length) + '%' })),
    ];
  },
  end(G) {
    window.removeEventListener('resize', this._rs);
    const S = this.S;
    if (S && S.renderer) S.renderer.dispose();
  },
});
