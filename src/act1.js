// ACT 1 (0–55 s): the red line leaves the textbook and climbs the page.
import {
  G, C, E, clamp, lerp, ilerp, P, spring, wobble, ns, n1, rr, hash, TAU,
  Path, stroke, sketch, spline, ellipsePts, rectPts, handCircle, wash, washRect, scribblePts, blobPath,
  handText, FONT_FUN, FONT_HAND, bez,
} from './engine.js';
import { reg, redLine, penStroke, visKey } from './pen.js';
import { bill, slip, coin, lp } from './props.js';

const range = (n) => [...Array(n).keys()];
// piecewise ease: the stroke stops and goes at the given length fractions (one beat per piece)
export function beats(qs, ease = E.ink, us = null) {
  const n = qs.length - 1;
  const U = us || qs.map((_, i) => i / n);
  return (u) => {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    let i = 0;
    while (i < n - 1 && u > U[i + 1]) i++;
    const k = (u - U[i]) / (U[i + 1] - U[i]);
    return lerp(qs[i], qs[i + 1], ease(clamp(k)));
  };
}
function fracsOf(pts, idx) {
  // cumulative length fraction at each listed vertex index
  const d = [0];
  for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = d[d.length - 1];
  return idx.map((i) => d[i] / L);
}
const gs = (ctx, path, t, t0, dur, opt = {}, e = E.ink) => {
  const b = P(t, t0, dur, e);
  if (b > 0) sketch(ctx, path, { w: 3, color: C.graph, boil: 1, wob: 2, seed: Math.floor(t0 * 37), ...opt, b });
};
const gl = (ctx, path, t, t0, dur, opt = {}, e = E.ink) => {
  const b = P(t, t0, dur, e);
  if (b > 0) stroke(ctx, path, { w: 3, color: C.graph, boil: 1, wob: 2, seed: Math.floor(t0 * 37), ...opt, b });
};
export const MAIN_W = 8;
// the main line thickens as the camera pulls out so it stays legible in the overview
export const mainW = () => MAIN_W * Math.max(1, Math.pow(0.75 / G.cam.z, 0.75));
const main = (ctx, t, s, opt = {}) => penStroke(ctx, t, s, { w: mainW(), ...opt });

// =====================================================================================
// A — the textbook (0 – 5.2)
// =====================================================================================
const A = {
  rules: range(19).map((i) => new Path([[60, 4250 + i * 68], [1560, 4250 + i * 68 + rr(i, -5, 5)]], 10)),
  margin: new Path([[208, 4150], [200, 5640]], 10),
  yAxis: new Path([[300, 5380], [303, 4650]], 6),
  yArr: new Path([[276, 4694], [303, 4648], [328, 4696]], 4),
  xAxis: new Path([[300, 5380], [1240, 5374]], 6),
  xArr: new Path([[1200, 5352], [1244, 5374], [1198, 5398]], 4),
};
A.predCtl = [[360, 4740], [520, 4800], [690, 4920], [870, 5070], [1040, 5200], [1170, 5272]];
A.pred = new Path(spline(A.predCtl, 18), 5);
{
  const e = A.pred.at(1), a = e.ang;
  A.predArr = new Path([[e.x + Math.cos(a + 2.6) * 40, e.y + Math.sin(a + 2.6) * 40], [e.x, e.y], [e.x + Math.cos(a - 2.6) * 40, e.y + Math.sin(a - 2.6) * 40]], 4);
}
// red trace follows the textbook line to K, then kinks upward
const KF = 0.44;
A.tracePts = A.pred.p.filter((_, i) => A.pred.s[i] <= KF * A.pred.len).map(([x, y]) => [x, y - 9]);
A.K = A.tracePts[A.tracePts.length - 1];
const [Kx, Ky] = A.K;
A.trace = reg(1.25, 4.2, new Path(A.tracePts, 5), bez(0.35, 0.05, 0.55, 1));
// pressing: a tiny loop that leaves a blob of pigment where the pencil hesitates
A.press = reg(4.22, 4.62, new Path([[Kx, Ky], [Kx + 5, Ky + 6], [Kx - 3, Ky + 10], [Kx - 7, Ky + 3], [Kx + 1, Ky + 1]], 1.5), E.sine);
// the snap: a sharp V, then a fast rising stroke into the first bar
A.upPts = spline([[Kx, Ky], [Kx + 22, Ky - 70], [Kx + 80, Ky - 300], [880, 4300], [975, 4040], [1000, 3900]], 20);
A.up = reg(4.64, 5.22, new Path(A.upPts, 5), E.expoOut);
visKey(0.35, 0); visKey(1.2, 1);
// the pencil steps out of frame whenever it would idle over the action
for (const [a, b] of [[17.3, 19.85], [20.9, 24.8], [26.5, 31.2], [38.2, 42.45], [48.0, 54.5]]) { visKey(a, 1); visKey(a + 0.45, 0); visKey(b - 0.4, 0); visKey(b, 1); }

function drawA(c, t) {
  A.rules.forEach((p, i) => gl(c.graph, p, t, -0.5 + i * 0.045, 0.75, { w: 1.7, alpha: 0.32, boil: 0.6, wob: 1.5, seed: 10 + i }, E.expoOut));
  gl(c.graph, A.margin, t, -0.2, 0.9, { w: 1.6, alpha: 0.3, seed: 5 }, E.expoOut);
  gs(c.graph, A.yAxis, t, -0.28, 0.75, { w: 4 }, E.expoOut);
  gs(c.graph, A.yArr, t, 0.45, 0.25, { w: 3.5 });
  gs(c.graph, A.xAxis, t, -0.12, 0.8, { w: 4 }, E.expoOut);
  gs(c.graph, A.xArr, t, 0.9, 0.25, { w: 3.5 });
  if (t > 0.7) handText(c.text, '汇率', 330, 4700, { size: 38, color: C.graphSoft, t, times: [0.75, 0.85] });
  if (t > 1.0) handText(c.text, '时间', 1150, 5440, { size: 34, color: C.graphSoft, t, times: [1.05, 1.15] });
  // textbook prediction (graphite) runs ahead of the red pencil
  gs(c.graph, A.pred, t, 0.85, 3.25, { w: 5.5, seed: 77 }, bez(0.3, 0.1, 0.6, 1));
  gs(c.graph, A.predArr, t, 4.05, 0.25, { w: 5 });
  if (t > 3.2) handText(c.text, '标准答案', 1000, 5340, { size: 36, color: C.graphSoft, t, times: [3.25, 3.33, 3.41, 3.49], rot: 0.03 });
  // red pencil
  main(c.ink, t, A.trace, { seed: 3 });
  main(c.ink, t, A.press, { seed: 4, w: mainW() * 1.6, taper: 2, tip: 2 });
  main(c.ink, t, A.up, { seed: 5, tip: 30 });
}

