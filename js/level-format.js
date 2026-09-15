/* Closed, inert JSON data contract. Shared by browser import and the offline CLI. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RescueLevelFormat = api;
})(globalThis, function () {
  'use strict';
  const MAX_FILE_BYTES = 64 * 1024;
  const byteLength = text => new TextEncoder().encode(text).length;
  const fail = (path, message) => { throw new Error(`${path}：${message}`); };
  function object(value, allowed, required, path) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, '需要 JSON 对象');
    for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${path}.${key}`, '不支持的字段（不允许脚本或自定义回调）');
    for (const key of required) if (!Object.hasOwn(value, key)) fail(`${path}.${key}`, '缺少必填字段');
  }
  function number(value, min, max, path, integer = false) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) fail(path, `需要 ${min}–${max} 的${integer ? '整数' : '有限数字'}`);
  }
  function text(value, max, path) {
    if (typeof value !== 'string' || !value.trim() || [...value].length > max) fail(path, `需要 1–${max} 字的非空纯文本`);
  }
  function array(value, min, max, path, item) {
    if (!Array.isArray(value) || value.length < min || value.length > max) fail(path, `需要 ${min}–${max} 项数组`);
    value.forEach((entry, i) => item(entry, `${path}[${i}]`));
  }
  function point(value, path) {
    object(value, ['x','y'], ['x','y'], path);
    number(value.x, 0, 720, `${path}.x`); number(value.y, 0, 480, `${path}.y`);
  }
  function rect(value, path, extra = []) {
    object(value, ['x','y','w','h',...extra], ['x','y','w','h'], path);
    number(value.x, 0, 719, `${path}.x`); number(value.y, 0, 480, `${path}.y`);
    number(value.w, 1, 720, `${path}.w`); number(value.h, 1, 600, `${path}.h`);
    if (value.x + value.w > 720 || value.y + value.h > 600) fail(path, '矩形右边界不得超过 720，下边界不得超过 600');
  }
  function validateLevel(level) {
    const required = ['format','version','id','chapter','title','tag','brief','condition','quip','success','failure','ink','gold','chair','terrain','load','hint'];
    object(level, [...required,'forbidden','forbiddenZones','gap','labels','forces'], required, '$');
    if (level.format !== 'save-one-stroke-level' || level.version !== 1) fail('$.version', '仅支持 save-one-stroke-level 格式的版本 1');
    number(level.id, 1, 999999, '$.id', true);
    if (!['入门','挑战'].includes(level.chapter)) fail('$.chapter', '只能是“入门”或“挑战”');
    for (const [key,max] of Object.entries({title:40,tag:80,brief:240,condition:300,quip:120,success:240,failure:240})) text(level[key], max, `$.${key}`);
    number(level.ink, 10, 2000, '$.ink'); number(level.gold, 10, 2000, '$.gold');
    if (level.gold > level.ink) fail('$.gold', '三星目标不能大于墨水总量');
    array(level.chair, 1, 30, '$.chair', (r,p) => { rect(r,p,['kind']); if (!['seat','leg'].includes(r.kind)) fail(`${p}.kind`, '只能是 seat 或 leg'); });
    if (level.chair[0].kind !== 'seat') fail('$.chair[0].kind', '第一块必须是座面 seat');
    array(level.terrain, 1, 30, '$.terrain', (r,p) => { rect(r,p,['step']); if (r.step !== undefined && typeof r.step !== 'boolean') fail(`${p}.step`, '需要布尔值'); });
    object(level.load, ['x','mass','cat','catX','catMass'], ['x','mass'], '$.load');
    number(level.load.x, 25, 695, '$.load.x'); number(level.load.mass, .1, 200, '$.load.mass');
    if (level.load.cat !== undefined && typeof level.load.cat !== 'boolean') fail('$.load.cat', '需要布尔值');
    if (level.load.cat || level.load.catX !== undefined) number(level.load.catX, 25, 695, '$.load.catX');
    if (level.load.cat || level.load.catMass !== undefined) number(level.load.catMass, .1, 200, '$.load.catMass');
    array(level.hint, 1, 4, '$.hint', (h,p) => text(h,300,p));
    if (level.forbidden && level.forbiddenZones) fail('$', 'forbidden 和 forbiddenZones 只能选择一种');
    if (level.forbidden !== undefined) rect(level.forbidden,'$.forbidden');
    if (level.forbiddenZones !== undefined) array(level.forbiddenZones, 1, 10, '$.forbiddenZones', (r,p) => { rect(r,p,['label']); if (r.label !== undefined) text(r.label,40,`${p}.label`); });
    if (level.gap !== undefined) {
      array(level.gap,2,2,'$.gap',(v,p) => number(v,0,720,p));
      if (level.gap[0] >= level.gap[1]) fail('$.gap', '左边界必须小于右边界');
    }
    if (level.labels !== undefined) array(level.labels,0,12,'$.labels',(label,p) => {
      object(label,['x','y','text','to'],['x','y','text','to'],p);
      number(label.x,0,720,`${p}.x`); number(label.y,0,480,`${p}.y`); text(label.text,100,`${p}.text`);
      array(label.to,2,2,`${p}.to`,(v,q) => number(v,0,q.endsWith('[0]') ? 720 : 480,q));
    });
    if (level.forces !== undefined) array(level.forces,0,10,'$.forces',(force,p) => {
      object(force,['start','end','fx','fy','at','label'],['start','end','fx','at','label'],p);
      number(force.start,0,5000,`${p}.start`); number(force.end,0,5000,`${p}.end`);
      if (force.start >= force.end) fail(p, '外力 start 必须小于 end');
      number(force.fx,-.1,.1,`${p}.fx`); if (force.fy !== undefined) number(force.fy,-.1,.1,`${p}.fy`);
      point(force.at,`${p}.at`); text(force.label,100,`${p}.label`);
    });
    if (byteLength(JSON.stringify(level)) > MAX_FILE_BYTES) fail('$', '单关最多 64 KiB');
    return level;
  }
  function parseLevel(source) {
    if (typeof source !== 'string') fail('$', '请提供 UTF-8 JSON 文本');
    if (byteLength(source) > MAX_FILE_BYTES) fail('$', '文件过大：单关最多 64 KiB');
    let level;
    try { level = JSON.parse(source.replace(/^\uFEFF/, '')); }
    catch { fail('$', 'JSON 语法错误；请检查逗号、双引号，不要包含注释、代码块或 JavaScript'); }
    return validateLevel(level);
  }
  function serializeLevel(level) { return JSON.stringify(validateLevel(level), null, 2) + '\n'; }
  return { MAX_FILE_BYTES, byteLength, validateLevel, parseLevel, serializeLevel };
});
