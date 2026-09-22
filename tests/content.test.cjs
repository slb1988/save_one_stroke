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
test('挂点可选 releaseAt：缺省永不释放，到点真实移除约束并同步 bindings，重试隔离',()=>{
  const base=clone(levels.find(l=>l.id==='lab/not-a-chair-leg'));
  const stroke=[[450,150],[620,230]];
  // 默认行为不变：无 releaseAt 时挂接保持到底
  const keep=P.createTrial(base,stroke);while(!keep.ended)P.step(keep);
  assert.equal(keep.bindings.length,2);assert.equal(keep.outcome.success,true);
  // 到点释放：约束从世界移除、bindings 同步清空、事件预告存在
  const rel=clone(base);rel.scene.find(e=>e.id==='ramp-pins').params.forEach(a=>a.releaseAt=1500);
  F.validateLevel(rel);
  assert.ok(P.ruleEvents(rel).some(e=>e.type==='anchor-release'&&e.at===1500));
  const t=P.createTrial(rel,stroke);
  const constraints=()=>Matter.Composite.allConstraints(t.engine.world).length;
  assert.equal(t.bindings.length,2);assert.equal(constraints(),2);
  while(t.elapsed<1400)P.step(t);assert.equal(t.bindings.length,2);
  while(!t.ended)P.step(t);
  assert.equal(t.bindings.length,0);assert.equal(constraints(),0);
  // 重试隔离：新一轮试坐重新挂接
  assert.equal(P.createTrial(rel,stroke).bindings.length,2);
  // 参数校验：越界与未知字段仍拒绝
  const bad=clone(base);bad.scene.find(e=>e.id==='ramp-pins').params[0].releaseAt=100;assert.throws(()=>F.validateLevel(bad));
  const unknown=clone(base);unknown.scene.find(e=>e.id==='ramp-pins').params[0].releaseNote='x';assert.throws(()=>F.validateLevel(unknown));
});
test('落球可选 restitution：缺省 0.08 不变，高弹性真实反弹更高，参数闭合校验',()=>{
  const base=clone(levels.find(l=>l.id==='lab/not-a-chair-leg'));
  const stroke=[[300,255],[330,255]];
  const bounce=src=>{const t=P.createTrial(src,stroke);let contacted=false,peak=Infinity;
    while(!t.ended){P.step(t);const b=t.drops[0]?.body;if(!b)continue;if(!contacted&&b.position.y>350)contacted=true;else if(contacted)peak=Math.min(peak,b.position.y);}
    return {peak,rest:t.drops[0].body.restitution};};
  const def=bounce(base);assert.equal(def.rest,0.08);
  const bouncy=clone(base);bouncy.scene.find(e=>e.id==='parcel').params[0].restitution=0.95;
  F.validateLevel(bouncy);const hi=bounce(bouncy);assert.equal(hi.rest,0.95);
  assert.ok(hi.peak<def.peak-20,`高弹性应反弹更高：${hi.peak} vs ${def.peak}`);
  const bad=clone(base);bad.scene.find(e=>e.id==='parcel').params[0].restitution=1.2;assert.throws(()=>F.validateLevel(bad));
});
test('触碰触发平台：仅真实落球触发、触发后真实位移、不触发不动、重试隔离、参数闭合',()=>{
  const lift={id:'lift',type:'lab/trigger-lift',params:{button:{x:560,y:390,w:60,h:10},x:270,y:440,w:160,h:24,dx:50,dy:-40,speed:0.08,label:'接应平台'}};
  const base={format:'save-one-stroke-level',version:3,id:'var2/tmp-trigger',chapter:'测试',progression:{groupOrder:1,order:1,difficulty:'easy'},
    title:'触发平台测试',tag:'t',brief:'b',condition:'c',quip:'q',success:'s',failure:'f',ink:200,gold:150,load:{x:360,mass:14},hint:['h'],drawArea:{drawTop:60},
    scene:[{id:'seat',type:'workshop/seat',params:{legs:'both'},at:{x:180,y:251}},{id:'floor',type:'core/terrain',params:{x:20,y:400,w:680,h:90}},lift]};
  const stroke=[[300,255],[330,255]];
  // 无球：永不触发，平台停在原地
  const t0=P.createTrial(clone(base),stroke);const liftState=()=>t0.modules.find(m=>m.def.type==='lab/trigger-lift').state;
  const y0=liftState().body.position.y;while(!t0.ended)P.step(t0);
  assert.equal(liftState().triggered,false);assert.equal(liftState().body.position.y,y0);
  // 球命中感应区：触发记录时刻，平台到达终点；重试后状态重建
  const withBall=clone(base);withBall.scene.push({id:'parcel',type:'core/drops',params:[{at:500,x:590,y:60,radius:20,mass:8,label:'球'}]});
  F.validateLevel(withBall);
  const t1=P.createTrial(withBall,stroke);const s1=()=>t1.modules.find(m=>m.def.type==='lab/trigger-lift').state;
  while(!t1.ended)P.step(t1);
  assert.equal(s1().triggered,true);assert.ok(s1().at>=500);
  const dx=50,dy=-40;assert.ok(Math.abs(s1().body.position.x-(270+80+dx))<1.5&&Math.abs(s1().body.position.y-(440+12+dy))<1.5,'平台须到达终点');
  assert.equal(P.createTrial(withBall,stroke).modules.find(m=>m.def.type==='lab/trigger-lift').state.triggered,false);
  // 球落在别处：不触发
  const miss=clone(withBall);miss.scene.find(e=>e.id==='parcel').params[0].x=300;
  const t2=P.createTrial(miss,stroke);while(!t2.ended)P.step(t2);
  assert.equal(t2.modules.find(m=>m.def.type==='lab/trigger-lift').state.triggered,false);
  // 参数闭合：超速/终点出界/未知字段拒绝
  const badSpeed=clone(base);badSpeed.scene.find(e=>e.id==='lift').params.speed=0.2;assert.throws(()=>F.validateLevel(badSpeed));
  const badDest=clone(base);badDest.scene.find(e=>e.id==='lift').params.dx=700;assert.throws(()=>F.validateLevel(badDest));
  const badKey=clone(base);badKey.scene.find(e=>e.id==='lift').params.delay=100;assert.throws(()=>F.validateLevel(badKey));
});
test('地形可选 friction：缺省保持 Matter 静态摩擦 1 的现状，低摩擦真实生效且闭合校验',()=>{
  const base=clone(levels.find(l=>l.id==='lab/up-we-go'));
  const stroke=[[300,255],[330,255]];
  const frictionOf=(src,i=0)=>{const t=P.createTrial(src,stroke);return t.terrain[i].friction;};
  assert.equal(frictionOf(base),1,'静态地形现状摩擦应为 1（Matter setStatic 行为）');
  const icy=clone(base);icy.scene.find(e=>e.id==='distant').params.friction=0.05;
  F.validateLevel(icy);assert.equal(frictionOf(icy),0.05,'低摩擦须真实写入刚体');
  const bad=clone(base);bad.scene.find(e=>e.id==='distant').params.friction=2;assert.throws(()=>F.validateLevel(bad));
  const badKey=clone(base);badKey.scene.find(e=>e.id==='distant').params.slick=true;assert.throws(()=>F.validateLevel(badKey));
});
test('自动生成的静态目录/模块 allowlist 与开发发现一致，没有手写关卡清单',()=>{
  assert.deepEqual(discover(),JSON.parse(fs.readFileSync(path.join(__dirname,'../levels/manifest.json'),'utf8')));
  assert.deepEqual(modules(),JSON.parse(fs.readFileSync(path.join(__dirname,'../js/modules/manifest.json'),'utf8')));
  // 旧 19 关 id 集合完整、id 全局唯一；课程 namespace 当前首批恰好 5 关（终批再独立断言 50）；发现目录与有效加载一致，无隔离缺项。
  const ids=new Set(levels.map(l=>String(l.id)));
  for(const id of ['1','2','3','4','5','6','7','8','9','10','11','12','13','lab/last-stop','lab/not-a-chair-leg','lab/off-duty','lab/return-ticket','lab/up-we-go','lab/world-tour'])assert.ok(ids.has(id),`旧关缺失：${id}`);
  assert.equal(ids.size,levels.length);
  // 课程 namespace 当前恰好 15 关且顺序固定（终批再独立断言 50）。
  assert.deepEqual(levels.filter(l=>String(l.id).startsWith('course/')).map(l=>l.id),['course/01-reach-the-ground','course/02-start-from-ground','course/03-not-welded','course/04-borrow-the-leg','course/05-full-route','course/06-follow-the-weight','course/07-two-kinds-of-cat','course/08-two-short-legs','course/09-wide-enough-span','course/10-high-low-feet','course/11-cantilever-rail','course/12-tall-back','course/13-rocking-runner','course/14-tulip-base','course/15-kneeling-two-points']);
  assert.equal(discover().files.length,levels.length);
});
test('v3 来源元数据闭合：可选、协议白名单、序列化往返保留；v1 拒绝',()=>{
  const l=levels.find(l=>l.id==='course/11-cantilever-rail');
  assert.match(l.source.prototype,/悬臂椅/);assert.match(l.source.url,/^https:\/\//);
  assert.deepEqual(F.parseLevel(F.serializeLevel(C.resolve(l))).source,l.source);
  const badUrl=clone(l);badUrl.source={...l.source,url:'javascript:alert(1)'};assert.throws(()=>F.validateLevel(badUrl));
  const extra=clone(l);extra.source={...l.source,onclick:'x'};assert.throws(()=>F.validateLevel(extra));
  assert.throws(()=>F.validateLevel({...clone(levels[0]),source:{prototype:'x',url:'https://example.com'}}));
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
