// The red pencil: every stroke it draws is registered here so the pencil sprite
// can follow the drawing point, travel (lifted) between strokes and hover when idle.
import { E, clamp, lerp, ns, Path, stroke, C } from './engine.js';

const strokes = [];
const visKeys = []; // [t, v]

export function reg(t0, t1, path, ease = E.ink, xf = null) {
  const s = { t0, t1, path, ease, xf };
  strokes.push(s);
  strokes.sort((a, b) => a.t0 - b.t0);
  return s;
}
export function visKey(t, v) {
  visKeys.push([t, v]);
  visKeys.sort((a, b) => a[0] - b[0]);
}
function visAt(t) {
  if (!visKeys.length) return 1;
  if (t <= visKeys[0][0]) return visKeys[0][1];
  for (let i = 1; i < visKeys.length; i++) {
    const [ta, va] = visKeys[i - 1], [tb, vb] = visKeys[i];
    if (t <= tb) return lerp(va, vb, E.expoInOut((t - ta) / (tb - ta)));
  }
  return visKeys[visKeys.length - 1][1];
}
function ptOf(s, u, t) {
  const p = s.path.at(u);
  if (s.xf) {
    const m = s.xf(t);
    const c = Math.cos(m.r || 0) * (m.s || 1), sn = Math.sin(m.r || 0) * (m.s || 1);
    return { x: m.x + c * p.x - sn * p.y, y: m.y + sn * p.x + c * p.y };
  }
  return p;
}
export function penAt(t) {
  const vis = visAt(t);
  let prev = null, next = null;
  for (const s of strokes) {
    if (t >= s.t0 && t <= s.t1) {
      const u = s.ease(clamp((t - s.t0) / (s.t1 - s.t0)));
      const p = ptOf(s, u, t);
      return { x: p.x, y: p.y, lift: 0, vis };
    }
    if (s.t1 < t && (!prev || s.t1 > prev.t1)) prev = s;
    if (s.t0 > t && !next) next = s;
  }
  if (!prev && next) {
    const p = ptOf(next, 0, next.t0);
    return { x: p.x + 40, y: p.y - 60, lift: 1, vis };
  }
  if (!prev) return { x: 0, y: 0, lift: 1, vis: 0 };
  const a = ptOf(prev, 1, prev.t1);
  if (!next) {
    const k = E.expoOut(clamp((t - prev.t1) / 0.4));
    return { x: a.x + 30 * k + ns(t * 0.7, 3) * 8, y: a.y - 50 * k + ns(t * 0.6, 4) * 8, lift: 0.7 * k, vis };
  }
  const b = ptOf(next, 0, next.t0);
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const gap = next.t0 - prev.t1;
  const travel = Math.min(gap, 0.22 + dist / 2600);
  const tStart = next.t0 - travel;
  // hover after finishing, then travel lifted to the next start
  const hk = E.expoOut(clamp((t - prev.t1) / 0.3));
  const far = gap > 0.6 ? 1 : 0.35;
  const hoverLift = (gap > 0.6 ? 0.8 : 0.3) * hk;
  const ox = 90 * far * hk, oy = -120 * far * hk;
  if (t < tStart) {
    return { x: a.x + ox + ns(t * 0.8, 7) * 8 * hk, y: a.y + oy + ns(t * 0.7, 8) * 8 * hk, lift: hoverLift, vis };
  }
  const u = (t - tStart) / travel;
  const e = E.expoInOut(u);
  const hx = a.x + ox, hy = a.y + oy;
  const arc = Math.sin(Math.PI * u) * clamp(dist / 500, 0.2, 1);
  return { x: lerp(hx, b.x, e), y: lerp(hy, b.y, e), lift: lerp(hoverLift, 0, E.cubicOut(u)) + arc * 0.6, vis };
}

// speed-sensitive width profile for a stroke drawn with an ease over dur seconds
const _wcache = new WeakMap();
function widthProfile(path, ease, dur) {
  let m = _wcache.get(path);
  if (!m) { m = new Map(); _wcache.set(path, m); }
  let me = m.get(ease);
  if (!me) { me = new Map(); m.set(ease, me); }
  const key = dur.toFixed(3);
  let tab = me.get(key);
  if (!tab) {
    const N = 48;
    tab = new Float32Array(N + 1);
    // for each q, invert ease by sampling
    const us = [], qs = [];
    for (let i = 0; i <= 200; i++) { const u = i / 200; us.push(u); qs.push(ease(u)); }
    for (let k = 0; k <= N; k++) {
      const q = k / N;
      let j = 1;
      while (j < 200 && qs[j] < q) j++;
      const dq = Math.max(1e-4, qs[j] - qs[j - 1]);
      const speed = (dq * 200) * path.len / dur; // px/s
      tab[k] = clamp(1.3 - speed / 2400, 0.42, 1.25);
    }
    me.set(key, tab);
  }
  return (q) => {
    const f = clamp(q) * (tab.length - 1), i = Math.floor(f);
    return lerp(tab[i], tab[Math.min(i + 1, tab.length - 1)], f - i);
  };
}

// draw a registered-style red pencil stroke at time t
export function penStroke(ctx, t, s, opt = {}) {
  if (t <= s.t0) return;
  const b = s.ease(clamp((t - s.t0) / (s.t1 - s.t0)));
  stroke(ctx, s.path, {
    w: 8, color: C.red, boil: 1.4, wob: 1.5, seed: opt.seed ?? Math.floor(s.t0 * 100),
    ...opt, b, wfn: widthProfile(s.path, s.ease, s.t1 - s.t0),
  });
}
export function redLine(t0, t1, pts, ease = E.ink, xf = null) {
  return reg(t0, t1, new Path(pts, 5), ease, xf);
}