// =====================================================================================
// B — one line draws the trade-surplus bars (5.2 – 11.9)
// =====================================================================================
const BASE = 3900, BX = 1000, BW = 74, BSTEP = 110;
const HS = [250, 190, 320, 280, 350, 300, 390];
const B = {};
{
  const pts = [[BX, BASE]];
  const idx = [0];
  HS.forEach((h, i) => {
    const x = BX + i * BSTEP;
    pts.push([x, BASE - h], [x + BW, BASE - h], [x + BW, BASE], [x + BSTEP, BASE]);
    idx.push(pts.length - 1);
  });
  const qs = fracsOf(pts, idx);
  B.outline = reg(5.22, 7.82, new Path(pts, 5), beats(qs, bez(0.5, 0, 0.3, 1)));
  B.qs = qs;
}
B.base = new Path([[930, BASE + 3], [1980, BASE - 2]], 8);
B.fills = HS.map((h, i) => new Path(scribblePts(BX + i * BSTEP + 9, BASE - h + 12, BW - 18, h - 18, 15, 50 + i, 0.25), 4));
const X8 = BX + 7 * BSTEP; // 1770
const TOP8 = BASE - 980; // 2920
const top8 = (t) => BASE - 980 * spring(t, 7.86, 1.55, 0.38);
B.shaft = reg(7.86, 8.5, new Path([[X8, BASE], [X8, TOP8]], 5), (u) => clamp(spring(7.86 + u * 0.64, 7.86, 1.55, 0.38), 0, 1));
B.fill8 = new Path(scribblePts(X8 + 9, TOP8 + 14, BW - 18, 980 - 20, 16, 99, 0.3), 4);
B.dash = range(14).map((i) => new Path([[X8 - 18 - i * 56, TOP8], [X8 - 50 - i * 56, TOP8 + rr(i, -2, 2)]], 4));
B.pole = reg(10.42, 10.78, new Path([[X8 + 2, TOP8], [X8 + 1, TOP8 - 190]], 5), E.expoOut);
const POLE = [X8 + 1, TOP8 - 190];

function flagPts(t) {
  const [px, py] = POLE;
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const u = i / 12;
    pts.push([px + u * 140, py + 4 + u * 34 + Math.sin(u * 4 - t * 7) * 9 * u]);
  }
  for (let i = 12; i >= 0; i--) {
    const u = i / 12;
    pts.push([px + u * 140, py + 72 - u * 34 + Math.sin(u * 4 - t * 7 + 0.6) * 9 * u]);
  }
  return pts;
}

function drawB(c, t) {
  gl(c.graph, B.base, t, 5.25, 0.8, { w: 3.5, seed: 31 }, E.expoOut);
  for (let i = 0; i < 8; i++) {
    const t0 = 5.5 + i * 0.09;
    if (t > t0) handText(c.text, i === 7 ? '8月' : String(i + 1), BX + i * BSTEP + BW / 2, BASE + 52, { size: 32, color: C.graphSoft, t, times: [t0, t0 + 0.06], align: 'center' });
  }
  main(c.ink, t, B.outline, { seed: 21 });
  // crayon fill chases the outline
  B.fills.forEach((p, i) => {
    const t0 = 5.22 + (i + 0.85) * (2.6 / 7);
    const b = P(t, t0, 0.5, E.cubicOut);
    if (b > 0) stroke(c.ink, p, { w: 4, color: C.red, alpha: 0.42, boil: 1.2, seed: 40 + i, b, taper: 4 });
  });
  // the record bar: spring-loaded, top lags behind the shaft (follow-through)
  if (t > 7.86) {
    const y = top8(t), yl = top8(t - 0.06);
    const v = (top8(t - 0.02) - y) / 0.02; // px/s upward
    const squeeze = clamp(Math.abs(v) / 9000, 0, 0.3);
    const xl = X8 + BW * squeeze * 0.5, xr = X8 + BW - BW * squeeze * 0.5;
    washRect(c.wash, xl + 4, Math.min(y, BASE - 1), xr - xl - 8, BASE - y, C.red, P(t, 8.1, 0.6), 7, 0.3);
    main(c.ink, t, B.shaft, { seed: 22, tip: 30 });
    const top = new Path([[xl, y], [xr, yl]], 5);
    const right = new Path([[xr, yl], [xr + 1, BASE]], 5);
    stroke(c.ink, top, { w: mainW(), color: C.red, boil: 1.3, seed: 23, b: P(t, 7.95, 0.18, E.expoOut) });
    stroke(c.ink, right, { w: mainW(), color: C.red, boil: 1.3, seed: 24, b: P(t, 8.02, 0.35, E.expoOut) });
    const fb = P(t, 8.45, 0.9, E.cubicOut);
    if (fb > 0) {
      c.ink.save();
      c.ink.translate(0, BASE);
      c.ink.scale(1, (BASE - y) / 980);
      c.ink.translate(0, -BASE);
      stroke(c.ink, B.fill8, { w: 4.5, color: C.red, alpha: 0.45, boil: 1.2, seed: 60, b: fb, taper: 4 });
      c.ink.restore();
    }
  }
  // record line + flag
  B.dash.forEach((p, i) => gl(c.graph, p, t, 10.38 + i * 0.03, 0.15, { w: 3, seed: 70 + i, alpha: 0.75 }, E.expoOut));
  main(c.ink, t, B.pole, { seed: 25 });
  if (t > 10.8) {
    const fp = new Path(flagPts(t), 5);
    const b = P(t, 10.8, 0.4, E.ink);
    const wp = P(t, 10.95, 0.6, E.expoOut);
    if (wp > 0) {
      c.wash.globalAlpha = 0.55 * wp;
      c.wash.fillStyle = C.ochre;
      c.wash.beginPath();
      const pts = flagPts(t);
      pts.forEach(([x, y], i) => (i ? c.wash.lineTo(x, y) : c.wash.moveTo(x, y)));
      c.wash.fill();
      c.wash.globalAlpha = 1;
    }
    stroke(c.ink, fp, { w: 5, color: C.red, boil: 1.2, seed: 26, b });
  }
}

