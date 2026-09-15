/* Atomic local storage for imported data. Built-in levels and scores are untouched. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./level-format.js'));
  else root.RescueLevelLibrary = factory(root.RescueLevelFormat);
})(globalThis, function (Format) {
  'use strict';
  const KEY = 'save-one-stroke:imported:v1', MAX_LEVELS = 12;
  const clone = value => JSON.parse(JSON.stringify(value));
  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
    return value;
  }
  const fingerprint = value => JSON.stringify(canonical(value));
  function createLibrary(storage, makeKey = () => globalThis.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(36).slice(2)}`) {
    let entries = [], warning = '', blocked = false;
    try {
      const raw = storage.getItem(KEY);
      if (raw) {
        if (raw.length > Format.MAX_FILE_BYTES * MAX_LEVELS * 2) throw new Error('本地数据过大');
        const data = JSON.parse(raw);
        if (data?.format !== 'save-one-stroke-library' || data.version !== 1 || !Array.isArray(data.entries) || data.entries.length > MAX_LEVELS) throw new Error('格式错误');
        const seen = new Set();
        for (const entry of data.entries) {
          if (!entry || typeof entry.key !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(entry.key) || seen.has(entry.key)) throw new Error('本地键值错误');
          seen.add(entry.key); Format.validateLevel(entry.level);
          if (entry.record !== undefined && (!entry.record || !Number.isInteger(entry.record.stars) || entry.record.stars < 1 || entry.record.stars > 3 || !Number.isFinite(entry.record.ink) || entry.record.ink < 10 || entry.record.ink > entry.level.ink + 1)) throw new Error('成绩错误');
          entries.push({key:entry.key, level:clone(entry.level), ...(entry.record ? {record:{stars:entry.record.stars,ink:entry.record.ink}} : {})});
        }
      }
    } catch {
      entries = []; blocked = true;
      warning = '无法读取本地关卡库，原始存储未被覆盖；内置关仍可玩。请允许存储，或备份后清理损坏的本地关卡数据。';
    }
    function commit(next) {
      if (blocked) throw new Error(warning);
      try { storage.setItem(KEY, JSON.stringify({format:'save-one-stroke-library',version:1,entries:next})); }
      catch { throw new Error('本地保存失败：浏览器未允许存储或空间不足；未替换当前关卡，也未覆盖已有存档。'); }
      entries = next;
    }
    return {
      get warning() { return warning; },
      list: () => clone(entries),
      get: key => { const entry = entries.find(e => e.key === key); return entry ? clone(entry) : null; },
      add(level) {
        Format.validateLevel(level);
        const duplicate = entries.find(e => fingerprint(e.level) === fingerprint(level));
        if (duplicate) return { ...clone(duplicate), duplicate:true };
        if (entries.length >= MAX_LEVELS) throw new Error(`本地最多保存 ${MAX_LEVELS} 关，请先移除不需要的本地关卡。`);
        const entry = {key:makeKey(),level:clone(level)};
        commit([...entries,entry]); return clone(entry);
      },
      remove(key) { commit(entries.filter(e => e.key !== key)); },
      record(key, result) {
        if (!Number.isInteger(result.stars) || result.stars < 1 || result.stars > 3 || !Number.isFinite(result.ink)) throw new Error('成绩无效');
        commit(entries.map(entry => entry.key === key ? {...entry,record:{stars:Math.max(entry.record?.stars || 0,result.stars),ink:Math.min(entry.record?.ink ?? Infinity,result.ink)}} : entry));
      }
    };
  }
  return { KEY, MAX_LEVELS, createLibrary };
});
