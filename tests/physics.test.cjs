'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const levels = require('../js/levels.js').levels.filter(l=>l.version<3);
const P = require('../js/physics.js');
const { solutions, failures, alternatives } = require('./fixtures.cjs');

for (const [i, level] of levels.entries()) {
  test(`关 ${level.id}「${level.title}」: 合法解承重 5 秒`, () => {
    const result = P.simulate(level, solutions[i]);
    assert.equal(result.valid, true); assert.equal(result.attached, true);
    assert.equal(result.success, true, JSON.stringify(result));
    assert.equal(result.duration, 5000); assert.equal(result.stars, 3);
    assert.ok(result.contacts.length >= 2); assert.ok(result.maxTilt < 10);
  });
  test(`关 ${level.id}: 合法但错误的几何必须失败`, () => {
    const result = P.simulate(level, failures[i]);
    assert.equal(result.valid, true); assert.equal(result.attached, true);
    assert.equal(result.success, false, JSON.stringify(result));
    assert.notEqual(result.code, 'stable'); assert.equal(result.duration, 5000);
  });
  test(`关 ${level.id}: 不同路径也能解，不匹配模板`, () => {
    const result = P.simulate(level, alternatives[i]);
    assert.equal(result.valid, true); assert.equal(result.success, true, JSON.stringify(result));
  });
}

test('没接木椅的悬空画线是动态刚体，不钉在空气里', () => {
  const trial = P.createTrial(levels[0], [[510,270],[510,360]]);
  assert.equal(trial.valid, true); assert.equal(trial.stroke.attached, false);
  assert.ok(trial.looseInk); assert.equal(trial.looseInk.isStatic, false); assert.equal(trial.chair.isStatic, false);
  const start = trial.looseInk.position.y;
  for (let i = 0; i < 25; i++) P.step(trial);
  assert.ok(trial.looseInk.position.y > start + 10);
  while (!trial.ended) P.step(trial);
  assert.equal(trial.outcome.success, false); assert.equal(trial.outcome.code, 'detached');
});
test('没有地板的洞不是隐藏的静态支点', () => {
  const vertical = [[405,264],[405,395.5]];
  assert.equal(P.simulate(levels[0], vertical).success, true);
  assert.equal(P.simulate(levels[2], vertical).success, false);
});
test('同一把椅子、同一笔画，改变载荷位置会改变稳定性', () => {
  const chair = levels[1];
  const leftBracing = [[252,264],[210,395.5]];
  assert.equal(P.simulate(chair, leftBracing).success, false);
  const centred = { ...chair, load: { x: 300, mass: 15 } };
  assert.equal(P.simulate(centred, leftBracing).success, true);
});
test('碰到猫区的整段几何被阻止，不仅检查端点', () => {
  assert.equal(P.validateStroke(levels[3], [[410,264],[499,395.5]]).code, 'cat');
  assert.equal(P.validateStroke(levels[3], [[342,350],[499,350]]).code, 'cat');
});
test('墨水严格限长、零笔画/非数字/画入实心区/画人区域均不能试坐', () => {
  assert.equal(P.validateStroke(levels[0], []).code, 'empty');
  assert.equal(P.validateStroke(levels[0], [[404,264],[404,268]]).code, 'short');
  assert.equal(P.validateStroke(levels[0], [[404,264],[650,395]]).code, 'ink');
  assert.equal(P.validateStroke(levels[0], [[NaN,264],[400,395]]).code, 'invalid');
  assert.equal(P.validateStroke(levels[0], [[404,264],[404,410]]).code, 'terrain');
  assert.equal(P.validateStroke(levels[0], [[404,230],[404,360]]).code, 'bounds');
});
test('表面吸附有界，空洞不会吸附；吸附后的长度仍计费', () => {
  assert.deepEqual(P.snapEndpoint([404,398], levels[0]), { x:404, y:395.5 });
  assert.deepEqual(P.snapEndpoint([404,398], levels[2]), { x:404, y:398 });
  assert.deepEqual(P.snapEndpoint([404,370], levels[0]), { x:404, y:370 });
  const end = P.snapEndpoint([404,390], levels[0]);
  assert.ok(P.length([{ x:404, y:264 }, end]) > 126);
});
test('逐帧浏览器 API 和离线验收共用同一固定步长与判定', () => {
  const trial = P.createTrial(levels[2], solutions[2]);
  for (let i = 0; i < 599; i++) P.step(trial);
  assert.equal(trial.ended, false);
  P.step(trial); assert.equal(trial.ended, true);
  const offline = P.simulate(levels[2], solutions[2]);
  for (const key of ['success', 'code', 'stars', 'ink', 'maxTilt', 'duration']) assert.equal(trial.outcome[key], offline[key]);
  const position = { ...trial.chair.position }; P.step(trial); assert.deepEqual(trial.chair.position, position);
});
test('短解端点 ±6 的自由变化仍可玩，不要求像素描线', () => {
  for (const dx of [-6, -3, 3, 6]) {
    const path = solutions[0].map(([x,y]) => [x + dx, y]);
    assert.equal(P.simulate(levels[0], path).success, true);
  }
});
test('倾斜越过失败阈值后不能靠翻回正面“复活”', () => {
  const trial = P.createTrial(levels[0], failures[0]);
  while (!trial.outcome) P.step(trial);
  assert.equal(trial.outcome.success, false);
  const code = trial.outcome.code;
  while (!trial.ended) P.step(trial);
  assert.equal(trial.outcome.success, false); assert.equal(trial.outcome.code, code);
});
