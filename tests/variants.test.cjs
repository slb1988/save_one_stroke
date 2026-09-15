'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const Ajv=require('ajv/dist/2020');
const Matter=require('../vendor/matter.min.js');
const P=require('../js/physics.js'), Format=require('../js/level-format.js');
const {levels}=require('../js/levels.js'), {solutions,failures,alternatives}=require('./fixtures.cjs');
const schema=new Ajv({strict:false,allErrors:true}).compile(require('../schemas/level-v2.schema.json'));
const variants=levels.filter(level=>level.version===2), copy=value=>JSON.parse(JSON.stringify(value));
const expectedCodes=['support-removed','swing','gravity-shift','impact'];
for(const [i,level] of variants.entries()) {
  const index=level.id-1;
  test(`变种 ${level.id} ${level.title}：v2 格式/Schema、合法解、自由替代解均通过`,()=>{
    assert.equal(schema(level),true,JSON.stringify(schema.errors)); Format.validateLevel(level);
    for(const stroke of [solutions[index],alternatives[index]]) {
      const result=P.simulate(level,stroke);
      assert.equal(result.valid,true);assert.equal(result.success,true,JSON.stringify(result));assert.equal(result.duration,5000);
    }
    const restored=Format.parseLevel(Format.serializeLevel(level));
    assert.deepEqual(P.simulate(restored,solutions[index]),P.simulate(level,solutions[index]));
  });
  test(`变种 ${level.id}：朴素画法合法，但因 ${expectedCodes[i]} 失败`,()=>{
    const result=P.simulate(level,failures[index]);
    assert.equal(result.valid,true);assert.equal(result.success,false);assert.equal(result.code,expectedCodes[i]);
  });
}

test('临时支点按预告时刻从物理世界移除；不撤走时朴素解能坐稳',()=>{
  const level=variants[0], t=P.createTrial(level,failures[level.id-1]);
  while(t.elapsed<2100)P.step(t);
  assert.equal(t.outcome,null);assert.equal(t.removedTerrain.size,0);assert.ok(Matter.Composite.allBodies(t.engine.world).includes(t.terrain[2]));
  while(t.elapsed<2300)P.step(t);
  assert.ok(t.removedTerrain.has(2));assert.ok(!Matter.Composite.allBodies(t.engine.world).includes(t.terrain[2]));
  assert.match(P.ruleStatus(level,2300).text,/已生效/);
  const without={...level,version:1,chapter:'挑战'};delete without.mechanics;
  assert.equal(P.simulate(without,failures[level.id-1]).success,true);
});
test('金环创建真实可转铰接，无地面也可承重；去掉金环并不会悬空成功',()=>{
  const level=variants[1], t=P.createTrial(level,solutions[level.id-1]);
  assert.equal(t.bindings.length,2);assert.equal(Matter.Composite.allConstraints(t.engine.world).length,2);
  assert.ok(t.bindings.every(b=>b.constraint.length===0 && b.constraint.bodyB===t.chair));
  while(!t.ended)P.step(t);
  assert.equal(t.outcome.success,true);assert.ok(t.diagnostics.contacts.every(c=>c.kind==='anchor'));
  const without=copy(level);delete without.mechanics.anchors;without.mechanics.gravity=[{at:0,x:0,y:1,label:'正常重力'}];
  assert.equal(P.simulate(without,solutions[level.id-1]).success,false);
});
test('重力改写引擎方向，不是换文案；不换向时旧式竖腿能成功',()=>{
  const level=variants[2], t=P.createTrial(level,solutions[level.id-1]);
  while(t.elapsed<1900)P.step(t);assert.equal(t.engine.gravity.x,0);assert.equal(t.engine.gravity.y,1);
  while(t.elapsed<2100)P.step(t);assert.equal(t.engine.gravity.x,1);assert.equal(t.engine.gravity.y,0);
  const without=copy(level);without.mechanics.gravity=[without.mechanics.gravity[0]];
  assert.equal(P.simulate(without,failures[level.id-1]).success,true);
  assert.deepEqual(P.constrainPoint(level,{x:610,y:270},{x:580,y:264}),{x:595.5,y:270});
  assert.deepEqual(P.snapEndpoint({x:599,y:270},level),{x:595.5,y:270});
});
test('球在预告后才作为动态刚体出生并碰撞，斜顶能导走；没有落球则平顶稳定',()=>{
  const level=variants[3], t=P.createTrial(level,solutions[level.id-1]);
  while(t.elapsed<800)P.step(t);assert.equal(t.drops.length,0);
  while(t.elapsed<1000)P.step(t);assert.equal(t.drops.length,1);assert.equal(t.drops[0].body.isStatic,false);assert.equal(t.drops[0].body.mass,10);
  while(!t.ended)P.step(t);assert.equal(t.outcome.success,true);assert.equal(t.dropImpact,true);assert.ok(t.drops[0].body.position.x>475);
  const without=copy(level);delete without.mechanics.drops;without.mechanics.gravity=[{at:0,x:0,y:1,label:'正常重力'}];
  assert.equal(P.simulate(without,failures[level.id-1]).success,true);
  assert.equal(P.validateStroke(level,[[427,74],[480,100]]).code,'spawn-overlap');
  assert.equal(P.validateStroke(level,[[424,264],[450,390]]).code,'bounds');
});
test('新规则参数依然是闭合数据：v1 不吞 v2 字段，坏引用/回调/时序被拒绝',()=>{
  const old={...variants[0],version:1,chapter:'挑战'};assert.throws(()=>Format.validateLevel(old),/mechanics/);
  const bads=[
    {...variants[0],mechanics:{temporaryTerrain:[{index:99,removeAt:2200,label:'坏引用'}]}},
    {...variants[1],mechanics:{anchors:[{x:270,y:130,radius:10,label:'金环',onAttach:'alert(1)'}]}},
    {...variants[2],mechanics:{gravity:[{at:0,x:0,y:0,label:'零重力'}]}},
    {...variants[2],mechanics:{gravity:[{at:100,x:0,y:1,label:'缺少初始状态'}]}},
    {...variants[3],mechanics:{drawTop:60,drawBottom:200,drops:variants[3].mechanics.drops}},
    {...variants[3],mechanics:{drops:[{at:900,x:30,y:74,radius:22,mass:10,label:'圈出界'}]}}
  ];
  for(const bad of bads)assert.throws(()=>Format.validateLevel(bad));
});
