// Core toolkit: math, easing, deterministic noise, hand-drawn strokes, washes, text.
// Every function is a pure function of time — no state is carried between frames.

export const W = 1080, H = 1440, FPS = 30;

// ---------------------------------------------------------------- math
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const ilerp = (a, b, x) => clamp((x - a) / (b - a));
export const smooth = (t) => t * t * (3 - 2 * t);
export const TAU = Math.PI * 2;

// ---------------------------------------------------------------- easing
export const E = {
  lin: (t) => t,
  sine: (t) => 0.5 - 0.5 * Math.cos(Math.PI * t),
  quadOut: (t) => 1 - (1 - t) * (1 - t),
  cubicOut: (t) => 1 - (1 - t) ** 3,
  quartOut: (t) => 1 - (1 - t) ** 4,
  cubicIn: (t) => t * t * t,
  expoOut: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  expoIn: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  expoInOut: (t) =>
    t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  backOut: (t, s = 1.70158) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2,
  backIn: (t, s = 1.70158) => (s + 1) * t * t * t - s * t * t,
  backInOut: (t, s = 1.4) => {
    const c = s * 1.525;
    return t < 0.5
      ? ((2 * t) ** 2 * ((c + 1) * 2 * t - c)) / 2
      : ((2 * t - 2) ** 2 * ((c + 1) * (t * 2 - 2) + c) + 2) / 2;
  },
};

// cubic-bezier easing (CSS semantics)
export function bez(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (u) => ((ax * u + bx) * u + cx) * u;
  const sy = (u) => ((ay * u + by) * u + cy) * u;
  const dx = (u) => (3 * ax * u + 2 * bx) * u + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let u = x;
    for (let i = 0; i < 8; i++) {
      const d = dx(u);
      if (Math.abs(d) < 1e-6) break;
      u -= (sx(u) - x) / d;
    }
    u = clamp(u);
    return sy(u);
  };
}
// a few signature curves
E.snap = bez(0.7, 0, 0.1, 1); // long anticipation, violent arrival
E.whip = bez(0.8, -0.25, 0.15, 1.0); // pulls back first, then whips
E.glide = bez(0.33, 0, 0.12, 1);
E.settle = bez(0.2, 0.9, 0.3, 1);
E.ink = bez(0.45, 0.05, 0.2, 1); // a pen stroke: hesitate, commit, ease into stop

// progress in a window, eased
export const P = (t, t0, dur, ease = E.expoOut) => ease(clamp((t - t0) / dur));

// damped spring step response, starting at t0 (0 -> 1 with overshoot)
export function spring(t, t0, freq = 3.2, damp = 0.32) {
  const x = t - t0;
  if (x <= 0) return 0;
  const w = TAU * freq;
  const wd = w * Math.sqrt(1 - damp * damp);
  return 1 - Math.exp(-damp * w * x) * (Math.cos(wd * x) + ((damp * w) / wd) * Math.sin(wd * x));
}
// damped oscillation impulse (0 -> wobble -> 0)
export function wobble(t, t0, freq = 3, damp = 0.25) {
  const x = t - t0;
  if (x <= 0) return 0;
  const w = TAU * freq;
  return Math.exp(-damp * w * x) * Math.sin(w * Math.sqrt(1 - damp * damp) * x);
}

// ---------------------------------------------------------------- noise
export function hash(n) {
  n = (n | 0) ^ 0x9e3779b9;
  n = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
  n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}
export const h2 = (a, b) => hash(Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663));
export const rr = (seed, a = 0, b = 1) => a + (b - a) * hash(seed);
// smooth 1d value noise in [0,1]
export function n1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(h2(i, seed), h2(i + 1, seed), u);
}
export const ns = (x, seed = 0) => n1(x, seed) * 2 - 1; // signed
export function fbm(x, seed = 0) {
  return (ns(x, seed) * 0.6 + ns(x * 2.1, seed + 11) * 0.28 + ns(x * 4.3, seed + 23) * 0.12);
}

// ---------------------------------------------------------------- colors
export const C = {
  paper: '#f2eadb',
  graph: '#34302b',
  graphSoft: '#6d665c',
  red: '#d2402b',
  redDeep: '#a92b1d',
  green: '#4e7d62',
  ochre: '#e9b949',
  ink: '#2a2622',
};

// ---------------------------------------------------------------- global frame context
// boil = index of the current line-boil drawing (changes every 2–3 frames)
export const G = { t: 0, frame: 0, boil: 0, cam: null };

