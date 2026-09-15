(function(root){
'use strict';
const C=typeof module==='object'&&module.exports ? require('../../content.js') : root.RescueContent;
C.register({type:'core/gravity',kind:'rule',legacyKey:'gravity',schema:{type:'array',minItems:1,maxItems:6,items:{$ref:'#/$defs/gravityChange'}},
validate(data,p,V,level){const {object,number,text,array,fail}=V;const m={gravity:data};let previous=-1;
      array(m.gravity,1,6,p,(g,p)=>{
        object(g,['at','x','y','label'],['at','x','y','label'],p);
        number(g.at,0,4000,`${p}.at`); number(g.x,-1.5,1.5,`${p}.x`); number(g.y,-1.5,1.5,`${p}.y`); text(g.label,60,`${p}.label`);
        if(g.at<=previous) fail(p,'gravity 时间必须严格递增'); previous=g.at;
        const magnitude=Math.hypot(g.x,g.y); if(magnitude<.2 || magnitude>1.5) fail(p,'重力向量长度必须为 0.2–1.5，不能零重力悬空作弊');
      });
      if(m.gravity[0].at!==0) fail(p+'[0].at','必须从 0 毫秒声明初始重力');
    },select:level=>level.mechanics?.gravity,compile(data,level){level.mechanics.gravity=[...(level.mechanics.gravity||[]),...data];},
at(data,elapsed){let gravity={x:0,y:1,label:'重力向下 ↓'};for(const change of data||[])if(change.at<=elapsed+1e-6)gravity=change;return gravity;},
beforeStep({trial:t},data){const g=this.at(data,t.elapsed);Object.assign(t.engine.gravity,{x:g.x,y:g.y});},
events:data=>data.filter(i=>i.at>0).map(i=>({at:i.at,type:'gravity-changed',label:i.label})),
status({elapsed},data){return this.at(data,elapsed).label;},
failurePriority:30,failure({trial:t},data){const g=this.at(data,t.elapsed);return g.x!==0||g.y!==1?{code:'gravity-shift',reason:g.label+'：旧地脚不再正对受力方向。找新的承重面，阿稳仍须保持原来的坐姿。'}:null;},
layer:'foreground',render(view){const {ctx,level,trial,state,time,isRunning,m,elapsed,gravity,failed,P,C,roundRect,path,text,ellipse,arrow,cat}=view;
    if(m.gravity?.length) {
      const norm=Math.hypot(gravity.x,gravity.y);ellipse(ctx,659,147,27,27,'#e5eee0','#bacbb1',1.6);
      arrow(ctx,[659-gravity.x/norm*14,147-gravity.y/norm*14],[659+gravity.x/norm*17,147+gravity.y/norm*17],'#57916e');
      text(ctx,'重力方向',659,187,10,'#889e7e','center');
    }

}
});
})(globalThis);
