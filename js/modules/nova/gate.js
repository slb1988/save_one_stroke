/* A real collision gate that re-closes. Open windows are shown before the trial. */
(function(root){
'use strict';
const C=typeof module==='object'&&module.exports?require('../../content.js'):root.RescueContent;
const n=(minimum,maximum)=>({type:'number',minimum,maximum});
const isOpen=(d,t)=>d.windows.some(w=>t>=w.open&&t<w.close);
C.register({type:'nova/gate',kind:'element',schema:{type:'object',additionalProperties:false,required:['x','y','w','h','windows','label'],properties:{x:n(0,719),y:n(0,480),w:n(8,300),h:n(8,400),windows:{type:'array',minItems:1,maxItems:3,items:{type:'object',additionalProperties:false,required:['open','close'],properties:{open:n(0,4500),close:n(500,5000)}}},label:{type:'string',minLength:1,maxLength:40}}},
 validate(d,p,V){V.rect(d,p,['windows','label']);V.number(d.w,8,300,p+'.w');V.number(d.h,8,400,p+'.h');let prev=-1;V.array(d.windows,1,3,p+'.windows',(w,q)=>{V.object(w,['open','close'],['open','close'],q);V.number(w.open,0,4500,q+'.open');V.number(w.close,500,5000,q+'.close');if(w.close<=w.open||w.open<=prev)V.fail(q,'开窗不能倒序或重叠');prev=w.close;});V.text(d.label,40,p+'.label');},
 translate:(d,a)=>({...d,x:d.x+a.x,y:d.y+a.y}),obstacles:d=>isOpen(d,0)?[]:[d],
 init({trial:t,api:P,Matter:{Composite}},d,s){s.body=P.rectBody(d,{isStatic:true,label:'timed-gate'});s.open=isOpen(d,0);s.changes=[];if(!s.open)Composite.add(t.engine.world,s.body);},
 beforeStep({trial:t,Matter:{Composite}},d,s){const open=isOpen(d,t.elapsed);if(open!==s.open){s.open=open;if(open)Composite.remove(t.engine.world,s.body);else Composite.add(t.engine.world,s.body);s.changes.push({at:t.elapsed,open});}},
 events:d=>d.windows.flatMap(w=>[{at:w.open,type:'gate-open',label:d.label+'开门'},{at:w.close,type:'gate-close',label:d.label+'关门'}]),
 inspect:s=>({open:s.open,changes:s.changes.map(x=>({...x}))}),
 layer:'background',render({ctx,roundRect,path,text,elapsed},d,s){const open=s?.open??isOpen(d,elapsed);ctx.save();if(open)ctx.setLineDash([4,4]);roundRect(ctx,d.x,d.y,d.w,d.h,3,open?'#e8d9c522':'#c89a76','#996d50',2);ctx.restore();if(!open)for(let y=d.y+6;y<d.y+d.h-4;y+=12)path(ctx,[[d.x+3,y],[d.x+d.w-3,y]],'#e5c4a9',1);text(ctx,d.label+(open?' 开':' 关'),d.x+d.w/2,d.y-18,10,'#936c4f','center');text(ctx,d.windows.map(w=>`${w.open/1000}–${w.close/1000}s`).join(' / '),d.x+d.w/2,d.y-6,9,'#936c4f','center');}
});
})(globalThis);
