/* One JSON file per level; the manifest is the only level registry. */
(function (root) {
  'use strict';
  function validateLevel(level) {
    const require = (ok, message) => { if (!ok) throw new Error(`关卡 ${level?.id ?? '?'}：${message}`); };
    const finite = value => typeof value === 'number' && Number.isFinite(value);
    const rect = r => r && ['x','y','w','h'].every(k => finite(r[k])) && r.w > 0 && r.h > 0 && r.x >= 0 && r.x + r.w <= 720 && r.y >= 0 && r.y + r.h <= 600;
    require(level && level.format === 'save-one-stroke-level' && level.version === 1, '不支持的文件格式或版本');
    require(Number.isInteger(level.id) && level.id > 0, 'id 必须是正整数');
    require(['入门', '挑战'].includes(level.chapter), 'chapter 必须是入门或挑战');
    for (const field of ['title','tag','brief','condition','quip','success','failure']) require(typeof level[field] === 'string' && level[field].length > 0 && level[field].length <= 300, `${field} 需要非空文字`);
    require(finite(level.ink) && finite(level.gold) && level.gold >= 10 && level.gold <= level.ink && level.ink <= 2000, '墨水或三星目标无效');
    require(Array.isArray(level.chair) && level.chair.length > 0 && level.chair.length <= 30 && level.chair.every(rect) && level.chair[0].kind === 'seat', 'chair 第一块必须是座面矩形');
    require(Array.isArray(level.terrain) && level.terrain.length > 0 && level.terrain.length <= 30 && level.terrain.every(rect), 'terrain 必须是承重矩形数组');
    require(level.load && finite(level.load.x) && level.load.x > 24 && level.load.x < 696 && finite(level.load.mass) && level.load.mass > 0 && level.load.mass <= 200, '试坐载荷无效');
    if (level.load.cat) require(finite(level.load.catX) && finite(level.load.catMass) && level.load.catMass > 0, '抱猫载荷无效');
    require(Array.isArray(level.hint) && level.hint.length >= 1 && level.hint.every(h => typeof h === 'string'), 'hint 需要提示文字数组');
    if (level.forbidden) require(rect(level.forbidden), '猫区矩形无效');
    if (level.forbiddenZones) require(Array.isArray(level.forbiddenZones) && level.forbiddenZones.length <= 10 && level.forbiddenZones.every(rect), '猫区数组无效');
    if (level.gap) require(Array.isArray(level.gap) && level.gap.length === 2 && level.gap.every(finite) && level.gap[0] < level.gap[1], '空洞标记无效');
    if (level.labels) require(Array.isArray(level.labels) && level.labels.every(l => finite(l.x) && finite(l.y) && typeof l.text === 'string' && Array.isArray(l.to) && l.to.length === 2 && l.to.every(finite)), '画板注释无效');
    if (level.forces) require(Array.isArray(level.forces) && level.forces.length <= 10 && level.forces.every(f => finite(f.start) && finite(f.end) && f.start >= 0 && f.end <= 5000 && f.end > f.start && finite(f.fx) && Math.abs(f.fx) <= .1 && finite(f.fy || 0) && Math.abs(f.fy || 0) <= .1 && finite(f.at?.x) && finite(f.at?.y) && typeof f.label === 'string'), '定时外力无效');
    return level;
  }
  function manifestFiles(manifest) {
    if (manifest?.format !== 'save-one-stroke-manifest' || manifest.version !== 1 || !Array.isArray(manifest.files) || !manifest.files.length || manifest.files.length > 100 || !manifest.files.every(f => typeof f === 'string' && /^\d{2,3}-[a-z0-9-]+\.json$/.test(f)) || new Set(manifest.files).size !== manifest.files.length) throw new Error('关卡目录 manifest.json 无效');
    return manifest.files;
  }
  function checkOrder(levels) {
    levels.forEach((level, i) => { validateLevel(level); if (level.id !== i + 1) throw new Error('关卡 id 必须与目录顺序一致，从 1 连续编号'); });
    return levels;
  }
  const api = { levels: [], WIDTH: 720, HEIGHT: 480, validateLevel, manifestFiles };
  if (typeof module === 'object' && module.exports) {
    api.levels = checkOrder(manifestFiles(require('../levels/manifest.json')).map(file => require('../levels/' + file)));
    module.exports = api;
  } else {
    const base = new URL('../levels/', document.currentScript.src);
    const json = async file => { const response = await fetch(new URL(file, base)); if (!response.ok) throw new Error(`无法加载关卡：${file} (${response.status})`); return response.json(); };
    api.ready = json('manifest.json').then(manifest => Promise.all(manifestFiles(manifest).map(json))).then(data => { api.levels.push(...checkOrder(data)); return api.levels; });
    root.RescueLevels = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
