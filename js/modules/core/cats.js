(function(root){
'use strict';
const C=typeof module==='object'&&module.exports ? require('../../content.js') : root.RescueContent;
C.register({type:'core/cats',kind:'element',schema:{type:'array',minItems:1,maxItems:10,items:{$ref:'#/$defs/zoneRect'}},
validate(data,p,V){V.array(data,1,10,p,(r,q)=>{V.rect(r,q,['label']);if(r.label!==undefined)V.text(r.label,40,q+'.label');});},
translate:(data,at)=>data.map(r=>({...r,x:r.x+at.x,y:r.y+at.y})),compile(data,level){level.forbiddenZones.push(...data);},
select:level=>level.forbiddenZones || (level.forbidden ? [level.forbidden] : []),
create:(data,{rectBody})=>data.map(r=>rectBody(r,{isStatic:true,isSensor:true,label:'sleeping-cat'})),
layer:'background',render(view){const {ctx,level,trial,state,time,isRunning,m,elapsed,gravity,failed,P,C,roundRect,path,text,ellipse,arrow,cat}=view;
    for (const r of P.zones(level)) {
      roundRect(ctx, r.x, r.y, r.w, r.h, 8, '#f7e5dfb3');
      ctx.save(); ctx.setLineDash([5, 6]); roundRect(ctx, r.x, r.y, r.w, r.h, 8, null, '#d7ac9e', 1.6); ctx.restore();
      ctx.save(); ctx.translate(r.x + r.w / 2, r.y + r.h * .52);
      const catScale = Math.min(r.w / 138, r.h / 84); ctx.scale(catScale, catScale);
      cat(ctx, 8, 4, true, trial?.outcome?.code === 'cat'); ctx.restore();
      text(ctx, r.label ? `${r.label} · 请勿碰` : '猫的领地 · 请勿触碰', r.x + r.w / 2, r.y + r.h + 19, 10, '#bb9183', 'center');
    }

}
});
})(globalThis);
