/* A real kinematic support, independent of the generic simulation and renderer. */
(function(root){
'use strict';
const C=typeof module==='object'&&module.exports ? require('../../content.js') : root.RescueContent;
C.register({
 type:'lab/elevator',kind:'element',
 schema:{type:'object',additionalProperties:false,required:['x','y','w','h','dx','dy','start','end','label'],properties:{x:{type:'number',minimum:0,maximum:719},y:{type:'number',minimum:0,maximum:480},w:{type:'number',minimum:20,maximum:300},h:{type:'number',minimum:10,maximum:60},dx:{type:'number',minimum:-160,maximum:160},dy:{type:'number',minimum:-120,maximum:120},start:{type:'number',minimum:0,maximum:3000},end:{type:'number',minimum:500,maximum:4000},label:{type:'string',minLength:1,maxLength:60}}},
 validate(d,p,V){V.rect(d,p,['dx','dy','start','end','label']);V.number(d.w,20,300,p+'.w');V.number(d.h,10,60,p+'.h');V.number(d.dx,-160,160,p+'.dx');V.number(d.dy,-120,120,p+'.dy');V.number(d.start,0,3000,p+'.start');V.number(d.end,500,4000,p+'.end');V.text(d.label,60,p+'.label');if(d.end<=d.start||Math.hypot(d.dx,d.dy)/(d.end-d.start)>.08)V.fail(p,'位移速度最多 0.08 单位/ms，end 必须大于 start');if(!d.dx&&!d.dy)V.fail(p,'平台必须有真实位移');V.rect({x:d.x+d.dx,y:d.y+d.dy,w:d.w,h:d.h},p+'.destination');},
 translate:(d,at)=>({...d,x:d.x+at.x,y:d.y+at.y}),
 obstacles:d=>[d],
 inspect:s=>({position:{...s.body.position},touched:s.touched}),
 init({trial:t,api:P,Matter:{Composite}},d,s){s.body=P.rectBody(d,{isStatic:true,friction:0,frictionStatic:0,label:'elevator'});s.touched=false;Composite.add(t.engine.world,s.body);},
 beforeStep({trial:t,Matter:{Body}},d,s){const progress=Math.max(0,Math.min(1,(t.elapsed-d.start)/(d.end-d.start)));Body.setPosition(s.body,{x:d.x+d.w/2+d.dx*progress,y:d.y+d.h/2+d.dy*progress},true);},
 afterStep({trial:t},d,s){for(const pair of t.engine.pairs.list)if(pair.isActive&&[pair.bodyA.parent,pair.bodyB.parent].includes(s.body)&&[pair.bodyA.parent,pair.bodyB.parent].includes(t.chair))s.touched=true;},
 events:d=>[{at:d.start,type:'elevator-start',label:d.label+'开始移动'},{at:d.end,type:'elevator-stop',label:d.label+'到站承重'}],
 failurePriority:35,failure:({trial:t},d,s)=>s.touched&&t.elapsed>d.start?{code:'moving-support',reason:'移动平台会真的改变落脚位置。想想它到站后哪里还接得住，以及两边是否一起移动。'}:null,
 layer:'background',render({ctx,trial,roundRect,path,text,arrow},d,s){
  const x=s?.body?s.body.position.x-d.w/2:d.x,y=s?.body?s.body.position.y-d.h/2:d.y;
  ctx.save();ctx.setLineDash([4,5]);roundRect(ctx,d.x+d.dx,d.y+d.dy,d.w,d.h,3,null,'#79a7b5',1.5);ctx.restore();
  arrow(ctx,[d.x+d.w/2,d.y+d.h/2],[d.x+d.w/2+d.dx,d.y+d.h/2+d.dy],'#80a6b3',true);
  roundRect(ctx,x,y,d.w,d.h,4,'#bedfe2','#4a8d9c',2);path(ctx,[[x+5,y+4],[x+d.w-5,y+4]],'#f0faf7',2);
  text(ctx,d.label,x+d.w/2,y+d.h+15,10,'#478794','center');
 }
});
})(globalThis);