// ---------------------------------------------------------------- path geometry
export function resample(pts, step = 5) {
  const out = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const d = Math.hypot(bx - ax, by - ay);
    if (d === 0) continue;
    let s = step - carry;
    while (s <= d) {
      out.push([ax + ((bx - ax) * s) / d, ay + ((by - ay) * s) / d]);
      s += step;
    }
    carry = d - (s - step);
  }
  const last = pts[pts.length - 1];
  const pl = out[out.length - 1];
  if (pl[0] !== last[0] || pl[1] !== last[1]) out.push(last);
  return out;
}
// centripetal-ish Catmull-Rom through control points
export function spline(cp, seg = 16) {
  if (cp.length < 3) return cp.slice();
  const out = [];
  const p = [cp[0], ...cp, cp[cp.length - 1]];
  for (let i = 1; i < p.length - 2; i++) {
    const [p0, p1, p2, p3] = [p[i - 1], p[i], p[i + 1], p[i + 2]];
    for (let j = 0; j < seg; j++) {
      const t = j / seg, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(cp[cp.length - 1]);
  return out;
}
export function ellipsePts(cx, cy, rx, ry, a0 = -Math.PI / 2, sweep = TAU, n = 64) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (sweep * i) / n;
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}
// hand-drawn circle: overshoots its start and spirals in slightly
export function handCircle(cx, cy, r, seed = 1, over = 0.12) {
  const a0 = rr(seed, -2.6, -1.2);
  const out = [];
  const n = 72;
  for (let i = 0; i <= n * (1 + over); i++) {
    const u = i / n;
    const a = a0 + u * TAU;
    const rad = r * (1 + 0.035 * ns(u * 3, seed) - 0.03 * u);
    out.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad * (1 + 0.02 * ns(u * 2, seed + 4))]);
  }
  return out;
}
export function rectPts(x, y, w, h) {
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y - 2]];
}

export class Path {
  constructor(pts, step = 5) {
    this.p = resample(pts, step);
    const n = this.p.length;
    this.s = new Float32Array(n);
    for (let i = 1; i < n; i++)
      this.s[i] = this.s[i - 1] + Math.hypot(this.p[i][0] - this.p[i - 1][0], this.p[i][1] - this.p[i - 1][1]);
    this.len = this.s[n - 1] || 1;
  }
  // point + tangent angle at fraction u (0..1) of length
  at(u) {
    const target = clamp(u) * this.len;
    let lo = 0, hi = this.p.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (this.s[m] < target) lo = m; else hi = m;
    }
    const seg = this.s[hi] - this.s[lo] || 1;
    const f = (target - this.s[lo]) / seg;
    const a = this.p[lo], b = this.p[hi];
    return { x: lerp(a[0], b[0], f), y: lerp(a[1], b[1], f), ang: Math.atan2(b[1] - a[1], b[0] - a[0]) };
  }
}

