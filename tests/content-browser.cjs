'use strict';
// Targeted acceptance: isolated browser profile, no production deployment or user tabs.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),local=path.join(root,'.local');fs.mkdirSync(path.join(local,'tmp'),{recursive:true});
process.env.TMP=process.env.TEMP=process.env.TMPDIR=path.join(local,'tmp');
const {chromium}=require('playwright');
const URL=process.env.GAME_URL||'http://127.0.0.1:4173/';
const executablePath=process.env.BROWSER_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/chromium','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(f=>fs.existsSync(f));
const newDir=path.join(root,'levels/acceptance'),hotFile=path.join(newDir,'hot-added.json'),badFile=path.join(newDir,'broken.json');
const cases=id=>JSON.parse(fs.readFileSync(path.join(root,`tests/cases/${id}.cases.json`),'utf8')).cases;
let browser,created=false;
(async()=>{
 assert.ok(!fs.existsSync(newDir),'验收目录已存在，拒绝覆盖');
 browser=await chromium.launch({executablePath,headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:1000},acceptDownloads:true}),page=await context.newPage(),errors=[],results=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(URL+'#level=1',{waitUntil:'networkidle'});await page.waitForFunction(()=>Boolean(window.rescueDebug));
 const snapshot=()=>page.evaluate(()=>rescueDebug.snapshot());
 async function refresh(){await page.locator('#refresh-catalog').click();await page.waitForFunction(()=>!document.getElementById('refresh-catalog').disabled);}
 async function select(id){await page.evaluate(id=>{location.hash='level='+encodeURIComponent(id);},id);await page.waitForFunction(id=>rescueDebug.snapshot().level===id,id);}
 async function draw(stroke){await page.locator('#game-canvas').scrollIntoViewIfNeeded();const box=await page.locator('#game-canvas').boundingBox(),xy=([x,y])=>({x:box.x+x/720*box.width,y:box.y+y/480*box.height});const p=xy(stroke[0]);await page.mouse.move(p.x,p.y);await page.mouse.down();for(const point of stroke.slice(1)){const q=xy(point);await page.mouse.move(q.x,q.y,{steps:18});}await page.mouse.up();assert.equal((await snapshot()).validation.valid,true,JSON.stringify(await snapshot()));}
 async function finish(expected=true){await page.waitForFunction(()=>rescueDebug.snapshot().mode==='result',null,{timeout:12000});const s=await snapshot();assert.equal(s.outcome.success,expected,JSON.stringify(s));results.push({id:s.level,...s.outcome,modules:s.modules,attached:s.validation.attached});return s;}
 // Existing numeric hash and storage record are retained; stale catalog ids are not deleted.
 await page.evaluate(()=>localStorage.setItem('save-one-stroke:v1',JSON.stringify({records:{1:{stars:3,ink:132},999:{stars:2,ink:55}},muted:true})));
 await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>Boolean(window.rescueDebug));
 assert.equal((await snapshot()).level,1);assert.equal((await snapshot()).records[1].stars,3);
 // v2 import is still raw and exportable. Refresh while drawing does not reset a local entry.
 await page.locator('#open-library').click();await page.locator('#import-file').setInputFiles(path.join(root,'docs/examples/variant.json'));
 await page.waitForFunction(()=>Boolean(rescueDebug.snapshot().customKey));
 await draw([[242,264],[183,395.5]]);const imported=await snapshot();await refresh();
 assert.deepEqual((await snapshot()).points,imported.points);assert.equal((await snapshot()).customKey,imported.customKey);
 const downloadWait=page.waitForEvent('download');await page.locator('#export-button').click();const download=await downloadWait;const exportPath=path.join(local,'content-v2-roundtrip.json');await download.saveAs(exportPath);
 assert.deepEqual(JSON.parse(fs.readFileSync(exportPath,'utf8')),JSON.parse(fs.readFileSync(path.join(root,'docs/examples/variant.json'),'utf8')));
 await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>Boolean(window.rescueDebug));assert.equal((await snapshot()).customKey,imported.customKey);
 // New file is added AFTER server startup and page load; no list edit/restart/build.
 await select('lab/last-stop');await draw(cases('lab/last-stop')[0].stroke);await page.locator('#test-button').click();await page.waitForFunction(()=>rescueDebug.snapshot().elapsed>400);
 const before=await snapshot(),hot=JSON.parse(fs.readFileSync(path.join(root,'levels/lab/up-we-go.json'),'utf8'));
 Object.assign(hot,{id:'acceptance/hot-added',chapter:'刷新实验',title:'刚刚添加的电梯',progression:{groupOrder:90,order:10,difficulty:'easy'}});
 fs.mkdirSync(newDir);created=true;fs.writeFileSync(hotFile,JSON.stringify(hot));fs.writeFileSync(badFile,'{ deliberately invalid');
 await refresh();const after=await snapshot();assert.equal(after.level,before.level);assert.deepEqual(after.points,before.points);assert.ok(after.elapsed>=before.elapsed);assert.ok(after.catalog.ids.includes(hot.id));assert.match(after.catalog.errors[0].file,/acceptance\/broken.json/);
 assert.equal(after.savedLevels.length,1);assert.equal(after.records[1].stars,3);assert.equal(after.records[999].stars,2);
 await finish();
 await page.locator('[data-chapter="刷新实验"]').click();await page.locator('[data-level="acceptance/hot-added"]').click();
 await draw(cases('lab/up-we-go')[0].stroke);await page.locator('#test-button').click();await finish();
 // The surprising independent ramp really works through native pointer input.
 await select('lab/not-a-chair-leg');await draw(cases('lab/not-a-chair-leg')[0].stroke);assert.equal((await snapshot()).validation.attached,false);await page.locator('#test-button').click();await finish();
 await page.locator('#reset-button').click();await draw(cases('lab/not-a-chair-leg')[1].stroke);await page.locator('#test-button').click();assert.equal((await finish(false)).outcome.code,'cat');
 await select('lab/return-ticket');await draw(cases('lab/return-ticket')[0].stroke);await page.locator('#test-button').click();await finish();
 // v3 import/export preserves recipes, parameters, namespace id, local key and record on reload.
 await page.locator('#open-library').click();await page.locator('#import-file').setInputFiles(path.join(root,'levels/lab/up-we-go.json'));await page.waitForFunction(()=>rescueDebug.snapshot().level==='lab/up-we-go'&&Boolean(rescueDebug.snapshot().customKey));
 const v3key=(await snapshot()).customKey,wait=page.waitForEvent('download');await page.locator('#export-button').click();const v3export=path.join(local,'content-v3-roundtrip.json');await (await wait).saveAs(v3export);
 assert.deepEqual(JSON.parse(fs.readFileSync(v3export,'utf8')),JSON.parse(fs.readFileSync(path.join(root,'levels/lab/up-we-go.json'),'utf8')));
 await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>Boolean(window.rescueDebug));assert.equal((await snapshot()).customKey,v3key);assert.equal((await snapshot()).savedLevels.length,2);
 await page.setViewportSize({width:390,height:844});await page.locator('#chapter-tabs').getByRole('button',{name:'脑洞接力',exact:true}).click();await page.locator('[data-level="lab/last-stop"]').click();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const screenshot=path.join(local,'content-narrow.png');await page.screenshot({path:screenshot,fullPage:true});
 assert.deepEqual(errors,[]);
 // Removal is discovered too, without disrupting the selected independent level.
 fs.unlinkSync(hotFile);fs.unlinkSync(badFile);fs.rmdirSync(newDir);created=false;await refresh();assert.equal((await snapshot()).catalog.ids.length,19);assert.deepEqual((await snapshot()).catalog.errors,[]);
 console.log(JSON.stringify({passed:true,url:URL,results,hotFileRefreshPlayable:true,refreshPreservesRunningTrial:true,badFileIsolated:true,legacyNumericLinkAndRecords:true,v2AndV3ImportExport:true,localLibrarySurvivesRefresh:true,narrowScreenNoOverflow:true,screenshot,errors},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(created){for(const f of [hotFile,badFile])if(fs.existsSync(f))fs.unlinkSync(f);fs.rmdirSync(newDir);}await browser?.close();});
