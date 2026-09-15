(function(root){
'use strict';
const C=typeof module==='object'&&module.exports ? require('../../content.js') : root.RescueContent;
C.register({type:'core/forces',kind:'rule',schema:{type:'array',minItems:1,maxItems:10,items:{$ref:'#/$defs/force'}},
validate(data,p,V){V.array(data,0,10,p,(f,q)=>{V.object(f,['start','end','fx','fy','at','label'],['start','end','fx','at','label'],q);V.number(f.start,0,5000,q+'.start');V.number(f.end,0,5000,q+'.end');if(f.start>=f.end)V.fail(q,'外力 start 必须小于 end');V.number(f.fx,-.1,.1,q+'.fx');if(f.fy!==undefined)V.number(f.fy,-.1,.1,q+'.fy');V.point(f.at,q+'.at');V.text(f.label,100,q+'.label');});},
translate:(data,at)=>data.map(f=>({...f,at:{x:f.at.x+at.x,y:f.at.y+at.y}})),compile(data,level){level.forces.push(...data);},select:level=>level.forces,
beforeStep({trial:t,api:P,Matter:{Body}},data){for(const f of data)if(t.elapsed>=f.start&&t.elapsed<f.end)Body.applyForce(t.chair,P.transform(f.at,t.chair,t.origin),{x:f.fx,y:f.fy||0});},
layer:'foreground',render(view){const {ctx,level,trial,state,time,isRunning,m,elapsed,gravity,failed,P,C,roundRect,path,text,ellipse,arrow,cat}=view;
    if (level.forces?.length) {
      const force = trial ? P.activeForces(level, trial.elapsed)[0] : null;
      const finishedForces = trial && trial.elapsed >= Math.max(...level.forces.map(item => item.end));
      text(ctx, force ? force.label : finishedForces ? '外力已结束，继续稳住' : `外力预报：${level.forces.length} 段 · 留意试坐条件`, 537, 70, 14, force ? '#c48051' : '#9da68a', 'center', 600);
      const magnitude = force ? Math.hypot(force.fx, force.fy || 0) : 0;
      if (force && isRunning && magnitude > 0) {
        for (let i = 0; i < 5; i++) {
          const x = 80 + ((time * .15 + i * 127) % 550), y = 118 + i * 16;
          arrow(ctx, [x, y], [x + force.fx / magnitude * 45, y + (force.fy || 0) / magnitude * 45], '#b1c4b5');
        }
      }
    }

}
});
})(globalThis);
