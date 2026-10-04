/* A local field affects marked balls only; chair/ink/world gravity stay unchanged. */
(function(root){
'use strict';
const C=typeof module==='object'&&module.exports?require('../../content.js'):root.RescueContent;
const n=(minimum,maximum)=>({type:'number',minimum,maximum});
C.register({type:'nova/field',kind:'rule',schema:{type:'object',additionalProperties:false,required:['x','y','w','h','fx','fy','start','end','label'],properties:{x:n(0,719),y:n(0,480),w:n(20,600),h:n(20,480),fx:n(-2,2),fy:n(-2,2),start:n(0,4500),end:n(500,5000),ball:{type:'string',pattern:'^[a-z][a-z0-9-]{0,15}$'},label:{type:'string',minLength:1,maxLength:40}}},
 validate(d,p,V){V.rect(d,p,['fx','fy','start','end','ball','label']);V.number(d.w,20,600,p+'.w');V.number(d.h,20,480,p+'.h');if(d.y+d.h>480)V.fail(p,'力场需在画布内');for(const k of ['fx','fy'])V.number(d[k],-2,2,p+'.'+k);if(!d.fx&&!d.fy)V.fail(p,'力场不能为零');V.number(d.start,0,4500,p+'.start');V.number(d.end,500,5000,p+'.end');if(d.end<=d.start)V.fail(p,'力场结束应晚于开始');if(d.ball!==undefined&&!/^[a-z][a-z0-9-]{0,15}$/.test(d.ball))V.fail(p+'.ball','球id错误');V.text(d.label,40,p+'.label');},
 validateScene(d,p,V,l){if(d.ball&&!l.extensions.some(e=>e.type==='nova/launcher'&&e.params.ball===d.ball))V.fail(p,'指定球不存在');},
 translate:(d,a)=>({...d,x:d.x+a.x,y:d.y+a.y}),init(_,d,s){s.affected=[];s.steps=0;},
 beforeStep({trial:t,Matter:{Body}},d,s){if(t.elapsed<d.start||t.elapsed>=d.end)return;for(const b of t.dynamicBodies){const id=b.plugin?.novaBall,p=b.position;if(!id||(d.ball&&id!==d.ball)||p.x<d.x||p.x>d.x+d.w||p.y<d.y||p.y>d.y+d.h)continue;Body.applyForce(b,p,{x:b.mass*.001*d.fx,y:b.mass*.001*d.fy});s.steps++;if(!s.affected.includes(id))s.affected.push(id);}},
 inspect:s=>({affected:[...s.affected],steps:s.steps}),
 events:d=>[{at:d.start,type:'field-on',label:d.label+'开启'},{at:d.end,type:'field-off',label:d.label+'关闭'}],
 layer:'background',render({ctx,roundRect,arrow,text,elapsed},d){const active=elapsed>=d.start&&elapsed<d.end;roundRect(ctx,d.x,d.y,d.w,d.h,8,active?'#ccd9ec44':'#dee3ee22','#8ca6c2',1);const norm=Math.hypot(d.fx,d.fy);for(let x=d.x+24;x<d.x+d.w-12;x+=48)for(let y=d.y+24;y<d.y+d.h-12;y+=48)arrow(ctx,[x,y],[x+d.fx/norm*15,y+d.fy/norm*15],active?'#91a7c7':'#c4cfdb');text(ctx,d.label+(d.ball?' · '+d.ball.toUpperCase():' · 钢球')+` ${d.start/1000}–${d.end/1000}s`,d.x+d.w/2,d.y-7,10,'#728ead','center');}
});
})(globalThis);
