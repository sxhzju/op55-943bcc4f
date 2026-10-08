// ACT 2 (54.5 – 89.4): the line's tip becomes a coin. The textbook weight drags it down;
// four balloons — the real-world forces — lift it, merge, cut the weight loose and launch it.
import {
  G, C, E, clamp, lerp, P, spring, wobble, ns, rr, hash, TAU, bez,
  Path, stroke, sketch, spline, ellipsePts, wash, blobPath, handText, FONT_FUN, FONT_HAND,
} from './engine.js';
import { reg, penStroke, visKey } from './pen.js';
import { coin, lp } from './props.js';
import { ACT1, mainW } from './act1.js';

const HOME = { x: 3335, y: -1560 };
const R = 78;
const LIFTS = [66.3, 72.5, 77.4, 83.3];
const STEP = 115;
const LAUNCH = 85.95;
const ROCKET = new Path(spline([[HOME.x, HOME.y - 4 * STEP], [3350, HOME.y - 4 * STEP - 260], [3395, HOME.y - 4 * STEP - 560], [3480, HOME.y - 4 * STEP - 860], [3590, HOME.y - 4 * STEP - 1080]], 16), 6);
const ROCKET_DUR = 1.25;

// ---------------------------------------------------------------- coin motion
function coinBase(t) {
  let y = HOME.y;
  y += 70 * spring(t, 57.86, 1.6, 0.42) + 60 * spring(t, 59.92, 1.6, 0.42);
  // "但这次": the dip is undone as the first balloon fills
  y -= 130 * spring(t, 62.3, 0.9, 0.5);
  for (const tl of LIFTS) y -= STEP * spring(t, tl, 1.3, 0.36);
  return { x: HOME.x, y };
}
function rocketU(t) {
  return E.expoOut(clamp((t - LAUNCH) / ROCKET_DUR));
}
export function coinAt(t) {
  if (t < LAUNCH - 0.4) return coinBase(t);
  const b = coinBase(Math.min(t, LAUNCH));
  // anticipation: squat down before launch
  const squat = Math.sin(Math.PI * clamp((t - (LAUNCH - 0.4)) / 0.42)) * 38 * (t < LAUNCH ? 1 : 0);
  if (t < LAUNCH) return { x: b.x, y: b.y + squat };
  const u = rocketU(t);
  const p = ROCKET.at(u);
  const settle = wobble(t, LAUNCH + ROCKET_DUR * 0.7, 1.4, 0.35) * 26;
  return { x: p.x, y: p.y + settle };
}
function coinScale(t) {
  // stretch along the launch, squash on the squat, bump when a pulse arrives
  let sx = 1, sy = 1;
  for (const b of BAL) for (const tp of b.pulses) { const w = wobble(t, tp + 0.55, 3, 0.3) * 0.1; sx += w; sy += w; }
  if (t > LAUNCH - 0.4 && t < LAUNCH) { const k = Math.sin(Math.PI * clamp((t - (LAUNCH - 0.4)) / 0.42)); sx += 0.18 * k; sy -= 0.16 * k; }
  if (t >= LAUNCH) {
    const v = (rocketU(t) - rocketU(t - 0.02)) / 0.02;
    const k = clamp(v * 0.25, 0, 0.5);
    sx -= k * 0.35; sy += k * 0.5;
  }
  return [sx, sy];
}

// ---------------------------------------------------------------- the textbook weight
const WOFF = 470;
function weightAt(t) {
  const c = coinAt(Math.min(t, LAUNCH));
  let y = c.y + WOFF + 14 * spring(t, 57.86, 1.6, 0.4);
  let x = c.x + Math.sin(t * 1.3) * 6;
  let r = Math.sin(t * 1.1) * 0.03;
  if (t > LAUNCH - 0.05) {
    const tau = t - (LAUNCH - 0.05);
    y += 0.5 * 5200 * tau * tau;
    r += tau * 1.4;
    x -= tau * 120;
  }
  return { x, y, r };
}
const KB = new Path(spline([[-38, -100], [-60, -150], [0, -176], [60, -150], [38, -100]], 10), 4);
const KBODY = new Path(spline([[-40, -104], [-118, -50], [-122, 50], [-70, 104], [70, 104], [122, 50], [118, -50], [40, -104], [-40, -104]], 10), 5);
const CRACKS = [new Path([[60, -95], [40, -50], [62, -20], [35, 30]], 3), new Path([[-90, 40], [-55, 20], [-62, -10]], 3)];
const KH = Array.from({ length: 9 }, (_, i) => new Path([[-110 + i * 26, 92], [-60 + i * 26, -92]], 4));

