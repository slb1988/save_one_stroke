/* Visible additional objectives only restrict success; they cannot bypass chair safety. */
(function(root){
'use strict';
const C=typeof module==='object'&&module.exports?require('../../content.js'):root.RescueContent;
const n=(minimum,maximum)=>({type:'number',minimum,maximum});
const inside=(b,r)=>b&&b.position.x>=r.x&&b.position.x<=r.x+r.w&&b.position.y>=r.y&&b.position.y<=r.y+r.h;
C.register({type:'nova/goals',kind:'rule',
 schema:{type:'object',additionalProperties:false,required:['targets'],properties:{ordered:{type:'boolean'},targets:{type:'array',minItems:1,maxItems:6,items:{type:'object',additionalProperties:false,required:['ball','x','y','w','h','mode','label'],properties:{ball:{type:'string',pattern:'^[a-z][a-z0-9-]{0,15}$'},x:n(0,719),y:n(0,480),w:n(20,720),h:n(20,480),mode:{enum:['visit','hold']},openAt:n(0,4500),closeAt:n(500,5000),label:{type:'string',minLength:1,maxLength:40}}}}}},
 validate(d,p,V){V.object(d,['ordered','targets'],['targets'],p);if(d.ordered!==undefined&&typeof d.ordered!=='boolean')V.fail(p+'.ordered','需要布尔值');V.array(d.targets,1,6,p+'.targets',(r,q)=>{V.rect(r,q,['ball','mode','openAt','closeAt','label']);V.number(r.w,20,720,q+'.w');V.number(r.h,20,480,q+'.h');if(r.y+r.h>480)V.fail(q,'目标框必须完整在画布内');if(typeof r.ball!=='string'||!/^[a-z][a-z0-9-]{0,15}$/.test(r.ball))V.fail(q+'.ball','需要标记球id');if(!['visit','hold'].includes(r.mode))V.fail(q+'.mode','visit或hold');V.text(r.label,40,q+'.label');if(r.openAt!==undefined)V.number(r.openAt,0,4500,q+'.openAt');if(r.closeAt!==undefined)V.number(r.closeAt,500,5000,q+'.closeAt');if((r.openAt??0)>=(r.closeAt??5000))V.fail(q,'目标开放时间必须早于截止时间');if(r.mode==='hold'&&r.closeAt!==undefined&&r.closeAt!==5000)V.fail(q,'hold在5秒结算，截止必须为5000');});},
 validateScene(d,p,V,l){const ids=l.extensions.filter(e=>e.type==='nova/launcher').map(e=>e.params.ball);for(const r of d.targets)if(!ids.includes(r.ball))V.fail(p,`目标引用了不存在的球 ${r.ball}`);},
 translate:(d,a)=>({...d,targets:d.targets.map(r=>({...r,x:r.x+a.x,y:r.y+a.y}))}),
 init(_,d,s){s.hit=d.targets.map(()=>false);s.at=d.targets.map(()=>null);s.current=d.targets.map(()=>false);},
 afterStep({trial:t},d,s){for(const [i,r]of d.targets.entries()){const b=t.dynamicBodies.find(b=>b.plugin?.novaBall===r.ball);s.current[i]=Boolean(inside(b,r));const open=t.elapsed>=(r.openAt??0)&&t.elapsed<=(r.closeAt??5000)+.01;if(!s.hit[i]&&open&&s.current[i]&&(!d.ordered||s.hit.slice(0,i).every(Boolean))){s.hit[i]=true;s.at[i]=t.elapsed;}}},
 finish(_,d,s){const missing=d.targets.filter((r,i)=>r.mode==='hold'?!s.current[i]||!s.hit[i]:!s.hit[i]);if(missing.length)return {code:'objective',reason:'椅子安全还不够：'+missing.map(r=>r.label+(r.mode==='hold'?'需要在5秒时留在框内':'尚未按时到达')).join('；')+'。'};},
 inspect:s=>({hit:[...s.hit],at:[...s.at],current:[...s.current]}),
 layer:'background',render({ctx,roundRect,text},d,s){for(const [i,r]of d.targets.entries()){const done=s&&(r.mode==='hold'?s.current[i]&&s.hit[i]:s.hit[i]),color=done?'#479372':'#b8873a';ctx.save();ctx.setLineDash([6,4]);roundRect(ctx,r.x,r.y,r.w,r.h,5,done?'#cfe9d255':'#eed7a644',color,2);ctx.restore();text(ctx,`${d.ordered?i+1+'. ':''}${r.ball.toUpperCase()} ${r.label}`,r.x+r.w/2,r.y-7,10,color,'center');const time=(r.openAt||r.closeAt)?` ${(r.openAt??0)/1000}–${(r.closeAt??5000)/1000}s`:'';text(ctx,(r.mode==='hold'?'5秒留框':'球心经过')+time,r.x+r.w/2,r.y+r.h+12,9,color,'center');}}
});
})(globalThis);
