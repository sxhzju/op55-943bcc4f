// Frame renderer: paper, layered ink, motion-blur accumulation, pencil, subtitles, grade + grain.
import { W, H, FPS, G, C, clamp, lerp, hash, ns, n1, E, ilerp } from './engine.js';
import { camAt, blurBoost, drawWorld, drawFront, penAt, mood, DURATION } from './story.js';
import { drawSubs } from './subs.js';

const mk = (w = W, h = H) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
};
const out = document.getElementById('c');
const octx = out.getContext('2d');
const acc = mk(), actx = acc.getContext('2d');
const sub = mk(), sctx = sub.getContext('2d');
const layers = {};
for (const k of ['wash', 'graph', 'ink', 'text', 'front']) {
  const c = mk();
  layers[k] = { c, x: c.getContext('2d') };
}

// ---------------------------------------------------------------- procedural textures
function noiseCanvas(size, fn) {
  const c = mk(size, size), x = c.getContext('2d');
  const img = x.createImageData(size, size);
  fn(img.data, size);
  x.putImageData(img, 0, 0);
  return c;
}
// tileable value noise
function tnoise(size, cells, seed) {
  const g = new Float32Array(cells * cells);
  for (let i = 0; i < g.length; i++) g[i] = hash(i * 7919 + seed);
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const fy = (y / size) * cells, iy = Math.floor(fy), ty = fy - iy, uy = ty * ty * (3 - 2 * ty);
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * cells, ix = Math.floor(fx), tx = fx - ix, ux = tx * tx * (3 - 2 * tx);
      const a = g[(iy % cells) * cells + (ix % cells)], b = g[(iy % cells) * cells + ((ix + 1) % cells)];
      const c2 = g[((iy + 1) % cells) * cells + (ix % cells)], d = g[((iy + 1) % cells) * cells + ((ix + 1) % cells)];
      out[y * size + x] = lerp(lerp(a, b, ux), lerp(c2, d, ux), uy);
    }
  }
  return out;
}
let paperTile, toothTile, grainTiles = [];
function buildTextures() {
  const S = 1024;
  const o1 = tnoise(S, 8, 1), o2 = tnoise(S, 32, 2), o3 = tnoise(S, 128, 3), o4 = tnoise(S, 256, 4);
  paperTile = noiseCanvas(S, (d) => {
    for (let i = 0; i < S * S; i++) {
      const v = (o1[i] - 0.5) * 10 + (o2[i] - 0.5) * 7 + (o3[i] - 0.5) * 7 + (o4[i] - 0.5) * 9 + (hash(i) - 0.5) * 6;
      d[i * 4] = 242 + v; d[i * 4 + 1] = 234 + v * 0.97; d[i * 4 + 2] = 219 + v * 0.9; d[i * 4 + 3] = 255;
    }
  });
  // fibres
  const px = paperTile.getContext('2d');
  for (let i = 0; i < 900; i++) {
    const x = hash(i * 3) * S, y = hash(i * 3 + 1) * S, a = hash(i * 3 + 2) * Math.PI * 2, l = 6 + hash(i * 5) * 22;
    px.strokeStyle = hash(i * 11) > 0.5 ? 'rgba(120,100,70,0.07)' : 'rgba(255,255,255,0.18)';
    px.lineWidth = 0.6 + hash(i * 13);
    px.beginPath();
    for (let dx = -S; dx <= S; dx += S) for (let dy = -S; dy <= S; dy += S) {
      px.moveTo(x + dx, y + dy);
      px.quadraticCurveTo(x + dx + Math.cos(a) * l * 0.5 + 3, y + dy + Math.sin(a) * l * 0.5 - 2, x + dx + Math.cos(a) * l, y + dy + Math.sin(a) * l);
    }
    px.stroke();
  }
  // paper tooth: where pigment skips (alpha mask)
  toothTile = noiseCanvas(512, (d) => {
    const a = tnoise(512, 128, 9), b = tnoise(512, 64, 10);
    for (let i = 0; i < 512 * 512; i++) {
      const v = a[i] * 0.6 + b[i] * 0.25 + hash(i + 77) * 0.35;
      const m = clamp((v - 0.52) * 3.2);
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 0; d[i * 4 + 3] = m * 255;
    }
  });
  for (let k = 0; k < 4; k++) {
    grainTiles.push(noiseCanvas(512, (d) => {
      for (let i = 0; i < 512 * 512; i++) {
        const v = 128 + (hash(i * 31 + k * 999331) + hash(i * 17 + k * 7177) - 1) * 120;
        d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255;
      }
    }));
  }
}

