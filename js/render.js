/* Scene compositor. Element/rule visuals belong to their trusted modules. */
(function(root){
  'use strict';
  const P=root.RescuePhysics,Content=root.RescueContent,A=root.RescueArt;
  const {path,roundRect,ellipse,text,arrow,person,bodyTransform,drawStroke}=A;
  function draw(canvas,state,time){
    const ctx=canvas.getContext('2d'),scale=canvas.width/720;
    ctx.setTransform(scale,0,0,scale,0,0);ctx.clearRect(0,0,720,480);ctx.lineJoin='round';ctx.lineCap='round';
    const level=Content.resolve(state.level),trial=state.trial,isRunning=state.mode==='running';
    const m=P.mechanics(level),elapsed=trial?.elapsed||0,gravity=P.gravityAt(level,elapsed),failed=trial?.outcome&&!trial.outcome.success;
    const view={...A,ctx,level,trial,state,time,isRunning,m,elapsed,gravity,failed,P};
    const mood=failed?'failed':state.mode==='result'?'success':'normal';
    const top=P.drawTop(level),bottom=P.drawBottom(level);
    if(m.drawBottom!==undefined){roundRect(ctx,24,bottom+5,672,475-bottom,0,'#a1ad8b15');ctx.save();ctx.setLineDash([5,6]);path(ctx,[[24,bottom+5],[696,bottom+5]],'#bdac86',1.5);ctx.restore();text(ctx,'下方停笔区 · 本关只能修上面',44,bottom+24,11,'#b0a285');}
    const lineY=level.version>=2?top:245;
    ctx.save();ctx.setLineDash([2,7]);path(ctx,[[31,lineY],[210,lineY]],'#c7ceba',1);path(ctx,[[528,lineY],[687,lineY]],'#c7ceba',1);ctx.restore();
    text(ctx,m.drawTop!==undefined?'上方画区已开放':'椅面以下可以画',44,lineY-7,10,m.drawTop!==undefined?'#a78b55':'#aab49b');
    Content.render('background',view);
    if(level.gap){const [a,b]=level.gap;ctx.save();ctx.setLineDash([6,6]);path(ctx,[[a,401],[b,401]],'#c8a379',1.7);ctx.restore();arrow(ctx,[(a+b)/2,415],[(a+b)/2,436],'#c5aa89');text(ctx,'空洞 · 不承重',(a+b)/2,457,12,'#b29b7c','center');}
    ellipse(ctx,334,402,113,7,'#74896a10');
    if(!trial){
      (level.labels||[]).forEach(l=>{text(ctx,l.text,l.x,l.y,13,'#a0a58e');arrow(ctx,[l.x+5,l.y+8],l.to,'#b1b79f',true);});
      const bx=m.drawTop!==undefined?40:Math.max(53,level.load.x-213);
      roundRect(ctx,bx,108,156,49,11,'#fffdf5','#d9ddcb',1.5);
      path(ctx,[[bx+126,157],[bx+142,169],[bx+141,157]],'#d9ddcb',1.5,false,'#fffdf5');
      const str=level.quip;
      if(str.length>15){text(ctx,str.slice(0,12),bx+78,127,11,'#8a947c','center');text(ctx,str.slice(12),bx+78,144,11,'#8a947c','center');}
      else text(ctx,str,bx+78,138,11,'#8a947c','center');
    }
    ctx.save();if(trial)bodyTransform(ctx,trial.chair,trial.origin);
    Content.render('chair',view);
    if(trial?.stroke.attached)drawStroke(ctx,trial.stroke.points,false,true);
    person(ctx,level,mood,time);ctx.restore();
    if(trial?.looseInk){ctx.save();bodyTransform(ctx,trial.looseInk,trial.inkOrigin);drawStroke(ctx,trial.stroke.points,false,true);ctx.restore();}
    else if(!trial)drawStroke(ctx,state.points,state.validation&&!state.validation.valid,false);
    Content.render('foreground',view);
    if(trial&&!failed){
      const norm=Math.hypot(gravity.x,gravity.y),gx=gravity.x/norm,gy=gravity.y/norm;
      for(const p of trial.diagnostics.contacts){ellipse(ctx,p.x,p.y,7,3,p.kind==='anchor'?'#c4a65b88':'#76a88c66');arrow(ctx,[p.x+gx*24,p.y+gy*24],[p.x+gx*7,p.y+gy*7],p.kind==='anchor'?'#b2954a':'#69a084');}
      const x=trial.chair.position.x;
      if(level.version>=2){const y=trial.chair.position.y;arrow(ctx,[x+gx*60,y+gy*60],[x+gx*94,y+gy*94],'#beab7e',true);}
      else{ctx.save();ctx.setLineDash([3,5]);path(ctx,[[x,373],[x,403]],'#beab7e',1.2);ctx.restore();path(ctx,[[x-4,402],[x,408],[x+4,402]],'#beab7e',1.5);text(ctx,'重心投影',x,448,10,'#a69e80','center');}
    }
    if(failed&&isRunning)text(ctx,trial.outcome.code==='cat'?'老板醒了！！':'哎——我的工位！',535,123,18,'#c78360','center',600);
    if(state.keyboard&&!trial){const {x,y}=state.keyboard;ctx.save();ctx.setLineDash([2,3]);ellipse(ctx,x,y,9,9,null,'#bf8358',1.5);ctx.restore();path(ctx,[[x-13,y],[x+13,y]],'#bf8358',1);path(ctx,[[x,y-13],[x,y+13]],'#bf8358',1);}
    if(state.mode==='result'&&trial?.outcome.success){const colors=['#e9bb72','#91b396','#e9a082'];for(let i=0;i<16;i++){const x=386+Math.sin(i*13.7)*181,y=35+(i*31)%145;ctx.save();ctx.translate(x,y);ctx.rotate(i*.8);roundRect(ctx,-2,-4,4,8,1,colors[i%3]);ctx.restore();}}
  }
  root.RescueRenderer={draw};
})(globalThis);
