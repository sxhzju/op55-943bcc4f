// Subtitles as kinetic, hand-lettered typography.
// Each subtitle = lines of segments [text, size, color, start, opts]; the concatenated text
// must equal subtitles.srt exactly (render.mjs verifies this before rendering).
import { W, H, G, C, E, clamp, lerp, ns, n1, P, FONT_HAND, FONT_FUN, measure, spring, wobble } from './engine.js';

const COL = { g: C.graph, r: C.red, n: C.green, s: C.graphSoft };

export const SUBS = [
  {
    s: 0.3, e: 4.594, x: 74, y: 128, exit: 'fling',
    lines: [
      [['教科书里明明写着', 55, 'g', 0.3, { st: 0.055 }]],
      [['美联储加息', 97, 'g', 1.98, { st: 0.07, hit: 2.86 }], ['会让', 55, 'g', 3.05]],
      [['人民币', 55, 'g', 3.2], ['贬值', 97, 'g', 3.5, { hit: 4.05, sink: true }], ['，', 55, 'g', 3.68]],
      [['这次却不同', 110, 'r', 3.78, { st: 0.05, font: 'fun' }]],
    ],
  },
  {
    s: 6.06, e: 11.58, x: 70, y: 140,
    lines: [
      [['今年八月，', 55, 'g', 6.1]],
      [['中国贸易', 68, 'g', 6.85], ['顺差', 92, 'r', 7.5, { hit: 7.72 }]],
      [['冲到', 59, 'g', 7.9], ['1190.9亿', 123, 'r', 8.3, { st: 0.2, font: 'fun', hit: 9.9 }]],
      [['美元', 70, 'n', 10.0], ['，', 59, 'g', 10.15], ['创历史新高', 70, 'g', 10.35, { st: 0.11, hit: 11.2 }], ['。', 59, 'g', 11.3]],
    ],
  },
  {
    s: 14.952, e: 16.96, x: 66, y: 120,
    lines: [
      [['其中', 55, 'g', 14.97], ['AI产业链', 101, 'r', 15.08, { st: 0.04, font: 'fun', hit: 15.6 }], ['的', 55, 'g', 15.3]],
      [['芯片、数据中心设备', 59, 'g', 15.36, { st: 0.035 }]],
      [['订单', 77, 'g', 15.62], ['爆了。', 106, 'r', 15.72, { st: 0.05, font: 'fun', shake: true }]],
    ],
  },
  {
    s: 19.2, e: 22.68, x: 70, y: 1010, exit: 'erase',
    lines: [
      [['这些企业赚到', 57, 'g', 19.22], ['美元', 95, 'n', 19.95, { hit: 20.1 }], ['后，', 57, 'g', 20.2]],
      [['第一件事就是', 57, 'g', 20.6]],
      [['结汇', 128, 'r', 21.45, { st: 0.12, font: 'fun', hit: 21.75 }], ['换人民币。', 68, 'r', 21.85, { st: 0.06 }]],
    ],
  },
  {
    s: 25.82, e: 29.98, x: 70, y: 1000,
    lines: [
      [['CIPS', 114, 'r', 25.85, { st: 0.07, font: 'fun', hit: 26.5 }], ['人民币', 62, 'g', 26.6]],
      [['跨境支付系统', 62, 'g', 27.3, { st: 0.07 }]],
      [['单日交易额突破', 57, 'g', 28.1, { st: 0.07 }]],
      [['1.22万亿', 136, 'r', 28.7, { st: 0.1, font: 'fun', hit: 29.7 }]],
    ],
  },
  {
    s: 32.88, e: 36.76, x: 70, y: 130,
    lines: [
      [['这说明海外对人民币的', 55, 'g', 32.9, { st: 0.07 }]],
      [['真实需求', 114, 'r', 34.45, { st: 0.1, font: 'fun', hit: 35.0 }]],
      [['在上升，', 66, 'g', 35.2, { st: 0.07, rise: true }], ['不只是', 59, 'g', 35.75], ['投机', 84, 's', 36.05, { st: 0.1, jitter: true }], ['。', 59, 'g', 36.3]],
    ],
  },
];

export function subText(s) {
  return s.lines.map((l) => l.map((g) => g[0]).join('')).join('');
}

const fontOf = (seg, size) => `${size}px ${seg[4]?.font === 'fun' ? FONT_FUN : FONT_HAND}`;

// layout cache
const _lay = new Map();
function layout(ctx, sub) {
  let L = _lay.get(sub);
  if (L) return L;
  const chars = [];
  let y = sub.y, maxW = 0;
  sub.lines.forEach((line, li) => {
    const maxS = Math.max(...line.map((g) => g[1]));
    y += maxS * (li === 0 ? 0.92 : 1.12);
    let x = sub.x;
    line.forEach((seg) => {
      const [txt, size, col, start, o = {}] = seg;
      const f = fontOf(seg, size);
      [...txt].forEach((ch, k) => {
        const w = measure(ctx, ch, f);
        chars.push({ ch, x, y, w, size, f, col: COL[col], t: start + k * (o.st ?? 0.06), o, idx: chars.length });
        x += w + (o.font === 'fun' ? size * 0.02 : 0);
      });
    });
    maxW = Math.max(maxW, x - sub.x);
  });
  const avail = W - sub.x - 58;
  const sc = maxW > avail ? avail / maxW : 1;
  L = { chars, sc, h: y - sub.y };
  _lay.set(sub, L);
  return L;
}