function drawWeight(c, t) {
  if (t < 56.2) return;
  const w = weightAt(t);
  const cc = coinAt(Math.min(t, LAUNCH));
  const grow = 1 + 0.18 * spring(t, 57.86, 1.8, 0.35);
  // string coin -> handle (cut at LAUNCH-0.1)
  const sp = P(t, 56.25, 0.4);
  if (sp > 0) {
    const cut = t > LAUNCH - 0.1;
    const top = [cc.x, cc.y + R];
    const bot = [w.x, w.y - 176 * grow];
    if (!cut) {
      const pth = new Path([top, [lerp(top[0], bot[0], 0.5) + Math.sin(t * 1.7) * 6, lerp(top[1], bot[1], 0.5)], bot], 4);
      stroke(c.graph, pth, { w: 3.2, color: C.graph, boil: 1, seed: 2001, b: sp });
    } else {
      // recoil: the upper end snaps up, the lower end follows the falling weight
      const k = E.expoOut(clamp((t - (LAUNCH - 0.1)) / 0.35));
      const mid = [lerp(top[0], bot[0], 0.5), lerp(top[1], bot[1], 0.5)];
      const up = new Path([top, [lerp(mid[0], top[0], k) + 30 * k, lerp(mid[1], top[1], k)]], 4);
      stroke(c.graph, up, { w: 3.2, color: C.graph, boil: 1.4, seed: 2002, alpha: 1 - k });
      const dn = new Path([bot, [bot[0] - 20, bot[1] - 120 * (1 - k)]], 4);
      stroke(c.graph, dn, { w: 3.2, color: C.graph, boil: 1.4, seed: 2003 });
    }
  }
  c.graph.save();
  c.graph.translate(w.x, w.y);
  c.graph.rotate(w.r);
  c.graph.scale(grow, grow);
  const hb = P(t, 56.5, 0.6);
  if (hb > 0) {
    c.wash.save();
    c.wash.translate(w.x, w.y); c.wash.rotate(w.r); c.wash.scale(grow, grow);
    c.wash.globalAlpha = 0.8 * hb;
    c.wash.fillStyle = '#6f6a62';
    blobPath(c.wash, 0, 0, 118, 100, 2010, E.expoOut(hb), 0.06);
    c.wash.fill();
    c.wash.restore();
    c.wash.globalAlpha = 1;
  }
  sketch(c.graph, KBODY, { w: 4.5, color: C.graph, boil: 1.2, wob: 2, seed: 2011, b: P(t, 56.3, 0.55) });
  sketch(c.graph, KB, { w: 6, color: C.graph, boil: 1.2, wob: 1, seed: 2012, b: P(t, 56.7, 0.35) });
  KH.forEach((p, i) => {
    const b = P(t, 56.85 + i * 0.03, 0.15);
    if (b > 0) stroke(c.graph, p, { w: 2.2, color: C.graph, alpha: 0.35, boil: 1, seed: 2020 + i, b });
  });
  CRACKS.forEach((p, i) => { const b = P(t, 82.26 + i * 0.09, 0.2, E.expoOut); if (b > 0) stroke(c.graph, p, { w: 3.5, color: '#f4ede0', boil: 1, seed: 2030 + i, b }); });
  c.graph.restore();
  if (t > 57.0) {
    c.text.save();
    c.text.translate(w.x, w.y);
    c.text.rotate(w.r);
    c.text.scale(grow, grow);
    handText(c.text, '美联储', 0, -8, { size: 50, font: FONT_HAND, color: '#f4ede0', align: 'center', t, times: [57.08, 57.26, 57.48] });
    handText(c.text, '加息', 0, 58, { size: 62, font: FONT_FUN, color: '#f4ede0', align: 'center', t, times: [57.6, 57.86] });
    c.text.restore();
  }
}

