// CraftWorld (3D Minecraft) — HOST side. Every player explores and builds the
// same voxel island in first person ON THEIR OWN DEVICE; the console shows a
// rotating spectator view and relays positions + block edits between players.
registerGame({
  id: 'minecraft', title: 'CraftWorld 3D', icon: 'minecraft', desc: 'A shared voxel island. Build & break together in first person on your phone!',
  players: '1-8', minPlayers: 1, is3d: true,
  S: null,
  init(G) {
    const seed = Date.now() % 100000 | 0;
    const S = this.S = {
      seed, edits: [], avatars: new Map(), placed: new Map(),
      renderer: null, scene: null, camera: null, world: null, orbit: 0,
    };
    S.scene = E3D.makeScene();
    S.world = new E3D.World(seed);
    S.world.shadows = true;
    S.world.buildAll(S.scene);
    E3D.decorate(S.world, S.scene);
    S.clouds = E3D.makeClouds(seed);
    S.scene.add(S.clouds.group);
    S.camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 400);

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%;height:100%;display:block';
    G.glWrap.appendChild(canvas);
    S.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    E3D.enableShadows(S.renderer, S.scene);
    this.resize(G);
    window.addEventListener('resize', this._rs = () => this.resize(G));

    const hud = document.createElement('div');
    hud.id = 'mcHud';
    hud.style.cssText = 'position:absolute;left:16px;bottom:16px;color:#fff;font-size:14px;text-shadow:0 1px 3px #000;line-height:1.7';
    G.glWrap.appendChild(hud);
    S.hud = hud;

    G.players.forEach(p => S.placed.set(p.pid, 0));
    G.setScheme(null, '3d', { mode: 'minecraft', seed, edits: [] });
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
        av = { group: E3D.makeAvatar(new THREE.Color(p.color).getHex(), p.name), tx: m.p[0], ty: m.p[1], tz: m.p[2], ry: 0 };
        av.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
        av.group.position.set(m.p[0], m.p[1], m.p[2]);
        S.scene.add(av.group);
        S.avatars.set(p.pid, av);
      }
      av.tx = m.p[0]; av.ty = m.p[1]; av.tz = m.p[2]; av.ry = m.ry || 0;
      // relay to everyone else
      const out = { t: 'pp', pid: p.pid, name: p.name, color: p.color, p: m.p, ry: m.ry };
      for (const q of G.players) if (q.pid !== p.pid) G.send(q, out);
    } else if (m.t === 'blk') {
      const x = m.x | 0, y = m.y | 0, z = m.z | 0, id = m.id | 0;
      if (!(id in E3D.BLOCKS) && id !== 0) return;
      if (S.world.applyEdit(x, y, z, id)) {
        S.edits.push([x, y, z, id]);
        if (id !== 0) S.placed.set(p.pid, (S.placed.get(p.pid) || 0) + 1);
        const out = { t: 'blk', x, y, z, id };
        for (const q of G.players) if (q.pid !== p.pid) G.send(q, out);
      }
    }
  },
  update(dt, G) {
    const S = this.S;
    S.clouds.tick(dt);
    // drop avatars of players who left
    for (const [pid, av] of S.avatars) {
      if (!G.players.some(p => p.pid === pid)) {
        S.scene.remove(av.group);
        S.avatars.delete(pid);
        G.broadcast({ t: 'pgone', pid });
      }
    }
    for (const av of S.avatars.values()) {
      av.group.position.x = lerp(av.group.position.x, av.tx, dt * 10);
      av.group.position.y = lerp(av.group.position.y, av.ty, dt * 10);
      av.group.position.z = lerp(av.group.position.z, av.tz, dt * 10);
      av.group.rotation.y = av.ry;
    }
    // slow orbit around the island (or around the players' center)
    S.orbit += dt * 0.12;
    let cx = 24, cz = 24, cy = 8;
    if (S.avatars.size) {
      cx = 0; cz = 0; cy = 0;
      for (const av of S.avatars.values()) { cx += av.group.position.x; cy += av.group.position.y; cz += av.group.position.z; }
      cx /= S.avatars.size; cy /= S.avatars.size; cz /= S.avatars.size;
    }
    const r = 26;
    S.camera.position.set(cx + Math.cos(S.orbit) * r, cy + 16, cz + Math.sin(S.orbit) * r);
    S.camera.lookAt(cx, cy + 2, cz);
    S.renderer.render(S.scene, S.camera);

    S.hud.innerHTML = T('mcHud') + '<br>' +
      G.players.map(p => `<span style="color:${p.color}">●</span> ${esc(p.name)}: ${S.placed.get(p.pid) || 0} ${T('blocks')}`).join(' &nbsp; ');
  },
  end(G) {
    window.removeEventListener('resize', this._rs);
    const S = this.S;
    if (S && S.renderer) S.renderer.dispose();
  },
});
