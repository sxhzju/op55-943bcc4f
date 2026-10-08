// Small hand-drawn props reused across the piece: bills, coins, order slips, balloons.
import { G, C, E, clamp, lerp, ns, rr, Path, stroke, handText, FONT_FUN, FONT_HAND, rectPts, ellipsePts, blobPath } from './engine.js';

const P_RECT = new Path(rectPts(-55, -28, 110, 56), 4);
const P_OVAL = new Path(ellipsePts(0, 0, 30, 18, -Math.PI / 2, Math.PI * 2.1, 36), 3);
const P_SLIP = new Path(rectPts(-34, -44, 68, 88), 4);
const P_SL1 = new Path([[-22, -24], [22, -24]], 4);
const P_SL2 = new Path([[-22, -8], [16, -8]], 4);
const P_SL3 = new Path([[-22, 8], [20, 8]], 4);
const P_COIN = new Path(ellipsePts(0, 0, 1, 1, -2.2, Math.PI * 2.15, 48), 0.05);

// paper money; kind 'usd' (green, $) or 'cny' (red, ¥). sx allows the flip (scaleX through 0)
export function bill(ctx, x, y, rot, s, kind, seed = 1, alpha = 1, sx = 1) {
  const col = kind === 'usd' ? C.green : C.red;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s * sx, s);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = kind === 'usd' ? '#dfe8d6' : '#f6d9cc';
  ctx.beginPath(); ctx.rect(-55, -28, 110, 56); ctx.fill();
  ctx.globalAlpha = 1;
  stroke(ctx, P_RECT, { w: 3.2, color: col, boil: 0.8, seed, taper: 6, alpha });
  stroke(ctx, P_OVAL, { w: 2.2, color: col, boil: 0.6, seed: seed + 3, taper: 4, alpha });
  ctx.globalAlpha = alpha;
  ctx.fillStyle = col;
  ctx.font = `30px ${FONT_FUN}`;
  ctx.textAlign = 'center';
  ctx.fillText(kind === 'usd' ? '$' : '¥', 0, 11);
  ctx.textAlign = 'left';
  ctx.restore();
  ctx.globalAlpha = 1;
}

export function slip(ctx, x, y, rot, s, seed = 1, alpha = 1, sx = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s * sx, s);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#fbf6ec';
  ctx.beginPath(); ctx.rect(-34, -44, 68, 88); ctx.fill();
  ctx.globalAlpha = 1;
  stroke(ctx, P_SLIP, { w: 2.6, color: C.graph, boil: 0.8, seed, taper: 6, alpha });
  stroke(ctx, P_SL1, { w: 2, color: C.graphSoft, boil: 0.5, seed: seed + 1, alpha });
  stroke(ctx, P_SL2, { w: 2, color: C.graphSoft, boil: 0.5, seed: seed + 2, alpha });
  stroke(ctx, P_SL3, { w: 2, color: C.graphSoft, boil: 0.5, seed: seed + 3, alpha });
  ctx.globalAlpha = alpha * 0.8;
  ctx.strokeStyle = C.red; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(12, 28, 10, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = 1;
}

// red yuan coin; p = draw-on progress of the rim
export function coin(ctx, x, y, r, rot = 0, p = 1, seed = 1, sxs = 1, sys = 1) {
  if (p <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(r * sxs, r * sys);
  const fill = clamp((p - 0.4) / 0.6);
  if (fill > 0) {
    ctx.globalAlpha = 0.9 * fill;
    ctx.fillStyle = '#e8735d';
    blobPath(ctx, 0, 0, 0.96, 0.96, seed, E.expoOut(fill), 0.05, 36);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  stroke(ctx, P_COIN, { w: 0.13, color: C.redDeep, boil: 0.025, wob: 0.01, seed, b: E.ink(clamp(p / 0.6)), taper: 0.3, tip: 0.2 });
  if (fill > 0) {
    ctx.globalAlpha = fill;
    ctx.fillStyle = '#fff3e6';
    ctx.font = `1.1px ${FONT_FUN}`;
    ctx.textAlign = 'center';
    ctx.fillText('¥', 0, 0.38);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// generic polyline helper in local coordinates (cached by key)
const cache = new Map();
export function lp(key, fn, step = 4) {
  let p = cache.get(key);
  if (!p) { p = new Path(fn(), step); cache.set(key, p); }
  return p;
}
