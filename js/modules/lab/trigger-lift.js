/* Touch-triggered support platform: a non-load-bearing sensor pad and a solid platform
   owned by the same module. Only real falling-ball contact fires the trigger; the
   platform then glides to its destination at a closed constant speed. Never time-driven. */
(function(root){
'use strict';
const C=typeof module==='object'&&module.exports ? require('../../content.js') : root.RescueContent;
C.register({
 type:'lab/trigger-lift',kind:'element',
 schema:{type:'object',additionalProperties:false,required:['button','x','y','w','h','dx','dy','speed','label'],properties:{
  button:{type:'object',additionalProperties:false,required:['x','y','w','h'],properties:{x:{type:'number',minimum:0,maximum:719},y:{type:'number',minimum:0,maximum:480},w:{type:'number',minimum:20,maximum:120},h:{type:'number',minimum:6,maximum:30}}},
  x:{type:'number',minimum:0,maximum:719},y:{type:'number',minimum:0,maximum:480},w:{type:'number',minimum:20,maximum:300},h:{type:'number',minimum:10,maximum:60},
  dx:{type:'number',minimum:-160,maximum:160},dy:{type:'number',minimum:-120,maximum:120},speed:{type:'number',minimum:0.02,maximum:0.08},label:{type:'string',minLength:1,maxLength:60}}},
 validate(d,p,V){
  V.rect(d.button,p+'.button');V.number(d.button.w,20,120,p+'.button.w');V.number(d.button.h,6,30,p+'.button.h');
  V.rect(d,p,['button','dx','dy','speed','label']);V.number(d.w,20,300,p+'.w');V.number(d.h,10,60,p+'.h');
  V.number(d.dx,-160,160,p+'.dx');V.number(d.dy,-120,120,p+'.dy');V.number(d.speed,0.02,0.08,p+'.speed');V.text(d.label,60,p+'.label');
  if(!d.dx&&!d.dy)V.fail(p,'平台必须有真实位移');
  V.rect({x:d.x+d.dx,y:d.y+d.dy,w:d.w,h:d.h},p+'.destination');
 },
 translate:(d,at)=>({...d,x:d.x+at.x,y:d.y+at.y,button:{...d.button,x:d.button.x+at.x,y:d.button.y+at.y}}),
 obstacles:d=>[d], // 平台初始位置参与禁画；感应区非实心，不挡笔画
 inspect:s=>({triggered:s.triggered,at:s.at,position:{...s.body.position}}),
 init({trial:t,api:P,Matter:{Composite}},d,s){
  s.body=P.rectBody(d,{isStatic:true,label:'trigger-platform'});
  s.pad=P.rectBody(d.button,{isStatic:true,isSensor:true,label:'lift-pad'});
  s.triggered=false;s.at=null;s.touched=false;
  Composite.add(t.engine.world,[s.body,s.pad]);
 },
 afterStep({trial:t,api:P,Matter:{Body}},d,s){
  if(!s.triggered){
   for(const pair of t.engine.pairs.list){
    if(!pair.isActive)continue;
    const a=pair.bodyA,b=pair.bodyB;
    if((a===s.pad&&b.label==='falling-ball')||(b===s.pad&&a.label==='falling-ball')){s.triggered=true;s.at=t.elapsed;break;}
   }
  } else {
   const dist=Math.hypot(d.dx,d.dy),progress=Math.min(1,(t.elapsed-s.at)*d.speed/dist);
   Body.setPosition(s.body,{x:d.x+d.w/2+d.dx*progress,y:d.y+d.h/2+d.dy*progress},true);
  }
  for(const pair of t.engine.pairs.list)if(pair.isActive&&[pair.bodyA.parent,pair.bodyB.parent].includes(s.body)&&[pair.bodyA.parent,pair.bodyB.parent].includes(t.chair))s.touched=true;
 },
 status:(_,{label})=>label+'：感应区待球触发（非定时）',
 failurePriority:35,failure:({trial:t},d,s)=>s.touched&&s.triggered?{code:'trigger-platform',reason:'球触发了开关，平台才真的动起来。想想它到站后哪里还接得住。'}:null,
 layer:'background',render(view,d,s){const {ctx,trial,roundRect,path,text,arrow}=view;
  const triggered=Boolean(s&&s.triggered);
  ctx.save();ctx.setLineDash([4,5]);roundRect(ctx,d.x+d.dx,d.y+d.dy,d.w,d.h,3,null,'#79a7b5',1.5);ctx.restore();
  arrow(ctx,[d.x+d.w/2,d.y+d.h/2],[d.x+d.w/2+d.dx,d.y+d.h/2+d.dy],'#80a6b3',true);
  const px=s?.body?s.body.position.x-d.w/2:d.x,py=s?.body?s.body.position.y-d.h/2:d.y;
  roundRect(ctx,px,py,d.w,d.h,4,'#bedfe2','#4a8d9c',2);path(ctx,[[px+5,py+4],[px+d.w-5,py+4]],'#f0faf7',2);
  text(ctx,d.label+(triggered?' · 已触发':' · 待触发'),px+d.w/2,py+d.h+15,10,triggered?'#669277':'#478794','center');
  roundRect(ctx,d.button.x,d.button.y,d.button.w,d.button.h,5,triggered?'#cfe6cf':'#f3e4b1',triggered?'#669277':'#ac8b42',2);
  text(ctx,triggered?'开关已触发':'球触开关',d.button.x+d.button.w/2,d.button.y-8,10,triggered?'#669277':'#a38b56','center');
 }
});
})(globalThis);
