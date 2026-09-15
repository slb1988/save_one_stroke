'use strict';
// Isolated real-Chromium acceptance. No access to user browser profiles.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const local = path.join(ROOT, '.local');
fs.mkdirSync(path.join(local, 'tmp'), { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = path.join(local, 'tmp');
const { chromium } = require('playwright');
const { solutions, failures } = require('./fixtures.cjs');
const URL = process.env.GAME_URL || 'http://127.0.0.1:4173/';
const errors = [], evidence = { desktop: [], mobile: {}, checks: [], screenshots: [], intentionalOfflineIconRevalidations: 0 };
let browser, ownServer;
const executablePath = process.env.BROWSER_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].find(filename => fs.existsSync(filename));

async function draw(page, points) {
  await page.locator('#game-canvas').scrollIntoViewIfNeeded();
  const box = await page.locator('#game-canvas').boundingBox();
  const xy = ([x,y]) => ({ x:box.x + x / 720 * box.width, y:box.y + y / 480 * box.height });
  const start = xy(points[0]); await page.mouse.move(start.x, start.y); await page.mouse.down();
  for (let i = 1; i < points.length; i++) { const p = xy(points[i]); await page.mouse.move(p.x, p.y, {steps:18}); }
  await page.mouse.up();
  const state = await page.evaluate(() => rescueDebug.snapshot());
  assert.ok(state.points.length >= 2); assert.equal(state.drawing, false); assert.equal(state.validation.valid, true, JSON.stringify(state));
  assert.equal(await page.locator('#test-button').isEnabled(), true);
  return state;
}
async function sit(page, success) {
  await page.locator('#test-button').click();
  assert.equal((await page.evaluate(() => rescueDebug.snapshot())).mode, 'running');
  await page.waitForFunction(() => rescueDebug.snapshot().mode === 'result', null, {timeout:11000});
  const state = await page.evaluate(() => rescueDebug.snapshot());
  assert.equal(state.outcome.success, success, JSON.stringify(state));
  assert.equal(await page.locator('#result-panel').isVisible(), true);
  return { level:state.level, points:state.points.length, ...state.outcome };
}
async function screenshot(page, name) {
  await page.locator('#result-panel').evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
  const filename = path.join(local, name); await page.screenshot({path:filename, fullPage:true}); evidence.screenshots.push(filename);
}
(async () => {
  try { await fetch(URL + 'health'); }
  catch { ownServer = spawn(process.execPath, [path.join(ROOT, 'scripts/serve.cjs')], {cwd:ROOT, stdio:'ignore'}); await new Promise(resolve => setTimeout(resolve, 700)); }
  browser = await chromium.launch({executablePath, headless:true});
  const context = await browser.newContext({viewport:{width:1440,height:1060}, deviceScaleFactor:1});
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    // Chromium revalidates favicons when the hash changes. This deliberately
    // disconnected test blocks those requests too; no gameplay resource fails.
    if (message.text().includes('ERR_INTERNET_DISCONNECTED') && message.location().url === URL + 'assets/favicon.svg') evidence.intentionalOfflineIconRevalidations++;
    else errors.push(message.text());
  });
  await page.goto(URL, {waitUntil:'networkidle'});
  assert.equal(await page.locator('#level-title').textContent(), '少了一条腿');
  assert.equal(await page.locator('#test-button').isDisabled(), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await screenshot(page, 'desktop-ready.png');
  const resourceOrigins = await page.evaluate(() => [...new Set(performance.getEntriesByType('resource').map(r => new window.URL(r.name).origin))]);
  assert.deepEqual(resourceOrigins, [new global.URL(URL).origin]);
  await context.setOffline(true);
  evidence.checks.push('Runtime resources are all same-origin; five levels play with browser network offline.');

  for (let i = 0; i < solutions.length; i++) {
    await page.locator(`[data-level="${i + 1}"]`).click();
    await draw(page, solutions[i]);
    evidence.desktop.push(await sit(page, true));
  }
  assert.match(await page.locator('#stroke-status').textContent(), /全部获救/);
  await screenshot(page, 'desktop-graduated.png');
  await context.setOffline(false);
  await page.reload({waitUntil:'networkidle'});
  assert.equal(Object.keys((await page.evaluate(() => rescueDebug.snapshot())).records).length, 5);
  evidence.checks.push('5/5 mouse-drawn wins, graduation UI and localStorage survive reload.');
  await page.locator('[data-level="1"]').click();
  await draw(page, failures[0]); evidence.desktop.push(await sit(page, false));
  await page.locator('#test-button').click();
  let state = await page.evaluate(() => rescueDebug.snapshot());
  assert.equal(state.mode, 'ready'); assert.equal(state.points.length, 0);
  assert.equal(await page.locator('#ink-left').textContent(), '185');
  evidence.checks.push('Real mouse failure → result → one-click retry resets ink and geometry.');
  await page.locator('#hint-button').click(); await page.locator('#hint-button').click();
  assert.match(await page.locator('#hint-title').textContent(), /2 \/ 2/);
  await page.locator('#help-button').click(); assert.equal(await page.locator('#help-dialog').isVisible(), true); await page.locator('#got-it').click();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.locator('#share-button').click(); await page.locator('#toast').waitFor({state:'visible',timeout:5000});
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), URL + '#level=1');
  evidence.checks.push('Two-tier hints, modal help and actual copied challenge URL work.');

  // Actual Chromium touch input through its isolated CDP session, not JS event injection.
  const mobile = await browser.newContext({viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true});
  const phone = await mobile.newPage(); phone.on('pageerror', error => errors.push(error.message));
  await phone.goto(URL + '#level=3', {waitUntil:'networkidle'});
  assert.equal((await phone.evaluate(() => rescueDebug.snapshot())).level, 3);
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await phone.locator('#game-canvas').scrollIntoViewIfNeeded();
  const box = await phone.locator('#game-canvas').boundingBox();
  const cdp = await mobile.newCDPSession(phone);
  const point = ([x,y]) => ({x:box.x + x / 720 * box.width, y:box.y + y / 480 * box.height, radiusX:1,radiusY:1, force:1, id:1});
  await cdp.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[point(solutions[2][0])]});
  const [a,b] = solutions[2];
  for (let i = 1; i <= 22; i++) await cdp.send('Input.dispatchTouchEvent', {type:'touchMove',touchPoints:[point([a[0]+(b[0]-a[0])*i/22,a[1]+(b[1]-a[1])*i/22])]});
  await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]});
  state = await phone.evaluate(() => rescueDebug.snapshot());
  assert.equal(state.validation.valid, true, JSON.stringify(state)); assert.equal(state.drawing, false);
  evidence.mobile = {viewport:'390×844', input:'native touch (CDP Input.dispatchTouchEvent)', ...(await sit(phone, true))};
  await screenshot(phone, 'mobile-touch-win.png');
  await phone.locator('#reset-button').click();
  assert.equal((await phone.evaluate(() => rescueDebug.snapshot())).points.length, 0);
  await phone.setViewportSize({width:320,height:740});
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const buttonSizes = await phone.locator('.actions button').evaluateAll(nodes => nodes.map(n => ({w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height})));
  assert.ok(buttonSizes.every(b => b.h >= 44 && b.w >= 44));
  evidence.checks.push('390px native-touch draw → win → retry; 320px no horizontal overflow and all action targets ≥44px.');
  assert.deepEqual(errors, []); evidence.checks.push('No application/page errors; only explicitly accounted favicon revalidations are blocked during forced-offline testing.');
  evidence.passed = true; evidence.errors = errors;
  fs.writeFileSync(path.join(local,'browser-evidence.json'), JSON.stringify(evidence,null,2));
  console.log(JSON.stringify(evidence,null,2));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); ownServer?.kill(); });
