'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const F=require('../js/level-format.js'),C=require('../js/content.js'),P=require('../js/physics.js'),Catalog=require('../js/catalog.js');
const {levels}=require('../js/levels.js'),{discover,modules}=require('../scripts/content-index.cjs'),{verifyCases}=require('../scripts/validate-level.cjs');
const Matter=require('../vendor/matter.min.js'),Library=require('../js/level-library.js');
const clone=x=>JSON.parse(JSON.stringify(x));
const sample=id=>JSON.parse(fs.readFileSync(path.join(__dirname,`cases/${id}.cases.json`),'utf8'));
for(const level of levels.filter(l=>l.version===3))test(`${level.id}: 模块编译、独立解/失败例、导出回读同引擎一致`,()=>{
  const pack=sample(level.id),result=verifyCases(level,JSON.stringify(pack));
  assert.equal(result.verifiedSolvable,true,JSON.stringify(result));
  const restored=F.parseLevel(F.serializeLevel(C.resolve(level)));
  assert.deepEqual(restored,level);
  for(const c of pack.cases)assert.deepEqual(P.simulate(restored,c.stroke),P.simulate(level,c.stroke));
});
test('真实新元素无需通用循环/渲染器特判：平台移动后承重，逐次试坐状态隔离',()=>{
  const l=levels.find(l=>l.id==='lab/up-we-go'),points=sample(l.id).cases[0].stroke,t=P.createTrial(l,points);
  const extension=t.modules.find(m=>m.def.type==='lab/elevator'),body=extension.state.body,start=body.position.y;
  assert.ok(Matter.Composite.allBodies(t.engine.world).includes(body));
  while(t.elapsed<700)P.step(t);assert.equal(body.position.y,start);
  while(!t.ended)P.step(t);assert.equal(body.position.y,start-65);assert.equal(t.outcome.success,true);
  assert.ok(t.chair.position.y<t.origin.y-60);assert.equal(extension.state.touched,true);
  assert.equal(P.createTrial(l,points).modules.find(m=>m.def.type==='lab/elevator').state.body.position.y,start);
  for(const file of ['js/physics.js','js/render.js','js/game.js'])assert.doesNotMatch(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),/lab\/elevator|up-we-go|last-stop/);
  assert.equal(P.validateStroke(l,[[404,264],[404,410]]).code,'terrain');
});
test('横移班车的朴素解开始稳定，丢失真实接触后才失败；关掉移动反而成功',()=>{
  const l=levels.find(l=>l.id==='lab/last-stop'),stroke=sample(l.id).cases[1].stroke,t=P.createTrial(l,stroke);
  while(t.elapsed<1100)P.step(t);assert.equal(t.outcome,null);
  while(!t.ended)P.step(t);assert.equal(t.outcome.code,'moving-support');
  const without=clone(l);const lift=without.scene.find(e=>e.type==='lab/elevator');lift.type='core/terrain';const {x,y,w,h}=lift.params;lift.params={x,y,w,h};
  F.validateLevel(without);assert.equal(P.simulate(without,stroke).success,true);
});
test('独立挡板并非强制接椅模板：只挂墨水也能把真球导离猫',()=>{
  const l=levels.find(l=>l.id==='lab/not-a-chair-leg'),r=P.simulate(l,sample(l.id).cases[0].stroke);
  assert.equal(r.attached,false);assert.equal(r.anchorCount,0);assert.equal(r.success,true);
  assert.equal(P.simulate(l,sample(l.id).cases[1].stroke).code,'cat');
});
test('prefab 参数、位移、局部引用可组合；展开顺序不影响引用',()=>{
  const l=clone(levels.find(l=>l.id==='lab/off-duty'));const compiled=C.resolve(l);
  assert.equal(compiled.chair[0].x,234);assert.equal(compiled.terrain[0].y,400);
  assert.equal(compiled.mechanics.temporaryTerrain[0].index,0);
  l.scene.reverse();F.validateLevel(l);assert.equal(C.resolve(l).mechanics.temporaryTerrain[0].index,0);
  const recipe=C.get('workshop/seat');assert.equal(recipe.expand({legs:'none'})[0].params.length,1);assert.equal(recipe.expand({legs:'both'})[0].params.length,3);
});
test('闭合契约拒绝未知类型、脚本、重复实例、无效引用/位移、规则累积超量',()=>{
  const source=levels.find(l=>l.id==='lab/off-duty');
  const bads=[];let b=clone(source);b.scene[0].type='remote/unknown';bads.push(b);
  b=clone(source);b.scene[0].params.onCreate='alert(1)';bads.push(b);
  b=clone(source);b.scene.push(clone(b.scene[0]));bads.push(b);
  b=clone(source);b.scene[0].at.x=700;bads.push(b);
  b=clone(source);b.scene.push({id:'bad-ref',type:'core/temporary-terrain',params:[{target:'not-there',removeAt:1000,label:'缺引用'}]});bads.push(b);
  b=clone(source);b.scene.push({id:'many-pins',type:'core/anchors',params:Array.from({length:4},(_,i)=>({x:100+i*100,y:100,radius:10,label:'环'}))});bads.push(b);
  for(const bad of bads)assert.throws(()=>F.validateLevel(bad));
  assert.throws(()=>C.register(C.get('lab/elevator')),/重复注册/);
});
test('自动生成的静态目录/模块 allowlist 与开发发现一致，没有手写关卡清单',()=>{
  assert.deepEqual(discover(),JSON.parse(fs.readFileSync(path.join(__dirname,'../levels/manifest.json'),'utf8')));
  assert.deepEqual(modules(),JSON.parse(fs.readFileSync(path.join(__dirname,'../js/modules/manifest.json'),'utf8')));
  assert.equal(discover().files.length,19);assert.equal(new Set(levels.map(l=>l.id)).size,19);
});
test('目录逐文件隔离；重复 id 全部隔离，不用先到者覆盖；排序不靠编号',()=>{
  const good=levels.find(l=>l.id==='lab/up-we-go'),other={...good,id:'parallel/zebra',title:'独立关',progression:{...good.progression,order:5}};
  const manifest={format:'save-one-stroke-manifest',version:2,files:['owner/a.json','owner/b.json','owner/broken.json']};
  let result=Catalog.assemble(manifest,[{path:manifest.files[0],source:JSON.stringify(good)},{path:manifest.files[1],source:JSON.stringify(other)},{path:manifest.files[2],source:'{bad'}]);
  assert.deepEqual(result.levels.map(l=>l.id),['parallel/zebra',good.id]);assert.match(result.errors[0].file,/broken/);
  result=Catalog.assemble(manifest,[{path:'owner/a.json',source:JSON.stringify(good)},{path:'owner/b.json',source:JSON.stringify(good)}]);
  assert.equal(result.levels.length,0);assert.equal(result.errors.length,2);assert.match(result.errors[0].message,/重复关卡/);
  for(const file of ['../evil.json','https://evil/a.json','a/../../evil.json'])assert.throws(()=>Catalog.manifestFiles({...manifest,files:[file]}));
});
test('v3 本地导入保存不迁移或覆盖 v1/v2 库；稳定 id 与本地键分离',()=>{
  const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};let i=0;const library=Library.createLibrary(storage,()=>`test-${++i}`);
  for(const l of [levels[0],levels[10],levels.find(l=>l.id==='lab/up-we-go')])library.add(l);
  const imported=library.list().at(-1);library.record(imported.key,{stars:3,ink:132});
  const restored=Library.createLibrary(storage);assert.equal(restored.list().length,3);assert.equal(restored.get(imported.key).record.stars,3);
});
