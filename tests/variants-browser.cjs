'use strict';
// Third-round checks only: v2 rule changes, native drawing, v2 import/export.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),local=path.join(root,'.local');fs.mkdirSync(path.join(local,'tmp'),{recursive:true});
process.env.TMP=process.env.TEMP=process.env.TMPDIR=path.join(local,'tmp');
const {chromium}=require('playwright');
const {solutions,failures}=require('./fixtures.cjs'),example=require('../docs/examples/variant.json');
const URL=process.env.GAME_URL || 'http://127.0.0.1:4173/';
const executablePath=process.env.BROWSER_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/chromium','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(file=>fs.existsSync(file));
let browser;
(async()=>{
  for(const file of ['','schemas/level-v2.schema.json','docs/LEVEL_FORMAT.md']) assert.equal((await fetch(URL+file)).ok,true,`Missing static resource ${file}`);
  browser=await chromium.launch({executablePath,headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:1000},acceptDownloads:true});
  const page=await context.newPage(),errors=[],results=[],screenshots=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
  await page.goto(URL+'#level=10',{waitUntil:'networkidle'});await page.waitForFunction(()=>Boolean(window.rescueDebug));
  const snapshot=()=>page.evaluate(()=>rescueDebug.snapshot());
  async function draw(points) {
    await page.locator('#game-canvas').scrollIntoViewIfNeeded();
    const box=await page.locator('#game-canvas').boundingBox(),xy=([x,y])=>({x:box.x+x/720*box.width,y:box.y+y/480*box.height});
    const first=xy(points[0]);await page.mouse.move(first.x,first.y);await page.mouse.down();
    for(const point of points.slice(1)){const p=xy(point);await page.mouse.move(p.x,p.y,{steps:18});}
    await page.mouse.up();const state=await snapshot();assert.equal(state.validation.valid,true,JSON.stringify(state));
  }
  async function capture(name) {
    const file=path.join(local,name);await page.locator('#canvas-wrap').screenshot({path:file});screenshots.push(file);
  }
  for(const id of [10,11,12,13]) {
    if(id===10) {
      await page.locator('#open-library').click();await page.locator('#import-file').setInputFiles(path.join(root,'docs/examples/variant.json'));
      await page.waitForFunction(()=>rescueDebug.snapshot().customKey && rescueDebug.snapshot().level===201);
    } else {
      await page.locator('#chapter-variant').click();await page.locator(`[data-level="${id}"]`).click();
    }
    assert.equal(await page.locator('#rule-status').isVisible(),true);
    const preview=await page.locator('#rule-status').textContent();
    await draw(solutions[id-1]);
    if(id===11) {assert.equal((await snapshot()).validation.anchorCount,2);assert.match(await page.locator('#rule-status').textContent(),/2\/2/);}
    await page.locator('#test-button').click();
    if(id===10) await page.waitForFunction(()=>rescueDebug.snapshot().rules.removedTerrain.includes(2),null,{timeout:5000});
    if(id===11) {await page.waitForFunction(()=>rescueDebug.snapshot().elapsed>1200);await capture('variant-hanging-live.png');}
    if(id===12) {await page.waitForFunction(()=>rescueDebug.snapshot().rules.gravity.x===1,null,{timeout:5000});await capture('variant-gravity-live.png');}
    if(id===13) {await page.waitForFunction(()=>rescueDebug.snapshot().rules.dropImpact,null,{timeout:5000});await capture('variant-ball-live.png');}
    await page.waitForFunction(()=>rescueDebug.snapshot().mode==='result',null,{timeout:11000});
    const state=await snapshot();assert.equal(state.outcome.success,true,JSON.stringify(state));
    results.push({ruleSource:id,playedId:state.level,preview,changedUI:await page.locator('#rule-status').textContent(),...state.outcome,rules:state.rules});
    if(id===10) {
      const wait=page.waitForEvent('download');await page.locator('#export-button').click();const download=await wait;
      const file=path.join(local,'v2-import-export.json');await download.saveAs(file);assert.deepEqual(JSON.parse(fs.readFileSync(file,'utf8')),example);
      await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>Boolean(window.rescueDebug));assert.equal((await snapshot()).level,201);assert.ok((await snapshot()).customKey);
    }
  }
  await page.locator('#reset-button').click();await draw(failures[12]);await page.locator('#test-button').click();
  await page.waitForFunction(()=>rescueDebug.snapshot().mode==='result',null,{timeout:11000});
  let state=await snapshot();assert.equal(state.outcome.success,false);assert.equal(state.outcome.code,'impact');assert.match(await page.locator('#result-reason').textContent(),/落球/);
  results.push({ruleSource:13,naiveFailure:true,...state.outcome});
  await page.locator('#test-button').click();state=await snapshot();assert.equal(state.mode,'ready');assert.equal(state.rules,null);assert.equal(state.points.length,0);
  await page.setViewportSize({width:390,height:844});await page.locator('#chapter-variant').click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await page.locator('#rule-status').isVisible(),true);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,url:URL,results,v2ImportExportRoundTrip:true,resetClearsDynamicWorld:true,narrowScreenNoOverflow:true,screenshots,errors},null,2));
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await browser?.close()});
