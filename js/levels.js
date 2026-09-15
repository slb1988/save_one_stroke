/* The manifest registers built-ins; imported levels use the same format module. */
(function (root) {
  'use strict';
  const isNode = typeof module === 'object' && module.exports;
  const format = isNode ? require('./level-format.js') : root.RescueLevelFormat;
  function manifestFiles(manifest) {
    if (manifest?.format !== 'save-one-stroke-manifest' || manifest.version !== 1 || !Array.isArray(manifest.files) || !manifest.files.length || manifest.files.length > 100 || !manifest.files.every(f => typeof f === 'string' && /^\d{2,3}-[a-z0-9-]+\.json$/.test(f)) || new Set(manifest.files).size !== manifest.files.length) throw new Error('关卡目录 manifest.json 无效');
    return manifest.files;
  }
  function checkOrder(levels) {
    levels.forEach((level, i) => { format.validateLevel(level); if (level.id !== i + 1) throw new Error('内置关卡 id 必须与目录顺序一致，从 1 连续编号'); });
    return levels;
  }
  const api = { ...format, levels: [], WIDTH: 720, HEIGHT: 480, manifestFiles };
  if (isNode) {
    const fs = require('node:fs'), path = require('node:path');
    api.levels = checkOrder(manifestFiles(require('../levels/manifest.json')).map(file => format.parseLevel(fs.readFileSync(path.join(__dirname, '../levels', file), 'utf8'))));
    module.exports = api;
  } else {
    const base = new URL('../levels/', document.currentScript.src);
    const get = async file => { const response = await fetch(new URL(file, base)); if (!response.ok) throw new Error(`无法加载关卡：${file} (${response.status})`); return response.text(); };
    api.ready = get('manifest.json').then(source => Promise.all(manifestFiles(JSON.parse(source)).map(async file => format.parseLevel(await get(file))))).then(data => { api.levels.push(...checkOrder(data)); return api.levels; });
    root.RescueLevels = api;
  }
})(globalThis);
