'use strict';
// Real local page + native pointer events; never inject solutions into the game state.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const local = path.join(root, '.local');
fs.mkdirSync(path.join(local, 'tmp'), { recursive: true });
process.env.TMP = process.env.TEMP = process.env.TMPDIR = path.join(local, 'tmp');
const { chromium } = require('playwright');
const { levels } = require('../js/levels.js');
const batch = levels.filter(l => String(l.id).startsWith('remix/'));
const url = process.env.GAME_URL || 'http://127.0.0.1:4173/';
const executablePath = process.env.BROWSER_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].find(f => fs.existsSync(f));
const retries = new Set([4, 8, 16, 24]);
let browser;
(async () => {
  browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await context.newPage();
  const errors = [], results = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url + '#level=' + encodeURIComponent(batch[0].id), { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.rescueDebug));
  const snapshot = () => page.evaluate(() => rescueDebug.snapshot());
  assert.equal((await snapshot()).level, batch[0].id, '新关直达路由有效');
  await page.locator('#refresh-catalog').click();
  await page.waitForFunction(() => !document.getElementById('refresh-catalog').disabled);
  assert.equal((await snapshot()).catalog.ids.filter(id => String(id).startsWith('remix/')).length, 24);
  assert.deepEqual((await snapshot()).catalog.errors, []);
  async function draw(stroke) {
    await page.locator('#game-canvas').scrollIntoViewIfNeeded();
    const box = await page.locator('#game-canvas').boundingBox();
    const xy = ([x, y]) => ({ x: box.x + x / 720 * box.width, y: box.y + y / 480 * box.height });
    const start = xy(stroke[0]);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    for (const p of stroke.slice(1)) {
      const next = xy(p);
      await page.mouse.move(next.x, next.y, { steps: 18 });
    }
    await page.mouse.up();
    assert.equal((await snapshot()).validation?.valid, true, JSON.stringify(await snapshot()));
  }
  async function run(expected) {
    await page.locator('#test-button').click();
    await page.waitForFunction(() => rescueDebug.snapshot().mode === 'result', null, { timeout: 15000 });
    const s = await snapshot();
    assert.equal(s.outcome.success, expected, JSON.stringify(s));
    results.push({ id: s.level, expected, outcome: s.outcome, modules: s.modules });
    console.log(`${expected ? 'WIN' : 'FAILURE+RETRY'} ${s.level}`);
    return s;
  }
  // Discover every new level from its real chapter/card, then play one complete 5-second trial.
  for (const l of batch) {
    await page.locator(`[data-chapter="${l.chapter}"]`).click();
    await page.locator(`[data-level="${l.id}"]`).click();
    assert.equal((await snapshot()).level, l.id);
    const cases = JSON.parse(fs.readFileSync(path.join(root, 'tests/cases', `${l.id}.cases.json`), 'utf8')).cases;
    if (retries.has(l.progression.order)) {
      await draw(cases.find(c => c.expected === 'failure').stroke);
      await run(false);
      await page.locator('#reset-button').click();
      assert.equal((await snapshot()).points.length, 0);
      assert.equal((await snapshot()).outcome, null);
    }
    await draw(cases.find(c => c.expected === 'success').stroke);
    if (l.progression.order === 13) await page.screenshot({ path: path.join(local, 'remix-watershed-ready.png') });
    const result = await run(true);
    if (l.progression.order === 16) assert.equal(result.modules.find(m => m.type === 'lab/trigger-lift').triggered, false);
    if (l.progression.order === 24) assert.equal(result.modules.find(m => m.type === 'lab/trigger-lift').triggered, true);
  }
  await page.screenshot({ path: path.join(local, 'remix-finale-win.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#reset-button').click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.equal((await snapshot()).points.length, 0);
  await page.screenshot({ path: path.join(local, 'remix-mobile-ready.png'), fullPage: true });
  assert.deepEqual(errors, []);
  const evidence = { url, passed: true, discovered: 24, nativePointerWins: 24, failureAndRetry: [...retries], narrowNoOverflow: true, results, errors };
  fs.writeFileSync(path.join(local, 'remix-browser-evidence.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ ...evidence, results: `${results.length} trials; details in .local/remix-browser-evidence.json` }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); });
