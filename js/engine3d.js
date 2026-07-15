// CouchPlay 3D engine — voxel world (CraftWorld), obby course generator,
// avatars and physics. Shared by the console (spectator view) and controllers
// (first-person view). Worlds are generated deterministically from a seed so
// every device builds the identical map.
const E3D = (() => {
  const BLOCKS = {
    1: { c: 0x55b04f, top: 0x66c95c, name: 'Grass' },
    2: { c: 0x8a5a33, name: 'Dirt' },
    3: { c: 0x8d8d94, name: 'Stone' },
    4: { c: 0x6b4a2a, name: 'Wood' },
    5: { c: 0x2f8a3a, name: 'Leaves' },
    6: { c: 0xe0d08a, name: 'Sand' },
    7: { c: 0xb08a4f, name: 'Plank' },
    8: { c: 0xb04a3a, name: 'Brick' },
    9: { c: 0x9fd7e8, name: 'Ice' },
    10: { c: 0x3d7edb, name: 'Water' },
    11: { c: 0xf0f4f8, name: 'Snow' },
  };
  const NON_SOLID = new Set([0, 10]);
  const HOTBAR = [2, 3, 4, 7, 8, 5]; // block ids the player can place

  // value noise from seeded PRNG
  function noise2(seed) {
    const rnd = mulberry(seed);
    const grid = [];
    for (let i = 0; i < 64 * 64; i++) grid.push(rnd());
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const g = (a, b) => grid[(((a % 64) + 64) % 64) * 64 + (((b % 64) + 64) % 64)];
      const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
      return lerp(lerp(g(xi, yi), g(xi + 1, yi), sx), lerp(g(xi, yi + 1), g(xi + 1, yi + 1), sx), sy);
    };
  }

  class World {
    constructor(seed, sx = 48, sy = 28, sz = 48) {
      this.sx = sx; this.sy = sy; this.sz = sz;
      this.seed = seed;
      this.data = new Uint8Array(sx * sy * sz);
      this.chunkMeshes = new Map();
      this.CHUNK = 8;
      this.generate();
    }
    idx(x, y, z) { return (y * this.sz + z) * this.sx + x; }
    inBounds(x, y, z) { return x >= 0 && x < this.sx && y >= 0 && y < this.sy && z >= 0 && z < this.sz; }
    get(x, y, z) { return this.inBounds(x, y, z) ? this.data[this.idx(x, y, z)] : 0; }
    set(x, y, z, id) { if (this.inBounds(x, y, z)) this.data[this.idx(x, y, z)] = id; }
    solid(x, y, z) { return !NON_SOLID.has(this.get(Math.floor(x), Math.floor(y), Math.floor(z))); }
    solidId(id) { return !NON_SOLID.has(id); }

    generate() {
      const n = noise2(this.seed);
      const rnd = mulberry(this.seed ^ 0x9e3779b9);
      const WATER = 4;
      for (let x = 0; x < this.sx; x++) for (let z = 0; z < this.sz; z++) {
        const h = Math.floor(2 + n(x / 9, z / 9) * 9 + n(x / 21, z / 21) * 5);
        const sandy = h <= WATER + 1;
        const snowy = h >= 13;
        for (let y = 0; y <= h; y++) {
          let id = 3;
          if (y === h) id = snowy ? 11 : (sandy ? 6 : 1);
          else if (y >= h - 2) id = sandy ? 6 : (snowy ? 3 : 2);
          this.set(x, y, z, id);
        }
        for (let y = h + 1; y <= WATER; y++) this.set(x, y, z, 10); // lakes
      }
      // trees
      for (let t = 0; t < 14; t++) {
        const x = 3 + Math.floor(rnd() * (this.sx - 6));
        const z = 3 + Math.floor(rnd() * (this.sz - 6));
        let h = this.sy - 1;
        while (h > 0 && !this.get(x, h, z)) h--;
        if (this.get(x, h, z) !== 1) continue; // grass only: keeps trees off lakes/peaks
        const th = 3 + Math.floor(rnd() * 2);
        for (let y = 1; y <= th; y++) this.set(x, h + y, z, 4);
        for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 0; dy <= 2; dy++) {
          if (Math.abs(dx) + Math.abs(dz) + dy < 4 && !(dx === 0 && dz === 0 && dy === 0)) {
            if (!this.get(x + dx, h + th + dy, z + dz)) this.set(x + dx, h + th + dy, z + dz, 5);
          }
        }
      }
    }

    topY(x, z) {
      for (let y = this.sy - 1; y >= 0; y--) if (this.get(x, y, z)) return y;
      return 0;
    }

    // ---- meshing ----
    buildAll(scene) {
      this.scene = scene;
      this.waterMeshes = new Map();
      const nc = Math.ceil(this.sx / this.CHUNK);
      for (let cx = 0; cx < nc; cx++) for (let cz = 0; cz < Math.ceil(this.sz / this.CHUNK); cz++) {
        this.rebuildChunk(cx, cz);
      }
    }
    rebuildChunk(cx, cz) {
      const key = cx + ',' + cz;
      for (const [map, water] of [[this.chunkMeshes, false], [this.waterMeshes, true]]) {
        const old = map.get(key);
        if (old) { this.scene.remove(old); old.geometry.dispose(); }
        const geo = this.chunkGeometry(cx, cz, water);
        if (!geo) { map.delete(key); continue; }
        if (water) {
          if (!this.waterMat) this.waterMat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.72 });
          const mesh = new THREE.Mesh(geo, this.waterMat);
          this.scene.add(mesh);
          map.set(key, mesh);
        } else {
          if (!this.material) this.material = new THREE.MeshLambertMaterial({ vertexColors: true });
          const mesh = new THREE.Mesh(geo, this.material);
          if (this.shadows) { mesh.castShadow = true; mesh.receiveShadow = true; }
          this.scene.add(mesh);
          map.set(key, mesh);
        }
      }
    }
    chunkGeometry(cx, cz, water = false) {
      const C = this.CHUNK;
      const pos = [], nor = [], col = [], idxs = [];
      const FACES = [
        { d: [1, 0, 0], v: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], sh: 0.8 },
        { d: [-1, 0, 0], v: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], sh: 0.8 },
        { d: [0, 1, 0], v: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], sh: 1.0 },
        { d: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], sh: 0.5 },
        { d: [0, 0, 1], v: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], sh: 0.7 },
        { d: [0, 0, -1], v: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], sh: 0.7 },
      ];
      const color = new THREE.Color();
      for (let x = cx * C; x < Math.min((cx + 1) * C, this.sx); x++)
        for (let z = cz * C; z < Math.min((cz + 1) * C, this.sz); z++)
          for (let y = 0; y < this.sy; y++) {
            const id = this.get(x, y, z);
            if (!id) continue;
            if (water !== (id === 10)) continue;
            const b = BLOCKS[id];
            for (const f of FACES) {
              const nb = this.get(x + f.d[0], y + f.d[1], z + f.d[2]);
              // solid faces show against air/water; water faces only against air
              if (water ? nb !== 0 : (nb !== 0 && nb !== 10)) continue;
              const base = pos.length / 3;
              const c = (f.d[1] === 1 && b.top) ? b.top : b.c;
              // subtle per-block tint variation so large areas don't look flat
              const jit = 0.93 + (((x * 73856093 ^ y * 19349663 ^ z * 83492791) >>> 0) % 100) / 100 * 0.14;
              color.setHex(c).multiplyScalar(f.sh * (water ? 1 : jit));
              for (const v of f.v) {
                pos.push(x + v[0], y + v[1], z + v[2]);
                nor.push(f.d[0], f.d[1], f.d[2]);
                col.push(color.r, color.g, color.b);
              }
              idxs.push(base, base + 1, base + 2, base, base + 2, base + 3);
            }
          }
      if (!pos.length) return null;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setIndex(idxs);
      return geo;
    }
    applyEdit(x, y, z, id) {
      if (!this.inBounds(x, y, z)) return false;
      if (this.get(x, y, z) === id) return false;
      this.set(x, y, z, id);
      if (this.scene) {
        const C = this.CHUNK;
        const cx = Math.floor(x / C), cz = Math.floor(z / C);
        this.rebuildChunk(cx, cz);
        if (x % C === 0 && cx > 0) this.rebuildChunk(cx - 1, cz);
        if (x % C === C - 1) this.rebuildChunk(cx + 1, cz);
        if (z % C === 0 && cz > 0) this.rebuildChunk(cx, cz - 1);
        if (z % C === C - 1) this.rebuildChunk(cx, cz + 1);
      }
      return true;
    }
    // step a ray through the voxels; returns {hit:[x,y,z], prev:[x,y,z]} or null
    raycast(origin, dir, maxDist = 6) {
      let prev = null;
      for (let t = 0; t < maxDist; t += 0.04) {
        const x = Math.floor(origin.x + dir.x * t);
        const y = Math.floor(origin.y + dir.y * t);
        const z = Math.floor(origin.z + dir.z * t);
        const id = this.get(x, y, z);
        if (id && id !== 10) return { hit: [x, y, z], prev };
        prev = [x, y, z];
      }
      return null;
    }
  }

  // ---- shared scene helpers ----
  function makeScene(skyHex = 0x87b7e8) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(skyHex);
    scene.fog = new THREE.Fog(skyHex, 40, 140);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.9));
    const sun = new THREE.DirectionalLight(0xfff3d0, 0.9);
    sun.position.set(30, 60, 20);
    scene.add(sun);
    return scene;
  }

  function enableShadows(renderer, scene, size = 60) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene.traverse(o => { if (o.isDirectionalLight) {
      o.castShadow = true;
      o.shadow.mapSize.set(2048, 2048);
      o.shadow.camera.left = -size; o.shadow.camera.right = size;
      o.shadow.camera.top = size; o.shadow.camera.bottom = -size;
      o.shadow.camera.far = 200;
    } });
  }

  // slow drifting flat clouds
  function makeClouds(seed, area = 64, height = 24) {
    const rnd = mulberry(seed ^ 0x51ca);
    const group = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    const items = [];
    for (let i = 0; i < 9; i++) {
      const cl = new THREE.Group();
      const blobs = 2 + Math.floor(rnd() * 3);
      for (let b = 0; b < blobs; b++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(4 + rnd() * 7, 1, 3 + rnd() * 5), mat);
        m.position.set((rnd() - 0.5) * 8, rnd() * 0.6, (rnd() - 0.5) * 6);
        cl.add(m);
      }
      cl.position.set(rnd() * area, height + rnd() * 5, rnd() * area);
      group.add(cl);
      items.push({ cl, v: 0.6 + rnd() * 0.9 });
    }
    return {
      group,
      tick(dt) {
        for (const it of items) {
          it.cl.position.x += it.v * dt;
          if (it.cl.position.x > area + 12) it.cl.position.x = -12;
        }
      },
    };
  }

  // decorative flowers + grass tufts on grass blocks (deterministic from seed)
  function decorate(world, scene) {
    const rnd = mulberry(world.seed ^ 0xf10e);
    const colors = [0xe84a4a, 0xf2d34d, 0xffffff, 0xc86ae0];
    const stemMat = new THREE.MeshLambertMaterial({ color: 0x3f9a45 });
    for (let i = 0; i < 90; i++) {
      const x = 1 + Math.floor(rnd() * (world.sx - 2));
      const z = 1 + Math.floor(rnd() * (world.sz - 2));
      const y = world.topY(x, z);
      if (world.get(x, y, z) !== 1) continue;
      if (rnd() < 0.45) {
        // flower: stem + colored head
        const g = new THREE.Group();
        const stem = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.07), stemMat);
        stem.position.y = 0.25;
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24),
          new THREE.MeshLambertMaterial({ color: colors[Math.floor(rnd() * 4)] }));
        head.position.y = 0.55;
        g.add(stem, head);
        g.position.set(x + 0.3 + rnd() * 0.4, y + 1, z + 0.3 + rnd() * 0.4);
        scene.add(g);
      } else {
        // grass tuft
        const tuft = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.08), stemMat);
        tuft.position.set(x + 0.3 + rnd() * 0.4, y + 1.17, z + 0.3 + rnd() * 0.4);
        tuft.rotation.y = rnd() * 3;
        scene.add(tuft);
      }
    }
  }

  function makeAvatar(colorHex, name) {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: colorHex });
    const skin = new THREE.MeshLambertMaterial({ color: 0xf0c8a0 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.75, 0.35), mat);
    body.position.y = 0.95;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skin);
    head.position.y = 1.6;
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.3), new THREE.MeshLambertMaterial({ color: 0x2b3350 }));
    legs.position.y = 0.3;
    g.add(body, head, legs);
    if (name) {
      const cvs = document.createElement('canvas');
      cvs.width = 256; cvs.height = 64;
      const c = cvs.getContext('2d');
      c.font = '700 34px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, 0, 256, 64);
      c.fillStyle = '#fff'; c.fillText(name.slice(0, 12), 128, 34);
      const tex = new THREE.CanvasTexture(cvs);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
      sprite.scale.set(1.8, 0.45, 1);
      sprite.position.y = 2.2;
      g.add(sprite);
    }
    return g;
  }

  // ---- physics: AABB vs solidity query, axis-separated ----
  // p = {x,y,z} feet position; size = {w, h}; returns onGround
  function moveAABB(p, vel, dt, size, solidAt) {
    const hw = size.w / 2;
    let onGround = false;
    const collides = (x, y, z) => {
      for (let bx = Math.floor(x - hw); bx <= Math.floor(x + hw - 0.001); bx++)
        for (let bz = Math.floor(z - hw); bz <= Math.floor(z + hw - 0.001); bz++)
          for (let by = Math.floor(y); by <= Math.floor(y + size.h - 0.001); by++)
            if (solidAt(bx, by, bz)) return true;
      return false;
    };
    // x axis
    let nx = p.x + vel.x * dt;
    if (!collides(nx, p.y, p.z)) p.x = nx; else vel.x = 0;
    // z axis
    let nz = p.z + vel.z * dt;
    if (!collides(p.x, p.y, nz)) p.z = nz; else vel.z = 0;
    // y axis
    let ny = p.y + vel.y * dt;
    if (!collides(p.x, ny, p.z)) { p.y = ny; }
    else {
      if (vel.y < 0) { onGround = true; p.y = Math.ceil(ny); }
      vel.y = 0;
    }
    return onGround;
  }

  // ---- obby course ----
  // Deterministic obstacle course: platforms, moving platforms, checkpoints, finish.
  function obbyCourse(seed) {
    const rnd = mulberry(seed);
    const boxes = [];
    boxes.push({ x: 0, y: -0.5, z: 0, w: 8, h: 1, d: 8, kind: 'start' });
    let x = 0, y = 0, z = 0, prevD = 8;
    const checkpoints = [{ x: 0, y: 0.5, z: 0 }];
    const N = 42;
    for (let i = 1; i <= N; i++) {
      const isCp = i % 8 === 0;
      const w = isCp ? 5 : 2.2 + rnd() * 2.2;
      const d = isCp ? 5 : 2.2 + rnd() * 2.2;
      const gap = 2 + rnd() * 1.8;
      z += prevD / 2 + gap + d / 2;
      x = clamp(x + (rnd() - 0.5) * 7, -9, 9);
      y = clamp(y + (rnd() - 0.5) * 2.4, -1, 12);
      const box = { x, y: y - 0.5, z, w, h: 1, d, kind: isCp ? 'cp' : 'plat' };
      if (!isCp && rnd() < 0.22) {
        box.move = { axis: rnd() < 0.6 ? 'x' : 'y', amp: 2 + rnd() * 2, speed: 0.8 + rnd() * 1.2, phase: rnd() * 6.28 };
        box.baseX = box.x; box.baseY = box.y;
      }
      if (!isCp && rnd() < 0.15) box.kind = 'ice';
      boxes.push(box);
      if (isCp) checkpoints.push({ x, y: y + 0.5, z });
      prevD = d;
    }
    z += prevD / 2 + 2.5 + 4;
    boxes.push({ x, y: y - 0.5, z, w: 9, h: 1, d: 8, kind: 'finish' });
    return { boxes, checkpoints, finish: { x, y, z }, length: z };
  }

  function obbyBoxMeshes(course, scene) {
    const mats = {
      start: new THREE.MeshLambertMaterial({ color: 0x2f9bff }),
      plat: new THREE.MeshLambertMaterial({ color: 0x8f74e8 }),
      cp: new THREE.MeshLambertMaterial({ color: 0x2fd573 }),
      ice: new THREE.MeshLambertMaterial({ color: 0x9fd7e8 }),
      finish: new THREE.MeshLambertMaterial({ color: 0xffcf3f }),
      move: new THREE.MeshLambertMaterial({ color: 0xff8c3a }),
    };
    for (const b of course.boxes) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), b.move ? mats.move : mats[b.kind]);
      m.position.set(b.x, b.y, b.z);
      scene.add(m);
      b.mesh = m;
    }
    // lava floor
    const lava = new THREE.Mesh(
      new THREE.PlaneGeometry(400, course.length + 100),
      new THREE.MeshBasicMaterial({ color: 0xd83a1e })
    );
    lava.rotation.x = -Math.PI / 2;
    lava.position.set(0, -7, course.length / 2);
    scene.add(lava);
  }

  // advance moving platforms; player standing on one gets carried
  function obbyTick(course, t) {
    for (const b of course.boxes) {
      if (!b.move) continue;
      const off = Math.sin(t * b.move.speed + b.move.phase) * b.move.amp;
      b.prevX = b.x; b.prevY = b.y;
      if (b.move.axis === 'x') b.x = b.baseX + off; else b.y = b.baseY + off;
      if (b.mesh) b.mesh.position.set(b.x, b.y, b.z);
    }
  }

  // axis-separated collision against course boxes; returns {onGround, ground}
  function moveBoxes(p, vel, dt, size, boxes) {
    const hw = size.w / 2;
    let onGround = false, ground = null;
    const hit = (x, y, z) => {
      for (const b of boxes) {
        if (x + hw > b.x - b.w / 2 && x - hw < b.x + b.w / 2 &&
            z + hw > b.z - b.d / 2 && z - hw < b.z + b.d / 2 &&
            y < b.y + b.h / 2 && y + size.h > b.y - b.h / 2) return b;
      }
      return null;
    };
    let nx = p.x + vel.x * dt;
    if (!hit(nx, p.y, p.z)) p.x = nx; else vel.x = 0;
    let nz = p.z + vel.z * dt;
    if (!hit(p.x, p.y, nz)) p.z = nz; else vel.z = 0;
    let ny = p.y + vel.y * dt;
    const g = hit(p.x, ny, p.z);
    if (!g) p.y = ny;
    else {
      if (vel.y <= 0) { onGround = true; ground = g; p.y = g.y + g.h / 2; }
      vel.y = 0;
    }
    return { onGround, ground };
  }

  return { BLOCKS, HOTBAR, World, makeScene, makeAvatar, moveAABB, obbyCourse, obbyBoxMeshes, obbyTick, moveBoxes, enableShadows, makeClouds, decorate };
})();
