(function(root){
'use strict';
const C=typeof module==='object'&&module.exports ? require('../../content.js') : root.RescueContent;
C.register({type:'core/drops',kind:'rule',legacyKey:'drops',schema:{type:'array',minItems:1,maxItems:3,items:{$ref:'#/$defs/drop'}},
validate(data,p,V,level){const {object,number,text,array,fail}=V;const m={drops:data};array(m.drops,1,3,p,(drop,p)=>{
      object(drop,['at','x','y','radius','mass','label','restitution'],['at','x','y','radius','mass','label'],p);
      number(drop.at,500,3500,`${p}.at`); number(drop.x,24,696,`${p}.x`); number(drop.y,40,350,`${p}.y`);
      number(drop.radius,10,35,`${p}.radius`); number(drop.mass,.1,30,`${p}.mass`); text(drop.label,60,`${p}.label`);
      if(drop.restitution!==undefined)number(drop.restitution,0,1,`${p}.restitution`);
      if(drop.x-drop.radius<24 || drop.x+drop.radius>696 || drop.y-drop.radius<24 || drop.y+drop.radius>400) fail(p,'落球出生圈必须完整位于 x=24–696、y=24–400 内');
      const person={x:level.load.x-20,y:level.chair[0].y-71.5,w:40,h:69};
      const cat=level.load.cat ? [{x:level.load.catX-21,y:level.chair[0].y-38.5,w:42,h:35}] : [];
      if([...level.chair,...level.terrain,...(level.extensions||[]).flatMap(e=>C.get(e.type).obstacles?.(e.params)||[]),person,...cat].some(r=>Math.hypot(drop.x-Math.max(r.x,Math.min(r.x+r.w,drop.x)),drop.y-Math.max(r.y,Math.min(r.y+r.h,drop.y)))<drop.radius)) fail(p,'出生圈不能与初始木椅、载荷或实心地形重叠');
    });
  },
translate:(data,at)=>data.map(p=>({...p,x:p.x+at.x,y:p.y+at.y})),select:level=>level.mechanics?.drops,compile(data,level){level.mechanics.drops=[...(level.mechanics.drops||[]),...data];},
stroke({sampled,points,api:P},data){if(data.some(d=>P.closestOnStroke(sampled,d).distance<d.radius+P.RADIUS || P.closestOnStroke(points,d).distance<d.radius+P.RADIUS))return {code:'spawn-overlap',message:'不能把线画进球的虚线出生圈；在下方拦截真正落下来的球。'};},
beforeStep({trial:t,Matter:{Bodies,Body,Composite}},data){for(const [index,drop] of data.entries())if(t.elapsed+1e-6>=drop.at&&!t.drops.some(d=>d.index===index)){const body=Bodies.circle(drop.x,drop.y,drop.radius,{friction:.08,frictionStatic:.2,restitution:drop.restitution??.08,frictionAir:.005,label:'falling-ball'});Body.setMass(body,drop.mass);Composite.add(t.engine.world,body);t.drops.push({index,body});t.dynamicBodies.push(body);}},
afterStep({trial:t}){for(const pair of t.engine.pairs.list)if(pair.isActive){const a=pair.bodyA.parent,b=pair.bodyB.parent;if((a===t.chair&&t.drops.some(d=>d.body===b))||(b===t.chair&&t.drops.some(d=>d.body===a)))t.dropImpact=true;}},
events:data=>data.map((d,index)=>({at:d.at,type:'drop',index,label:d.label+'落下'})),
failurePriority:10,failure:({trial:t})=>t.dropImpact?{code:'impact',reason:'落球真的撞上了结构，冲击或新增载荷把它掀翻了。可以用支架承受，也可以用斜面把球导开。'}:null,
layer:'foreground',render(view){const {ctx,level,trial,state,time,isRunning,m,elapsed,gravity,failed,P,C,roundRect,path,text,ellipse,arrow,cat}=view;
    for(const [index,drop] of (m.drops || []).entries()) {
      const spawned=trial?.drops.find(item=>item.index===index);
      if(!spawned) {
        ctx.save();ctx.setLineDash([4,5]);ellipse(ctx,drop.x,drop.y,drop.radius,drop.radius,'#d9def04d','#9ba5bd',1.5);ctx.restore();
        text(ctx,`${((drop.at-elapsed)/1000).toFixed(1)}s 后落下`+(drop.restitution!==undefined?` · 弹性${drop.restitution}`:''),drop.x+drop.radius+10,drop.y+4,11,'#939db5');
        text(ctx,'出生圈勿画',drop.x,drop.y+drop.radius+15,9,'#a6aec1','center');
      } else {
        const b=spawned.body;ctx.save();ctx.translate(b.position.x,b.position.y);ctx.rotate(b.angle);
        ellipse(ctx,0,0,drop.radius,drop.radius,'#939fc0','#606f91',2.4);
        ellipse(ctx,-drop.radius*.24,-drop.radius*.3,3,3,'#596b8d');ellipse(ctx,drop.radius*.18,-drop.radius*.35,3,3,'#596b8d');ellipse(ctx,0,drop.radius*.02,3,3,'#596b8d');ctx.restore();
      }
    }

}
});
})(globalThis);