// =====================================================================================
// C — export growth, chip, data centre, orders explode (11.5 – 19)
// =====================================================================================
const Cn = {};
{
  const pts = [[POLE[0], POLE[1]], [1778, 2690], [1840, 2650], [1905, 2672], [1975, 2600], [2045, 2622], [2120, 2530], [2190, 2552], [2268, 2448], [2320, 2400]];
  const idx = [0, 2, 3, 4, 5, 6, 7, 8, 9];
  Cn.grow = reg(11.55, 14.72, new Path(pts, 5), beats(fracsOf(pts, idx), bez(0.55, 0, 0.25, 1)));
}
const CH = { x: 2320, y: 2100, s: 300 };
{
  const pts = [[2320, 2400], [2318, 2100], [2620, 2102], [2622, 2400], [2306, 2402]];
  Cn.chip = reg(14.75, 15.45, new Path(pts, 5), beats(fracsOf(pts, [0, 1, 2, 3, 4]), E.ink));
}
Cn.die = new Path(rectPts(2388, 2168, 164, 164), 4);
Cn.pins = [];
for (let side = 0; side < 4; side++) for (let k = 0; k < 7; k++) {
  const f = CH.s * (0.14 + k * 0.12);
  let a, b;
  if (side === 0) { a = [CH.x + f, CH.y - 4]; b = [CH.x + f, CH.y - 40]; }
  if (side === 1) { a = [CH.x + CH.s + 4, CH.y + f]; b = [CH.x + CH.s + 40, CH.y + f]; }
  if (side === 2) { a = [CH.x + f, CH.y + CH.s + 4]; b = [CH.x + f, CH.y + CH.s + 40]; }
  if (side === 3) { a = [CH.x - 4, CH.y + f]; b = [CH.x - 40, CH.y + f]; }
  Cn.pins.push({ p: new Path([a, b], 3), t0: 15.15 + (side * 7 + k) * 0.022 });
}
const RACKS = range(3).map((j) => ({ x: 2790 + j * 126, y: 2070, w: 110, h: 400 }));
Cn.traces = range(4).map((i) => {
  const y = CH.y + CH.s * (0.26 + i * 0.12) + 0;
  const y2 = RACKS[0].y + 80 + i * 80;
  return new Path([[CH.x + CH.s + 40, y], [2690 + i * 14, y], [2730 + i * 14, y2], [RACKS[0].x, y2]], 4);
});
Cn.traceReg = Cn.traces.map((p, i) => reg(16.35 + i * 0.17, 16.35 + i * 0.17 + 0.16, p, E.ink));
Cn.racks = RACKS.map((r, j) => ({
  box: new Path(rectPts(r.x, r.y, r.w, r.h), 5),
  shelves: range(5).map((k) => new Path([[r.x + 8, r.y + 70 + k * 66], [r.x + r.w - 8, r.y + 70 + k * 66 + rr(j * 9 + k, -3, 3)]], 4)),
}));
const BURST = { t: 18.2, x: 2920, y: 2230 };
const NS = 20;
const SL = range(NS).map((i) => {
  const a = -Math.PI / 2 + rr(i * 3 + 1, -1.35, 1.35);
  const v = rr(i * 3 + 2, 1300, 2400);
  return {
    vx: Math.cos(a) * v, vy: Math.sin(a) * v, spin: rr(i * 7, -5, 5), r0: rr(i * 5, -0.6, 0.6),
    s: rr(i * 11, 1.15, 1.5), seed: 300 + i, delay: rr(i * 13, 0, 0.12),
  };
});
function slipPos(i, t) {
  const s = SL[i];
  const tau = Math.max(0, t - BURST.t - s.delay);
  const k = 3.4, g = 260;
  const e = 1 - Math.exp(-k * tau);
  const x = BURST.x + (s.vx * e) / k + ns(tau * 0.8, s.seed) * 30 * clamp(tau);
  const y = BURST.y + (s.vy * e) / k + g * (tau / k - e / (k * k)) + ns(tau * 0.7, s.seed + 1) * 26 * clamp(tau);
  const vx = s.vx * Math.exp(-k * tau), vy = s.vy * Math.exp(-k * tau) + (g / k) * e;
  return { x, y, vx, vy, r: s.r0 + s.spin * e * 0.6 + Math.sin(tau * 3 + i) * 0.25 * clamp(tau), tau };
}
// D — funnel geometry (needed by slips)
const FN = { x: 3390, top: 1880, half: 150, neck: 2100, spout: 2170 };
const STACK_BASE = 2562;
const suckT = (i) => 20.55 + i * 0.055;

function drawC(c, t) {
  main(c.ink, t, Cn.grow, { seed: 31 });
  if (t > 12.4) handText(c.text, '1–8月 出口', 2000, 2850, { size: 44, color: C.graph, t, times: [12.45, 12.52, 12.6, 12.67, 12.75, 12.85, 12.95], rot: -0.2 });
  if (t > 13.9) handText(c.text, '+14.6%', 1960, 2770, { size: 100, font: FONT_FUN, color: C.red, t, times: [13.92, 14.02, 14.14, 14.4, 14.92, 15.12], rot: -0.2, charDur: 0.18 });
  // chip
  main(c.ink, t, Cn.chip, { seed: 32 });
  Cn.pins.forEach((p, i) => gl(c.graph, p.p, t, p.t0, 0.16, { w: 3.2, seed: 400 + i }, E.expoOut));
  gs(c.graph, Cn.die, t, 15.3, 0.4, { w: 2.6, seed: 33 });
  if (t > 15.5) {
    const k = spring(t, 15.56, 2.4, 0.35);
    c.text.save();
    c.text.translate(2470, 2252);
    c.text.scale(0.7 + 0.3 * k, 0.7 + 0.3 * k);
    handText(c.text, 'AI', 0, 48, { size: 132, font: FONT_FUN, color: C.red, t, times: [15.56, 15.7], align: 'center' });
    c.text.restore();
  }
  // traces to the data centre
  Cn.traceReg.forEach((s, i) => penStroke(c.ink, t, s, { w: 4.4, seed: 500 + i }));
  Cn.racks.forEach((r, j) => {
    gs(c.graph, r.box, t, 16.62 + j * 0.12, 0.5, { w: 3.6, seed: 600 + j });
    r.shelves.forEach((p, k) => gl(c.graph, p, t, 16.95 + j * 0.1 + k * 0.04, 0.2, { w: 2.4, seed: 620 + j * 7 + k }, E.expoOut));
  });
  // LEDs blink on the boil — they get frantic when the orders explode
  if (t > 17.1) {
    const fr = t > 17.85 && t < 18.6 ? 0.6 : 0.3;
    RACKS.forEach((r, j) => {
      for (let k = 0; k < 5; k++) for (let m = 0; m < 2; m++) {
        const on = hash(G.boil * 31 + j * 97 + k * 13 + m) > fr;
        if (!on) continue;
        c.ink.fillStyle = (j + k + m) % 3 ? C.red : C.green;
        c.ink.globalAlpha = P(t, 17.1 + j * 0.1 + k * 0.05, 0.2);
        c.ink.beginPath();
        c.ink.arc(r.x + 22 + m * 22, r.y + 40 + k * 66, 6, 0, TAU);
        c.ink.fill();
      }
    });
    c.ink.globalAlpha = 1;
  }
  // orders burst: slips with smear ghosts, flip into dollars, get sucked into the funnel
  if (t > BURST.t - 0.02) {
    for (let i = 0; i < NS; i++) {
      const ts = suckT(i);
      if (t > ts + 0.6) continue;
      const p = slipPos(i, Math.min(t, ts));
      let x = p.x, y = p.y, r = p.r, s = SL[i].s, a = 1;
      if (t < BURST.t + SL[i].delay) continue;
      if (t > ts) {
        const k = E.expoIn(clamp((t - ts) / 0.6));
        const mx = FN.x + ns(i, 9) * 40, my = FN.top + 10;
        const cx = lerp(p.x, mx, 0.5) + 160 * ns(i * 2, 3), cy = Math.min(p.y, my) - 220;
        x = (1 - k) * (1 - k) * p.x + 2 * (1 - k) * k * cx + k * k * mx;
        y = (1 - k) * (1 - k) * p.y + 2 * (1 - k) * k * cy + k * k * my;
        s *= 1 - 0.65 * k;
        r += k * 3;
        a = 1 - E.expoIn(clamp((k - 0.8) / 0.2));
      }
      // flip slip -> dollar bill
      const f = clamp((t - (19.25 + i * 0.04)) / 0.42);
      const fe = E.backInOut(f);
      const sx = Math.abs(Math.cos(Math.PI * fe)) * 0.9 + 0.1;
      const speed = Math.hypot(p.vx, p.vy);
      if (t < ts && speed > 300 && t < 19) {
        // smear: stretched ghosts along the velocity
        const ang = Math.atan2(p.vy, p.vx);
        for (let g2 = 2; g2 >= 1; g2--) {
          const q = slipPos(i, t - g2 * 0.022);
          c.ink.save();
          c.ink.translate(q.x, q.y);
          c.ink.rotate(ang);
          c.ink.scale(1 + speed / 1500, 1 - Math.min(0.4, speed / 6000));
          c.ink.rotate(-ang);
          slip(c.ink, 0, 0, q.r, s, SL[i].seed, 0.18 * g2 * 0.6);
          c.ink.restore();
        }
      }
      if (fe < 0.5) slip(c.ink, x, y, r, s, SL[i].seed, a, sx);
      else bill(c.ink, x, y, r, s, 'usd', SL[i].seed, a, sx);
    }
  }
}

