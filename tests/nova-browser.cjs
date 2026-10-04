'use strict';
// Isolated native-input acceptance. NOVA_LEVELS supports small representative batches.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),local=path.join(root,'.local');
fs.mkdirSync(path.join(local,'tmp'),{recursive:true});
process.env.TMP=process.env.TEMP=process.env.TMPDIR=path.join(local,'tmp');
const {chromium}=require('playwright'),{levels}=require('../js/levels.js');
const batch=levels.filter(l=>String(l.id).startsWith('nova/'));
const requested=process.env.NOVA_LEVELS?.split(',').map(Number);
const selected=requested?batch.filter(l=>requested.includes(l.progression.order)):batch;
const url=process.env.GAME_URL||'http://127.0.0.1:4173/';
const executablePath=process.env.BROWSER_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/chromium','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(f=>fs.existsSync(f));
const retries=new Set([1,7,13,19,25,31,37,43,49]);
let browser;
(async()=>{
 if(!requested)assert.equal(batch.length,54);else assert.equal(selected.length,requested.length,'每个指定关都必须可发现');
 browser=await chromium.launch({executablePath,headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:1000},acceptDownloads:true}),page=await context.newPage(),errors=[],results=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(url+'#level='+encodeURIComponent(selected[0].id),{waitUntil:'networkidle'});await page.waitForFunction(()=>Boolean(window.rescueDebug));
 const snapshot=()=>page.evaluate(()=>rescueDebug.snapshot());
 assert.equal((await snapshot()).level,selected[0].id);
 await page.locator('#refresh-catalog').click();await page.waitForFunction(()=>!document.getElementById('refresh-catalog').disabled);
 assert.equal((await snapshot()).catalog.ids.filter(id=>String(id).startsWith('nova/')).length,batch.length);
 assert.deepEqual((await snapshot()).catalog.errors,[]);
 async function draw(stroke){await page.locator('#game-canvas').scrollIntoViewIfNeeded();const box=await page.locator('#game-canvas').boundingBox(),xy=([x,y])=>({x:box.x+x/720*box.width,y:box.y+y/480*box.height}),p=xy(stroke[0]);await page.mouse.move(p.x,p.y);await page.mouse.down();for(const v of stroke.slice(1)){const q=xy(v);await page.mouse.move(q.x,q.y,{steps:18});}await page.mouse.up();assert.equal((await snapshot()).validation?.valid,true,JSON.stringify(await snapshot()));}
 async function run(expected){await page.locator('#test-button').click();await page.waitForFunction(()=>rescueDebug.snapshot().mode==='result',null,{timeout:15000});const s=await snapshot();assert.equal(s.outcome.success,expected,JSON.stringify(s));results.push({id:s.level,expected,outcome:s.outcome,modules:s.modules});console.log((expected?'WIN ':'FAILURE+RETRY ')+s.level);}
 for(const l of selected){await page.locator(`[data-chapter="${l.chapter}"]`).click();await page.locator(`[data-level="${l.id}"]`).click();assert.equal((await snapshot()).level,l.id);const cases=JSON.parse(fs.readFileSync(path.join(root,`tests/cases/${l.id}.cases.json`),'utf8')).cases;
  if(retries.has(l.progression.order)){await draw(cases.find(c=>c.expected==='failure').stroke);await run(false);await page.locator('#reset-button').click();assert.equal((await snapshot()).points.length,0);assert.equal((await snapshot()).outcome,null);}
  await draw(cases.find(c=>c.expected==='success').stroke);if([7,31,49].includes(l.progression.order))await page.screenshot({path:path.join(local,`nova-${l.progression.order}-ready.png`)});await run(true);
 }
 // A new-module recipe survives native export/import/local persistence, not just serialization.
 const last=selected.at(-1),downloadWait=page.waitForEvent('download');await page.locator('#export-button').click();const download=await downloadWait,exportPath=path.join(local,'nova-roundtrip.json');await download.saveAs(exportPath);
 assert.deepEqual(JSON.parse(fs.readFileSync(exportPath,'utf8')),last);
 await page.locator('#open-library').click();await page.locator('#import-file').setInputFiles(exportPath);await page.waitForFunction(()=>Boolean(rescueDebug.snapshot().customKey));const key=(await snapshot()).customKey;
 await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>Boolean(window.rescueDebug));assert.equal((await snapshot()).customKey,key);assert.equal((await snapshot()).level,last.id);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(local,'nova-mobile-ready.png'),fullPage:true});
 assert.deepEqual(errors,[]);
 const suffix=requested?requested[0]+'-'+requested.at(-1):'all';const evidence={passed:true,url,discovered:batch.length,nativePointerWins:selected.length,trials:results.length,importExportAndReload:true,narrowNoOverflow:true,results,errors};fs.writeFileSync(path.join(local,`nova-browser-${suffix}.json`),JSON.stringify(evidence,null,2));console.log(JSON.stringify({...evidence,results:'See .local/nova-browser-'+suffix+'.json'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();});
