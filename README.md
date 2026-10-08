# 人民币反教科书 · 成品配音短版

A 89.4 s hand-drawn motion piece (1080×1440, 30 fps), rendered frame by frame from an HTML canvas.

## Concept

**A red pencil traces a textbook's "standard answer" (the yuan goes down), then refuses it.** One unbroken vermilion line (the yuan) climbs a single sheet of paper. It draws the trade-surplus bars, turns into chip traces, passes through a 结汇 funnel, wraps a CIPS globe, scribbles a QR code and finally gets lifted off the page by four balloons, the real-world forces. Halfway through, the camera pulls back to show that the whole journey *is* the chart: a rising line, with the textbook's grey prediction crossed out in the corner. The textbook view is always graphite and the forces are always red. The whole film is one camera move over one sheet of paper, with no cuts.

The storyboard, palette and every transition ("what turns into what") are in [`TREATMENT.md`](TREATMENT.md).

## Re-render

Requirements: Node ≥ 18, `ffmpeg` on `PATH`, and a local Google Chrome or Chromium (set `CHROME_PATH` if it is not at the default macOS location).

```bash
npm ci
# put the narration next to the subtitles (not committed): original.mp3
node render.mjs                # → op55-hd.mp4  (H.264 yuv420p, 1080×1440, 30 fps, AAC)
node render.mjs --workers 4    # fewer parallel Chrome instances
```

`render.mjs` first checks that the subtitle design in `src/subs.js` matches `subtitles.srt` exactly, in both text and timing. It then splits the frames across N headless Chrome workers. Each worker streams PNG frames into its own x264 encoder. Finally, the segments are concatenated and muxed with `original.mp3`, starting at 0 s at the original speed, re-encoded to AAC only. Intermediate files go to `out/`, which git ignores.

Preview tools for checking motion without a full render:

```bash
node tools/preview.mjs frames 4.6 8.0            # single frames → out/preview/
node tools/preview.mjs strip 4.4 5.8 2 kink      # every 2nd frame across a transition, tiled
node tools/preview.mjs sheet 0 89.4 0.5 flow     # one frame per 0.5 s, tiled
```

You can also serve the repo (`node -e "import('./tools/server.mjs').then(m=>m.serve().then(s=>console.log(s.url)))"`) and open `/src/index.html?t=12.5` (one moment) or `?play` (rough real-time playback without motion blur).

## How it works

| file | role |
|---|---|
| `src/engine.js` | easing (expo/back/springs/custom béziers), deterministic noise, boiling variable-width strokes, watercolor washes, hand-written text |
| `src/pen.js` | registry of every stroke the red pencil draws; the pencil sprite follows the drawing point, travels lifted between strokes, and steps out of frame when idle |
| `src/act1.js` | 0–55 s: textbook → bars → chip → 结汇 → CIPS globe → eraser → reserves jar → phone/QR → overview |
| `src/act2.js` | 55–89 s: the coin, the "美联储加息" weight, four balloons, the launch and the title |
| `src/story.js` | camera route (with zoom-aware dolly interpolation and hand-held drift), light temperature, motion-blur hints, foreground dust and eraser |
| `src/subs.js` | the six subtitles as kinetic typography, each synced chunk-by-chunk to the narration |
| `src/main.js` | layer compositing (paper, wash, graphite, ink, text), paper-tooth texture, sub-frame accumulation motion blur, grade, grain |

Time is the only input: every frame is a pure function of its frame number, so any frame can be rendered alone and in any order. The line boil changes every 2–3 frames (12 drawings/s). The camera moves on every frame. Fast moves get 2–16 accumulated sub-frames of motion blur.

Timing comes from the narration. Pauses and energy were measured with `ffmpeg -af astats` / `silencedetect`, and word-level timestamps came from a local Whisper pass. These numbers are written straight into the cue times in `src/*.js`, so the audio is not needed to reproduce the picture.

## Assets & licenses

- `assets/fonts/LXGWWenKai-Medium.ttf`: LXGW WenKai (霞鹜文楷) v1.522, SIL Open Font License 1.1 (`assets/fonts/LXGWWenKai-OFL.txt`). Shipped unmodified.
- `assets/fonts/ZCOOLKuaiLe-Regular.ttf`: ZCOOL KuaiLe (站酷快乐体), SIL Open Font License 1.1 (`assets/fonts/ZCOOLKuaiLe-OFL.txt`).
- Everything else (paper, grain, pencil, eraser, all drawings) is generated procedurally in code. No images or music are used.

The MP4, the narration and `.op55/` are not in the repository (see `.gitignore`).
