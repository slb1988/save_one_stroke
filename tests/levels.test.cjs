'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { levels, errors, validateLevel, manifestFiles } = require('../js/levels.js');
const P = require('../js/physics.js');
const { solutions, failures } = require('./fixtures.cjs');

test('每关为独立版本化 JSON，目录唯一且完整', () => {
  const files = manifestFiles(require('../levels/manifest.json'));
  // 清单与有效加载集合相符：数量随关卡增减，不写死；隔离/坏文件必须为零。
  assert.equal(levels.length, files.length); assert.deepEqual(errors, []);
  for (let i = 0; i < files.length; i++) {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../levels', files[i]), 'utf8'));
    assert.equal(validateLevel(data), data);
    assert.deepEqual(data, levels.find(l=>l.id===data.id));
    assert.ok(!('solution' in data) && !('answer' in data));
  }
});
test('内置 JSON 序列化/反序列化后，用同一物理引擎得到相同结果', () => {
  for (const [i, level] of levels.filter(l=>l.version<3).entries()) {
    const restored = JSON.parse(JSON.stringify(level));
    assert.deepEqual(P.simulate(restored, solutions[i]), P.simulate(level, solutions[i]));
  }
});
test('关卡格式拒绝错误版本、负尺寸、无效载荷和越界外力', () => {
  assert.throws(() => validateLevel({...levels[0],version:2}));
  assert.throws(() => validateLevel({...levels[0],chair:[{...levels[0].chair[0],w:-10}]}));
  assert.throws(() => validateLevel({...levels[0],load:{x:300,mass:-1}}));
  assert.throws(() => validateLevel({...levels[6],forces:[{...levels[6].forces[0],fx:99}]}));
  assert.throws(() => manifestFiles({format:'save-one-stroke-manifest',version:1,files:['../outside.json']}));
});
test('进阶风力是定时物理推力：同一单侧支架在无风时成功，有换向风时失败', () => {
  const level = levels[6], stroke = failures[6];
  assert.equal(P.simulate({...level,forces:[]},stroke).success, true);
  assert.equal(P.simulate(level,stroke).success, false);
  assert.deepEqual(P.activeForces(level,599), []);
  assert.equal(P.activeForces(level,1000)[0].fx, .017);
  assert.equal(P.activeForces(level,3000)[0].fx, -.017);
  assert.deepEqual(P.activeForces(level,4500), []);
});
test('双猫是两个独立碰撞区，不可直接穿过去', () => {
  assert.equal(P.zones(levels[8]).length, 2);
  assert.equal(P.validateStroke(levels[8],[[412,264],[591,395.5]]).code, 'cat');
  assert.equal(P.simulate(levels[8],solutions[8]).success, true);
});
