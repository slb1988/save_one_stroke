(function (root) {
  'use strict';
  const P = root.RescuePhysics;
  const C = { ink: '#465044', wood: '#d7b380', edge: '#89744e', green: '#43806a', coral: '#e78c65', floor: '#e8e9dc' };
  const FONT = '"Segoe UI", "Microsoft YaHei", sans-serif';
  function path(ctx, points, color, width = 2, close = false, fill = null) {
    if (!points.length) return;
    ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
    points.slice(1).forEach(p => ctx.lineTo(p[0], p[1]));
    if (close) ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }
  function roundRect(ctx, x, y, w, h, radius, fill, stroke = null, width = 2) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, radius);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }
  function ellipse(ctx, x, y, rx, ry, fill, stroke = null, width = 2) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }
  function text(ctx, str, x, y, size = 13, color = C.ink, align = 'left', weight = 400) {
    ctx.fillStyle = color; ctx.font = `${weight} ${size}px ${FONT}`; ctx.textAlign = align; ctx.fillText(str, x, y);
  }
  function arrow(ctx, a, b, color = '#a6ae96', dashed = false) {
    ctx.save(); if (dashed) ctx.setLineDash([4, 6]);
    path(ctx, [a, b], color, 1.5); ctx.setLineDash([]);
    const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
    path(ctx, [[b[0] - 7 * Math.cos(angle - .45), b[1] - 7 * Math.sin(angle - .45)], b, [b[0] - 7 * Math.cos(angle + .45), b[1] - 7 * Math.sin(angle + .45)]], color, 1.5);
    ctx.restore();
  }
  function cat(ctx, x, y, sleeping, awake) {
    ctx.save();
    ellipse(ctx, x, y + 13, sleeping ? 45 : 22, sleeping ? 24 : 21, '#eac085', '#9f885d', 2.3);
    const hx = sleeping ? x - 25 : x - 5, hy = y - 5;
    path(ctx, [[hx - 18, hy - 7], [hx - 18, hy - 26], [hx - 6, hy - 17], [hx + 8, hy - 19], [hx + 20, hy - 29], [hx + 21, hy - 5]], '#9f885d', 2.3, true, '#eac085');
    ellipse(ctx, hx, hy, 24, 20, '#eac085', '#9f885d', 2.3);
    if (awake) { ellipse(ctx, hx - 9, hy - 3, 2, 4, '#64573e'); ellipse(ctx, hx + 9, hy - 3, 2, 4, '#64573e'); }
    else { path(ctx, [[hx - 13, hy - 2], [hx - 9, hy + 1], [hx - 5, hy - 2]], '#726245', 1.5); path(ctx, [[hx + 5, hy - 2], [hx + 9, hy + 1], [hx + 13, hy - 2]], '#726245', 1.5); }
    path(ctx, [[hx - 3, hy + 4], [hx, hy + 7], [hx + 3, hy + 4]], '#bc8f6d', 2);
    path(ctx, [[hx - 28, hy + 4], [hx - 18, hy + 5]], '#9f885d', 1.3); path(ctx, [[hx + 18, hy + 5], [hx + 29, hy + 3]], '#9f885d', 1.3);
    path(ctx, [[hx - 6, hy - 18], [hx - 4, hy - 11]], '#c9945d', 2); path(ctx, [[hx + 3, hy - 18], [hx + 4, hy - 11]], '#c9945d', 2);
    ctx.beginPath(); ctx.arc(x + (sleeping ? 23 : 18), y + 16, sleeping ? 20 : 11, -.8, 2.7); ctx.strokeStyle = '#c79760'; ctx.lineWidth = 5; ctx.stroke();
    if (sleeping) text(ctx, awake ? '!!' : 'z Z', x + 28, y - 34, 16, '#bd9ca0', 'center', 600);
    ctx.restore();
  }
  function person(ctx, level, mood, time) {
    const x = level.load.x, y = level.chair[0].y;
    // A seated, chair-hugging crash-test dummy — limbs are an illustration.
    path(ctx, [[x - 15, y - 8], [x + 20, y - 4], [x + 25, y + 30], [x + 39, y + 33]], '#4c6656', 16);
    path(ctx, [[x + 4, y - 7], [x + 38, y - 4], [x + 44, y + 29], [x + 56, y + 29]], '#789073', 13);
    path(ctx, [[x + 33, y + 34], [x + 45, y + 34]], '#494f43', 8); path(ctx, [[x + 49, y + 31], [x + 60, y + 31]], '#494f43', 7);
    ctx.beginPath(); ctx.moveTo(x - 28, y - 61); ctx.quadraticCurveTo(x - 5, y - 79, x + 17, y - 60); ctx.lineTo(x + 22, y - 12); ctx.quadraticCurveTo(x, y - 3, x - 28, y - 10); ctx.closePath(); ctx.fillStyle = C.coral; ctx.fill(); ctx.strokeStyle = '#9e7353'; ctx.lineWidth = 2.5; ctx.stroke();
    path(ctx, [[x + 10, y - 52], [x + 23, y - 28], [x + 3, y - 24]], '#b57f57', 11); path(ctx, [[x + 10, y - 52], [x + 23, y - 28], [x + 3, y - 24]], '#f1d4a8', 7);
    path(ctx, [[x - 8, y - 75], [x - 7, y - 63]], '#f1d4a8', 12);
    const hx = x - 7, hy = y - 96;
    ellipse(ctx, hx + 21, hy + 3, 5, 7, '#f1d4a8', '#9d8661', 1.5);
    ellipse(ctx, hx, hy, 24, 27, '#f3d8ae', '#8a7c5b', 2.3);
    ctx.beginPath(); ctx.moveTo(hx - 24, hy - 4); ctx.quadraticCurveTo(hx - 29, hy - 37, hx + 2, hy - 29); ctx.quadraticCurveTo(hx + 23, hy - 30, hx + 24, hy - 12); ctx.quadraticCurveTo(hx + 8, hy - 10, hx - 1, hy - 21); ctx.quadraticCurveTo(hx - 8, hy - 9, hx - 24, hy - 4); ctx.fillStyle = '#596050'; ctx.fill();
    path(ctx, [[hx - 2, hy - 28], [hx + 4, hy - 36], [hx + 12, hy - 30]], '#596050', 3);
    if (mood === 'failed') {
      for (const ex of [hx - 9, hx + 10]) { path(ctx, [[ex - 3, hy - 5], [ex + 3, hy + 1]], C.ink, 2); path(ctx, [[ex - 3, hy + 1], [ex + 3, hy - 5]], C.ink, 2); }
      ellipse(ctx, hx + 2, hy + 13, 4, 6, '#b18568');
    } else if (mood === 'success') {
      path(ctx, [[hx - 15, hy - 4], [hx - 9, hy - 8], [hx - 4, hy - 4]], C.ink, 2); path(ctx, [[hx + 4, hy - 4], [hx + 10, hy - 8], [hx + 15, hy - 4]], C.ink, 2);
      ctx.beginPath(); ctx.arc(hx + 1, hy + 9, 7, 0, Math.PI); ctx.strokeStyle = '#a77d5e'; ctx.lineWidth = 2; ctx.stroke();
    } else {
      const blink = Math.floor(time / 240) % 17 === 0;
      ellipse(ctx, hx - 9, hy - 3, 2.2, blink ? .8 : 3, C.ink); ellipse(ctx, hx + 10, hy - 3, 2.2, blink ? .8 : 3, C.ink);
      path(ctx, [[hx - 5, hy + 13], [hx + 6, hy + 12]], '#a87e5e', 1.7);
      path(ctx, [[hx - 15, hy - 13], [hx - 7, hy - 15]], '#83775a', 1.8); path(ctx, [[hx + 5, hy - 15], [hx + 13, hy - 12]], '#83775a', 1.8);
    }
    ellipse(ctx, hx - 17, hy + 7, 4, 2, '#e6b795'); ellipse(ctx, hx + 17, hy + 7, 4, 2, '#e6b795');
    text(ctx, '稳', x - 4, y - 35, 15, '#fff0cd', 'center', 700);
    if (level.load.cat) cat(ctx, level.load.catX, y - 29, false, mood === 'failed');
  }
  function bodyTransform(ctx, body, origin) {
    if (!body) return;
    ctx.translate(body.position.x, body.position.y); ctx.rotate(body.angle); ctx.translate(-origin.x, -origin.y);
  }
  function drawStroke(ctx, points, invalid, running) {
    if (points.length < 1) return;
    const pairs = points.map(p => [p.x, p.y]);
    if (pairs.length === 1) pairs.push([pairs[0][0] + .1, pairs[0][1]]);
    path(ctx, pairs, invalid ? '#d88a75' : '#b9ceb2', 12);
    path(ctx, pairs, invalid ? '#bd694f' : '#497e68', 8.5);
    path(ctx, pairs, invalid ? '#efb295' : '#90b297', 2);
    if (!running) {
      ellipse(ctx, points[0].x, points[0].y, 4.5, 4.5, '#fcfaf0', invalid ? '#c07556' : C.green, 1.8);
      const end = points[points.length - 1]; ellipse(ctx, end.x, end.y, 3.5, 3.5, invalid ? '#e5b092' : '#c5ddb4');
    }
  }

  function draw(canvas, state, time) {
    const ctx = canvas.getContext('2d');
    const scale = canvas.width / 720;
    ctx.setTransform(scale, 0, 0, scale, 0, 0); ctx.clearRect(0, 0, 720, 480);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const level = state.level, trial = state.trial, isRunning = state.mode === 'running';
    const m=P.mechanics(level), elapsed=trial?.elapsed || 0, gravity=P.gravityAt(level,elapsed);
    const failed = trial?.outcome && !trial.outcome.success;
    const mood = failed ? 'failed' : state.mode === 'result' ? 'success' : 'normal';
    // Wall annotations, drawing limit, floor cross section.
    const top=P.drawTop(level), bottom=P.drawBottom(level);
    if(m.drawBottom!==undefined) { roundRect(ctx,24,bottom+5,672,475-bottom,0,'#a1ad8b15'); ctx.save();ctx.setLineDash([5,6]);path(ctx,[[24,bottom+5],[696,bottom+5]],'#bdac86',1.5);ctx.restore();text(ctx,'下方停笔区 · 本关只能修上面',44,bottom+24,11,'#b0a285'); }
    const lineY=level.version===2 ? top : 245;
    ctx.save(); ctx.setLineDash([2,7]);path(ctx,[[31,lineY],[210,lineY]],'#c7ceba',1);path(ctx,[[528,lineY],[687,lineY]],'#c7ceba',1);ctx.restore();
    text(ctx,m.drawTop!==undefined ? '上方画区已开放' : '椅面以下可以画',44,lineY-7,10,m.drawTop!==undefined ? '#a78b55' : '#aab49b');
    for (const [index,r] of level.terrain.entries()) {
      const temporary=m.temporaryTerrain?.find(item=>item.index===index), removed=trial?.removedTerrain.has(index);
      if(removed) {
        ctx.save();ctx.setLineDash([5,6]);roundRect(ctx,r.x,r.y,r.w,r.h,3,null,'#d0bca5',1.5);ctx.restore();
        text(ctx,'已撤走',r.x+r.w/2,r.y+24,11,'#ba8c69','center');continue;
      }
      roundRect(ctx,r.x,r.y,r.w,r.h,r.step ? [5,5,0,0] : 0,temporary ? '#efd6a5' : r.step ? '#d6dfc7' : C.floor);
      ctx.save();ctx.beginPath();ctx.rect(r.x,r.y+4,r.w,r.h);ctx.clip();
      const hatchHeight=level.version===2 ? Math.max(65,r.h) : 65;
      for(let i=r.x-hatchHeight;i<r.x+r.w+100;i+=15)path(ctx,[[i,r.y+9],[i+hatchHeight*.6,r.y+hatchHeight]],temporary ? '#d4af71' : r.step ? '#bccbb1' : '#d0d5c2',1);
      ctx.restore();path(ctx,[[r.x,r.y],[r.x+r.w,r.y]],temporary ? '#bd914e' : '#899979',2.3);
      if(temporary) text(ctx,`${((temporary.removeAt-elapsed)/1000).toFixed(1)}s 后撤走`,r.x+r.w/2,r.y+25,10,'#b08448','center',600);
      else if(r.step)text(ctx,'借力台阶',r.x+r.w/2,r.y+30,12,'#849575','center',500);
    }
    if (level.gap) {
      const [a, b] = level.gap;
      ctx.save(); ctx.setLineDash([6, 6]); path(ctx, [[a, 401], [b, 401]], '#c8a379', 1.7); ctx.restore();
      arrow(ctx, [(a + b) / 2, 415], [(a + b) / 2, 436], '#c5aa89');
      text(ctx, '空洞 · 不承重', (a + b) / 2, 457, 12, '#b29b7c', 'center');
    } else text(ctx, '实心地板', 108, 432, 11, '#9aa88b', 'center');
    for (const r of P.zones(level)) {
      roundRect(ctx, r.x, r.y, r.w, r.h, 8, '#f7e5dfb3');
      ctx.save(); ctx.setLineDash([5, 6]); roundRect(ctx, r.x, r.y, r.w, r.h, 8, null, '#d7ac9e', 1.6); ctx.restore();
      ctx.save(); ctx.translate(r.x + r.w / 2, r.y + r.h * .52);
      const catScale = Math.min(r.w / 138, r.h / 84); ctx.scale(catScale, catScale);
      cat(ctx, 8, 4, true, trial?.outcome?.code === 'cat'); ctx.restore();
      text(ctx, r.label ? `${r.label} · 请勿碰` : '猫的领地 · 请勿触碰', r.x + r.w / 2, r.y + r.h + 19, 10, '#bb9183', 'center');
    }
    // Floor shadow is decorative; only the Matter terrain is solid.
    ellipse(ctx, 334, 402, 113, 7, '#74896a10');
    for(const anchor of m.anchors || []) {
      const attached=P.closestOnStroke(state.points,anchor).distance<=anchor.radius+P.RADIUS;
      roundRect(ctx,anchor.x-20,anchor.y-20,40,40,6,'#e4e5d8','#b4baa1',1.5);
      for(const dx of [-14,14]) for(const dy of [-14,14]) { path(ctx,[[anchor.x+dx-2,anchor.y+dy],[anchor.x+dx+2,anchor.y+dy]],'#9fa68e',1); }
      ellipse(ctx,anchor.x,anchor.y,anchor.radius+3,anchor.radius+3,attached ? '#e2ce83' : '#f3e4b1','#ac8b42',2.5);
      ellipse(ctx,anchor.x,anchor.y,anchor.radius-3,anchor.radius-3,'#fbfaf1',attached ? '#669277' : '#c8b16c',2);
      text(ctx,anchor.label,anchor.x,anchor.y+33,10,'#a38b56','center');
    }
    if (!trial) {
      (level.labels || []).forEach(l => { text(ctx, l.text, l.x, l.y, 13, '#a0a58e'); arrow(ctx, [l.x + 5, l.y + 8], l.to, '#b1b79f', true); });
      const bx = m.drawTop!==undefined ? 40 : Math.max(53, level.load.x - 213);
      roundRect(ctx, bx, 108, 156, 49, 11, '#fffdf5', '#d9ddcb', 1.5);
      path(ctx, [[bx + 126, 157], [bx + 142, 169], [bx + 141, 157]], '#d9ddcb', 1.5, false, '#fffdf5');
      const str = level.quip;
      if (str.length > 15) { text(ctx, str.slice(0, 12), bx + 78, 127, 11, '#8a947c', 'center'); text(ctx, str.slice(12), bx + 78, 144, 11, '#8a947c', 'center'); }
      else text(ctx, str, bx + 78, 138, 11, '#8a947c', 'center');
      if(!m.drops?.length && !m.anchors?.length) { text(ctx,'试坐重量',level.load.x+55,101,10,'#a4ad94','center');arrow(ctx,[level.load.x+55,109],[level.load.x+55,137],'#a4ad94'); }
    }
    ctx.save(); if (trial) bodyTransform(ctx, trial.chair, trial.origin);
    for (const r of [...level.chair].reverse()) {
      roundRect(ctx, r.x, r.y, r.w, r.h, r.kind === 'seat' ? 5 : 3, C.wood, C.edge, 2.4);
      if (r.kind === 'seat') {
        path(ctx, [[r.x + 12, r.y + 6], [r.x + r.w - 13, r.y + 5]], '#eed0a3', 1.5);
        [r.x + 13, r.x + r.w - 14].forEach(x => ellipse(ctx, x, r.y + r.h / 2, 1.4, 1.4, '#988354'));
      } else path(ctx, [[r.x + 5, r.y + 15], [r.x + 5, r.y + r.h - 12]], '#edd0a3', 1);
    }
    if (trial?.stroke.attached) drawStroke(ctx, trial.stroke.points, false, true);
    person(ctx, level, mood, time);
    ctx.restore();
    if (trial?.looseInk) { ctx.save(); bodyTransform(ctx, trial.looseInk, trial.inkOrigin); drawStroke(ctx, trial.stroke.points, false, true); ctx.restore(); }
    else if (!trial) drawStroke(ctx, state.points, state.validation && !state.validation.valid, false);
    for(const [index,drop] of (m.drops || []).entries()) {
      const spawned=trial?.drops.find(item=>item.index===index);
      if(!spawned) {
        ctx.save();ctx.setLineDash([4,5]);ellipse(ctx,drop.x,drop.y,drop.radius,drop.radius,'#d9def04d','#9ba5bd',1.5);ctx.restore();
        text(ctx,`${((drop.at-elapsed)/1000).toFixed(1)}s 后落下`,drop.x+drop.radius+10,drop.y+4,11,'#939db5');
        text(ctx,'出生圈勿画',drop.x,drop.y+drop.radius+15,9,'#a6aec1','center');
      } else {
        const b=spawned.body;ctx.save();ctx.translate(b.position.x,b.position.y);ctx.rotate(b.angle);
        ellipse(ctx,0,0,drop.radius,drop.radius,'#939fc0','#606f91',2.4);
        ellipse(ctx,-drop.radius*.24,-drop.radius*.3,3,3,'#596b8d');ellipse(ctx,drop.radius*.18,-drop.radius*.35,3,3,'#596b8d');ellipse(ctx,0,drop.radius*.02,3,3,'#596b8d');ctx.restore();
      }
    }
    if(m.gravity?.length) {
      const norm=Math.hypot(gravity.x,gravity.y);ellipse(ctx,659,147,27,27,'#e5eee0','#bacbb1',1.6);
      arrow(ctx,[659-gravity.x/norm*14,147-gravity.y/norm*14],[659+gravity.x/norm*17,147+gravity.y/norm*17],'#57916e');
      text(ctx,'重力方向',659,187,10,'#889e7e','center');
    }
    if (trial && !failed) {
      // Actual solver contacts and actual wall-mounted pin constraints.
      const norm=Math.hypot(gravity.x,gravity.y),gx=gravity.x/norm,gy=gravity.y/norm;
      for(const p of trial.diagnostics.contacts) {
        ellipse(ctx,p.x,p.y,7,3,p.kind==='anchor' ? '#c4a65b88' : '#76a88c66');
        arrow(ctx,[p.x+gx*24,p.y+gy*24],[p.x+gx*7,p.y+gy*7],p.kind==='anchor' ? '#b2954a' : '#69a084');
      }
      const x=trial.chair.position.x;
      if(level.version===2) {
        const y=trial.chair.position.y;arrow(ctx,[x+gx*60,y+gy*60],[x+gx*94,y+gy*94],'#beab7e',true);
      } else {
        ctx.save();ctx.setLineDash([3,5]);path(ctx,[[x,373],[x,403]],'#beab7e',1.2);ctx.restore();
        path(ctx,[[x-4,402],[x,408],[x+4,402]],'#beab7e',1.5);text(ctx,'重心投影',x,448,10,'#a69e80','center');
      }
    }
    if (level.forces?.length) {
      const force = trial ? P.activeForces(level, trial.elapsed)[0] : null;
      const finishedForces = trial && trial.elapsed >= Math.max(...level.forces.map(item => item.end));
      text(ctx, force ? force.label : finishedForces ? '外力已结束，继续稳住' : `外力预报：${level.forces.length} 段 · 留意试坐条件`, 537, 70, 14, force ? '#c48051' : '#9da68a', 'center', 600);
      const magnitude = force ? Math.hypot(force.fx, force.fy || 0) : 0;
      if (force && isRunning && magnitude > 0) {
        for (let i = 0; i < 5; i++) {
          const x = 80 + ((time * .15 + i * 127) % 550), y = 118 + i * 16;
          arrow(ctx, [x, y], [x + force.fx / magnitude * 45, y + (force.fy || 0) / magnitude * 45], '#b1c4b5');
        }
      }
    }
    if (failed && isRunning) {
      text(ctx, trial.outcome.code === 'cat' ? '老板醒了！！' : '哎——我的工位！', 535, 123, 18, '#c78360', 'center', 600);
    }
    if (state.keyboard && !trial) {
      const { x, y } = state.keyboard; ctx.save(); ctx.setLineDash([2, 3]); ellipse(ctx, x, y, 9, 9, null, '#bf8358', 1.5); ctx.restore();
      path(ctx, [[x - 13, y], [x + 13, y]], '#bf8358', 1); path(ctx, [[x, y - 13], [x, y + 13]], '#bf8358', 1);
    }
    if (state.mode === 'result' && trial?.outcome.success) {
      const colors = ['#e9bb72', '#91b396', '#e9a082'];
      for (let i = 0; i < 16; i++) {
        const x = 386 + Math.sin(i * 13.7) * 181, y = 35 + (i * 31) % 145;
        ctx.save(); ctx.translate(x, y); ctx.rotate(i * .8); roundRect(ctx, -2, -4, 4, 8, 1, colors[i % 3]); ctx.restore();
      }
    }
  }
  root.RescueRenderer = { draw };
})(globalThis);
