'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {levels}=require('../js/levels.js'),P=require('../js/physics.js'),F=require('../js/level-format.js'),C=require('../js/content.js');
const Matter=require('../vendor/matter.min.js'),{verifyCases}=require('../scripts/validate-level.cjs');
const batch=levels.filter(l=>String(l.id).startsWith('nova/'));
const level=n=>batch.find(l=>l.progression.order===n);
const pack=l=>JSON.parse(fs.readFileSync(path.join(__dirname,`cases/${l.id}.cases.json`),'utf8'));
const stroke=(l,expected='success')=>pack(l).cases.find(c=>c.expected===expected).stroke;
const trial=(n,expected='success')=>P.createTrial(level(n),stroke(level(n),expected));
const until=(t,ms)=>{while(t.elapsed<ms&&!t.ended)P.step(t);return t;};
const finish=t=>until(t,5001);
const state=(t,type)=>t.modules.find(m=>m.def.type===type).state;
const changed=(n,edit)=>{const l=structuredClone(level(n));edit(l);F.validateLevel(l);return l;};
const omit=(n,type)=>changed(n,l=>{l.scene=l.scene.filter(e=>e.type!==type);});

test('净新增54关、九章各6关，旧71关与上一批24关仍完整',()=>{
 assert.equal(batch.length,54);assert.equal(levels.filter(l=>!String(l.id).startsWith('nova/')).length,71);
 assert.equal(levels.filter(l=>String(l.id).startsWith('remix/')).length,24);
 assert.equal(new Set(batch.map(l=>l.chapter)).size,9);
 for(const chapter of new Set(batch.map(l=>l.chapter)))assert.equal(batch.filter(l=>l.chapter===chapter).length,6);
 assert.equal(new Set(batch.map(l=>JSON.stringify([l.scene,l.load]))).size,54,'不能只换叙事复制同一物理场景');
 for(let n=1;n<=54;n++){assert.ok(level(n));assert.ok(level(n).scene.some(e=>e.type.startsWith('nova/')));}
});
for(const l of batch)test(`${l.id}: 格式、合法解/失败例、非自动完成、无损往返`,()=>{
 const report=verifyCases(l,JSON.stringify(pack(l)));assert.equal(report.verifiedSolvable,true,JSON.stringify(report));
 assert.equal(P.simulate(l,[[100,255],[130,255]]).success,false,'只在原椅面添无关短线不能自动完成');
 assert.deepEqual(F.parseLevel(F.serializeLevel(l)),l);
});

test('工单按真实位置、截止、顺序和5秒留框判定；不替代原椅子安全',()=>{
 const delayed=stroke(level(3),'failure');assert.equal(P.simulate(level(3),delayed).success,false);
 const noDeadline=changed(3,l=>delete l.scene.find(e=>e.type==='nova/goals').params.targets[0].closeAt);
 assert.equal(P.simulate(noDeadline,delayed).success,true,'只是晚到，不是另一个无解形状');
 const early=stroke(level(6),'failure');assert.equal(P.simulate(level(6),early).success,false);
 const noWindow=changed(6,l=>{const g=l.scene.find(e=>e.type==='nova/goals').params.targets[0];delete g.openAt;delete g.closeAt;});
 assert.equal(P.simulate(noWindow,early).success,true);
 const ordered=finish(trial(14)),g=state(ordered,'nova/goals');assert.ok(g.at[0]<g.at[1]);assert.deepEqual(g.hit,[true,true]);
 const held=finish(trial(2));assert.deepEqual(state(held,'nova/goals').current,[true]);
 const unsafe=changed(1,l=>{l.scene.find(e=>e.id==='seat').params.legs='none';});
 assert.equal(P.simulate(unsafe,stroke(level(1))).success,false,'完成工单也不能把摔倒改成胜利');
});

test('发射器按时创建有质量刚体、初速是真速度，重试重新创建',()=>{
 const t=trial(13);until(t,490);assert.equal(state(t,'nova/launcher').body,null);
 until(t,510);const b=state(t,'nova/launcher').body;
 assert.ok(Matter.Composite.allBodies(t.engine.world).includes(b));assert.ok(t.dynamicBodies.includes(b));
 assert.equal(b.mass,2);assert.equal(b.plugin.novaBall,'a');assert.equal(b.label,'falling-ball');
 assert.ok(b.velocity.x>7.8&&b.velocity.x<8.1);assert.ok(b.velocity.y<0);
 assert.equal(state(trial(13),'nova/launcher').body,null);
 assert.equal(P.validateStroke(level(13),[[300,120],[320,150]]).code,'spawn-overlap');
});