let paperPat, toothPat;
function setWorld(ctx, cam, f = 1) {
  const z = cam.z * f, c = Math.cos(cam.r) * z, s = Math.sin(cam.r) * z;
  // screen = R*z*(w - cam) + center
  ctx.setTransform(c, s, -s, c, W / 2 - (c * cam.x - s * cam.y), H / 2 - (s * cam.x + c * cam.y));
}
function worldMatrix(cam) {
  const z = cam.z, c = Math.cos(cam.r) * z, s = Math.sin(cam.r) * z;
  return new DOMMatrix([c, s, -s, c, W / 2 - (c * cam.x - s * cam.y), H / 2 - (s * cam.x + c * cam.y)]);
}
export function toScreen(cam, x, y) {
  const z = cam.z, c = Math.cos(cam.r) * z, s = Math.sin(cam.r) * z;
  const dx = x - cam.x, dy = y - cam.y;
  return [W / 2 + c * dx - s * dy, H / 2 + s * dx + c * dy];
}

// ---------------------------------------------------------------- pencil sprite
let pencilImg, pencilShadow;
function buildPencil() {
  const Lp = 980, D = 70;
  const c = mk(Lp + 40, D + 40), x = c.getContext('2d');
  x.translate(20, 20 + D / 2);
  // tip at (0,0) pointing left; body to the right
  const cone = 150;
  // body
  x.fillStyle = '#c9402b';
  x.beginPath(); x.moveTo(cone, -D / 2); x.lineTo(Lp, -D / 2 + 2); x.lineTo(Lp, D / 2 - 2); x.lineTo(cone, D / 2); x.closePath(); x.fill();
  x.fillStyle = 'rgba(255,190,160,0.45)';
  x.fillRect(cone, -D / 2 + 9, Lp - cone, 10);
  x.fillStyle = 'rgba(90,10,0,0.28)';
  x.fillRect(cone, D / 2 - 18, Lp - cone, 18);
  x.fillStyle = 'rgba(255,255,255,0.12)';
  x.fillRect(cone, -4, Lp - cone, 4);
  // wood cone with scalloped edge
  x.fillStyle = '#ecd0a2';
  x.beginPath(); x.moveTo(26, -9); x.lineTo(cone, -D / 2);
  for (let i = 0; i <= 6; i++) x.quadraticCurveTo(cone + 12, -D / 2 + (D * (i + 0.5)) / 7, cone, -D / 2 + (D * Math.min(i + 1, 7)) / 7);
  x.lineTo(26, 9); x.closePath(); x.fill();
  x.fillStyle = 'rgba(150,100,50,0.25)';
  x.beginPath(); x.moveTo(26, 3); x.lineTo(cone, D / 2 - 14); x.lineTo(cone, D / 2); x.lineTo(26, 9); x.fill();
  // lead
  x.fillStyle = '#b8301f';
  x.beginPath(); x.moveTo(0, 0); x.lineTo(30, -10); x.lineTo(30, 10); x.closePath(); x.fill();
  // end
  x.fillStyle = '#e2c08e'; x.fillRect(Lp - 4, -D / 2 + 2, 6, D - 4);
  // hand-drawn outline
  x.strokeStyle = '#2b2622'; x.lineWidth = 3.2; x.lineJoin = 'round'; x.lineCap = 'round';
  const wob = (a, b, cx2, cy2) => { x.beginPath(); x.moveTo(a, b); x.lineTo(cx2, cy2); x.stroke(); };
  wob(cone, -D / 2, Lp + 3, -D / 2 + 3); wob(cone - 2, D / 2, Lp + 2, D / 2 - 1); wob(Lp + 2, -D / 2, Lp, D / 2 + 1);
  wob(0, 0, cone + 3, -D / 2 - 1); wob(0, 0, cone + 1, D / 2 + 2);
  x.lineWidth = 2;
  wob(cone + 4, -D / 2 + 22, Lp - 6, -D / 2 + 23); wob(cone + 4, D / 2 - 20, Lp - 10, D / 2 - 21);
  x.beginPath(); x.moveTo(cone, -D / 2);
  for (let i = 0; i <= 6; i++) x.quadraticCurveTo(cone + 12, -D / 2 + (D * (i + 0.5)) / 7, cone, -D / 2 + (D * Math.min(i + 1, 7)) / 7);
  x.stroke();
  pencilImg = c;
  const s = mk(Lp + 120, D + 120), sx = s.getContext('2d');
  sx.filter = 'blur(10px)';
  sx.drawImage(c, 40, 40);
  sx.globalCompositeOperation = 'source-in';
  sx.fillStyle = 'rgba(60,40,20,1)'; sx.fillRect(0, 0, s.width, s.height);
  pencilShadow = s;
}

