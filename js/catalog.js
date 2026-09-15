/* Stable identity, ordering and per-file fault isolation; no DOM or physics. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./level-format.js'));else root.RescueCatalog=factory(root.RescueLevelFormat);})(globalThis,function(Format){
 'use strict';
 function manifestFiles(m){
  if(m?.format!=='save-one-stroke-manifest'||![1,2].includes(m.version)||!Array.isArray(m.files)||m.files.length>2000||!m.files.every(f=>typeof f==='string'&&/^(?:[a-z0-9-]+\/)*[a-z0-9-]+\.json$/.test(f))||new Set(m.files).size!==m.files.length)throw Error('关卡目录 manifest.json 无效');
  return m.files;
 }
 function assemble(manifest,files){
  manifestFiles(manifest);
  const errors=[],candidates=[];
  for(const file of files){try{if(file.error)throw Error(file.error);const level=Format.parseLevel(file.source);const progression=level.progression||manifest.legacyProgression?.[level.id];
   if(!progression||!Number.isFinite(progression.groupOrder)||progression.groupOrder<0||!Number.isFinite(progression.order)||progression.order<0||!['easy','medium','hard'].includes(progression.difficulty))throw Error('缺少有效的难度/顺序元数据');
   candidates.push({level,file:file.path,progression});
  }catch(e){errors.push({file:file.path,message:e.message});}}
  const counts=new Map();for(const item of candidates){const key=String(item.level.id);counts.set(key,(counts.get(key)||0)+1);}
  const groupOrders=new Map();for(const c of candidates){const set=groupOrders.get(c.level.chapter)||new Set();set.add(c.progression.groupOrder);groupOrders.set(c.level.chapter,set);}
  const entries=candidates.filter(c=>{const reason=counts.get(String(c.level.id))>1?`重复关卡 id ${c.level.id}（全部冲突文件隔离，不按加载顺序覆盖）`:groupOrders.get(c.level.chapter).size>1?`分组 ${c.level.chapter} 的 groupOrder 冲突`:null;if(reason)errors.push({file:c.file,message:reason});return !reason;});
  entries.sort((a,b)=>a.progression.groupOrder-b.progression.groupOrder||a.level.chapter.localeCompare(b.level.chapter)||a.progression.order-b.progression.order||String(a.level.id).localeCompare(String(b.level.id)));
  return {entries,levels:entries.map(e=>e.level),errors};
 }
 return {manifestFiles,assemble};
});
