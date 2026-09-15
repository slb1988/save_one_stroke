(function(root){
'use strict';
const C=typeof module==='object'&&module.exports ? require('../../content.js') : root.RescueContent;
C.register({type:'core/terrain',kind:'element',schema:{$ref:'#/$defs/terrainRect'},
validate(r,p,V){V.rect(r,p,['step']);if(r.step!==undefined&&typeof r.step!=='boolean')V.fail(p+'.step','需要布尔值');},
translate:(r,at)=>({...r,x:r.x+at.x,y:r.y+at.y}),
compile(r,level,{id,terrainIds}){terrainIds.set(id,level.terrain.length);level.terrain.push(r);},
select:level=>level.terrain,
create:(data,{rectBody})=>data.map(r=>rectBody(r,{isStatic:true,label:'terrain'})),
layer:'background',render(view){const {ctx,level,trial,state,time,isRunning,m,elapsed,gravity,failed,P,C,roundRect,path,text,ellipse,arrow,cat}=view;
    for (const [index,r] of level.terrain.entries()) {
      const temporary=m.temporaryTerrain?.find(item=>item.index===index), removed=trial?.removedTerrain.has(index);
      if(removed) {
        ctx.save();ctx.setLineDash([5,6]);roundRect(ctx,r.x,r.y,r.w,r.h,3,null,'#d0bca5',1.5);ctx.restore();
        text(ctx,'已撤走',r.x+r.w/2,r.y+24,11,'#ba8c69','center');continue;
      }
      roundRect(ctx,r.x,r.y,r.w,r.h,r.step ? [5,5,0,0] : 0,temporary ? '#efd6a5' : r.step ? '#d6dfc7' : C.floor);
      ctx.save();ctx.beginPath();ctx.rect(r.x,r.y+4,r.w,r.h);ctx.clip();
      const hatchHeight=level.version===2 ? Math.max(65,r.h) : 65;
      for(let i=r.x-hatchHeight;i<r.x+r.w+100;i+=15)path(ctx,[[i,r.y+9],[i+hatchHeight*.6,r.y+hatchHeight]],temporary ? '#d4af71' : r.step ? '#bccbb1' : '#d0d5c2',1);
      ctx.restore();path(ctx,[[r.x,r.y],[r.x+r.w,r.y]],temporary ? '#bd914e' : '#899979',2.3);
      if(temporary) text(ctx,`${((temporary.removeAt-elapsed)/1000).toFixed(1)}s 后撤走`,r.x+r.w/2,r.y+25,10,'#b08448','center',600);
      else if(r.step)text(ctx,'借力台阶',r.x+r.w/2,r.y+30,12,'#849575','center',500);
    }

}
});
})(globalThis);
