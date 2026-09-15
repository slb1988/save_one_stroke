(function(root){
'use strict';
const C=typeof module==='object'&&module.exports ? require('../../content.js') : root.RescueContent;
C.register({type:'core/anchors',kind:'rule',legacyKey:'anchors',schema:{type:'array',minItems:1,maxItems:4,items:{$ref:'#/$defs/anchor'}},
validate(data,p,V,level){const {object,number,text,array,fail}=V;const m={anchors:data};array(m.anchors,1,4,p,(anchor,p)=>{
      object(anchor,['x','y','radius','label'],['x','y','radius','label'],p);
      number(anchor.x,24,696,`${p}.x`); number(anchor.y,40,460,`${p}.y`); number(anchor.radius,6,14,`${p}.radius`); text(anchor.label,60,`${p}.label`);
    });},
translate:(data,at)=>data.map(p=>({...p,x:p.x+at.x,y:p.y+at.y})),select:level=>level.mechanics?.anchors,compile(data,level){level.mechanics.anchors=[...(level.mechanics.anchors||[]),...data];},
init({trial:t,api:P,Matter:{Constraint,Composite}},data){
 const boundBody=t.stroke.attached?t.chair:t.looseInk,boundOrigin=t.stroke.attached?t.origin:t.inkOrigin;
 t.bindings=P.anchorMatches(t.level,t.stroke.points).map(hit=>{const constraint=Constraint.create({pointA:{...hit.point},bodyB:boundBody,pointB:{x:hit.point.x-boundOrigin.x,y:hit.point.y-boundOrigin.y},length:0,stiffness:1,damping:.12});Composite.add(t.engine.world,constraint);return {...hit,body:boundBody,constraint};});
},
status:({anchorCount},data)=>'已挂接 '+anchorCount+'/'+data.length+' · 挂点可转动',
failurePriority:40,failure:({trial:t})=>t.bindings.some(b=>b.body===t.chair)?{code:'swing',reason:'挂点是可转动的铰接，不会锁死椅子。重心偏在挂点一侧，会把整个结构转过去。'}:null,
layer:'background',render(view){const {ctx,level,trial,state,time,isRunning,m,elapsed,gravity,failed,P,C,roundRect,path,text,ellipse,arrow,cat}=view;
    for(const anchor of m.anchors || []) {
      const attached=P.closestOnStroke(state.points,anchor).distance<=anchor.radius+P.RADIUS;
      roundRect(ctx,anchor.x-20,anchor.y-20,40,40,6,'#e4e5d8','#b4baa1',1.5);
      for(const dx of [-14,14]) for(const dy of [-14,14]) { path(ctx,[[anchor.x+dx-2,anchor.y+dy],[anchor.x+dx+2,anchor.y+dy]],'#9fa68e',1); }
      ellipse(ctx,anchor.x,anchor.y,anchor.radius+3,anchor.radius+3,attached ? '#e2ce83' : '#f3e4b1','#ac8b42',2.5);
      ellipse(ctx,anchor.x,anchor.y,anchor.radius-3,anchor.radius-3,'#fbfaf1',attached ? '#669277' : '#c8b16c',2);
      text(ctx,anchor.label,anchor.x,anchor.y+33,10,'#a38b56','center');
    }

}
});
})(globalThis);