// pencil: tip-anchored in screen space, tilts with velocity (lagging spring), lifts off paper
function drawPencil(ctx, t, cam) {
  const pen = penAt(t);
  if (!pen || pen.vis <= 0.001) return;
  // velocity history (deterministic lag): average of past finite differences
  let vx = 0, vy = 0, wsum = 0;
  for (let k = 0; k < 6; k++) {
    const ta = t - k * 0.035, a = penAt(ta), b = penAt(ta - 0.035);
    const [ax, ay] = toScreen(cam, a.x, a.y), [bx, by] = toScreen(cam, b.x, b.y);
    const w = 1 - k / 6;
    vx += ((ax - bx) / 0.035) * w; vy += ((ay - by) / 0.035) * w; wsum += w;
  }
  vx /= wsum; vy /= wsum;
  let [sx, sy] = toScreen(cam, pen.x, pen.y);
  const lift = clamp(pen.lift ?? 0, 0, 1.5);
  const away = 1 - E.expoInOut(clamp(pen.vis));
  sx = lerp(sx, W + 520, away); sy = lerp(sy, H + 320, away);
  const base = -0.72; // radians: body goes up-right from the tip
  const tilt = clamp(-vx * 0.00022 + vy * 0.00008, -0.32, 0.32);
  const ang = base + tilt + ns(t * 0.6, 41) * 0.03;
  const scale = (0.5 + 0.12 * clamp(cam.z, 0.3, 1.6)) * (1 + lift * 0.07);
  const lx = -lift * 26, ly = -lift * 46; // lifted tip moves toward camera / up
  // shadow on paper
  ctx.save();
  ctx.translate(sx + 22 + lift * 70, sy + 26 + lift * 80);
  ctx.rotate(ang);
  ctx.scale(scale, scale);
  ctx.globalAlpha = 0.2 - lift * 0.06;
  ctx.drawImage(pencilShadow, -60, -pencilShadow.height / 2);
  ctx.restore();
  // pencil
  ctx.save();
  ctx.translate(sx + lx, sy + ly);
  ctx.rotate(ang);
  // squash along axis when pressing (speed spikes)
  const press = clamp(Math.hypot(vx, vy) / 4000, 0, 0.06);
  ctx.scale(scale * (1 - press), scale * (1 + press * 0.5));
  ctx.drawImage(pencilImg, -20, -pencilImg.height / 2);
  ctx.restore();
}

// ---------------------------------------------------------------- frame
const SHUTTER = 0.55; // fraction of a frame the virtual shutter is open

function renderSub(t, cam) {
  // world layers
  for (const k in layers) {
    const L = layers[k];
    L.x.setTransform(1, 0, 0, 1, 0, 0);
    L.x.globalCompositeOperation = 'source-over';
    L.x.globalAlpha = 1;
    L.x.clearRect(0, 0, W, H);
    setWorld(L.x, cam);
  }
  G.cam = cam;
  const ctx = { wash: layers.wash.x, graph: layers.graph.x, ink: layers.ink.x, text: layers.text.x, front: layers.front.x, cam };
  drawWorld(ctx, t);
  // paper
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.globalCompositeOperation = 'source-over';
  sctx.globalAlpha = 1;
  const m = worldMatrix(cam);
  paperPat.setTransform(m.scale(1.0));
  sctx.fillStyle = paperPat;
  sctx.fillRect(0, 0, W, H);
  // tooth mask on pigment layers (anchored to the paper)
  toothPat.setTransform(m.scale(0.9));
  for (const [k, a] of [['graph', 0.55], ['ink', 0.42], ['text', 0.18]]) {
    const x = layers[k].x;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = 'destination-out';
    x.globalAlpha = a;
    x.fillStyle = toothPat;
    x.fillRect(0, 0, W, H);
    x.globalAlpha = 1;
    x.globalCompositeOperation = 'source-over';
  }
  sctx.globalCompositeOperation = 'multiply';
  sctx.drawImage(layers.wash.c, 0, 0);
  sctx.globalAlpha = 0.93;
  sctx.drawImage(layers.graph.c, 0, 0);
  sctx.globalAlpha = 1;
  sctx.globalCompositeOperation = 'source-over';
  sctx.drawImage(layers.ink.c, 0, 0);
  sctx.drawImage(layers.text.c, 0, 0);
  // foreground (screen space): pencil, eraser, dust
  const fx = layers.front.x;
  fx.setTransform(1, 0, 0, 1, 0, 0);
  fx.clearRect(0, 0, W, H);
  drawFront(fx, t, cam, toScreen);
  drawPencil(fx, t, cam);
  sctx.drawImage(layers.front.c, 0, 0);
}

