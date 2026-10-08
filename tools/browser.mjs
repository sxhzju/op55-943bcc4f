// Launches local Chrome (puppeteer-core) and opens the renderer page.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean);

export async function openRenderer(baseUrl) {
  const executablePath = CANDIDATES.find((p) => fs.existsSync(p));
  if (!executablePath) throw new Error('Chrome not found; set CHROME_PATH');
  const browser = await puppeteer.launch({
    executablePath, headless: true,
    args: ['--no-sandbox', '--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none', '--hide-scrollbars'],
    defaultViewport: { width: 1080, height: 1440, deviceScaleFactor: 1 },
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('[page]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('[console]', m.text()); });
  await page.goto(`${baseUrl}/src/index.html`, { waitUntil: 'load' });
  const info = await page.evaluate(() => window.__ready);
  return { browser, page, info };
}

export async function grab(page, frame, opts = {}) {
  const K = await page.evaluate((f, o) => window.__frame(f, o), frame, opts);
  const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1080, height: 1440 }, optimizeForSpeed: true });
  return { buf, K };
}