// =====================================================================================
// D — 结汇: dollars in, yuan out, the stack lifts the line (19 – 25.5)
// =====================================================================================
const D = {};
D.funnel = new Path([[FN.x - FN.half, FN.top], [FN.x - 26, FN.neck], [FN.x - 24, FN.spout]], 5);
D.funnel2 = new Path([[FN.x + FN.half, FN.top], [FN.x + 26, FN.neck], [FN.x + 24, FN.spout]], 5);
D.rim = new Path(ellipsePts(FN.x, FN.top, FN.half, 30, Math.PI, TAU * 1.05, 48), 4);
D.route = reg(20.2, 20.6, new Path(spline([[3122, 2070], [3150, 1980], [3200, 1915], [FN.x - FN.half + 6, FN.top + 4]], 12), 5), E.ink);
D.shelf = new Path([[3220, STACK_BASE + 2], [3570, STACK_BASE - 2]], 5);
const NOUT = 24;
const outT = (i) => (i < 14 ? 21.85 + i * 0.085 : 23.05 + (i - 14) * 0.11);
D.rise = reg(25.0, 25.55, new Path(spline([[3462, 2262], [3560, 2205], [3615, 2040], [3580, 1800], [3460, 1590], [3355, 1470]], 16), 5), E.expoOut);
function funnelSquash(t) {
  let v = 0;
  for (let i = 0; i < NS; i++) v += wobble(t, suckT(i) + 0.6, 4, 0.3) * 0.5;
  return v;
}
function drawD(c, t) {
  if (t < 19.8) return;
  const sq = funnelSquash(t);
  c.graph.save();
  c.graph.translate(FN.x, FN.neck);
  c.graph.scale(1 + sq * 0.08, 1 - sq * 0.05);
  c.graph.translate(-FN.x, -FN.neck);
  gs(c.graph, D.funnel, t, 20.25, 0.45, { w: 4, seed: 700 });
  gs(c.graph, D.funnel2, t, 20.32, 0.45, { w: 4, seed: 701 });
  gs(c.graph, D.rim, t, 20.4, 0.4, { w: 3.5, seed: 702 });
  c.graph.restore();
  main(c.ink, t, D.route, { seed: 41 });
  if (t > 20.8) handText(c.text, '$', FN.x - FN.half - 70, FN.top + 20, { size: 76, font: FONT_FUN, color: C.green, t, times: [20.85] });
  if (t > 21.8) handText(c.text, '¥', FN.x + 70, FN.spout + 10, { size: 76, font: FONT_FUN, color: C.red, t, times: [21.85] });
  gs(c.graph, D.shelf, t, 21.4, 0.4, { w: 4, seed: 703 }, E.expoOut);
  // falling yuan, stacking with squash on landing
  for (let i = 0; i < NOUT; i++) {
    const t0 = outT(i);
    if (t < t0) continue;
    const slot = STACK_BASE - 10 - i * 12;
    const fallDur = 0.32;
    const k = clamp((t - t0) / fallDur);
    const x = FN.x + ns(i * 1.7, 5) * 10;
    if (k < 1) {
      const y = lerp(FN.spout + 10, slot, E.cubicIn(k));
      const flat = lerp(1, 0.3, E.cubicIn(k));
      bill(c.ink, x, y, ns(i, 8) * 0.4 * (1 - k), 1.05, 'cny', 900 + i, 1, 1);
      void flat;
    } else {
      const land = t - (t0 + fallDur);
      const sqy = 1 - 0.35 * Math.exp(-land * 14) * Math.cos(land * 30);
      c.ink.save();
      c.ink.translate(x, slot);
      c.ink.scale(1 + (1 - sqy) * 0.6, sqy);
      c.ink.fillStyle = '#f6d9cc';
      c.ink.fillRect(-62, -7, 124, 12);
      stroke(c.ink, lp('stk', () => rectPts(-62, -7, 124, 12)), { w: 3, color: C.red, boil: 0.8, seed: 950 + i, taper: 4 });
      c.ink.restore();
    }
  }
  main(c.ink, t, D.rise, { seed: 42, tip: 26 });
}

// =====================================================================================
// E — CIPS: the line wraps a globe and fires routes across it (25 – 32.5)
// =====================================================================================
const GL = { x: 3060, y: 1300, r: 300 };
{
  const a0 = Math.atan2(1470 - GL.y, 3355 - GL.x);
  const pts = [];
  for (let i = 0; i <= 80; i++) {
    const a = a0 - (i / 72) * TAU;
    const rad = GL.r * (1 + 0.025 * ns(i * 0.1, 3) - 0.025 * (i / 80));
    pts.push([GL.x + Math.cos(a) * rad, GL.y + Math.sin(a) * rad]);
  }
  D.globe = reg(25.55, 26.35, new Path(pts, 5), E.ink);
}
const CN = [GL.x + 95, GL.y - 95];
const DESTS = [[2860, 1180], [2900, 1460], [3120, 1530], [2520, 1280], [2620, 860], [3560, 960], [3640, 1330], [2690, 1560]];
const ARCS = DESTS.map(([x, y], i) => {
  const [ax, ay] = CN;
  const dx = x - ax, dy = y - ay, d = Math.hypot(dx, dy);
  const nx = -dy / d, ny = dx / d, h = d * 0.32 * (i % 2 ? 1 : -1);
  const pts = [];
  for (let k = 0; k <= 24; k++) {
    const u = k / 24, b = 4 * u * (1 - u);
    pts.push([ax + dx * u + nx * h * b, ay + dy * u + ny * h * b]);
  }
  return { p: new Path(pts, 5), t0: 26.75 + i * 0.16, d };
});
const LANDS = [[-0.4, -0.35, 0.45, 0.3], [0.25, 0.1, 0.35, 0.42], [-0.55, 0.35, 0.25, 0.2], [0.55, -0.45, 0.22, 0.18]];
const EF2 = reg(31.38, 31.62, new Path([[GL.x + 4, GL.y - GL.r - 6], [GL.x + 2, GL.y - GL.r - 130]], 5), E.expoOut);
const POLE2 = [GL.x + 2, GL.y - GL.r - 130];

