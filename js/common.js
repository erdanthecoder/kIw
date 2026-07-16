// CouchPlay — shared helpers for console + controller

// Older TV browsers (webOS/Tizen ship old Chromium) lack ctx.roundRect — polyfill it.
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    if (typeof r === 'number') r = [r, r, r, r];
    else if (Array.isArray(r)) { while (r.length < 4) r.push(r[r.length - 1] || 0); }
    else r = [0, 0, 0, 0];
    const m = Math.min(Math.abs(w) / 2, Math.abs(h) / 2);
    r = r.map(v => Math.min(v, m));
    this.moveTo(x + r[0], y);
    this.lineTo(x + w - r[1], y);
    this.arcTo(x + w, y, x + w, y + r[1], r[1]);
    this.lineTo(x + w, y + h - r[2]);
    this.arcTo(x + w, y + h, x + w - r[2], y + h, r[2]);
    this.lineTo(x + r[3], y + h);
    this.arcTo(x, y + h, x, y + h - r[3], r[3]);
    this.lineTo(x, y + r[0]);
    this.arcTo(x, y, x + r[0], y, r[0]);
    this.closePath();
    return this;
  };
}

// Performance profile: TVs and weak devices get reduced effects.
// 'auto' detects smart-TV user agents; override via settings (cp-perf).
const PERF = {
  mode: (typeof localStorage !== 'undefined' && localStorage.getItem('cp-perf')) || 'auto',
  isTV: typeof navigator !== 'undefined' && /web0s|webos|smart-tv|smarttv|tizen|netcast|viera|bravia|googletv|hbbtv/i.test(navigator.userAgent),
  get low() { return this.mode === 'low' || (this.mode === 'auto' && this.isTV); },
  set(mode) { this.mode = mode; try { localStorage.setItem('cp-perf', mode); } catch (e) {} },
};
const COLORS = ['#ff4655', '#2f9bff', '#2fd573', '#ffcf3f', '#b06cff', '#ff8c3a', '#2fe0d0', '#ff7ab8'];
const COLOR_NAMES = ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange', 'Teal', 'Pink'];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1

function makeCode(n = 4) {
  let s = '';
  for (let i = 0; i < n; i++) s += CODE_ALPHABET[Math.random() * CODE_ALPHABET.length | 0];
  return s;
}
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(a, b) { return a + Math.random() * (b - a); }
function irand(a, b) { return a + Math.random() * (b - a + 1) | 0; }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.random() * (i + 1) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
// Deterministic PRNG so host + controllers generate identical 3D worlds from a seed
function mulberry(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