function grade(t, frame) {
  const md = mood(t); // 0 = cool grey textbook, 1 = warm gold
  octx.setTransform(1, 0, 0, 1, 0, 0);
  // drifting window light
  const lx = W * (0.3 + 0.25 * ns(t * 0.05, 5)), ly = H * (0.25 + 0.2 * ns(t * 0.04, 6));
  let g = octx.createRadialGradient(lx, ly, 50, lx, ly, H * 0.9);
  g.addColorStop(0, `rgba(255,${235 + md * 10},${205 - md * 40},${0.10 + md * 0.08})`);
  g.addColorStop(1, 'rgba(255,240,220,0)');
  octx.globalCompositeOperation = 'screen';
  octx.fillStyle = g; octx.fillRect(0, 0, W, H);
  // temperature
  octx.globalCompositeOperation = 'soft-light';
  octx.fillStyle = md < 0.5 ? `rgba(120,150,175,${0.28 * (1 - md * 2)})` : `rgba(255,170,90,${0.26 * (md * 2 - 1)})`;
  octx.fillRect(0, 0, W, H);
  // vignette
  octx.globalCompositeOperation = 'multiply';
  g = octx.createRadialGradient(W / 2, H * 0.48, H * 0.35, W / 2, H * 0.5, H * 0.85);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, `rgba(${200 - md * 10},${185 - md * 10},${165 - md * 15},1)`);
  octx.fillStyle = g; octx.fillRect(0, 0, W, H);
  octx.globalCompositeOperation = 'source-over';
}
function grain(frame) {
  const tile = grainTiles[frame % 4];
  const ox = Math.floor(hash(frame * 3 + 1) * 512), oy = Math.floor(hash(frame * 3 + 2) * 512);
  octx.save();
  octx.globalCompositeOperation = 'overlay';
  octx.globalAlpha = 0.085;
  const pat = octx.createPattern(tile, 'repeat');
  pat.setTransform(new DOMMatrix([1, 0, 0, 1, -ox, -oy]));
  octx.fillStyle = pat;
  octx.fillRect(0, 0, W, H);
  octx.restore();
}

function camSpeed(t) {
  const a = camAt(t), b = camAt(t + 1 / FPS);
  const dz = Math.abs(Math.log(b.z / a.z)) * 900;
  return Math.hypot(b.x - a.x, b.y - a.y) * (a.z + b.z) * 0.5 + dz + Math.abs(b.r - a.r) * 900;
}

export function renderFrame(frame, opts = {}) {
  const t = frame / FPS;
  G.frame = frame;
  G.boil = Math.floor((frame + 0.5) / 2.5); // new drawing every 2–3 frames
  G.t = t;
  const v = camSpeed(t) + blurBoost(t);
  let K = opts.noBlur ? 1 : Math.max(1, Math.min(16, Math.ceil(v / 7)));
  actx.setTransform(1, 0, 0, 1, 0, 0);
  for (let k = 0; k < K; k++) {
    const ts = K === 1 ? t : t + ((k / (K - 1)) - 0.5) * SHUTTER / FPS;
    const cam = camAt(ts);
    renderSub(ts, cam);
    actx.globalAlpha = 1 / (k + 1);
    actx.drawImage(sub, 0, 0);
  }
  actx.globalAlpha = 1;
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.globalCompositeOperation = 'source-over';
  octx.drawImage(acc, 0, 0);
  grade(t, frame);
  drawSubs(octx, t, camAt(t), toScreen);
  grain(frame);
  return K;
}

export async function init() {
  const f1 = new FontFace('WenKai', 'url(../assets/fonts/LXGWWenKai-Medium.ttf)');
  const f2 = new FontFace('KuaiLe', 'url(../assets/fonts/ZCOOLKuaiLe-Regular.ttf)');
  await Promise.all([f1.load(), f2.load()]);
  document.fonts.add(f1); document.fonts.add(f2);
  buildTextures();
  buildPencil();
  paperPat = sctx.createPattern(paperTile, 'repeat');
  toothPat = layers.graph.x.createPattern(toothTile, 'repeat');
  return { frames: Math.round(DURATION * FPS) };
}
