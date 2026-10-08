// The film's spine: camera route, mood (light temperature), motion-blur hints, layer dispatch.
import { G, E, clamp, lerp, ns, wobble, P, W, H, C, hash, TAU } from './engine.js';
import { drawAct1, eraserAt, ERASE } from './act1.js';
import { drawAct2, rocketBoost, ACT2_MOVES } from './act2.js';
export { penAt } from './pen.js';

export const DURATION = 89.4; // 88.62 s of narration + a designed hold

// ---------------------------------------------------------------- camera
const CAM0 = { x: 760, y: 4800, z: 1.0, r: 0 };
// [t0, t1, target, ease]
const MOVES = [
  [0.0, 4.35, { x: 745, y: 4830, z: 1.06, r: -0.008 }, E.sine],
  [4.45, 5.75, { x: 1320, y: 3620, z: 1.0, r: 0.01 }, E.whip],
  [5.75, 7.75, { x: 1340, y: 3640, z: 1.08, r: 0.004 }, E.sine],
  [7.8, 8.8, { x: 1440, y: 3380, z: 0.9, r: -0.004 }, E.expoOut],
  [8.8, 10.3, { x: 1460, y: 3360, z: 0.93, r: 0 }, E.sine],
  [10.3, 11.3, { x: 1470, y: 3290, z: 0.92, r: 0.002 }, E.expoInOut],
  [11.3, 14.5, { x: 2250, y: 2380, z: 0.98, r: -0.012 }, E.glide],
  [14.5, 15.6, { x: 2470, y: 2170, z: 1.3, r: 0 }, E.expoInOut],
  [15.6, 16.25, { x: 2475, y: 2165, z: 1.36, r: -0.004 }, E.sine],
  [16.25, 17.4, { x: 2700, y: 2200, z: 0.86, r: 0.006 }, E.expoInOut],
  [17.4, 18.15, { x: 2710, y: 2200, z: 0.89, r: 0.004 }, E.sine],
  [18.3, 20.3, { x: 2920, y: 2080, z: 0.84, r: 0 }, E.expoOut],
  [20.3, 21.6, { x: 3140, y: 2140, z: 0.9, r: -0.006 }, E.expoInOut],
  [21.6, 24.85, { x: 3170, y: 2160, z: 0.94, r: 0 }, E.sine],
  [24.9, 26.1, { x: 3080, y: 1420, z: 0.92, r: 0.008 }, E.whip],
  [26.1, 29.9, { x: 3060, y: 1400, z: 0.96, r: 0 }, E.sine],
  [30.0, 31.6, { x: 3070, y: 1300, z: 0.9, r: -0.004 }, E.expoInOut],
  [32.0, 33.3, { x: 3150, y: 900, z: 0.92, r: 0.004 }, E.expoInOut],
  [33.3, 36.4, { x: 3190, y: 860, z: 0.97, r: 0 }, E.sine],
  [36.5, 37.8, { x: 3600, y: 400, z: 1.22, r: -0.006 }, E.expoInOut],
  [37.8, 42.3, { x: 3650, y: 430, z: 1.3, r: 0.004 }, E.sine],
  [42.4, 43.5, { x: 3335, y: -330, z: 1.2, r: 0 }, E.expoInOut],
  [43.5, 45.9, { x: 3330, y: -340, z: 1.3, r: -0.004 }, E.sine],
  [45.95, 46.9, { x: 3180, y: -230, z: 0.95, r: 0 }, E.expoInOut],
  [46.9, 48.2, { x: 3200, y: -260, z: 1.0, r: 0.003 }, E.sine],
  [48.2, 50.75, { x: 3290, y: -420, z: 0.78, r: 0 }, E.expoInOut],
  [50.86, 52.75, { x: 2030, y: 2370, z: 0.211, r: 0 }, E.expoInOut],
  [52.75, 54.6, { x: 2030, y: 2340, z: 0.218, r: 0 }, E.sine],
];

function shake(t) {
  // impulse camera shakes on the big hits
  let x = 0, y = 0, r = 0;
  for (const [tb, amp] of [[4.64, 10], [7.9, 6], [18.2, 14], [53.38, 3], [53.6, 3]]) {
    const w = wobble(t, tb, 7, 0.22);
    x += w * amp; y += wobble(t, tb + 0.03, 6, 0.25) * amp; r += w * amp * 0.0006;
  }
  return { x, y, r };
}
export function camAt(t) {
  let s = { ...CAM0 };
  for (const [t0, t1, to, e] of [...MOVES, ...ACT2_MOVES]) {
    if (t <= t0) break;
    const u = e(clamp((t - t0) / (t1 - t0)));
    const lz = lerp(Math.log(s.z), Math.log(to.z ?? s.z), u);
    // zoom-aware pan: interpolate position weighted by 1/zoom so big zooms feel like a dolly
    const z0 = s.z, z1 = to.z ?? s.z, z = Math.exp(lz);
    let k = u;
    if (Math.abs(z1 - z0) > 0.05) k = (1 / z - 1 / z0) / (1 / z1 - 1 / z0);
    s = { x: lerp(s.x, to.x ?? s.x, k), y: lerp(s.y, to.y ?? s.y, k), z, r: lerp(s.r, to.r ?? s.r, u) };
  }
  // hand-held drift: never perfectly still
  const sh = shake(t);
  s.x += (ns(t * 0.21, 1) * 7 + sh.x) / s.z;
  s.y += (ns(t * 0.17, 2) * 7 + sh.y) / s.z;
  s.r += ns(t * 0.13, 3) * 0.003 + sh.r;
  s.z *= 1 + ns(t * 0.11, 4) * 0.006;
  return s;
}

