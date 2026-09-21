/* Closed, inert JSON contract. All versions share geometry and module validation. */
(function(root,factory){
  if(typeof module==='object'&&module.exports) module.exports=factory(require('./validation.js'),require('./content.js'));
  else root.RescueLevelFormat=factory(root.RescueValidation,root.RescueContent);
})(globalThis,function(V,C){
  'use strict';
  const {MAX_FILE_BYTES,byteLength,fail,object,number,text,array,point,rect}=V;
  const narrative=['format','version','id','chapter','title','tag','brief','condition','quip','success','failure','ink','gold','load','hint'];
  function validateLevel(source) {
    source=C.source(source);
    const v3=source?.version===3, v2=source?.version===2;
    const required=[...narrative,...(v3?['scene','progression']:['chair','terrain',...(v2?['mechanics']:[])])];
    object(source,[...required,'gap','labels',...(v3?['drawArea','source']:['forbidden','forbiddenZones','forces'])],required,'$');
    if(source.format!=='save-one-stroke-level'||![1,2,3].includes(source.version))fail('$.version','仅支持 save-one-stroke-level 格式的版本 1、2 或 3');
    if(v3) {
      if(typeof source.id!=='string'||!C.TYPE.test(source.id)||source.id.length>100)fail('$.id','v3 需要稳定 namespace/name 标识，最多100字');
      text(source.chapter,40,'$.chapter');
      object(source.progression,['groupOrder','order','difficulty'],['groupOrder','order','difficulty'],'$.progression');
      number(source.progression.groupOrder,0,99999,'$.progression.groupOrder');number(source.progression.order,0,99999,'$.progression.order');
      if(!['easy','medium','hard'].includes(source.progression.difficulty))fail('$.progression.difficulty','只能是 easy、medium 或 hard');
      if(source.drawArea!==undefined)object(source.drawArea,['drawTop','drawBottom'],[],'$.drawArea');
      // 可选来源元数据：只含纯文本与 http/https 链接；不影响物理与胜负。
      if(source.source!==undefined){
        object(source.source,['prototype','url','credit','note'],['prototype','url'],'$.source');
        text(source.source.prototype,80,'$.source.prototype');
        text(source.source.url,200,'$.source.url');
        if(!/^https?:\/\/\S+$/.test(source.source.url))fail('$.source.url','来源链接只支持 http/https 协议');
        if(source.source.credit!==undefined)text(source.source.credit,80,'$.source.credit');
        if(source.source.note!==undefined)text(source.source.note,160,'$.source.note');
      }
    } else {
      number(source.id,1,999999,'$.id',true);
      if(!(v2?['入门','挑战','变种']:['入门','挑战']).includes(source.chapter))fail('$.chapter','不支持的旧版分组');
    }
    for(const [key,max] of Object.entries({title:40,tag:80,brief:240,condition:300,quip:120,success:240,failure:240}))text(source[key],max,`$.${key}`);
    number(source.ink,10,2000,'$.ink');number(source.gold,10,2000,'$.gold');
    if(source.gold>source.ink)fail('$.gold','三星目标不能大于墨水总量');
    object(source.load,['x','mass','cat','catX','catMass'],['x','mass'],'$.load');
    number(source.load.x,25,695,'$.load.x');number(source.load.mass,.1,200,'$.load.mass');
    if(source.load.cat!==undefined&&typeof source.load.cat!=='boolean')fail('$.load.cat','需要布尔值');
    if(source.load.cat||source.load.catX!==undefined)number(source.load.catX,25,695,'$.load.catX');
    if(source.load.cat||source.load.catMass!==undefined)number(source.load.catMass,.1,200,'$.load.catMass');
    array(source.hint,1,4,'$.hint',(h,p)=>text(h,300,p));
    if(source.gap!==undefined){array(source.gap,2,2,'$.gap',(v,p)=>number(v,0,720,p));if(source.gap[0]>=source.gap[1])fail('$.gap','左边界必须小于右边界');}
    if(source.labels!==undefined)array(source.labels,0,12,'$.labels',(l,p)=>{object(l,['x','y','text','to'],['x','y','text','to'],p);number(l.x,0,720,p+'.x');number(l.y,0,480,p+'.y');text(l.text,100,p+'.text');array(l.to,2,2,p+'.to',(v,q)=>number(v,0,q.endsWith('[0]')?720:480,q));});
    const level=v3?C.resolve(source,true):source;
    C.get('core/chair').validate(level.chair,'$.chair',V);
    if(level.chair[0].kind!=='seat')fail('$.chair[0].kind','第一块必须是座面 seat');
    array(level.terrain,1,30,'$.terrain',(r,p)=>C.get('core/terrain').validate(r,p,V));
    if(level.forbidden&&level.forbiddenZones)fail('$','forbidden 和 forbiddenZones 只能选择一种');
    if(level.forbidden!==undefined)rect(level.forbidden,'$.forbidden');
    if(level.forbiddenZones!==undefined && (!v3||level.forbiddenZones.length))C.get('core/cats').validate(level.forbiddenZones,'$.forbiddenZones',V);
    if(level.forces!==undefined)C.get('core/forces').validate(level.forces,'$.forces',V);
    if(v2||v3)validateMechanics(level,v3);
    if(byteLength(JSON.stringify(source))>MAX_FILE_BYTES)fail('$','单关最多 64 KiB');
    return source;
  }
  function validateMechanics(level,v3) {
    const m=level.mechanics, defs=C.list().filter(d=>d.legacyKey), keys=defs.map(d=>d.legacyKey);
    object(m,['drawTop','drawBottom',...keys],[],'$.mechanics');
    if(!v3&&!keys.some(key=>Object.hasOwn(m,key)))fail('$.mechanics','至少声明一个规则数组，不能仅改变画区');
    if(m.drawTop!==undefined){number(m.drawTop,40,400,'$.mechanics.drawTop');if(m.drawTop>level.chair[0].y-4)fail('$.mechanics.drawTop','不得低于默认座面画区上界');}
    if(m.drawBottom!==undefined){number(m.drawBottom,100,465,'$.mechanics.drawBottom');if(m.drawBottom<level.chair[0].y)fail('$.mechanics.drawBottom','下界不能高于座面顶面，否则无法接椅子');}
    if((m.drawTop??level.chair[0].y-4)>=(m.drawBottom??465))fail('$.mechanics','开放画区不能为空');
    for(const def of defs)if(m[def.legacyKey]!==undefined)(def.validateLegacy||def.validate)(m[def.legacyKey],`$.mechanics.${def.legacyKey}`,V,level);
  }
  function parseLevel(source) {
    if(typeof source!=='string')fail('$','请提供 UTF-8 JSON 文本');
    if(byteLength(source)>MAX_FILE_BYTES)fail('$','文件过大：单关最多 64 KiB');
    let level;try{level=JSON.parse(source.replace(/^\uFEFF/,''));}catch{fail('$','JSON 语法错误；请检查逗号、双引号，不要包含注释、代码块或 JavaScript');}
    return validateLevel(level);
  }
  function serializeLevel(level){return JSON.stringify(validateLevel(level),null,2)+'\n';}
  return {MAX_FILE_BYTES,byteLength,validateLevel,parseLevel,serializeLevel};
});
