'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { levels } = require('../js/levels.js');
const P = require('../js/physics.js');
const F = require('../js/level-format.js');
const { verifyCases } = require('../scripts/validate-level.cjs');
const batch = levels.filter(l => String(l.id).startsWith('remix/'));
const level = number => batch.find(l => l.id.startsWith(`remix/${String(number).padStart(2, '0')}-`));
const pack = l => JSON.parse(fs.readFileSync(path.join(__dirname, 'cases', `${l.id}.cases.json`), 'utf8'));
const stroke = (l, expected = 'success') => pack(l).cases.find(c => c.expected === expected).stroke;
const trial = (number, expected = 'success') => P.createTrial(level(number), stroke(level(number), expected));
const finish = t => { while (!t.ended) P.step(t); return t; };
const until = (t, ms) => { while (t.elapsed < ms) P.step(t); return t; };
const without = (number, type) => {
  const l = structuredClone(level(number));
  l.scene = l.scene.filter(e => e.type !== type);
  F.validateLevel(l);
  return l;
};

test('工坊确实新增24关，四章各6关，既有47关仍在', () => {
  assert.equal(batch.length, 24);
  assert.equal(levels.filter(l => !String(l.id).startsWith('remix/')).length >= 47, true);
  assert.equal(new Set(batch.map(l => l.chapter)).size, 4);
  for (const chapter of new Set(batch.map(l => l.chapter))) assert.equal(batch.filter(l => l.chapter === chapter).length, 6);
  for (let i = 1; i <= 24; i++) assert.ok(level(i));
});
for (const l of batch) test(`${l.id}: 独立JSON与合法成功/失败样例`, () => {
  const result = verifyCases(l, JSON.stringify(pack(l)));
  assert.equal(result.verifiedSolvable, true, JSON.stringify(result));
  assert.deepEqual(F.parseLevel(F.serializeLevel(l)), l);
});

test('下行同乘：平台真的下降40，椅子随之下降且仍过关', () => {
  const t = trial(1), y = t.chair.position.y;
  const platform = t.modules.find(m => m.def.type === 'lab/elevator').state.body;
  const platformY = platform.position.y;
  finish(t);
  assert.equal(t.outcome.success, true);
  assert.ok(Math.abs(platform.position.y - platformY - 40) < 0.01);
  assert.ok(t.chair.position.y > y + 35 && t.chair.position.y < y + 45);
});

test('单环换班、低位双环、分离班车：失败发生在变化以后', () => {
  for (const [number, changeAt] of [[2, 2700], [3, 1000], [4, 1600], [5, 1800], [9, 2200], [12, 1400], [14, 2200]]) {
    const t = until(trial(number, 'failure'), changeAt - 50);
    assert.equal(t.outcome, null, `第${number}关不应在机制变化前已失败`);
    assert.equal(finish(t).outcome.success, false);
  }
  const partial = finish(trial(4));
  assert.equal(partial.bindings.filter(b => b.body === partial.chair).length, 1);
  const below = finish(trial(5));
  assert.equal(below.bindings.filter(b => b.body === below.chair).length, 2);
  assert.equal(below.removedTerrain.size, 1);
});

test('斜重力的因果与替代解：窄脚在不换向时能稳，宽脚可自由滑到墙', () => {
  const l = level(8), bad = stroke(l, 'failure');
  assert.equal(P.simulate(l, bad).success, false);
  assert.equal(P.simulate(without(8, 'core/gravity'), bad).success, true);
  assert.equal(P.simulate(l, pack(l).cases[2].stroke).success, true);
  const toWall = finish(trial(11));
  assert.equal(toWall.bindings.length, 0);
  assert.deepEqual({ x: toWall.engine.gravity.x, y: toWall.engine.gravity.y }, { x: 1, y: 0 });
  assert.equal(toWall.outcome.success, true);
});

test('不要按开关：成功路线真的未触发，朴素画法真的触发并下降', () => {
  const good = finish(trial(16)), bad = finish(trial(16, 'failure'));
  const lift = t => t.modules.find(m => m.def.type === 'lab/trigger-lift').state;
  assert.equal(lift(good).triggered, false);
  assert.equal(lift(good).body.position.y, 281);
  assert.equal(lift(bad).triggered, true);
  assert.equal(lift(bad).body.position.y, 401);
  assert.equal(good.stroke.attached, false);
  assert.equal(good.outcome.success, true);
  assert.equal(bad.outcome.success, false);
});

test('球是资源而非装饰：去掉配重或叫车球，参考解不再成功', () => {
  for (const number of [17, 18, 24]) {
    const s = stroke(level(number));
    assert.equal(P.simulate(level(number), s).success, true);
    assert.equal(P.simulate(without(number, 'core/drops'), s).success, false, `第${number}关应真正依赖球`);
  }
});

test('独立落地箱、焊椅挡板、叫车后松手三种不同的承重交接', () => {
  const box = finish(trial(14));
  assert.equal(box.stroke.attached, false);
  assert.equal(box.bindings.length, 0);
  assert.equal(box.outcome.success, true);
  const ramp = finish(trial(22));
  assert.equal(ramp.stroke.attached, true);
  assert.equal(ramp.bindings.length, 0);
  assert.equal(ramp.drops.length, 2);
  assert.equal(ramp.outcome.success, true);
  const called = trial(24), lift = called.modules.find(m => m.def.type === 'lab/trigger-lift');
  until(called, 3450);
  assert.equal(lift.state.triggered, true);
  assert.ok(Math.abs(lift.state.body.position.y - 332) < 0.01, '松手前平台已经到站');
  assert.ok(called.bindings.length > 0);
  finish(called);
  assert.equal(called.bindings.length, 0);
  assert.equal(called.outcome.success, true);
  assert.equal(trial(24).modules.find(m => m.def.type === 'lab/trigger-lift').state.triggered, false, '重试没有继承触发状态');
});
