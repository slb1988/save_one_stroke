/* The surface stays put. Real contact applies a bounded tangential drive force. */
(function(root){
'use strict';
const C=typeof module==='object'&&module.exports?require('../../content.js'):root.RescueContent;
const n=(minimum,maximum)=>({type:'number',minimum,maximum});
C.register({type:'nova/belt',kind:'element',schema:{type:'object',additionalProperties:false,required:['x','y','w','h','speeds','label'],properties:{x:n(0,719),y:n(0,480),w:n(30,500),h:n(10,60),speeds:{type:'array',minItems:1,maxItems:4,items:{type:'object',additionalProperties:false,required:['at','vx'],properties:{at:n(0,4500),vx:n(-6,6)}}},label:{type:'string',minLength:1,maxLength:40}}},
 validate(d,p,V){V.rect(d,p,['speeds','label']);V.number(d.w,30,500,p+'.w');V.number(d.h,10,60,p+'.h');let prev=-1;V.array(d.speeds,1,4,p+'.speeds',(v,q)=>{V.object(v,['at','vx'],['at','vx'],q);V.number(v.at,0,4500,q+'.at');V.number(v.vx,-6,6,q+'.vx');if(v.at<=prev)V.fail(q,'时刻必须严格递增');prev=v.at;});if(d.speeds[0].at!==0)V.fail(p,'传送带必须声明初始速度');V.text(d.label,40,p+'.label');},
 translate:(d,a)=>({...d,x:d.x+a.x,y:d.y+a.y}),obstacles:d=>[d],
 init({trial:t,api:P,Matter:{Composite}},d,s){s.body=P.rectBody(d,{isStatic:true,label:'conveyor'});s.body.friction=0;s.body.frictionStatic=0;s.touched=[];s.drivenSteps=0;s.vx=d.speeds[0].vx;Composite.add(t.engine.world,s.body);},
 beforeStep({trial:t,Matter:{Body}},d,s){for(const v of d.speeds)if(v.at<=t.elapsed)s.vx=v.vx;const touched=new Set();for(const pair of t.engine.pairs.list){if(!pair.isActive||pair.isSensor)continue;const a=pair.bodyA.parent,b=pair.bodyB.parent,other=a===s.body?b:b===s.body?a:null;if(!other||other.isStatic||other.position.y>s.body.bounds.min.y+5)continue;touched.add(other);}for(const b of touched){const dv=Math.max(-6,Math.min(6,s.vx-b.velocity.x));Body.applyForce(b,b.position,{x:b.mass*dv*.0008,y:0});s.drivenSteps++;const id=b.plugin?.novaBall||b.label;if(!s.touched.includes(id))s.touched.push(id);}},
 inspect:s=>({speed:s.vx,touched:[...s.touched],drivenSteps:s.drivenSteps}),
 events:d=>d.speeds.slice(1).map(v=>({at:v.at,type:'belt-speed',label:d.label+'改速 '+v.vx})),
 layer:'background',render({ctx,roundRect,path,text,elapsed},d,s){let vx=s?.vx??d.speeds[0].vx;roundRect(ctx,d.x,d.y,d.w,d.h,5,'#c6d9d0','#528274',2);for(let x=d.x+12;x<d.x+d.w-8;x+=24){const z=(elapsed*.025)%12;path(ctx,[[x-z,d.y+5],[x+(vx<0?-6:6)-z,d.y+d.h/2],[x-z,d.y+d.h-5]],'#528274',1.5);}text(ctx,d.label+' '+(vx>0?'→':vx<0?'←':'停'),d.x+d.w/2,d.y+d.h+14,10,'#528274','center');}
});
})(globalThis);
