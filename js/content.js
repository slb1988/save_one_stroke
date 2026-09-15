/* Trusted repository modules only. JSON selects registered types; it never loads code. */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const api=factory(node ? require('./validation.js') : root.RescueValidation);
  if(node) {
    module.exports=api;
    const path=require('node:path'),{modules}=require('../scripts/content-index.cjs');
    for(const file of modules().files) require(path.join(__dirname,'modules',file));
  } else {
    root.RescueContent=api;
    const base=new URL('./modules/',document.currentScript.src), loaded=new Set();
    let pending;
    api.refresh=()=> pending ||= (async()=>{
      const response=await fetch(new URL('manifest.json',base),{cache:'no-store'});
      if(!response.ok) throw Error(`模块目录加载失败 (${response.status})`);
      const manifest=await response.json();
      if(manifest?.format!=='save-one-stroke-modules' || manifest.version!==1 || !Array.isArray(manifest.files)) throw Error('模块目录格式错误');
      for(const file of manifest.files) {
        if(typeof file!=='string' || !/^[a-z0-9-]+\/[a-z0-9-]+\.js$/.test(file)) throw Error('模块目录路径错误');
        if(loaded.has(file)) continue;
        await new Promise((resolve,reject)=>{
          const script=document.createElement('script');script.src=new URL(file,base);script.onload=resolve;script.onerror=()=>reject(Error(`无法加载模块 ${file}`));document.head.append(script);
        });
        loaded.add(file);
      }
    })().finally(()=>{pending=null;});
    api.ready=api.refresh();
  }
})(globalThis,function(V){
  'use strict';
  const definitions=new Map(), cache=new WeakMap(), sources=new WeakMap();
  const clone=value=>JSON.parse(JSON.stringify(value));
  const TYPE=/^[a-z0-9-]+\/[a-z0-9-]+$/;
  function register(def) {
    if(!def || !TYPE.test(def.type) || !['element','rule','prefab'].includes(def.kind) || typeof def.validate!=='function' || !def.schema) throw Error('模块必须提供 type/kind/validate/schema');
    if(definitions.has(def.type)) throw Error(`模块重复注册：${def.type}`);
    definitions.set(def.type,Object.freeze(def));
  }
  function get(type) { const def=definitions.get(type);if(!def) throw Error(`未安装可信模块：${type}`);return def; }
  function resolve(source,fresh=false) {
    if(source.version!==3 || sources.has(source)) return source;
    if(!fresh && cache.has(source)) return cache.get(source);
    const level={...source,chair:[],terrain:[],forbiddenZones:[],mechanics:{...source.drawArea},forces:[],extensions:[]};
    const seen=new Set(), terrainIds=new Map(), deferred=[];
    V.array(source.scene,1,80,'$.scene',(entry,p)=>visit(entry,p,{x:0,y:0},'',0));
    function visit(entry,p,offset,prefix,depth) {
      V.object(entry,['id','type','params','at'],['id','type','params'],p);
      if(typeof entry.id!=='string'|| !/^[a-z0-9-]{1,60}$/.test(entry.id)) V.fail(`${p}.id`,'需要小写字母、数字或连字符，最多60字');
      const id=prefix+entry.id;if(seen.has(id)) V.fail(p,`重复场景标识 ${id}`);seen.add(id);
      if(seen.size>160) V.fail(p,'展开后最多160项');
      if(entry.at!==undefined) V.point(entry.at,`${p}.at`);
      const at={x:offset.x+(entry.at?.x||0),y:offset.y+(entry.at?.y||0)},def=get(entry.type),params=clone(entry.params);
      if(def.kind!=='rule') def.validate(params,`${p}.params`,V,level);
      if(def.kind==='prefab') {
        if(depth>=2) V.fail(p,'prefab 最多嵌套两层');
        const children=def.expand(params);
        V.array(children,1,80,p,(child,q)=>visit(child,q,at,id+'/',depth+1));
      } else deferred.push({def,params,id,at,p,prefix});
    }
    // Geometry first, rules second: references are independent of declaration order.
    for(const item of deferred.filter(i=>i.def.kind==='element')) {
      const {def,params,id,at,p}=item;
      const data=def.translate ? def.translate(params,at) : params;
      def.validate(data,`${p}.params (变换后)`,V,level);
      if(def.compile) def.compile(data,level,{id,terrainIds});
      else level.extensions.push({type:def.type,id,params:data});
    }
    for(const item of deferred.filter(i=>i.def.kind==='rule')) {
      const {def,params,id,at,p,prefix}=item;
      const data=def.translate ? def.translate(params,at) : params;
      def.validate(data,`${p}.params`,V,level);
      if(def.compile) def.compile(data,level,{id,terrainIds,prefix});
      else level.extensions.push({type:def.type,id,params:data});
    }
    cache.set(source,level);sources.set(level,source);return level;
  }
  function instances(raw) {
    const level=resolve(raw),items=[];
    for(const def of definitions.values()) if(def.select && !(def.legacyKey && level.version===1)) {
      const params=def.select(level);if(params!==undefined && params!==null) items.push({def,params});
    }
    for(const item of level.extensions||[]) items.push({def:get(item.type),params:item.params,id:item.id});
    return items;
  }
  function call(items,hook,context) { for(const item of items) if(item.def[hook]) item.def[hook](context,item.params,item.state); }
  function runtime(level) { return instances(level).map(item=>({...item,state:{}})); }
  function render(layer,context) {
    for(const item of context.trial?.modules || instances(context.level)) {
      if(item.def.layer===layer && item.def.render) item.def.render(context,item.params,item.state);
    }
  }
  return {register,get,resolve,source:level=>sources.get(level)||level,instances,runtime,call,render,list:()=>[...definitions.values()],TYPE};
});