function drawE(c, t) {
  if (t < 25.4) return;
  // land masses (soft graphite-green wash, clipped to the sphere)
  const lp2 = P(t, 26.0, 0.9);
  if (lp2 > 0) {
    c.wash.save();
    c.wash.beginPath(); c.wash.arc(GL.x, GL.y, GL.r - 4, 0, TAU); c.wash.clip();
    LANDS.forEach(([u, v, rx, ry], i) => wash(c.wash, GL.x + (u + t * 0.004) * GL.r, GL.y + v * GL.r, rx * GL.r, ry * GL.r, '#9fae96', lp2, 800 + i, 0.32));
    c.wash.restore();
  }
  main(c.ink, t, D.globe, { seed: 51 });
  // meridians turn slowly
  const mp = P(t, 25.9, 0.7);
  if (mp > 0) {
    for (let k = 0; k < 4; k++) {
      const ph = t * 0.12 + (k * Math.PI) / 4;
      const rx = GL.r * Math.abs(Math.cos(ph));
      const pth = new Path(ellipsePts(GL.x, GL.y, rx, GL.r, -Math.PI / 2, Math.PI * 2, 48), 8);
      stroke(c.graph, pth, { w: 2, color: C.graphSoft, alpha: 0.6, seed: 820 + k, b: clamp(mp * 1.2 - k * 0.1), boil: 0.8 });
    }
    [-0.5, 0, 0.5].forEach((lat, k) => {
      const yy = GL.y - GL.r * Math.sin(lat), rx = GL.r * Math.cos(lat);
      gl(c.graph, lp('par' + k, () => ellipsePts(GL.x, yy, rx, rx * 0.16, 0, Math.PI, 30)), t, 26.0 + k * 0.08, 0.5, { w: 2, alpha: 0.6, color: C.graphSoft, seed: 840 + k });
    });
  }
  // CIPS origin pops
  if (t > 26.3) {
    const k = spring(t, 26.32, 2.6, 0.3);
    c.ink.fillStyle = C.red;
    c.ink.beginPath(); c.ink.arc(CN[0], CN[1], 15 * k, 0, TAU); c.ink.fill();
    const ring = clamp((t - 26.32) / 0.8);
    c.ink.globalAlpha = (1 - ring) * 0.8;
    c.ink.strokeStyle = C.red; c.ink.lineWidth = 3;
    c.ink.beginPath(); c.ink.arc(CN[0], CN[1], 15 + ring * 70, 0, TAU); c.ink.stroke();
    c.ink.globalAlpha = 1;
  }
  ARCS.forEach((a, i) => {
    const b = P(t, a.t0, 0.42 + a.d / 2400, E.ink);
    if (b <= 0) return;
    stroke(c.ink, a.p, { w: 4, color: C.red, boil: 1, wob: 1, seed: 860 + i, b });
    const [dx, dy] = DESTS[i];
    if (b > 0.98) {
      const k = spring(t, a.t0 + 0.42 + a.d / 2400, 3, 0.3);
      c.ink.strokeStyle = C.graph; c.ink.lineWidth = 3;
      c.ink.beginPath(); c.ink.arc(dx, dy, 11 * k, 0, TAU); c.ink.stroke();
    }
    // pulses of yuan travelling the routes (more traffic as volume peaks)
    const t1 = a.t0 + 0.5;
    if (t > t1) {
      const per = 1.15 - (t > 29.3 ? 0.35 : 0);
      for (let m = 0; m < 2; m++) {
        const u = (((t - t1) / per + m * 0.5 + i * 0.13) % 1);
        const pt = a.p.at(E.sine(u));
        c.ink.globalAlpha = Math.sin(Math.PI * u) * clamp((t - t1) * 3);
        c.ink.fillStyle = C.red;
        c.ink.beginPath(); c.ink.arc(pt.x, pt.y, 8, 0, TAU); c.ink.fill();
        c.wash.globalAlpha = Math.sin(Math.PI * u) * 0.35;
        c.wash.fillStyle = C.ochre;
        c.wash.beginPath(); c.wash.arc(pt.x, pt.y, 26, 0, TAU); c.wash.fill();
        c.wash.globalAlpha = 1;
      }
      c.ink.globalAlpha = 1;
    }
  });
  // 也创了历史新高: the flag rhymes with the bar chart
  main(c.ink, t, EF2, { seed: 52, w: mainW() * 0.8 });
  if (t > 31.6) {
    const [px, py] = POLE2;
    const pts = [];
    for (let i = 0; i <= 10; i++) { const u = i / 10; pts.push([px + u * 100, py + 3 + u * 26 + Math.sin(u * 4 - t * 7) * 7 * u]); }
    for (let i = 10; i >= 0; i--) { const u = i / 10; pts.push([px + u * 100, py + 56 - u * 26 + Math.sin(u * 4 - t * 7 + 0.6) * 7 * u]); }
    const wp = P(t, 31.7, 0.5);
    c.wash.globalAlpha = 0.55 * wp; c.wash.fillStyle = C.ochre; c.wash.beginPath();
    pts.forEach(([x, y], i) => (i ? c.wash.lineTo(x, y) : c.wash.moveTo(x, y))); c.wash.fill(); c.wash.globalAlpha = 1;
    stroke(c.ink, new Path(pts, 5), { w: 4.5, color: C.red, boil: 1.2, seed: 53, b: P(t, 31.62, 0.35) });
  }
}

// =====================================================================================
// F — real demand rises steadily; speculation is erased (32.8 – 37)
// =====================================================================================
const Fp = {};
{
  const pts = spline([[POLE2[0], POLE2[1]], [3110, 800], [3175, 735], [3235, 610], [3300, 430], [3360, 290], [3440, 180], [3560, 128]], 16);
  Fp.real = reg(32.9, 37.2, new Path(pts, 5), beats([0, 0.3, 0.55, 0.78, 1], bez(0.5, 0, 0.3, 1), [0, 0.3, 0.55, 0.75, 1]));
  const zz = [];
  for (let i = 0; i <= 22; i++) {
    const u = i / 22;
    zz.push([3200 + u * 330 + (i % 2 ? 18 : -14), 1010 - u * 470 + (i % 2 ? -80 : 70) * (0.5 + hash(i) * 0.9)]);
  }
  Fp.zig = new Path(zz, 4);
}
export const ERASE = { t0: 36.15, t1: 36.95 };
export function eraserAt(t) {
  // scrubs back and forth along the zigzag while moving from its start to its end
  const u = clamp((t - ERASE.t0) / (ERASE.t1 - ERASE.t0));
  const prog = E.sine(u);
  const p = Fp.zig.at(clamp(prog + Math.sin(t * 42) * 0.035));
  return { x: p.x + Math.sin(t * 42) * 18, y: p.y + Math.cos(t * 39) * 10, u, prog };
}
function drawF(c, t) {
  if (t < 32.8) return;
  main(c.ink, t, Fp.real, { seed: 61 });
  const drawn = P(t, 34.55, 1.4, E.lin);
  const erased = clamp(eraserAt(t).prog * 1.06 - 0.02);
  if (drawn > 0 && erased < 1) {
    stroke(c.graph, Fp.zig, { w: 5.5, color: C.graph, boil: 3, wob: 1, seed: 62, a: t > ERASE.t0 ? erased : 0, b: drawn, taper: 6 });
    if (t > 35.95 && erased < 0.6) handText(c.text, '投机', 3560, 520, { size: 60, color: C.graphSoft, t, times: [35.98, 36.1], alpha: 1 - clamp((t - 36.4) / 0.3) });
  }
  // eraser crumbs settle on the paper
  if (t > ERASE.t0) {
    for (let i = 0; i < 26; i++) {
      const tb = ERASE.t0 + (i / 26) * (ERASE.t1 - ERASE.t0);
      if (t < tb) continue;
      const p = eraserAt(tb);
      const life = t - tb;
      const k = 1 - Math.exp(-life * 5);
      const x = p.x + ns(i, 1) * 70 * k, y = p.y + 30 * k + ns(i, 2) * 30 * k;
      c.graph.globalAlpha = 0.5 * (1 - clamp((life - 1.2) / 0.8));
      c.graph.fillStyle = '#c99b8f';
      c.graph.beginPath(); c.graph.ellipse(x, y, 5 + hash(i) * 4, 3 + hash(i + 9) * 3, i, 0, TAU); c.graph.fill();
    }
    c.graph.globalAlpha = 1;
  }
}

