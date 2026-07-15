// CouchPlay — shared helpers for console + controller
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
