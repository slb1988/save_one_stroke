/* Dev serves a live index; static hosts serve the generated same-path index. */
(function(root){
 'use strict';
 const node=typeof module==='object'&&module.exports;
 const Format=node?require('./level-format.js'):root.RescueLevelFormat;
 const Catalog=node?require('./catalog.js'):root.RescueCatalog;
 const api={...Format,manifestFiles:Catalog.manifestFiles,levels:[],entries:[],errors:[],WIDTH:720,HEIGHT:480};
 function commit(next){api.levels.splice(0,api.levels.length,...next.levels);api.entries=next.entries;api.errors=next.errors;return api.levels;}
 if(node){
  const fs=require('node:fs'),path=require('node:path'),{discover}=require('../scripts/content-index.cjs');
  api.refresh=()=>{const m=discover();return commit(Catalog.assemble(m,m.files.map(file=>{try{return {path:file,source:fs.readFileSync(path.join(__dirname,'../levels',file),'utf8')};}catch(e){return {path:file,error:e.message};}})));};
  api.refresh();module.exports=api;
 }else{
  const base=new URL('../levels/',document.currentScript.src);
  const get=async file=>{const r=await fetch(new URL(file,base),{cache:'no-store'});if(!r.ok)throw Error(`无法加载 (${r.status})`);return r.text();};
  let pending;
  api.refresh=()=>pending||=(async()=>{
   await root.RescueContent.refresh();
   const manifest=JSON.parse(await get('manifest.json'));
   const files=await Promise.all(Catalog.manifestFiles(manifest).map(async file=>{try{return {path:file,source:await get(file)};}catch(e){return {path:file,error:e.message};}}));
   const next=Catalog.assemble(manifest,files);
   if(!next.levels.length)throw Error(next.errors.map(e=>e.file+': '+e.message).join('\n')||'目录没有有效关卡');
   return commit(next);
  })().finally(()=>{pending=null;});
  api.ready=api.refresh();root.RescueLevels=api;
 }
})(globalThis);
