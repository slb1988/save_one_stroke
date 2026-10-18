'use strict';
// Simulates Via/Android old WebView: removes APIs added after Chromium 91
// (ctx.roundRect 99+, Object.hasOwn 93+, Array.prototype.at 92+) and requires
// a full draw → sit → win cycle with zero page errors and visible person/ink.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const local = path.join(ROOT, '.local');
fs.mkdirSync(path.join(local, 'tmp'), { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = path.join(local, 'tmp');
const { chromium } = require('playwright');
const { solutions } = require('./fixtures.cjs');
const URL = process.env.GAME_URL || 'http://127.0.0.1:4173/';
const errors = [];
let browser, ownServer;
const executablePath = process.env.BROWSER_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].find(filename => fs.existsSync(filename));

function countColor(rgb) {
  return page => page.evaluate(([r, g, b]) => {
    const canvas = document.getElementById('game-canvas');
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let found = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i] - r) < 12 && Math.abs(data[i + 1] - g) < 12 && Math.abs(data[i + 2] - b) < 12 && data[i + 3] > 200) found++;
    }
    return found;
  }, rgb);
}

(async () => {
  try { await fetch(URL + 'health'); }
  catch { ownServer = spawn(process.execPath, [path.join(ROOT, 'scripts/serve.cjs')], { cwd: ROOT, stdio: 'ignore' }); await new Promise(resolve => setTimeout(resolve, 700)); }
  browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    delete CanvasRenderingContext2D.prototype.roundRect; // Chromium < 99 (Via / old Android WebView)
    delete Object.hasOwn;                                // Chromium < 93
    delete Array.prototype.at;                           // Chromium < 92
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.rescueDebug));
  await page.waitForTimeout(300);

  const personPixels = await countColor([231, 140, 101])(page); // coral shirt of the seated dummy
  assert.ok(personPixels > 50, `person not rendered (coral pixels: ${personPixels})`);

  const box = await page.locator('#game-canvas').boundingBox();
  const xy = ([x, y]) => ({ x: box.x + x / 720 * box.width, y: box.y + y / 480 * box.height });
  const [from, to] = solutions[0], start = xy(from);
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  for (let i = 1; i <= 12; i++) { const p = xy([from[0] + (to[0] - from[0]) * i / 12, from[1] + (to[1] - from[1]) * i / 12]); await page.mouse.move(p.x, p.y, { steps: 4 }); }
  await page.mouse.up();
  await page.waitForTimeout(200);
  const state = await page.evaluate(() => rescueDebug.snapshot());
  assert.equal(state.validation.valid, true, JSON.stringify(state));
  const inkPixels = await countColor([73, 126, 104])(page); // #497e68 stroke core
  assert.ok(inkPixels > 50, `ink stroke not rendered (ink pixels: ${inkPixels})`);

  await page.locator('#test-button').click();
  await page.waitForFunction(() => rescueDebug.snapshot().mode === 'result', null, { timeout: 11000 });
  assert.equal((await page.evaluate(() => rescueDebug.snapshot())).outcome.success, true);
  await page.waitForTimeout(200);
  assert.equal(await page.locator('#js-error-banner').count(), 0, 'error banner appeared');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, personPixels, inkPixels, note: 'roundRect/Object.hasOwn/Array.at deleted to simulate Chromium 91 WebView; full draw->sit->win clean.' }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); ownServer?.kill(); });
