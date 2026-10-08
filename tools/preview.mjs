// Motion checks without a full render.
//   node tools/preview.mjs frames 4.2 5.0 6.1          -> out/preview/t_<time>.png
//   node tools/preview.mjs strip 4.4 5.6 2 [name]      -> 12-ish frames every N frames, tiled (motion strip)
//   node tools/preview.mjs sheet 0 89.4 0.5 [name]     -> one frame every 0.5 s, tiled (flow overview)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { serve, ROOT } from './server.mjs';
import { openRenderer, grab } from './browser.mjs';

const [mode, ...a] = process.argv.slice(2);
const OUT = path.join(ROOT, 'out', 'preview');
fs.mkdirSync(OUT, { recursive: true });
const { srv, url } = await serve();
const { browser, page } = await openRenderer(url);
const FONT = path.join(ROOT, 'assets/fonts/LXGWWenKai-Medium.ttf');

async function frames(list, dir, opts) {
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
  let i = 0;
  for (const f of list) {
    const t0 = Date.now();
    const { buf, K } = await grab(page, f, opts);
    fs.writeFileSync(path.join(dir, `f_${String(i++).padStart(4, '0')}.png`), buf);
    process.stdout.write(`frame ${f} (${(f / 30).toFixed(2)}s) K=${K} ${Date.now() - t0}ms\n`);
  }
}
function tile(dir, cols, rows, outFile, list, scale = 270) {
  const vf = `scale=${scale}:-1,drawtext=fontfile='${FONT}':text='%{metadata\\:t}':x=8:y=8:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.5,tile=${cols}x${rows}:padding=4:color=gray`;
  // write per-frame time labels via sidecar: simpler to label with frame index
  const labels = list.map((f) => (f / 30).toFixed(2));
  const tmp = path.join(dir, 'labeled');
  fs.mkdirSync(tmp, { recursive: true });
  labels.forEach((lab, i) => {
    const src = path.join(dir, `f_${String(i).padStart(4, '0')}.png`);
    spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-vf', `scale=${scale}:-1,drawtext=fontfile='${FONT}':text='${lab}s':x=6:y=6:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.55`, path.join(tmp, `l_${String(i).padStart(4, '0')}.png`)]);
  });
  spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(tmp, 'l_%04d.png'), '-vf', `tile=${cols}x${rows}:padding=4:color=gray`, '-frames:v', '1', outFile], { stdio: 'inherit' });
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (mode === 'frames') {
  for (const s of a) {
    const f = Math.round(parseFloat(s) * 30);
    const { buf, K } = await grab(page, f);
    fs.writeFileSync(path.join(OUT, `t_${s}.png`), buf);
    console.log('wrote', s, 'K=', K);
  }
} else if (mode === 'strip' || mode === 'sheet') {
  const t0 = parseFloat(a[0]), t1 = parseFloat(a[1]);
  const name = a[3] || `${mode}_${a[0]}_${a[1]}`;
  let list = [];
  if (mode === 'strip') {
    const step = parseInt(a[2] || '2', 10);
    for (let f = Math.round(t0 * 30); f <= Math.round(t1 * 30); f += step) list.push(f);
  } else {
    const dt = parseFloat(a[2] || '0.5');
    for (let t = t0; t <= t1 + 1e-6; t += dt) list.push(Math.round(t * 30));
  }
  const dir = path.join(OUT, 'tmp_' + name);
  await frames(list, dir, mode === 'sheet' ? {} : {});
  const cols = mode === 'strip' ? Math.min(6, list.length) : 10;
  const rows = Math.ceil(list.length / cols);
  tile(dir, cols, rows, path.join(OUT, `${name}.png`), list, mode === 'strip' ? 300 : 180);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('wrote', path.join(OUT, `${name}.png`));
}
await browser.close();
srv.close();
