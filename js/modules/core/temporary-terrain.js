(function(root){
'use strict';
const C=typeof module==='object'&&module.exports ? require('../../content.js') : root.RescueContent;
C.register({
 type:'core/temporary-terrain',kind:'rule',legacyKey:'temporaryTerrain',
 schema:{type:'array',minItems:1,maxItems:8,items:{type:'object',additionalProperties:false,required:['target','removeAt','label'],properties:{target:{type:'string',pattern:'^[a-z0-9/-]+$'},removeAt:{type:'number',minimum:750,maximum:4000},label:{type:'string',minLength:1,maxLength:60}}}},
 validate(data,p,V){V.array(data,1,8,p,(item,q)=>{V.object(item,['target','removeAt','label'],['target','removeAt','label'],q);V.text(item.target,180,q+'.target');V.number(item.removeAt,750,4000,q+'.removeAt');V.text(item.label,60,q+'.label');});},
 validateLegacy(data,p,V,level){const seen=new Set();V.array(data,1,8,p,(item,q)=>{V.object(item,['index','removeAt','label'],['index','removeAt','label'],q);V.number(item.index,0,level.terrain.length-1,q+'.index',true);V.number(item.removeAt,750,4000,q+'.removeAt');V.text(item.label,60,q+'.label');if(seen.has(item.index))V.fail(q,'同一 terrain 不能重复撤走');seen.add(item.index);});},
 compile(data,level,{terrainIds,prefix}){const items=data.map(item=>{const index=terrainIds.get(prefix+item.target);if(index===undefined)throw Error(`撤走支点找不到 terrain：${prefix+item.target}`);return {index,removeAt:item.removeAt,label:item.label};});level.mechanics.temporaryTerrain=[...(level.mechanics.temporaryTerrain||[]),...items];},
 select:level=>level.mechanics?.temporaryTerrain,
 beforeStep({trial:t,Matter:{Composite}},data){for(const item of data)if(t.elapsed+1e-6>=item.removeAt&&!t.removedTerrain.has(item.index)){Composite.remove(t.engine.world,t.terrain[item.index]);t.removedTerrain.add(item.index);}},
 events:data=>data.map(item=>({at:item.removeAt,type:'terrain-removed',index:item.index,label:item.label+'撤走'})),
 failurePriority:20,failure:({trial:t})=>t.removedTerrain.size?{code:'support-removed',reason:'临时支点已撤走，原来的承重路线断了。撤走后也需要有永久落脚点，或有效挂接。'}:null
});
})(globalThis);
