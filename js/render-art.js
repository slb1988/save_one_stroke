/* Shared canvas primitives and the seated dummy illustration. */
(function(root){'use strict';
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


root.RescueArt={C,path,roundRect,ellipse,text,arrow,cat,person,bodyTransform,drawStroke};
})(globalThis);