// ---------------------------------------------------------------- traditional logic (graphite notes)
const NOTE = { x: 3560, y: -1290 };
const STRIKE = reg(60.78, 61.05, new Path(spline([[NOTE.x + 40, NOTE.y + 122], [NOTE.x + 220, NOTE.y + 112], [NOTE.x + 420, NOTE.y + 124]], 8), 5), E.expoOut);
function drawNotes(c, t) {
  if (t < 55.6) return;
  const fade = 1 - clamp((t - 84.6) / 0.8);
  if (fade <= 0) return;
  const a = { color: C.graph, t, alpha: fade };
  handText(c.text, '传统逻辑：', NOTE.x, NOTE.y - 70, { ...a, size: 46, color: C.graphSoft, times: [55.74, 55.9, 56.06, 56.24, 56.42] });
  if (t > 58.1) handText(c.text, '→ 美元走强', NOTE.x, NOTE.y + 6, { ...a, size: 58, times: [58.1, 58.18, 58.22, 58.32, 58.5, 58.82] });
  if (t > 59.3) handText(c.text, '→ 其他货币贬值', NOTE.x, NOTE.y + 140, { ...a, size: 58, times: [59.3, 59.36, 59.38, 59.52, 59.66, 59.8, 59.92, 60.12] });
  penStroke(c.ink, t, STRIKE, { w: 10, seed: 2101, alpha: fade });
}

// ---------------------------------------------------------------- balloons
const BAL = [
  { off: [-330, -560], m: [-165, -560], col: C.red, l: ['顺差', '结汇'], lt: [62.2, 63.8], t0: 61.25, pulses: [62.6, 63.85, 64.3, 65.25, 65.7] },
  { off: [290, -690], m: [165, -590], col: C.ochre, l: ['AI', '出口'], lt: [68.15, 68.3], t0: 67.5, pulses: [69.4, 70.4, 71.0, 71.6, 72.0] },
  { off: [-40, -960], m: [0, -770], col: C.red, l: ['CIPS', '互换'], lt: [74.25, 74.9], t0: 73.6, pulses: [75.3, 75.75, 76.6, 77.0] },
  { off: [420, -380], m: [10, -410], col: C.ochre, l: ['央行', '增持'], lt: [79.7, 80.24], t0: 79.0, pulses: [80.6, 81.1, 82.7, 83.0] },
];
const BRX = 140, BRY = 166;
const BOUT = new Path(ellipsePts(0, 0, BRX, BRY, Math.PI * 0.55, TAU * 1.03, 64), 5);
const KNOT = new Path([[-10, BRY + 16], [0, BRY - 2], [10, BRY + 16], [-10, BRY + 16]], 2);
const MERGE0 = 84.42, MERGE1 = 85.6;
function balloonAt(i, t) {
  const b = BAL[i];
  const lag = 0.05 + i * 0.03;
  const cc = coinAt(t - lag * (t > LAUNCH ? 1 : 0));
  const inf = spring(t, b.t0 + 0.6, 1.1, 0.45); // floats up from the coin to its place
  const mk = E.expoInOut(clamp((t - MERGE0) / (MERGE1 - MERGE0)));
  const ox = lerp(b.off[0], b.m[0], mk), oy = lerp(b.off[1], b.m[1], mk);
  const sway = Math.sin(t * (1.1 + i * 0.17) + i * 2) * 14, bob = Math.sin(t * (1.6 + i * 0.13) + i) * 9;
  let x = cc.x + lerp(0, ox, inf) + sway * inf, y = cc.y + lerp(-R - BRY, oy, inf) + bob * inf;
  // drag during launch: balloons trail behind, stretched
  return { x, y, r: sway * 0.004 + (ox / 2000), s: clamp(0.35 + 0.65 * E.backOut(clamp((t - b.t0 - 0.55) / 0.5))) };
}
BAL.forEach((b, i) => {
  b.reg = reg(b.t0, b.t0 + 0.6, BOUT, E.ink, (t) => { const p = balloonAt(i, t); return { x: p.x, y: p.y, r: p.r, s: 1 }; });
});
function drawBalloons(c, t) {
  BAL.forEach((b, i) => {
    if (t < b.t0) return;
    const p = balloonAt(i, t);
    const cc = coinAt(t);
    const mk = E.expoInOut(clamp((t - MERGE0) / (MERGE1 - MERGE0)));
    // string (becomes a red braided rope when the forces merge)
    const sb = P(t, b.t0 + 0.45, 0.5);
    if (sb > 0) {
      const top = [p.x, p.y + BRY * p.s + 14];
      const bot = [cc.x + (i - 1.5) * 8 * (1 - mk), cc.y - R + 4];
      const midx = lerp(top[0], bot[0], 0.5) + Math.sin(t * 2 + i) * 18 * (1 - mk), midy = lerp(top[1], bot[1], 0.55);
      const pth = new Path(spline([top, [midx, midy], bot], 10), 4);
      stroke(c.graph, pth, { w: 2.6, color: C.graph, alpha: 1 - mk, boil: 1, seed: 2200 + i, b: sb });
      if (mk > 0) stroke(c.ink, pth, { w: 3 + mk * 4, color: C.red, alpha: mk, boil: 1.2, seed: 2210 + i, b: sb });
      // demand pulses run down the string into the coin
      for (const tp of b.pulses) {
        const u = (t - tp) / 0.55;
        if (u <= 0 || u >= 1) continue;
        const q = pth.at(E.cubicIn(u));
        c.wash.globalAlpha = 0.5 * Math.sin(Math.PI * u);
        c.wash.fillStyle = C.ochre;
        c.wash.beginPath(); c.wash.arc(q.x, q.y, 34, 0, TAU); c.wash.fill();
        c.wash.globalAlpha = 1;
        c.ink.fillStyle = C.red;
        c.ink.beginPath(); c.ink.arc(q.x, q.y, 11, 0, TAU); c.ink.fill();
      }
    }
    // body
    c.wash.save();
    c.wash.translate(p.x, p.y); c.wash.rotate(p.r); c.wash.scale(p.s, p.s);
    const fp = P(t, b.t0 + 0.35, 0.7);
    if (fp > 0) {
      wash(c.wash, 0, 0, BRX * 0.98, BRY * 0.98, b.col, fp, 2300 + i * 7, b.col === C.red ? 0.3 : 0.45);
      c.wash.globalAlpha = 0.5 * fp;
      c.wash.fillStyle = '#fffaf0';
      c.wash.beginPath(); c.wash.ellipse(-40, -55, 18, 30, -0.5, 0, TAU); c.wash.fill();
      c.wash.globalAlpha = 1;
    }
    c.wash.restore();
    c.ink.save();
    c.ink.translate(p.x, p.y); c.ink.rotate(p.r); c.ink.scale(p.s, p.s);
    penStroke(c.ink, t, b.reg, { w: 6.5, seed: 2400 + i });
    if (t > b.t0 + 0.55) stroke(c.ink, KNOT, { w: 4, color: C.red, boil: 1, seed: 2410 + i });
    c.ink.restore();
    c.text.save();
    c.text.translate(p.x, p.y); c.text.rotate(p.r); c.text.scale(p.s, p.s);
    const col = b.col === C.red ? C.redDeep : '#7a5212';
    handText(c.text, b.l[0], 0, -4, { size: b.l[0].length > 2 ? 70 : 78, font: FONT_FUN, color: col, align: 'center', t, times: [...b.l[0]].map((_, k) => b.lt[0] + k * 0.08) });
    handText(c.text, b.l[1], 0, 80, { size: 68, font: FONT_FUN, color: col, align: 'center', t, times: [...b.l[1]].map((_, k) => b.lt[1] + k * 0.1) });
    c.text.restore();
  });
}