function drawChar(ctx, c, t, sub, n) {
  const life = t - c.t;
  if (life < 0) return;
  // entrance: drop in with overshoot, slight spin, quick write-on
  const k = clamp(life / 0.38);
  const pop = E.backOut(k, 2.6);
  let sx = 0.55 + 0.45 * pop, sy = sx;
  let dy = (1 - E.expoOut(k)) * c.size * 0.45;
  let dx = 0;
  let rot = (1 - E.expoOut(k)) * ns(c.idx * 3.7, 9) * 0.5;
  let alpha = clamp(life / 0.12);
  // boil (2–3 frame hand jitter)
  const bi = G.boil;
  dx += ns(bi * 2.1 + c.idx * 5.3, 1) * c.size * 0.012;
  dy += ns(bi * 1.9 + c.idx * 4.1, 2) * c.size * 0.012;
  rot += ns(bi * 1.3 + c.idx * 2.9, 3) * 0.018;
  // emphasis hit on the spoken beat
  if (c.o.hit) {
    const h = Math.max(0, t - c.o.hit);
    if (t > c.o.hit) { const s2 = 1 + 0.16 * Math.exp(-h * 7) * Math.cos(h * 26); sx *= s2; sy *= s2; }
  }
  if (c.o.shake && t > c.t + 0.25) {
    const h = t - (c.t + 0.25);
    dx += Math.sin(h * 70 + c.idx) * 6 * Math.exp(-h * 3);
    rot += Math.sin(h * 55 + c.idx * 2) * 0.08 * Math.exp(-h * 3);
  }
  if (c.o.sink) dy += E.backOut(clamp((t - c.o.hit) / 0.5)) * c.size * 0.18 * (t > c.o.hit ? 1 : 0);
  if (c.o.rise) dy -= E.backOut(clamp((t - 35.44) / 0.5)) * c.size * 0.22 * (t > 35.44 ? 1 : 0);
  if (c.o.jitter) { dx += ns(t * 14 + c.idx * 3, 5) * 3; dy += ns(t * 13 + c.idx * 5, 6) * 3; }
  // exits
  const ex = sub.exit || 'erase';
  if (ex === 'fling') {
    const k2 = clamp((t - (4.56 + (n - c.idx) * 0.008)) / 0.42);
    if (k2 > 0) {
      const e2 = E.expoIn(k2);
      dy -= e2 * 1500 + E.backIn(k2) * 60;
      dx += e2 * (180 + ns(c.idx, 7) * 140);
      rot += e2 * ns(c.idx * 1.3, 8) * 1.4;
      sy *= 1 + e2 * 0.9; sx *= 1 - e2 * 0.35; // stretch along the fling = smear
    }
  } else {
    const k2 = clamp((t - (sub.e - 0.04 + c.idx * 0.012)) / 0.28);
    if (k2 > 0) {
      const e2 = E.cubicIn(k2);
      alpha *= 1 - e2;
      dy -= e2 * c.size * 0.35;
      dx += e2 * c.size * 0.12;
      sx *= 1 - e2 * 0.25; sy *= 1 - e2 * 0.25;
    }
  }
  if (alpha <= 0.002) return;
  ctx.save();
  ctx.translate(c.x + c.w / 2 + dx, c.y - c.size * 0.35 + dy);
  ctx.rotate(rot);
  ctx.scale(sx, sy);
  ctx.globalAlpha = alpha;
  ctx.font = c.f;
  ctx.fillStyle = c.col;
  ctx.shadowColor = 'rgba(244,237,224,0.92)';
  ctx.shadowBlur = c.size * 0.28;
  ctx.fillText(c.ch, -c.w / 2, c.size * 0.35);
  ctx.shadowBlur = 0;
  ctx.fillText(c.ch, -c.w / 2, c.size * 0.35);
  ctx.restore();
}

export function drawSubs(ctx, t) {
  for (const sub of SUBS) {
    if (t < sub.s - 0.05 || t > sub.e + 0.8) continue;
    const L = layout(ctx, sub);
    ctx.save();
    // gentle breathing drift of the whole block
    const ox = ns(t * 0.35, 21) * 5, oy = ns(t * 0.3, 22) * 5;
    ctx.translate(sub.x + ox, sub.y + oy);
    ctx.rotate(ns(t * 0.2, 23) * 0.006);
    ctx.scale(L.sc, L.sc);
    ctx.translate(-sub.x, -sub.y);
    ctx.textBaseline = 'alphabetic';
    for (const c of L.chars) drawChar(ctx, c, t, sub, L.chars.length);
    ctx.restore();
  }
}
