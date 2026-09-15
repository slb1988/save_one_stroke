'use strict';
// Focused second-round acceptance; does not replay the nine-level matrix.
const fs = require('node:fs'), path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'..'), local = path.join(root,'.local');
fs.mkdirSync(path.join(local,'tmp'),{recursive:true});
process.env.TMP = process.env.TEMP = process.env.TMPDIR = path.join(local,'tmp');
const {chromium} = require('playwright');
const example = require('../docs/examples/level.json');
const {cases} = require('../docs/examples/level.cases.json');
const URL = process.env.GAME_URL || 'http://127.0.0.1:5178/';
const executablePath = process.env.BROWSER_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/chromium','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(file=>fs.existsSync(file));
let browser;
(async()=>{
  const response = await fetch(URL); assert.equal(response.ok,true,'Start the existing static server before this test.');
  browser = await chromium.launch({executablePath,headless:true});
  const context = await browser.newContext({viewport:{width:1280,height:1000},acceptDownloads:true});
  const page = await context.newPage(), errors=[], dialogs=[], checks=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  page.on('dialog',async dialog=>{dialogs.push(dialog.type());await dialog.dismiss()});
  await page.goto(URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(window.rescueDebug));
  const snap = ()=>page.evaluate(()=>rescueDebug.snapshot());
  assert.equal((await snap()).level,1);
  await page.locator('#open-library').click();
  await page.locator('#import-file').setInputFiles(path.join(root,'docs/examples/level.json'));
  await page.waitForFunction(()=>rescueDebug.snapshot().customKey && rescueDebug.snapshot().level===101);
  let state=await snap(); const localKey=state.customKey;
  assert.equal(state.savedLevels.length,1); assert.equal(await page.locator('#library-dialog').isVisible(),false);
  assert.match(await page.locator('#custom-warning').textContent(),/尚未验证可解/);
  checks.push('Complete Markdown example imports, validates and saves under an isolated local key.');

  // Native mouse path, not internal state injection or a forced result.
  await page.locator('#game-canvas').scrollIntoViewIfNeeded();
  const box=await page.locator('#game-canvas').boundingBox();
  const xy=([x,y])=>({x:box.x+x/720*box.width,y:box.y+y/480*box.height});
  const stroke=cases[0].stroke, first=xy(stroke[0]);
  await page.mouse.move(first.x,first.y); await page.mouse.down();
  for(const value of stroke.slice(1)){const p=xy(value);await page.mouse.move(p.x,p.y,{steps:18});}
  await page.mouse.up(); assert.equal((await snap()).validation.valid,true);
  await page.locator('#test-button').click();
  await page.waitForFunction(()=>rescueDebug.snapshot().mode==='result',null,{timeout:11000});
  state=await snap(); assert.equal(state.outcome.success,true,JSON.stringify(state.outcome));
  const outcome=state.outcome;
  assert.match(await page.locator('#total-stars').textContent(),new RegExp(`^0\\s*/\\s*${require('../levels/manifest.json').files.length*3}$`));
  const pending=page.waitForEvent('download'); await page.locator('#export-button').click();
  const download=await pending, exported=path.join(local,'import-export-level.json');
  await download.saveAs(exported); assert.deepEqual(JSON.parse(fs.readFileSync(exported,'utf8')),example);
  checks.push('Native mouse draw → 5000ms same-engine success → actual JSON download, deeply equal to the source; built-in stars remain unchanged.');
  await page.reload({waitUntil:'networkidle'}); await page.waitForFunction(()=>Boolean(window.rescueDebug));
  state=await snap(); assert.equal(state.customKey,localKey); assert.equal(state.level,101); assert.equal(state.savedLevels.length,1);
  assert.match(await page.locator('#personal-stars').textContent(),/★/);
  await page.locator('#chapter-beginner').click(); await page.locator('#open-library').click();
  await page.locator('#play-saved').click(); assert.equal((await snap()).customKey,localKey);
  await page.locator('#open-library').click(); await page.locator('#import-file').setInputFiles(path.join(root,'docs/examples/level.json'));
  await page.locator('#library-dialog').waitFor({state:'hidden'}); assert.equal((await snap()).savedLevels.length,1);
  checks.push('Reload restores imported level and its score; saved-level picker reopens it; identical reimport is deduplicated.');

  await page.locator('#open-library').click();
  const bad = async (source,needle)=>{
    await page.locator('#import-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(source)});
    await page.waitForFunction(text=>document.getElementById('import-feedback').textContent.includes(text),needle);
    const now=await snap(); assert.equal(now.customKey,localKey); assert.equal(now.savedLevels.length,1); assert.equal(now.mode,'ready');
  };
  await bad('{oops','JSON 语法错误');
  await bad(JSON.stringify({...example,onWin:'alert(1)'}),'不支持的字段');
  await bad(JSON.stringify({...example,version:8}),'版本 1');
  await bad('x'.repeat(65537),'64 KiB');
  checks.push('Malformed JSON, callback fields, unsupported versions and oversized files show friendly errors without replacing the active level or saved library.');

  // Accepted text stays inert even when it resembles HTML; id=1 cannot shadow a built-in.
  const textLevel={...example,id:1,title:'<img src=x onerror=alert(1)>'};
  await page.locator('#import-file').setInputFiles({name:'text-only.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(textLevel))});
  await page.locator('#library-dialog').waitFor({state:'hidden'});
  assert.equal(await page.locator('#level-title').textContent(),textLevel.title);
  assert.equal(await page.locator('#level-title img').count(),0); assert.equal((await snap()).savedLevels.length,2);
  await page.locator('#chapter-beginner').click(); assert.equal((await snap()).customKey,null);
  assert.equal(await page.locator('#level-title').textContent(),'少了一条腿');
  checks.push('HTML-looking text remains plain text; imported id=1 does not replace built-in level 1.');

  await page.setViewportSize({width:390,height:844});
  await page.locator('#open-library').click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('#saved-level-select').selectOption(localKey); await page.locator('#play-saved').click();
  assert.equal((await snap()).level,101);
  await page.screenshot({path:path.join(local,'imported-level-mobile.png'),fullPage:true});
  checks.push('390px layout and native saved-level selection remain usable.');
  assert.deepEqual(errors,[]); assert.deepEqual(dialogs,[]);
  console.log(JSON.stringify({passed:true,url:URL,checks,outcome,exported,screenshot:path.join(local,'imported-level-mobile.png'),errors},null,2));
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await browser?.close()});
