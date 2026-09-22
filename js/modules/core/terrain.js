(function(root){
'use strict';
const C=typeof module==='object'&&module.exports ? require('../../content.js') : root.RescueContent;
C.register({type:'core/terrain',kind:'element',schema:{$ref:'#/$defs/terrainRect'},
validate(r,p,V){V.rect(r,p,['step','friction']);if(r.step!==undefined&&typeof r.step!=='boolean')V.fail(p+'.step','需要布尔值');if(r.friction!==undefined)V.number(r.friction,0,1.5,p+'.friction');},
translate:(r,at)=>({...r,x:r.x+at.x,y:r.y+at.y}),
compile(r,level,{id,terrainIds}){terrainIds.set(id,level.terrain.length);level.terrain.push(r);},
select:level=>level.terrain,
// 可选 friction：低摩擦面是真实刚体属性。注意 Matter 0.20 setStatic 会把静态体 friction 重置为 1，
// 因此静态地形的实际摩擦一直是 1（physical.friction 0.95 被覆盖）；本参数在创建后显式赋值才真实生效，缺省保持现状。
create:(data,{rectBody})=>data.map(r=>{const b=rectBody(r,{isStatic:true,label:'terrain'});if(r.friction!==undefined){b.friction=r.friction;b.frictionStatic=r.friction;}return b;}),
layer:'background',render(view){const {ctx,level,trial,state,time,isRunning,m,elapsed,gravity,failed,P,C,roundRect,path,text,ellipse,arrow,cat}=view;
    for (const [index,r] of level.terrain.entries()) {
      const temporary=m.temporaryTerrain?.find(item=>item.index===index), removed=trial?.removedTerrain.has(index);
      if(removed) {
        ctx.save();ctx.setLineDash([5,6]);roundRect(ctx,r.x,r.y,r.w,r.h,3,null,'#d0bca5',1.5);ctx.restore();
        text(ctx,'已撤走',r.x+r.w/2,r.y+24,11,'#ba8c69','center');continue;
      }
      const icy=r.friction!==undefined&&r.friction<0.3;
      roundRect(ctx,r.x,r.y,r.w,r.h,r.step ? [5,5,0,0] : 0,temporary ? '#efd6a5' : icy ? '#dbe9ef' : r.step ? '#d6dfc7' : C.floor);
      ctx.save();ctx.beginPath();ctx.rect(r.x,r.y+4,r.w,r.h);ctx.clip();
      const hatchHeight=level.version===2 ? Math.max(65,r.h) : 65;
      for(let i=r.x-hatchHeight;i<r.x+r.w+100;i+=15)path(ctx,[[i,r.y+9],[i+hatchHeight*.6,r.y+hatchHeight]],temporary ? '#d4af71' : icy ? '#b9d3dd' : r.step ? '#bccbb1' : '#d0d5c2',1);
      ctx.restore();path(ctx,[[r.x,r.y],[r.x+r.w,r.y]],temporary ? '#bd914e' : icy ? '#7fa8b8' : '#899979',2.3);
      if(temporary) text(ctx,`${((temporary.removeAt-elapsed)/1000).toFixed(1)}s 后撤走`,r.x+r.w/2,r.y+25,10,'#b08448','center',600);
      else if(icy) text(ctx,'冰面 · 滑',r.x+r.w/2,r.y+25,11,'#6b96a8','center',500);
      else if(r.step)text(ctx,'借力台阶',r.x+r.w/2,r.y+30,12,'#849575','center',500);
    }

}
});
})(globalThis);