// extra sub-frames where objects (not the camera) move fast
export function blurBoost(t) {
  let b = 0;
  for (const [a, z] of [[4.62, 5.3], [7.84, 8.35], [18.15, 18.75], [20.55, 21.8], [36.1, 37.0]]) if (t > a && t < z) b = Math.max(b, 30);
  return b + rocketBoost(t);
}

// 0 = cool textbook grey, 1 = warm gold
export function mood(t) {
  const keys = [[0, 0], [4.6, 0.05], [6, 0.3], [25, 0.5], [50, 0.62], [55.5, 0.6], [57.5, 0.15], [60.4, 0.12], [61.5, 0.6], [84, 0.82], [86.5, 1], [90, 1]];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) return lerp(keys[i - 1][1], keys[i][1], E.sine((t - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0])));
  }
  return 1;
}

function viewBox(cam) {
  const rw = (W / 2 / cam.z) * 1.25, rh = (H / 2 / cam.z) * 1.25;
  return { x0: cam.x - rw, x1: cam.x + rw, y0: cam.y - rh, y1: cam.y + rh };
}
export function drawWorld(c, t) {
  const v = viewBox(c.cam);
  drawAct1(c, t, v);
  drawAct2(c, t, v);
}

// ---------------------------------------------------------------- foreground (screen space)
const ERASER = (() => {
  const cv = document.createElement('canvas');
  cv.width = 260; cv.height = 140;
  const x = cv.getContext('2d');
  x.translate(130, 70);
  x.rotate(-0.2);
  x.fillStyle = '#e9a7a0';
  x.fillRect(-100, -38, 200, 76);
  x.fillStyle = '#4f6f8c';
  x.fillRect(10, -38, 90, 76);
  x.fillStyle = 'rgba(255,255,255,0.35)';
  x.fillRect(-100, -38, 200, 12);
  x.strokeStyle = '#2b2622'; x.lineWidth = 4; x.lineJoin = 'round';
  x.strokeRect(-100, -38, 200, 76);
  x.beginPath(); x.moveTo(10, -38); x.lineTo(10, 38); x.stroke();
  return cv;
})();

export function drawFront(ctx, t, cam, toScreen) {
  // drifting graphite dust, closer to the lens than the paper (parallax 1.6x, soft)
  for (let i = 0; i < 18; i++) {
    const px = hash(i * 3) * 6000 - 1000, py = hash(i * 3 + 1) * 9000 - 2500;
    const f = 1.5 + hash(i * 7) * 0.8;
    let sx = W / 2 + (px - cam.x) * cam.z * f + ns(t * 0.2, i) * 40;
    let sy = H / 2 + (py - cam.y) * cam.z * f + ns(t * 0.17, i + 50) * 40 - t * 6;
    sx = ((sx % (W + 200)) + W + 200) % (W + 200) - 100;
    sy = ((sy % (H + 200)) + H + 200) % (H + 200) - 100;
    const r = 1.5 + hash(i * 11) * 3;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 3);
    g.addColorStop(0, 'rgba(60,50,40,0.07)');
    g.addColorStop(1, 'rgba(60,50,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(sx, sy, r * 3, 0, TAU); ctx.fill();
  }
  // the eraser
  if (t > ERASE.t0 - 0.4 && t < ERASE.t1 + 0.5) {
    const e = eraserAt(clamp(t, ERASE.t0, ERASE.t1));
    let [sx, sy] = toScreen(cam, e.x, e.y);
    const inK = E.expoOut(clamp((t - (ERASE.t0 - 0.4)) / 0.4));
    const outK = E.expoIn(clamp((t - ERASE.t1) / 0.45));
    sx = lerp(W + 200, sx, inK) + outK * 700;
    sy = lerp(sy + 200, sy, inK) - outK * 300;
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.translate(sx + 26, sy + 30);
    ctx.filter = 'blur(8px)';
    ctx.drawImage(ERASER, -130, -70);
    ctx.restore();
    ctx.save();
    ctx.translate(sx, sy - 20);
    ctx.rotate(Math.sin(t * 42) * 0.06);
    ctx.drawImage(ERASER, -60, -90);
    ctx.restore();
  }
}
