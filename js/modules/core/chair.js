(function(root){
'use strict';
const C=typeof module==='object'&&module.exports ? require('../../content.js') : root.RescueContent;
C.register({type:'core/chair',kind:'element',schema:{type:'array',minItems:1,maxItems:30,items:{$ref:'#/$defs/woodRect'}},
validate(data,p,V){V.array(data,1,30,p,(r,q)=>{V.rect(r,q,['kind']);if(!['seat','leg'].includes(r.kind))V.fail(q+'.kind','只能是seat或leg');});},
translate:(data,at)=>data.map(r=>({...r,x:r.x+at.x,y:r.y+at.y})),compile(data,level){level.chair.push(...data);},
select:level=>level.chair,
create:(data,{rectBody})=>data.map(r=>rectBody(r,{density:0.0015,label:'wood'})),
layer:'chair',render(view){const {ctx,level,trial,state,time,isRunning,m,elapsed,gravity,failed,P,C,roundRect,path,text,ellipse,arrow,cat}=view;
    for (const r of [...level.chair].reverse()) {
      roundRect(ctx, r.x, r.y, r.w, r.h, r.kind === 'seat' ? 5 : 3, C.wood, C.edge, 2.4);
      if (r.kind === 'seat') {
        path(ctx, [[r.x + 12, r.y + 6], [r.x + r.w - 13, r.y + 5]], '#eed0a3', 1.5);
        [r.x + 13, r.x + r.w - 14].forEach(x => ellipse(ctx, x, r.y + r.h / 2, 1.4, 1.4, '#988354'));
      } else path(ctx, [[r.x + 5, r.y + 15], [r.x + 5, r.y + r.h - 12]], '#edd0a3', 1);
    }

}
});
})(globalThis);