// "炒作": a grey balloon that pops
const HYPE = { t0: 77.85, pop: 78.62 };
function drawHype(c, t) {
  if (t < HYPE.t0 || t > HYPE.pop + 0.6) return;
  const cc = coinAt(t);
  const x = cc.x - 330, y = cc.y - 120;
  if (t < HYPE.pop) {
    const k = E.backOut(clamp((t - HYPE.t0) / 0.4));
    const shiver = Math.sin(t * 60) * 3 * clamp((t - 78.3) / 0.3);
    c.graph.save();
    c.graph.translate(x + shiver, y);
    c.graph.scale(0.55 * k, 0.55 * k);
    stroke(c.graph, BOUT, { w: 6, color: C.graphSoft, boil: 2, seed: 2500, b: P(t, HYPE.t0, 0.3) });
    c.graph.restore();
    handText(c.text, '炒作', x + shiver, y + 16, { size: 44, color: C.graphSoft, align: 'center', t, times: [78.0, 78.1] });
    const sp = new Path([[x, y + 75 * k], [x + 120, cc.y - R]], 4);
    stroke(c.graph, sp, { w: 2, color: C.graphSoft, boil: 1, seed: 2501, alpha: 0.6 });
  } else {
    const k = clamp((t - HYPE.pop) / 0.5);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + 0.3;
      const r0 = 40 + 90 * E.expoOut(k), r1 = r0 + 30 * (1 - k);
      const pth = new Path([[x + Math.cos(a) * r0, y + Math.sin(a) * r0], [x + Math.cos(a) * r1, y + Math.sin(a) * r1]], 3);
      stroke(c.graph, pth, { w: 4, color: C.graph, boil: 1, seed: 2510 + i, alpha: 1 - k });
    }
    for (let i = 0; i < 6; i++) {
      const a = rr(i, 0, TAU), d = 60 + 80 * E.expoOut(k);
      c.graph.globalAlpha = 1 - k;
      c.graph.fillStyle = C.graphSoft;
      c.graph.save();
      c.graph.translate(x + Math.cos(a) * d, y + Math.sin(a) * d + 120 * k * k);
      c.graph.rotate(a + k * 5);
      c.graph.fillRect(-10, -4, 20, 8);
      c.graph.restore();
    }
    c.graph.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- the launch + title
const SLY = coinBase(LAUNCH).y + R + 70;
const SLASH = reg(LAUNCH - 0.16, LAUNCH - 0.06, new Path([[HOME.x - 80, SLY + 30], [HOME.x + 80, SLY - 30]], 4), E.expoOut);
const TITLE = { x: 2740, y: -2560, size: 210 };
const T2 = { x: 2740, y: -2350, size: 136 };
const TT = [87.05, 87.4, 87.64, 87.86];
const TT2 = [88.06, 88.2];
// the pencil "writes" each glyph: a short hidden pass across each character
{
  const cw = TITLE.size * 1.0;
  TT.forEach((t0, i) => {
    const x0 = TITLE.x - 2 * cw + i * cw;
    reg(t0, t0 + 0.24, new Path([[x0 + cw * 0.15, TITLE.y - cw * 0.55], [x0 + cw * 0.5, TITLE.y - cw * 0.3], [x0 + cw * 0.85, TITLE.y - cw * 0.1]], 6), E.ink);
  });
  const cw2 = T2.size;
  TT2.forEach((t0, i) => {
    const x0 = T2.x - cw2 + i * cw2;
    reg(t0, t0 + 0.14, new Path([[x0 + cw2 * 0.2, T2.y - cw2 * 0.5], [x0 + cw2 * 0.8, T2.y - cw2 * 0.15]], 6), E.ink);
  });
}
function drawLaunch(c, t) {
  if (t < LAUNCH - 0.2) return;
  penStroke(c.ink, t, SLASH, { w: 8, seed: 2600 });
  // the trail: the line continues, thick, behind the coin
  if (t > LAUNCH) {
    const u = rocketU(t);
    stroke(c.ink, ROCKET, { w: 34, color: C.red, boil: 2, wob: 2, seed: 2610, b: u, taper: 60, tip: 30 });
    const hw = P(t, LAUNCH + 0.3, 1.2);
    if (hw > 0) stroke(c.wash, ROCKET, { w: 100, color: C.ochre, alpha: 0.45 * hw, boil: 5, seed: 2611, b: u, taper: 80 });
  }
  if (t > TT[0] - 0.05) {
    // title: written, then breathing
    const br = 1 + Math.sin(t * 2.2) * 0.006;
    c.text.save();
    c.text.translate(TITLE.x, TITLE.y - TITLE.size * 0.35);
    c.text.scale(br, br);
    c.text.rotate(-0.035);
    handText(c.text, '反教科书', 0, TITLE.size * 0.35, { size: TITLE.size, font: FONT_FUN, color: C.red, align: 'center', t, times: TT, charDur: 0.24, boil: 0.6 });
    c.text.restore();
    if (t > TT2[0] - 0.05) handText(c.text, '行情', T2.x, T2.y + 60, { size: T2.size, font: FONT_FUN, color: C.graph, align: 'center', t, times: TT2, charDur: 0.2, rot: -0.02, boil: 0.6 });
    // underline swoosh
    const ub = P(t, 88.25, 0.35, E.expoOut);
    if (ub > 0) stroke(c.ink, lp('uline', () => spline([[TITLE.x - 470, TITLE.y + 90], [TITLE.x - 100, TITLE.y + 70], [TITLE.x + 420, TITLE.y + 40]], 10)), { w: 12, color: C.red, boil: 1.5, seed: 2620, b: ub });
  }
}

// ---------------------------------------------------------------- bridge from act 1 + coin
const STEM = reg(54.75, 55.38, new Path(spline([[ACT1.PHONE_TOP[0], ACT1.PHONE_TOP[1] - 4], [3215, -760], [3110, -1000], [3125, -1300], [3220, -1480], [HOME.x - 34, HOME.y + R - 8]], 14), 5), E.ink);
const COINDRAW = reg(55.35, 55.85, new Path(ellipsePts(HOME.x, HOME.y, R, R, Math.PI / 2, TAU * 1.05, 48), 4), E.ink);
visKey(54.5, 0); visKey(54.8, 1);
visKey(56.0, 1); visKey(56.5, 0); visKey(60.4, 0); visKey(60.75, 1);
for (const [a, b] of [[61.95, 67.15], [68.15, 73.25], [74.25, 78.65], [79.65, 85.5]]) { visKey(a, 1); visKey(a + 0.4, 0); visKey(b - 0.35, 0); visKey(b, 1); }
visKey(LAUNCH + 0.02, 1); visKey(LAUNCH + 0.35, 0); visKey(86.65, 0); visKey(87.0, 1); visKey(88.4, 1); visKey(88.95, 0);

export function drawAct2(c, t, view) {
  if (t < 54.7) return;
  penStroke(c.ink, t, STEM, { w: mainW(), seed: 2700 });
  drawNotes(c, t);
  drawWeight(c, t);
  drawHype(c, t);
  drawBalloons(c, t);
  drawLaunch(c, t);
  // coin
  const cc = coinAt(t);
  const [sx, sy] = coinScale(t);
  const p = P(t, COINDRAW.t0, COINDRAW.t1 - COINDRAW.t0, E.lin);
  if (p > 0) coin(c.ink, cc.x, cc.y, R, Math.sin(t * 1.4) * 0.05, p, 2800, sx, sy);
}

export function rocketBoost(t) {
  if (t > LAUNCH - 0.15 && t < LAUNCH + 0.9) return 40;
  if (t > 61.0 && t < 61.4) return 0;
  return 0;
}

// camera for act 2: follows the coin
export const ACT2_MOVES = ([
  [54.6, 56.4, { x: HOME.x + 90, y: HOME.y + 150, z: 0.9, r: 0 }, E.expoInOut],
  [56.4, 60.4, { x: HOME.x + 190, y: HOME.y + 215, z: 1.06, r: -0.008 }, E.sine],
  [60.7, 62.4, { x: HOME.x + 40, y: HOME.y - 200, z: 0.82, r: 0.004 }, E.expoInOut],
  [62.4, 66.2, { x: HOME.x + 20, y: HOME.y - 240, z: 0.88, r: 0 }, E.sine],
  [66.3, 67.6, { x: HOME.x + 60, y: HOME.y - 420, z: 0.8, r: -0.006 }, E.expoInOut],
  [67.6, 72.4, { x: HOME.x + 80, y: HOME.y - 430, z: 0.84, r: 0 }, E.sine],
  [72.5, 73.7, { x: HOME.x + 20, y: HOME.y - 620, z: 0.76, r: 0.006 }, E.expoInOut],
  [73.7, 77.3, { x: HOME.x, y: HOME.y - 640, z: 0.8, r: 0 }, E.sine],
  [77.4, 78.6, { x: HOME.x + 30, y: HOME.y - 720, z: 0.74, r: -0.004 }, E.expoInOut],
  [78.6, 83.2, { x: HOME.x + 110, y: HOME.y - 740, z: 0.77, r: 0 }, E.sine],
  [83.3, 84.4, { x: HOME.x + 60, y: HOME.y - 860, z: 0.76, r: 0 }, E.expoInOut],
  [84.4, 85.75, { x: HOME.x + 20, y: HOME.y - 800, z: 0.86, r: 0.006 }, E.sine],
  [85.8, 87.35, { x: 3150, y: -2900, z: 0.6, r: -0.01 }, bez(0.6, -0.15, 0.2, 1)],
  [87.35, 89.4, { x: 3148, y: -2890, z: 0.615, r: -0.008 }, E.sine],
]);
