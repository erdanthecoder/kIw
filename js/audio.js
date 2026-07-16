// CouchPlay audio — classical music + SFX, all synthesized with WebAudio.
// The compositions are famous public-domain classical works (their composers
// died centuries ago, so the sheet music is free for anyone to use), and the
// performances are generated note-by-note in code — no recordings, no
// copyright problems, nothing to license.
// Volumes persist in localStorage (cp-vol-music / cp-vol-sfx).
const AudioSys = (() => {
  let ctx = null, musicGain = null, sfxGain = null, delaySend = null;
  let piece = null, timer = null, paused = false;
  let mPtr = 0, bPtr = 0, mTime = 0, bTime = 0;
  const vol = {
    music: parseFloat(localStorage.getItem('cp-vol-music') !== null ? localStorage.getItem('cp-vol-music') : '0.5'),
    sfx: parseFloat(localStorage.getItem('cp-vol-sfx') !== null ? localStorage.getItem('cp-vol-sfx') : '0.7'),
  };

  // Note encoding: [midi, beats] (midi 0 = rest). Melody and bass loop
  // independently over their own total length.
  const PIECES = [
    {
      id: 'canon', name: 'Canon in D', composer: 'Pachelbel', bpm: 54, wave: 'triangle',
      melody: [[78, 2], [76, 2], [74, 2], [73, 2], [71, 2], [69, 2], [71, 2], [73, 2],
               [74, 2], [73, 2], [71, 2], [69, 2], [67, 2], [66, 2], [67, 2], [69, 2]],
      bass: [[50, 2], [45, 2], [47, 2], [42, 2], [43, 2], [38, 2], [43, 2], [45, 2]],
    },
    {
      id: 'elise', name: 'Fur Elise', composer: 'Beethoven', bpm: 72, wave: 'triangle',
      melody: [[76, 0.5], [75, 0.5], [76, 0.5], [75, 0.5], [76, 0.5], [71, 0.5], [74, 0.5], [72, 0.5], [69, 1.5],
               [60, 0.5], [64, 0.5], [69, 0.5], [71, 1.5], [64, 0.5], [68, 0.5], [71, 0.5], [72, 1.5],
               [64, 0.5], [76, 0.5], [75, 0.5], [76, 0.5], [75, 0.5], [76, 0.5], [71, 0.5], [74, 0.5], [72, 0.5], [69, 1.5],
               [60, 0.5], [64, 0.5], [69, 0.5], [71, 1.5], [64, 0.5], [72, 0.5], [71, 0.5], [69, 2]],
      bass: [[45, 3], [40, 3], [45, 3], [45, 3], [40, 3], [45, 3], [40, 1.5], [45, 1.5]],
    },
    {
      id: 'mozart', name: 'Eine kleine Nachtmusik', composer: 'Mozart', bpm: 116, wave: 'square',
      melody: [[67, 1], [62, 0.5], [67, 1], [62, 0.5], [67, 0.5], [62, 0.5], [67, 0.5], [71, 0.5], [74, 2],
               [72, 1], [69, 0.5], [72, 1], [69, 0.5], [72, 0.5], [69, 0.5], [66, 0.5], [69, 0.5], [62, 2],
               [67, 1], [0, 0.5], [67, 0.5], [64, 0.5], [67, 0.5], [71, 0.5], [67, 0.5], [74, 0.5], [71, 0.5], [79, 2]],
      bass: [[43, 1], [50, 1], [43, 1], [50, 1], [48, 1], [52, 1], [45, 1], [50, 1]],
    },
    {
      id: 'grieg', name: 'In the Hall of the Mountain King', composer: 'Grieg', bpm: 138, wave: 'sawtooth',
      melody: [[59, 0.5], [61, 0.5], [62, 0.5], [64, 0.5], [66, 0.5], [62, 0.5], [66, 1],
               [65, 0.5], [61, 0.5], [65, 1], [64, 0.5], [60, 0.5], [64, 1],
               [59, 0.5], [61, 0.5], [62, 0.5], [64, 0.5], [66, 0.5], [62, 0.5], [66, 0.5], [71, 0.5],
               [69, 0.5], [66, 0.5], [62, 0.5], [66, 0.5], [69, 2]],
      bass: [[47, 1], [47, 1], [47, 1], [47, 1], [46, 1], [46, 1], [45, 1], [45, 1]],
    },
    {
      id: 'tell', name: 'William Tell Overture', composer: 'Rossini', bpm: 152, wave: 'square',
      melody: [[64, 0.33], [64, 0.33], [64, 0.34], [64, 1], [64, 0.33], [64, 0.33], [64, 0.34], [64, 1],
               [64, 0.33], [64, 0.33], [64, 0.34], [67, 1], [64, 1], [62, 1], [60, 2],
               [64, 0.33], [64, 0.33], [64, 0.34], [67, 1], [69, 1], [71, 1], [72, 2]],
      bass: [[48, 0.5], [55, 0.5], [52, 0.5], [55, 0.5], [48, 0.5], [55, 0.5], [52, 0.5], [55, 0.5]],
    },
    {
      id: 'ode', name: 'Ode to Joy', composer: 'Beethoven', bpm: 108, wave: 'triangle',
      melody: [[64, 1], [64, 1], [65, 1], [67, 1], [67, 1], [65, 1], [64, 1], [62, 1],
               [60, 1], [60, 1], [62, 1], [64, 1], [64, 1.5], [62, 0.5], [62, 2],
               [64, 1], [64, 1], [65, 1], [67, 1], [67, 1], [65, 1], [64, 1], [62, 1],
               [60, 1], [60, 1], [62, 1], [64, 1], [62, 1.5], [60, 0.5], [60, 2]],
      bass: [[48, 2], [43, 2], [48, 2], [43, 2], [45, 2], [43, 2], [48, 1], [43, 1], [48, 2]],
    },
  ];
  // which piece plays for each game mood
  const MOOD_PIECE = { menu: 'canon', chill: 'elise', party: 'mozart', action: 'grieg', race: 'tell', results: 'ode' };

  let onTrack = null;

  function ensureCtx() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    musicGain = ctx.createGain();
    sfxGain = ctx.createGain();
    musicGain.gain.value = vol.music * 0.5;
    sfxGain.gain.value = vol.sfx;
    musicGain.connect(ctx.destination);
    sfxGain.connect(ctx.destination);
    // a touch of concert-hall echo for the music
    delaySend = ctx.createGain();
    delaySend.gain.value = 0.22;
    const delay = ctx.createDelay(0.5);
    delay.delayTime.value = 0.24;
    const fb = ctx.createGain();
    fb.gain.value = 0.25;
    delaySend.connect(delay); delay.connect(fb); fb.connect(delay);
    delay.connect(musicGain);
    return true;
  }

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function note(freq, t, dur, wave, dest, peak, slide) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.02);
    g.gain.setValueAtTime(peak * 0.8, t + Math.max(0.03, dur * 0.65));
    g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.08);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.15);
  }

  function musicNote(midi, t, dur, wave, peak) {
    if (!midi) return;
    const g = ctx.createGain();
    g.gain.value = 1;
    g.connect(musicGain);
    g.connect(delaySend);
    note(mtof(midi), t, dur, wave, g, peak);
  }

  function pump() {
    if (!piece || !ctx || paused) return;
    const spb = 60 / piece.bpm;
    const horizon = ctx.currentTime + 0.35;
    while (mTime < horizon) {
      const [m, b] = piece.melody[mPtr];
      musicNote(m, Math.max(mTime, ctx.currentTime), b * spb * 0.92, piece.wave, 0.16);
      mTime += b * spb;
      mPtr = (mPtr + 1) % piece.melody.length;
    }
    while (bTime < horizon) {
      const [m, b] = piece.bass[bPtr];
      musicNote(m, Math.max(bTime, ctx.currentTime), b * spb * 0.95, 'sine', 0.2);
      bTime += b * spb;
      bPtr = (bPtr + 1) % piece.bass.length;
    }
  }

  function startPiece(p) {
    piece = p;
    mPtr = 0; bPtr = 0;
    if (ctx) { mTime = ctx.currentTime + 0.1; bTime = ctx.currentTime + 0.1; }
    if (onTrack) onTrack(p);
  }

  const SFX = {
    move() { note(520, ctx.currentTime, 0.06, 'square', sfxGain, 0.12); },
    select() { note(440, ctx.currentTime, 0.08, 'square', sfxGain, 0.15); note(660, ctx.currentTime + 0.07, 0.1, 'square', sfxGain, 0.15); },
    count() { note(660, ctx.currentTime, 0.09, 'square', sfxGain, 0.2); },
    go() { note(660, ctx.currentTime, 0.08, 'square', sfxGain, 0.2); note(990, ctx.currentTime + 0.08, 0.22, 'square', sfxGain, 0.22); },
    pop() { note(700, ctx.currentTime, 0.07, 'sine', sfxGain, 0.16, 1.6); },
    boom() {
      const t = ctx.currentTime, len = 0.4;
      const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(120, t + len);
      const g = ctx.createGain(); g.gain.value = 0.5;
      src.connect(lp); lp.connect(g); g.connect(sfxGain);
      src.start(t);
      note(90, t, 0.3, 'sine', sfxGain, 0.35, 0.4);
    },
    goal() { [523, 659, 784, 1047].forEach((f, i) => note(f, ctx.currentTime + i * 0.09, 0.16, 'square', sfxGain, 0.18)); },
    win() { [392, 523, 659, 784, 1047, 784, 1047].forEach((f, i) => note(f, ctx.currentTime + i * 0.13, 0.22, 'triangle', sfxGain, 0.2)); },
    lose() { [400, 330, 262, 208].forEach((f, i) => note(f, ctx.currentTime + i * 0.14, 0.2, 'triangle', sfxGain, 0.16)); },
  };

  return {
    PIECES,
    // call once from a user gesture (autoplay policy)
    unlock() {
      if (!ensureCtx()) return;
      if (ctx.state === 'suspended') ctx.resume();
      if (piece) { mTime = ctx.currentTime + 0.1; bTime = ctx.currentTime + 0.1; }
      if (!timer) timer = setInterval(pump, 100);
    },
    get unlocked() { return !!ctx; },
    get current() { return piece; },
    get paused() { return paused; },
    playMusic(mood) {
      const id = MOOD_PIECE[mood] || 'canon';
      const p = PIECES.find(x => x.id === id);
      if (!p || (piece && piece.id === p.id)) return;
      startPiece(p);
    },
    next(dir) {
      if (!piece) { startPiece(PIECES[0]); return; }
      const i = PIECES.indexOf(piece);
      startPiece(PIECES[(i + (dir || 1) + PIECES.length) % PIECES.length]);
    },
    togglePause() {
      paused = !paused;
      if (!paused && ctx) { mTime = ctx.currentTime + 0.1; bTime = ctx.currentTime + 0.1; }
      if (onTrack) onTrack(piece);
      return paused;
    },
    setOnTrack(fn) { onTrack = fn; if (piece) fn(piece); },
    stopMusic() { piece = null; },
    sfx(name) {
      if (!ctx || vol.sfx <= 0 || !SFX[name]) return;
      try { SFX[name](); } catch (e) {}
    },
    setVol(kind, v) {
      vol[kind] = clamp(v, 0, 1);
      try { localStorage.setItem('cp-vol-' + kind, String(vol[kind])); } catch (e) {}
      if (kind === 'music' && musicGain) musicGain.gain.value = vol.music * 0.5;
      if (kind === 'sfx' && sfxGain) sfxGain.gain.value = vol.sfx;
    },
    getVol(kind) { return vol[kind]; },
  };
})();
