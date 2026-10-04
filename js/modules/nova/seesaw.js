/* A dynamic beam on a fixed pivot. Ink can chock it; ball weight can rotate it. */
(function(root){
'use strict';
const C=typeof module==='object'&&module.exports?require('../../content.js'):root.RescueContent;
const n=(minimum,maximum)=>({type:'number',minimum,maximum});
C.register({type:'nova/seesaw',kind:'element',schema:{type:'object',additionalProperties:false,required:['x','y','w','h','pivot','mass','label'],properties:{x:n(0,719),y:n(0,480),w:n(80,300),h:n(10,30),pivot:n(.2,.8),mass:n(2,60),label:{type:'string',minLength:1,maxLength:40}}},
 validate(d,p,V){V.rect(d,p,['pivot','mass','label']);V.number(d.w,80,300,p+'.w');V.number(d.h,10,30,p+'.h');V.number(d.pivot,.2,.8,p+'.pivot');V.number(d.mass,2,60,p+'.mass');V.text(d.label,40,p+'.label');},
 translate:(d,a)=>({...d,x:d.x+a.x,y:d.y+a.y}),obstacles:d=>[d],
 init({trial:t,api:P,Matter:{Body,Constraint,Composite}},d,s){s.body=P.rectBody(d,{friction:.35,frictionAir:.04,label:'pivot-beam'});Body.setMass(s.body,d.mass);s.pivot={x:d.x+d.w*d.pivot,y:d.y+d.h/2};s.constraint=Constraint.create({pointA:s.pivot,bodyB:s.body,pointB:{x:d.w*(d.pivot-.5),y:0},length:0,stiffness:1,damping:.2});s.maxAngle=0;Composite.add(t.engine.world,[s.body,s.constraint]);t.dynamicBodies.push(s.body);t.supportBodies.push(s.body);},
 afterStep(_,d,s){s.maxAngle=Math.max(s.maxAngle,Math.abs(s.body.angle)*180/Math.PI);},
 inspect:s=>({angle:s.body.angle*180/Math.PI,maxAngle:s.maxAngle,position:{...s.body.position}}),
 layer:'background',render({ctx,roundRect,path,ellipse,text},d,s){const pivot=s?.pivot||{x:d.x+d.w*d.pivot,y:d.y+d.h/2};path(ctx,[[pivot.x-13,pivot.y+27],[pivot.x,pivot.y],[pivot.x+13,pivot.y+27]],'#a57d56',2,true,'#e7cba6');ctx.save();ctx.translate(s?.body.position.x??d.x+d.w/2,s?.body.position.y??d.y+d.h/2);ctx.rotate(s?.body.angle||0);roundRect(ctx,-d.w/2,-d.h/2,d.w,d.h,3,'#e8c38e','#a57d56',2);ctx.restore();ellipse(ctx,pivot.x,pivot.y,5,5,'#a57d56');text(ctx,d.label,pivot.x,pivot.y+42,10,'#98734d','center');}
});
})(globalThis);