test('传送真实触发、保持旋转后的动量、球过滤、有限额度与重试隔离',()=>{
 const l=changed(7,l=>l.scene.find(e=>e.type==='nova/portal').params.turn=90),t=P.createTrial(l,stroke(l));
 let before;while(!state(t,'nova/portal').transfers.length){before=state(t,'nova/launcher').body?{...state(t,'nova/launcher').body.velocity}:null;P.step(t);assert.ok(t.elapsed<4000);}
 const b=state(t,'nova/launcher').body;assert.deepEqual(b.position,{x:600,y:140});
 assert.ok(Math.abs(b.velocity.x+before.y)<.4&&Math.abs(b.velocity.y-before.x)<.4,'旋转90度而不是重设固定速度');
 const filtered=finish(trial(10));assert.ok(state(filtered,'nova/portal').transfers.every(x=>x.ball==='a'));
 const once=finish(trial(43));assert.equal(state(once,'nova/portal').transfers.length,1);assert.equal(once.outcome.success,true);
 const unlimited=changed(43,l=>delete l.scene.find(e=>e.type==='nova/portal').params.charges);
 assert.equal(P.simulate(unlimited,stroke(level(43))).success,false,'无限额度会把回程球再次传走');
 assert.deepEqual(state(trial(43),'nova/portal').transfers,[]);
 assert.equal(P.validateStroke(level(7),[[490,285],[520,300]]).code,'portal-overlap');
});

test('传送带是静止实体+接触驱动力，能运墨水；磁场只作用选中的钢球',()=>{
 const t=trial(23),s=state(t,'nova/belt'),origin={...s.body.position};finish(t);
 assert.deepEqual(s.body.position,origin);assert.ok(s.drivenSteps>0);assert.ok(s.touched.includes('loose-ink'));
 assert.ok(t.looseInk.position.x>t.inkOrigin.x+100);assert.equal(t.outcome.success,true);
 const selective=finish(trial(27));assert.deepEqual(state(selective,'nova/field').affected,['a']);
 assert.deepEqual({x:selective.engine.gravity.x,y:selective.engine.gravity.y},{x:0,y:1});
 const timed=trial(29);until(timed,2550);assert.equal(state(timed,'nova/field').steps,0);finish(timed);
 assert.deepEqual(state(timed,'nova/field').affected,['b']);assert.equal(timed.outcome.success,true);
});

test('自由跷板有真实可转约束；不是预设斜坡；锚定动态支撑也可承椅',()=>{
 const t=finish(trial(31)),s=state(t,'nova/seesaw');assert.ok(s.maxAngle>40);assert.ok(s.body.angle<0);
 assert.ok(Matter.Composite.allConstraints(t.engine.world).includes(s.constraint));assert.ok(t.supportBodies.includes(s.body));
 assert.ok(state(finish(trial(31,'failure')),'nova/seesaw').body.angle>0,'没放墨水砝码时朝另一边转');
 const balanced=changed(53,l=>{l.load={x:430,mass:14};l.scene=[
  {id:'seat',type:'workshop/seat',at:{x:338,y:251},params:{legs:'none'}},
  {id:'remote',type:'core/terrain',params:{x:20,y:400,w:80,h:90}},
  {id:'beam',type:'nova/seesaw',params:{x:300,y:350,w:260,h:14,pivot:.5,mass:8,label:'轴心承重'}}
 ];l.ink=500;l.gold=450;});
 const points=[[380,345.5],[430,265],[480,345.5]],good=P.createTrial(balanced,points);finish(good);
 assert.equal(good.outcome.success,true);assert.ok(good.diagnostics.contacts.length>0);
 const unregistered=P.createTrial(balanced,points);unregistered.supportBodies=[];finish(unregistered);
 assert.equal(unregistered.outcome.success,false,'不能把没有注册承重关系的任意动态体当作固定支撑');
});

