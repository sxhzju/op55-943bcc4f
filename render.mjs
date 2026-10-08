// Full render: N headless Chrome workers render contiguous frame ranges, each streams PNGs
// into its own x264 encoder; segments are concatenated and muxed with the original narration.
//   node render.mjs [--workers 8] [--out op55-hd.mp4] [--from 0 --to 2682]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { serve, ROOT } from './tools/server.mjs';
import { openRenderer, grab } from './tools/browser.mjs';
import { SUBS, subText } from './src/subs.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const WORKERS = parseInt(arg('workers', String(Math.max(2, Math.min(8, Math.floor(os.cpus().length / 2))))), 10);
const OUTFILE = path.join(ROOT, arg('out', 'op55-hd.mp4'));
const AUDIO = path.join(ROOT, 'original.mp3');
const TMP = path.join(ROOT, 'out', 'segments');

// ---------------------------------------------------------------- 1. subtitles must match the SRT verbatim
function parseSrt(txt) {
  const ts = (s) => { const [h, m, r] = s.split(':'); const [sec, ms] = r.split(','); return +h * 3600 + +m * 60 + +sec + +ms / 1000; };
  return txt.replace(/\r/g, '').trim().split(/\n\n+/).map((b) => {
    const l = b.split('\n');
    const [a, z] = l[1].split(' --> ');
    return { s: ts(a.trim()), e: ts(z.trim()), text: l.slice(2).join('') };
  });
}
const srt = parseSrt(fs.readFileSync(path.join(ROOT, 'subtitles.srt'), 'utf8'));
if (srt.length !== SUBS.length) throw new Error(`SRT has ${srt.length} cues, design has ${SUBS.length}`);
srt.forEach((c, i) => {
  const mine = subText(SUBS[i]);
  if (mine !== c.text) throw new Error(`subtitle ${i + 1} text mismatch:\n  srt:    ${c.text}\n  design: ${mine}`);
  if (Math.abs(SUBS[i].s - c.s) > 0.002 || Math.abs(SUBS[i].e - c.e) > 0.002) throw new Error(`subtitle ${i + 1} timing mismatch`);
});
console.log(`✓ ${srt.length} subtitles match subtitles.srt`);

// ---------------------------------------------------------------- 2. render
fs.mkdirSync(TMP, { recursive: true });
for (const f of fs.readdirSync(TMP)) fs.unlinkSync(path.join(TMP, f));
const { srv, url } = await serve();
const probe = await openRenderer(url);
const TOTAL = probe.info.frames;
await probe.browser.close();
const F0 = parseInt(arg('from', '0'), 10), F1 = parseInt(arg('to', String(TOTAL)), 10);
console.log(`rendering frames ${F0}..${F1 - 1} of ${TOTAL} with ${WORKERS} workers`);

let done = 0;
const t0 = Date.now();
async function worker(k, a, b) {
  const seg = path.join(TMP, `seg_${String(k).padStart(2, '0')}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-tune', 'grain',
    '-x264-params', 'keyint=60:min-keyint=60:scenecut=0', '-r', '30', seg], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done$ = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));
  const { browser, page } = await openRenderer(url);
  for (let f = a; f < b; f++) {
    const { buf } = await grab(page, f);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    done++;
    if (done % 60 === 0) {
      const el = (Date.now() - t0) / 1000;
      console.log(`  ${done}/${F1 - F0} frames  ${el.toFixed(0)}s elapsed  ~${((el / done) * (F1 - F0 - done)).toFixed(0)}s left`);
    }
  }
  ff.stdin.end();
  await browser.close();
  await done$;
  return seg;
}
const per = Math.ceil((F1 - F0) / WORKERS);
const segs = await Promise.all(Array.from({ length: WORKERS }, (_, k) => {
  const a = F0 + k * per, b = Math.min(F1, a + per);
  return a < b ? worker(k, a, b) : null;
}));
srv.close();

// ---------------------------------------------------------------- 3. concat + mux narration (from 0 s, untouched)
const list = path.join(TMP, 'list.txt');
fs.writeFileSync(list, segs.filter(Boolean).map((s) => `file '${s}'`).join('\n'));
const mux = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list];
const full = F0 === 0 && F1 === TOTAL && fs.existsSync(AUDIO);
if (full) mux.push('-i', AUDIO, '-map', '0:v:0', '-map', '1:a:0', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000');
mux.push('-c:v', 'copy', '-movflags', '+faststart', OUTFILE);
const r = spawnSync('ffmpeg', mux, { stdio: 'inherit' });
if (r.status !== 0) throw new Error('mux failed');
console.log(`✓ wrote ${path.relative(ROOT, OUTFILE)} in ${((Date.now() - t0) / 1000).toFixed(0)}s${full ? '' : ' (partial, no audio)'}`);
process.exit(0);