// ---------------------------------------------------------------- strokes
// Draws a boiling, tapered, variable-width line along a Path between fractions a..b.
// opt: w, color, boil (px of jitter), wob (static hand wobble), seed, alpha, taper, tip,
//      wfn(u) width profile, dash
const _L = [], _R = [];
export function stroke(ctx, path, opt = {}) {
  const a = opt.a ?? 0, b = opt.b ?? 1;
  if (b <= a + 1e-4) return;
  const w0 = opt.w ?? 4, seed = opt.seed ?? 1;
  const boil = opt.boil ?? 1.2, wob = opt.wob ?? 0;
  const bi = opt.still ? 0 : G.boil;
  const L = path.len, s0 = a * L, s1 = b * L;
  const taper = opt.taper ?? Math.min(40, L * 0.2);
  const tip = b < 1 ? (opt.tip ?? 14) : taper;
  const pts = path.p, S = path.s;
  _L.length = 0; _R.length = 0;
  const n = pts.length;
  const wscale = opt.wscale ?? 1;
  let i0 = 0;
  while (i0 < n - 1 && S[i0 + 1] < s0) i0++;
  for (let i = i0; i < n; i++) {
    let s = S[i];
    let x = pts[i][0], y = pts[i][1];
    const j = Math.min(i + 1, n - 1), k = Math.max(i - 1, 0);
    let tx = pts[j][0] - pts[k][0], ty = pts[j][1] - pts[k][1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl; ty /= tl;
    // clip start / end exactly
    if (s < s0) {
      const f = (s0 - s) / ((S[i + 1] - s) || 1);
      x = lerp(x, pts[i + 1][0], f); y = lerp(y, pts[i + 1][1], f); s = s0;
    }
    let end = false;
    if (s >= s1) {
      if (i > 0) {
        const sp = S[i - 1];
        const f = (s1 - sp) / ((s - sp) || 1);
        x = lerp(pts[i - 1][0], x, f); y = lerp(pts[i - 1][1], y, f);
      }
      s = s1; end = true;
    }
    const nx = -ty, ny = tx;
    const off = (boil * ns(s * 0.035 + bi * 17.31, seed) + wob * fbm(s * 0.004, seed + 77)) * wscale;
    const px = x + nx * off, py = y + ny * off;
    let w = w0 * (0.78 + 0.44 * n1(s * 0.012 + bi * 0.7, seed + 5));
    if (opt.wfn) w *= opt.wfn(s / L);
    w *= Math.min(1, 0.25 + 0.75 * smooth(clamp((s - 0) / taper)));
    w *= Math.min(1, 0.2 + 0.8 * smooth(clamp((s1 - s) / tip)));
    if (b >= 1) w *= Math.min(1, 0.25 + 0.75 * smooth(clamp((L - s) / taper)));
    w *= 0.5;
    _L.push(px + nx * w, py + ny * w);
    _R.push(px - nx * w, py - ny * w);
    if (end) break;
  }
  if (_L.length < 4) return;
  ctx.globalAlpha = opt.alpha ?? 1;
  ctx.fillStyle = opt.color ?? C.graph;
  ctx.beginPath();
  ctx.moveTo(_L[0], _L[1]);
  for (let i = 2; i < _L.length; i += 2) ctx.lineTo(_L[i], _L[i + 1]);
  for (let i = _R.length - 2; i >= 0; i -= 2) ctx.lineTo(_R[i], _R[i + 1]);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

// Convenience: stroke built from raw points with cache
const _pcache = new Map();
export function P_(key, fn) {
  let p = _pcache.get(key);
  if (!p) { p = new Path(fn()); _pcache.set(key, p); }
  return p;
}

// sketchy graphite: two passes with different seeds, second one lighter & offset
export function sketch(ctx, path, opt = {}) {
  stroke(ctx, path, opt);
  if (opt.double !== false) {
    const o = { ...opt, seed: (opt.seed ?? 1) + 101, w: (opt.w ?? 3) * 0.55, alpha: (opt.alpha ?? 1) * 0.45, wob: (opt.wob ?? 2) * 1.6 };
    if (o.b !== undefined) o.b = clamp(o.b * 1.02);
    stroke(ctx, path, o);
  }
}

// ---------------------------------------------------------------- watercolor wash
// irregular blob that blooms open; layered transparent fills with darker rim.
export function blobPath(ctx, cx, cy, rx, ry, seed, grow = 1, rough = 0.18, n = 56) {
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const k = 1 + rough * (ns(Math.cos(a) * 1.3 + 5, seed) * 0.6 + ns(Math.sin(a) * 2.7 + 9, seed + 3) * 0.4);
    const x = cx + Math.cos(a) * rx * k * grow, y = cy + Math.sin(a) * ry * k * grow;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}
export function wash(ctx, cx, cy, rx, ry, color, p, seed = 1, alpha = 0.22) {
  if (p <= 0) return;
  const g = E.expoOut(clamp(p));
  ctx.fillStyle = color;
  for (let k = 0; k < 3; k++) {
    ctx.globalAlpha = alpha * (k === 0 ? 1 : 0.6) * clamp(p * 3);
    blobPath(ctx, cx + rr(seed + k, -0.06, 0.06) * rx, cy + rr(seed + k + 7, -0.06, 0.06) * ry, rx * (1 - k * 0.12), ry * (1 - k * 0.12), seed + k * 13, g, 0.16 + k * 0.05);
    ctx.fill();
  }
  ctx.globalAlpha = alpha * 0.9 * clamp(p * 3);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(rx, ry) * 0.03;
  blobPath(ctx, cx, cy, rx, ry, seed, g, 0.16);
  ctx.stroke();
  ctx.globalAlpha = 1;
}
// rectangular-ish wash (for bars, jar water…) with ragged edges, fills from bottom by p
export function washRect(ctx, x, y, w, h, color, p, seed = 1, alpha = 0.3, fromBottom = true) {
  if (p <= 0) return;
  const hh = h * clamp(p);
  const yy = fromBottom ? y + h - hh : y;
  ctx.fillStyle = color;
  for (let k = 0; k < 2; k++) {
    ctx.globalAlpha = alpha * (k ? 0.55 : 1);
    ctx.beginPath();
    const n = 18;
    const j = (i, s) => ns(i * 0.7 + s, seed + k * 9) * 5;
    ctx.moveTo(x + j(0, 1), yy + j(0, 2));
    for (let i = 1; i <= n; i++) ctx.lineTo(x + (w * i) / n + j(i, 3), yy + j(i, 4) + k * 4);
    for (let i = 1; i <= n; i++) ctx.lineTo(x + w + j(i, 5), yy + (hh * i) / n);
    for (let i = n; i >= 0; i--) ctx.lineTo(x + (w * i) / n + j(i, 6), yy + hh + j(i, 7));
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// zig-zag crayon scribble filling a rect, drawn in stroke order (p = 0..1)
export function scribblePts(x, y, w, h, gap = 14, seed = 1, angle = 0) {
  const pts = [];
  const rows = Math.max(2, Math.ceil(h / gap));
  for (let i = 0; i <= rows; i++) {
    const yy = y + (h * i) / rows;
    const l = x + rr(seed + i, -3, 6), r = x + w + rr(seed + i * 3, -6, 3);
    const sk = Math.tan(angle) * gap;
    if (i % 2 === 0) { pts.push([l, yy + sk]); pts.push([r, yy - sk]); }
    else { pts.push([r, yy - sk]); pts.push([l, yy + sk]); }
  }
  return pts;
}

// ---------------------------------------------------------------- text
export const FONT_HAND = '"WenKai", serif';
export const FONT_FUN = '"KuaiLe", "WenKai", sans-serif';

const _mcache = new Map();
export function measure(ctx, ch, font) {
  const k = font + '|' + ch;
  let v = _mcache.get(k);
  if (v === undefined) { ctx.font = font; v = ctx.measureText(ch).width; _mcache.set(k, v); }
  return v;
}

// Hand-written text: each glyph is "written" with a wipe + pop, then boils.
// opt: size, font, color, p (0..1 reveal), align, rot, boil, track, stagger (seconds-free, in chars)
export function handText(ctx, str, x, y, opt = {}) {
  const size = opt.size ?? 48;
  const font = `${opt.weight ?? ''} ${size}px ${opt.font ?? FONT_HAND}`;
  const chars = [...str];
  const track = opt.track ?? 0;
  const widths = chars.map((c) => measure(ctx, c, font) + track * size);
  const total = widths.reduce((a, b) => a + b, 0);
  let cx = opt.align === 'center' ? -total / 2 : opt.align === 'right' ? -total : 0;
  const p = opt.p ?? 1;
  const n = chars.length;
  const soft = opt.soft ?? 2.2; // how many chars are "in flight" at once
  ctx.save();
  ctx.translate(x, y);
  if (opt.rot) ctx.rotate(opt.rot);
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = opt.color ?? C.graph;
  const boil = opt.boil ?? 1;
  const seed = opt.seed ?? 3;
  for (let i = 0; i < n; i++) {
    const cw = widths[i];
    const local = opt.times
      ? clamp((opt.t - (opt.times[i] ?? opt.times[opt.times.length - 1])) / (opt.charDur ?? 0.22))
      : clamp((p * (n + soft) - i) / soft);
    if (local > 0) {
      const bi = G.boil;
      const jx = ns(bi * 3.1 + i * 7.7, seed) * boil * size * 0.025;
      const jy = ns(bi * 2.3 + i * 5.1, seed + 1) * boil * size * 0.025;
      const jr = ns(bi * 1.7 + i * 3.3, seed + 2) * boil * 0.025 + (opt.charRot ? ns(i * 9.1, seed + 5) * opt.charRot : 0);
      const pop = opt.pop === false ? 1 : 1 + 0.35 * (1 - E.backOut(local, 2.2));
      ctx.save();
      ctx.translate(cx + cw / 2 + jx, jy - size * 0.35);
      ctx.rotate(jr);
      ctx.scale(pop, pop);
      ctx.translate(-cw / 2, size * 0.35);
      if (local < 1) {
        ctx.beginPath();
        ctx.rect(-size * 0.1, -size * 1.2, (cw + size * 0.2) * E.cubicOut(local), size * 1.6);
        ctx.clip();
      }
      ctx.globalAlpha = (opt.alpha ?? 1) * clamp(local * 2.5);
      ctx.fillText(chars[i], 0, 0);
      ctx.restore();
    }
    cx += cw;
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  return total;
}
export function textWidth(ctx, str, size, font = FONT_HAND, weight = '', track = 0) {
  const f = `${weight} ${size}px ${font}`;
  let w = 0;
  for (const c of str) w += measure(ctx, c, f) + track * size;
  return w;
}