// =====================================================================================
// G — central banks fill a reserve jar; the dollar pile shakes under a storm (37 – 42.6)
// =====================================================================================
const JAR = { x: 3430, y: 300, w: 260, h: 300 };
const Gp = {};
Gp.jar = new Path(spline([[JAR.x + 14, JAR.y - 10], [JAR.x + 4, JAR.y + 30], [JAR.x - 4, JAR.y + 140], [JAR.x + 6, JAR.y + JAR.h - 10], [JAR.x + JAR.w / 2, JAR.y + JAR.h + 6], [JAR.x + JAR.w - 6, JAR.y + JAR.h - 12], [JAR.x + JAR.w + 4, JAR.y + 140], [JAR.x + JAR.w - 4, JAR.y + 30], [JAR.x + JAR.w - 14, JAR.y - 10]], 10), 5);
Gp.lip = new Path(ellipsePts(JAR.x + JAR.w / 2, JAR.y - 10, JAR.w / 2 - 12, 18, Math.PI, TAU * 1.04, 40), 4);
Gp.shine = new Path([[JAR.x + 30, JAR.y + 60], [JAR.x + 24, JAR.y + 190]], 4);
const NCOIN = 9;
const coinT = (i) => 37.75 + i * 0.16;
const coinSlot = (i) => [JAR.x + 50 + (i % 4) * 54 + (Math.floor(i / 4) % 2) * 26, JAR.y + JAR.h - 34 - Math.floor(i / 4) * 40];
const STK = { x: 3800, y: 560 };
Gp.cloud = new Path(spline([[3720, 330], [3700, 290], [3740, 250], [3790, 255], [3815, 215], [3880, 210], [3915, 250], [3965, 245], [3990, 290], [3960, 330], [3720, 330]], 10), 4);
Gp.bolt = new Path([[3860, 335], [3830, 395], [3868, 400], [3836, 470]], 3);
function drawG(c, t) {
  if (t < 37) return;
  gs(c.graph, Gp.jar, t, 37.15, 0.6, { w: 4, seed: 1001 });
  gs(c.graph, Gp.lip, t, 37.6, 0.3, { w: 3, seed: 1002 });
  gl(c.graph, Gp.shine, t, 37.8, 0.3, { w: 3, alpha: 0.5, seed: 1003 });
  if (t > 37.5) handText(c.text, '央行储备', JAR.x + JAR.w / 2, JAR.y - 60, { size: 70, font: FONT_FUN, color: C.red, align: 'center', t, times: [37.5, 37.64, 38.94, 39.1], charDur: 0.2 });
  // reserve level rises (watercolor)
  const lvl = P(t, 38.0, 2.0, E.cubicOut);
  if (lvl > 0) {
    c.wash.save();
    c.wash.beginPath(); c.wash.rect(JAR.x + 2, JAR.y, JAR.w - 4, JAR.h); c.wash.clip();
    washRect(c.wash, JAR.x, JAR.y + JAR.h * (1 - 0.62 * lvl), JAR.w, JAR.h, C.red, 1, 1010, 0.22);
    c.wash.restore();
  }
  for (let i = 0; i < NCOIN; i++) {
    const t0 = coinT(i);
    if (t < t0) continue;
    const [sx, sy] = coinSlot(i);
    const k = clamp((t - t0) / 0.45);
    const y = k < 1 ? lerp(140, sy, E.cubicIn(k)) : sy - Math.abs(wobble(t, t0 + 0.45, 3, 0.35)) * 26;
    const x = lerp(3560, sx, E.quadOut(k));
    coin(c.ink, x, y, 24, (1 - k) * 4 + i, 1, 1100 + i);
  }
  // dollar pile + storm (中东局势紧张 / 美元资产风险)
  const shake = t > 40.9 ? Math.sin(t * 22) * 0.06 * clamp((t - 40.9) / 0.8) : 0;
  for (let i = 0; i < 6; i++) {
    const t0 = 38.9 + i * 0.07;
    if (t < t0) continue;
    const k = spring(t, t0, 3, 0.35);
    const slide = i === 5 ? E.backIn(clamp((t - 41.6) / 0.5)) * 160 : 0;
    const slideY = i === 5 ? E.cubicIn(clamp((t - 41.6) / 0.5)) * 90 : 0;
    c.ink.save();
    c.ink.translate(STK.x, STK.y);
    c.ink.rotate(shake * (i + 1) * 0.5);
    bill(c.ink, slide + ns(i, 3) * 8, -i * 30 * k + slideY, ns(i, 4) * 0.08 + (i === 5 ? clamp((t - 41.6) / 0.5) * 0.6 : 0), 1.2, 'usd', 1200 + i);
    c.ink.restore();
  }
  gs(c.graph, Gp.cloud, t, 39.6, 0.7, { w: 4, seed: 1210 });
  if (t > 39.9) {
    // scribbled rain under the cloud
    for (let i = 0; i < 7; i++) {
      const ph = (t * 2.2 + i * 0.37) % 1;
      const x = 3740 + i * 36, y = 345 + ph * 90;
      c.graph.globalAlpha = 0.55 * Math.sin(Math.PI * ph) * P(t, 39.9, 0.3);
      c.graph.strokeStyle = C.graphSoft; c.graph.lineWidth = 3;
      c.graph.beginPath(); c.graph.moveTo(x, y); c.graph.lineTo(x - 8, y + 26); c.graph.stroke();
    }
    c.graph.globalAlpha = 1;
  }
  for (const tb of [40.34, 41.42]) {
    const k = t - tb;
    if (k > 0 && k < 0.35) {
      c.wash.save();
      c.wash.globalAlpha = 0.45 * (1 - k / 0.35);
      c.wash.fillStyle = C.ochre;
      c.wash.translate(0, 8);
      c.wash.scale(1.08, 1.25);
      c.wash.translate(-3850 * 0.08 / 1.08 * 1.08 + 0, -280 * 0.25);
      c.wash.beginPath();
      Gp.cloud.p.forEach(([x, y], i) => (i ? c.wash.lineTo(x, y) : c.wash.moveTo(x, y)));
      c.wash.fill();
      c.wash.restore();
      stroke(c.ink, Gp.bolt, { w: 12, color: C.ochre, boil: 2, seed: 1220 + Math.floor(tb), b: clamp(k / 0.06) });
      stroke(c.graph, Gp.bolt, { w: 4, color: C.graph, boil: 2, seed: 1221, b: clamp(k / 0.06) });
    }
  }
  if (t > 39.6) handText(c.text, '中东局势', 3700, 190, { size: 38, color: C.graphSoft, t, times: [39.6, 39.84, 40.04, 40.22], rot: -0.05 });
  if (t > 40.9) handText(c.text, '美元资产风险↑', 3700, 680, { size: 40, color: C.green, t, times: [40.9, 41.0, 41.04, 41.3, 41.42, 41.6, 41.98], rot: 0.03 });
}

