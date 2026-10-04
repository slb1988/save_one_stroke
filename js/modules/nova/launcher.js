/* Marked projectiles with a real initial velocity, not a scripted flight path. */
(function(root){
'use strict';
const C=typeof module==='object'&&module.exports?require('../../content.js'):root.RescueContent;
const n=(minimum,maximum)=>({type:'number',minimum,maximum});
C.register({type:'nova/launcher',kind:'rule',
 schema:{type:'object',additionalProperties:false,required:['ball','x','y','at','vx','vy','radius','mass','label'],properties:{ball:{type:'string',pattern:'^[a-z][a-z0-9-]{0,15}$'},x:n(24,696),y:n(40,350),at:n(500,3500),vx:n(-14,14),vy:n(-14,14),radius:n(10,30),mass:n(.1,30),restitution:n(0,1),label:{type:'string',minLength:1,maxLength:40}}},
 validate(d,p,V){V.object(d,['ball','x','y','at','vx','vy','radius','mass','restitution','label'],['ball','x','y','at','vx','vy','radius','mass','label'],p);if(typeof d.ball!=='string'||!/^[a-z][a-z0-9-]{0,15}$/.test(d.ball))V.fail(p+'.ball','需要1–16位小写球标识');for(const [k,a,b]of [['x',24,696],['y',40,350],['at',500,3500],['vx',-14,14],['vy',-14,14],['radius',10,30],['mass',.1,30]])V.number(d[k],a,b,p+'.'+k);if(d.restitution!==undefined)V.number(d.restitution,0,1,p+'.restitution');V.text(d.label,40,p+'.label');if(d.x-d.radius<24||d.x+d.radius>696||d.y-d.radius<24||d.y+d.radius>400)V.fail(p,'出生圈超出安全边界');},
 validateScene(d,p,V,l){const launchers=l.extensions.filter(e=>e.type==='nova/launcher');if(launchers.length>6)V.fail(p,'每关最多6个标记球');if(launchers.filter(e=>e.params.ball===d.ball).length!==1)V.fail(p,'标记球id必须唯一');const person={x:l.load.x-20,y:l.chair[0].y-71.5,w:40,h:69};const passenger=l.load.cat?[{x:l.load.catX-21,y:l.chair[0].y-38.5,w:42,h:35}]:[];const obstacles=[...l.chair,...l.terrain,person,...passenger,...l.extensions.flatMap(e=>C.get(e.type).obstacles?.(e.params)||[])];if(obstacles.some(r=>Math.hypot(d.x-Math.max(r.x,Math.min(r.x+r.w,d.x)),d.y-Math.max(r.y,Math.min(r.y+r.h,d.y)))<d.radius))V.fail(p,'球出生圈与开局实体重叠');},
 translate:(d,a)=>({...d,x:d.x+a.x,y:d.y+a.y}),
 stroke({sampled,points,api:P},d){if([sampled,points].some(s=>P.closestOnStroke(s,d).distance<d.radius+P.RADIUS))return {code:'spawn-overlap',message:'不要画入发射球的虚线出生圈。'};},
 init(_,d,s){s.body=null;},
 beforeStep({trial:t,Matter:{Bodies,Body,Composite}},d,s){if(s.body||t.elapsed+1e-6<d.at)return;s.body=Bodies.circle(d.x,d.y,d.radius,{friction:.08,frictionStatic:.2,frictionAir:.005,restitution:d.restitution??.08,label:'falling-ball',plugin:{novaBall:d.ball}});Body.setMass(s.body,d.mass);Body.setVelocity(s.body,{x:d.vx,y:d.vy});Composite.add(t.engine.world,s.body);t.dynamicBodies.push(s.body);},
 events:d=>[{at:d.at,type:'launch',label:d.label+'发射'}],
 inspect:s=>({ball:s.body?.plugin.novaBall,position:s.body?{...s.body.position}:null,velocity:s.body?{...s.body.velocity}:null}),
 layer:'foreground',render({ctx,ellipse,text,arrow,elapsed},d,s){const b=s?.body,p=b?.position||d;ctx.save();if(!b)ctx.setLineDash([4,4]);ellipse(ctx,p.x,p.y,d.radius,d.radius,b?'#9bbbc6':'#c4d9e533','#577f94',2);ctx.restore();text(ctx,d.ball.toUpperCase(),p.x,p.y+4,11,'#385a72','center',600);if(!b){arrow(ctx,[d.x,d.y],[d.x+d.vx*4,d.y+d.vy*4],'#577f94');text(ctx,`${d.label} · ${((d.at-elapsed)/1000).toFixed(1)}s`,d.x,d.y-d.radius-8,10,'#577f94','center');}}
});
})(globalThis);