test('开合门真的移除并重新加入碰撞体，窗口不继承到重试',()=>{
 const t=trial(37),s=state(t,'nova/gate'),has=()=>Matter.Composite.allBodies(t.engine.world).includes(s.body);
 assert.equal(has(),true);until(t,1550);assert.equal(has(),false);assert.equal(s.open,true);
 until(t,2550);assert.equal(has(),true);assert.equal(s.open,false);assert.deepEqual(s.changes.map(x=>x.open),[true,false]);
 finish(t);assert.equal(t.outcome.success,true);assert.deepEqual(state(trial(37),'nova/gate').changes,[]);
 const twice=finish(trial(38));assert.deepEqual(state(twice,'nova/gate').changes.map(x=>x.open),[true,false,true,false]);
});

test('关键新因果反事实：去掉资源或规则，同一笔不再完成',()=>{
 const controls=[[7,'nova/portal'],[12,'nova/field'],[19,'nova/belt'],[25,'nova/field'],[28,'nova/field'],[31,'nova/seesaw'],[33,'nova/seesaw'],[37,'nova/gate'],[43,'nova/portal'],[43,'nova/belt'],[44,'nova/field'],[44,'nova/portal'],[46,'nova/field'],[53,'nova/seesaw'],[54,'nova/portal'],[54,'nova/belt'],[54,'nova/field']];
 for(const [n,type]of controls)assert.equal(P.simulate(omit(n,type),stroke(level(n))).success,false,`第${n}关必须真正依赖${type}`);
 const finale=finish(trial(54));assert.equal(finale.outcome.success,true);
 assert.equal(state(finale,'nova/portal').transfers.length,2);
 for(const m of finale.modules.filter(m=>m.def.type==='nova/goals'))assert.ok(m.state.hit.every(Boolean));
});

test('新模块闭合Schema/运行时一致拒绝未知键、坏球引用、数值、时窗、出生重叠',()=>{
 const Ajv=require('ajv/dist/2020'),check=new Ajv({strict:false,allErrors:true}).compile(require('../schemas/level-v3.schema.json'));
 const bads=[];const bad=(n,fn)=>{const l=structuredClone(level(n));fn(l);bads.push(l);};
 for(const n of [1,7,19,25,31,37])bad(n,l=>{l.scene.find(e=>e.type.startsWith('nova/')).params.callback='not code';});
 bad(1,l=>l.scene.find(e=>e.type==='nova/launcher').params.vx=50);
 bad(1,l=>l.scene.find(e=>e.type==='nova/goals').params.targets[0].mode='win');
 bad(7,l=>l.scene.find(e=>e.type==='nova/portal').params.charges=0);
 bad(19,l=>l.scene.find(e=>e.type==='nova/belt').params.speeds[0].vx=7);
 bad(25,l=>l.scene.find(e=>e.type==='nova/field').params.fx=3);
 bad(31,l=>l.scene.find(e=>e.type==='nova/seesaw').params.pivot=1);
 for(const l of bads){assert.equal(check(l),false);assert.throws(()=>F.validateLevel(l));}
 const cross=[];const crossBad=(n,fn)=>{const l=structuredClone(level(n));fn(l);cross.push(l);};
 crossBad(1,l=>l.scene.find(e=>e.type==='nova/goals').params.targets[0].ball='missing');
 crossBad(1,l=>{const e=structuredClone(l.scene.find(e=>e.type==='nova/launcher'));e.id='duplicate-ball';l.scene.push(e);});
 crossBad(1,l=>l.scene.find(e=>e.type==='nova/launcher').params.y=390);
 crossBad(1,l=>{const b=l.scene.find(e=>e.type==='nova/launcher').params;b.x=130;b.y=210;});
 crossBad(7,l=>l.scene.find(e=>e.type==='nova/portal').params.exit={x:50,y:430,radius:26});
 crossBad(7,l=>l.scene.find(e=>e.type==='nova/portal').params.exit={x:130,y:210,radius:26});
 crossBad(19,l=>l.scene.find(e=>e.type==='nova/belt').params.speeds.push({at:0,vx:1}));
 crossBad(25,l=>l.scene.find(e=>e.type==='nova/field').params.end=0);
 crossBad(37,l=>l.scene.find(e=>e.type==='nova/gate').params.windows=[{open:2000,close:1000}]);
 for(const l of cross)assert.throws(()=>F.validateLevel(l));
 const reversed=structuredClone(level(54));reversed.scene.reverse();F.validateLevel(reversed);
 assert.deepEqual(F.parseLevel(F.serializeLevel(reversed)),reversed,'跨模块引用不依赖声明顺序');
});