// =====================================================================================
// H — Indonesia / Bali: the line draws a phone and scribbles a QR code (42.6 – 50.8)
// =====================================================================================
const PH = { x: 3190, y: -640, w: 290, h: 560 };
const Hh = {};
{
  const r = 40, { x, y, w, h } = PH;
  // build properly: clockwise from bottom-right going up
  const P2 = [[x + w, y + h - r], [x + w, y + r]];
  for (let i = 0; i <= 8; i++) { const a = 0 - (i / 8) * (Math.PI / 2); P2.push([x + w - r + Math.cos(a) * r, y + r + Math.sin(a) * r]); }
  P2.push([x + r, y]);
  for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 - (i / 8) * (Math.PI / 2); P2.push([x + r + Math.cos(a) * r, y + r + Math.sin(a) * r]); }
  P2.push([x, y + h - r]);
  for (let i = 0; i <= 8; i++) { const a = Math.PI - (i / 8) * (Math.PI / 2); P2.push([x + r + Math.cos(a) * r, y + h - r + Math.sin(a) * r]); }
  P2.push([x + w - r, y + h]);
  for (let i = 0; i <= 8; i++) { const a = Math.PI / 2 - (i / 8) * (Math.PI / 2); P2.push([x + w - r + Math.cos(a) * r, y + h - r + Math.sin(a) * r]); }
  P2.push([x + w + 2, y + h - r - 30]);
  Hh.toPhone = reg(42.62, 42.95, new Path(spline([[3560, 128], [3590, 40], [3560, -40], [x + w + 2, y + h - r + 10]], 12), 5), E.ink);
  Hh.phone = reg(42.98, 43.7, new Path(P2, 5), E.ink);
}
Hh.screen = new Path(rectPts(PH.x + 26, PH.y + 70, PH.w - 52, PH.h - 150), 5);
Hh.btn = new Path(ellipsePts(PH.x + PH.w / 2, PH.y + PH.h - 40, 20, 20, -2, TAU * 1.05, 24), 3);
const QN = 9, QS = 24;
const QX = PH.x + (PH.w - QN * QS) / 2, QY = PH.y + 120;
const QR = [];
{
  const finder = (r, cc) => {
    const inF = (fr, fc) => r >= fr && r < fr + 3 && cc >= fc && cc < fc + 3;
    return inF(0, 0) || inF(0, 6) || inF(6, 0);
  };
  for (let r = 0; r < QN; r++) for (let cc = 0; cc < QN; cc++) {
    const f = finder(r, cc);
    const on = f ? !((r % 6 === 1) && (cc % 6 === 1)) : hash(r * 31 + cc * 7 + 5) > 0.48;
    if (on) QR.push({ r, c: cc });
  }
  const zz = [[PH.x + PH.w - 30, PH.y + 100]];
  for (let r = 0; r < QN; r++) {
    const y = QY + (r + 0.5) * QS;
    if (r % 2 === 0) { zz.push([QX - 6, y]); zz.push([QX + QN * QS + 6, y + QS * 0.5]); }
    else { zz.push([QX + QN * QS + 6, y]); zz.push([QX - 6, y + QS * 0.5]); }
  }
  Hh.zigPts = zz;
  Hh.zig = reg(43.75, 45.9, new Path(zz, 4), bez(0.3, 0, 0.7, 1));
  // fraction of zigzag at which each module gets "inked"
  QR.forEach((m) => { m.q = clamp((m.r + (m.r % 2 === 0 ? m.c / QN : 1 - m.c / QN)) / QN + 0.02); });
}
Hh.check = reg(47.58, 47.85, new Path([[QX + 40, QY + 110], [QX + 92, QY + 170], [QX + 200, QY + 40]], 4), E.expoOut);
Hh.palm = [
  new Path(spline([[2930, 210], [2945, 120], [2935, 30], [2960, -60]], 12), 5),
  ...[[-150, 20], [-110, -40], [-20, -60], [70, -40], [120, 20]].map(([dx, dy], i) => new Path(spline([[2960, -60], [2960 + dx * 0.45, -60 + dy - 30], [2960 + dx, -60 + dy + 30]], 10), 4)),
];
Hh.sun = new Path(handCircle(2810, -230, 46, 4), 4);
Hh.waves = range(3).map((i) => new Path(range(9).map((k) => [2780 + k * 40, 240 + i * 26 + (k % 2 ? -9 : 9)]), 4));
const ITEMS = [
  { x: 2930, y: -860, t0: 48.95, kind: 'cup' },
  { x: 3640, y: -720, t0: 49.25, kind: 'bag' },
  { x: 3700, y: -260, t0: 49.55, kind: 'bowl' },
];
const ITEM_P = {
  cup: [new Path([[-40, -50], [-32, 50], [32, 50], [40, -50], [-40, -50]], 4), new Path(spline([[40, -30], [72, -22], [70, 14], [36, 22]], 8), 4), new Path(spline([[-10, -70], [0, -95], [-8, -120]], 8), 3), new Path(spline([[14, -70], [24, -95], [16, -120]], 8), 3)],
  bag: [new Path([[-50, -40], [50, -40], [60, 60], [-60, 60], [-50, -40]], 4), new Path(spline([[-24, -40], [-22, -84], [22, -84], [24, -40]], 8), 4)],
  bowl: [new Path(spline([[-70, -10], [-50, 40], [0, 56], [50, 40], [70, -10]], 10), 4), new Path([[-76, -10], [76, -10]], 4), new Path([[30, -14], [70, -80]], 3), new Path([[40, -14], [86, -72]], 3)],
};
function drawH(c, t) {
  if (t < 42.5) return;
  main(c.ink, t, Hh.toPhone, { seed: 71 });
  main(c.ink, t, Hh.phone, { seed: 72 });
  gl(c.graph, Hh.screen, t, 43.4, 0.5, { w: 2.4, alpha: 0.6, seed: 73 });
  gl(c.graph, Hh.btn, t, 43.6, 0.3, { w: 2.4, seed: 74 });
  if (t > 42.7) handText(c.text, '印尼', PH.x - 40, PH.y - 30, { size: 56, font: FONT_FUN, color: C.graph, align: 'right', t, times: [42.74, 42.9] });
  // QR: the zigzag scribble leaves inked modules behind it
  const zb = P(t, Hh.zig.t0, Hh.zig.t1 - Hh.zig.t0, Hh.zig.ease);
  if (zb > 0) {
    stroke(c.ink, Hh.zig.path, { w: 2.6, color: C.red, alpha: 0.55 * (1 - clamp((t - 46.0) / 0.6)) + 0.12, boil: 0.8, seed: 75, b: zb });
    for (const m of QR) {
      if (zb < m.q) continue;
      const k = spring(t, Hh.zig.t0 + (Hh.zig.t1 - Hh.zig.t0) * m.q * 0.95, 4, 0.4);
      const x = QX + m.c * QS + QS / 2, y = QY + m.r * QS + QS / 2;
      const s = (QS - 3) * Math.min(1.15, k) / 2;
      c.ink.fillStyle = C.redDeep;
      c.ink.save();
      c.ink.translate(x + ns(G.boil + m.r * 9 + m.c, 2) * 0.8, y);
      c.ink.rotate(ns(m.r * 3 + m.c, 4) * 0.08);
      c.ink.fillRect(-s, -s, s * 2, s * 2);
      c.ink.restore();
    }
  }
  // 支付宝 ⇄ 微信支付: two tags wired into the phone
  [['支付宝', 44.74], ['微信支付', 45.26]].forEach(([s, t0], i) => {
    if (t < t0) return;
    const yy = PH.y + 210 + i * 96;
    handText(c.text, s, PH.x - 56, yy, { size: 42, color: C.graph, align: 'right', t, times: [...s].map((_, k) => t0 + k * 0.07) });
    gl(c.graph, lp('wire' + i, () => [[PH.x - 48, yy - 14], [PH.x - 6, yy - 14]]), t, t0 + 0.1, 0.25, { w: 3, seed: 1300 + i });
  });
  // Bali
  Hh.palm.forEach((p, i) => {
    const sway = i ? Math.sin(t * 1.6 + i) * 0.03 : 0;
    c.graph.save();
    c.graph.translate(2960, -60); c.graph.rotate(sway); c.graph.translate(-2960, 60);
    gs(c.graph, p, t, 46.2 + i * 0.07, 0.35, { w: i ? 3.5 : 4.5, seed: 1400 + i });
    c.graph.restore();
  });
  const sp = P(t, 46.35, 0.6);
  if (sp > 0) wash(c.wash, 2810, -230, 52, 52, C.ochre, sp, 1450, 0.55);
  gl(c.graph, Hh.sun, t, 46.35, 0.4, { w: 3, seed: 1451 });
  Hh.waves.forEach((p, i) => gl(c.graph, p, t, 46.5 + i * 0.08, 0.4, { w: 3, alpha: 0.7, seed: 1460 + i }));
  if (t > 46.25) handText(c.text, '巴厘岛', 2790, 340, { size: 54, font: FONT_FUN, color: C.graph, t, times: [46.28, 46.4, 46.46] });
  // scan: an ochre band sweeps the code, then a tick
  const sc = clamp((t - 46.95) / 0.55);
  if (sc > 0 && sc < 1) {
    const y = QY + E.sine(sc) * QN * QS;
    c.wash.globalAlpha = 0.6 * Math.sin(Math.PI * sc);
    c.wash.fillStyle = C.ochre;
    c.wash.fillRect(QX - 18, y - 16, QN * QS + 36, 32);
    c.wash.globalAlpha = 1;
  }
  main(c.ink, t, Hh.check, { seed: 76, w: 14 });
  if (t > 47.7) {
    const k = spring(t, 47.7, 2.2, 0.32);
    coin(c.ink, PH.x + PH.w / 2 + 90, PH.y - 20 - 90 * k, 34, Math.sin(t * 3) * 0.2, 1, 1500);
  }
  // everyday life pops up around the phone
  ITEMS.forEach((it, i) => {
    if (t < it.t0) return;
    const k = spring(t, it.t0, 2.6, 0.33);
    c.graph.save();
    c.graph.translate(it.x, it.y);
    c.graph.scale(1.6 * (0.6 + 0.4 * k), 1.6 * (0.6 + 0.4 * k));
    c.graph.rotate(ns(t * 0.5, i) * 0.05);
    ITEM_P[it.kind].forEach((p, j) => gs(c.graph, p, t, it.t0 + j * 0.06, 0.3, { w: 3.6, seed: 1600 + i * 10 + j }));
    c.graph.restore();
    if (t > it.t0 + 0.25) coin(c.ink, it.x + 110, it.y - 80, 30, 0, P(t, it.t0 + 0.25, 0.4), 1650 + i);
  });
}

// =====================================================================================
// overview (50.9 – 55): highlight the whole climb; cross out the textbook answer
// =====================================================================================
const ALL_MAIN = [A.trace, A.up, B.outline, B.shaft, B.pole, Cn.grow, Cn.chip, D.route, D.rise, D.globe, EF2, Fp.real, Hh.toPhone, Hh.phone];
const HL = new Path(spline([[Kx, Ky], [1000, 3900], [1500, 3400], [1772, 2735], [2320, 2400], [3122, 2070], [3462, 2262], [3355, 1470], [GL.x, GL.y - GL.r], [3300, 430], [3560, 128], [PH.x + PH.w, PH.y + 300]], 14), 10);
const X1 = new Path(spline([[260, 4640], [700, 4980], [1260, 5420]], 10), 6);
const X2 = new Path(spline([[1240, 4660], [760, 5020], [250, 5400]], 10), 6);
function drawOverview(c, t) {
  if (t < 51.3) return;
  const b = P(t, 51.55, 1.5, E.expoInOut);
  stroke(c.wash, HL, { w: 150, color: C.ochre, alpha: 0.42 * (1 - clamp((t - 56) / 2)), boil: 6, seed: 1700, b, taper: 60 });
  const x1 = P(t, 53.36, 0.22, E.expoOut), x2 = P(t, 53.6, 0.22, E.expoOut);
  if (x1 > 0) stroke(c.ink, X1, { w: 46, color: C.red, boil: 4, seed: 1710, b: x1, taper: 80 });
  if (x2 > 0) stroke(c.ink, X2, { w: 46, color: C.red, boil: 4, seed: 1711, b: x2, taper: 80 });
}

export function drawAct1(c, t, view) {
  const vis = (x0, y0, x1, y1) => !(x1 < view.x0 || x0 > view.x1 || y1 < view.y0 || y0 > view.y1);
  if (vis(0, 4100, 1600, 5700)) drawA(c, t);
  if (vis(850, 2600, 2100, 4000)) drawB(c, t);
  if (vis(1500, 1000, 3700, 2700) || (t > 18 && t < 21.5)) drawC(c, t);
  if (vis(3050, 1700, 3700, 2700)) drawD(c, t);
  if (vis(2400, 700, 3800, 1900)) drawE(c, t);
  if (vis(3000, 0, 3700, 1100)) drawF(c, t);
  if (vis(3300, 0, 4100, 800)) drawG(c, t);
  if (vis(2600, -1000, 3900, 450)) drawH(c, t);
  drawOverview(c, t);
}
export const ACT1 = { A, B, Cn, D, GL, Fp, JAR, PH, HL, ALL_MAIN, PHONE_TOP: [PH.x + PH.w / 2, PH.y] };
