/* Shared by the browser and Node tests. Matter runs all strokes, never a template match. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../vendor/matter.min.js'), require('./content.js'));
  else root.RescuePhysics = factory(root.Matter, root.RescueContent);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Matter, Content) {
  'use strict';
  const { Engine, Bodies, Body, Composite, Query, Constraint } = Matter;
  const DT = 1000 / 120;
  const DURATION = 5000;
  const RADIUS = 4.5;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const zones = level => level.forbiddenZones || (level.forbidden ? [level.forbidden] : []);
  const solidRects = level => [...level.terrain,...Content.instances(level).flatMap(({def,params})=>def.obstacles ? def.obstacles(params) : [])];
  const activeForces = (level, elapsed) => (level.forces || []).filter(force => elapsed >= force.start && elapsed < force.end);
  const length = points => points.slice(1).reduce((n, p, i) => n + distance(points[i], p), 0);
  const point = p => Array.isArray(p) ? { x: p[0], y: p[1] } : { x: p.x, y: p.y };
  const mechanics = level => level.version >= 2 ? level.mechanics || {} : {};
  const drawTop = level => mechanics(level).drawTop ?? level.chair[0].y - 4;
  const drawBottom = level => mechanics(level).drawBottom ?? 465;
  function gravityAt(level, elapsed) { return Content.get('core/gravity').at(mechanics(level).gravity, elapsed); }
  function ruleEvents(level) {
    return Content.instances(level).flatMap(({def,params})=>def.events ? def.events(params) : []).sort((a,b)=>a.at-b.at);
  }
  function ruleStatus(level, elapsed = 0, anchorCount = 0) {
    const parts = Content.instances(level).flatMap(({def,params})=>def.status ? [def.status({elapsed,anchorCount},params)] : []), timeline = ruleEvents(level);
    const upcoming = timeline.find(event => event.at > elapsed + 1e-6);
    const past = timeline.filter(event => event.at <= elapsed + 1e-6).at(-1);
    if (upcoming) parts.push(`${((upcoming.at-elapsed)/1000).toFixed(1)} 秒后：${upcoming.label}`);
    else if (past) parts.push(`${past.label} · 已生效`);
    return {text:parts.join(' ｜ '),changed:Boolean(past && elapsed - past.at < 650)};
  }
  function closestOnStroke(points, target) {
    let best = {x:0,y:0,distance:Infinity};
    for (let i=1;i<points.length;i++) {
      const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y,len2=dx*dx+dy*dy;
      const t=len2 ? Math.max(0,Math.min(1,((target.x-a.x)*dx+(target.y-a.y)*dy)/len2)) : 0;
      const p={x:a.x+t*dx,y:a.y+t*dy},d=distance(p,target);
      if(d<best.distance) best={...p,distance:d};
    }
    return best;
  }
  function anchorMatches(level, points) {
    return (mechanics(level).anchors || []).flatMap((anchor,index) => {
      const hit=closestOnStroke(points,anchor);
      return hit.distance <= anchor.radius + RADIUS ? [{index,point:{x:hit.x,y:hit.y}}] : [];
    });
  }
  function constrainPoint(level, p, previous) {
    const clamp = q => ({x:Math.max(24,Math.min(696,q.x)),y:Math.max(drawTop(level),Math.min(drawBottom(level),q.y))});
    let q=clamp(p);
    for (const r of solidRects(level)) {
      if (level.version === 1) {
        if(q.x>=r.x && q.x<=r.x+r.w && q.y>r.y-RADIUS) q.y=Math.min(q.y,r.y-RADIUS);
      } else if(q.x>r.x-RADIUS && q.x<r.x+r.w+RADIUS && q.y>r.y-RADIUS && q.y<r.y+r.h+RADIUS) {
        const options=[{x:q.x,y:r.y-RADIUS},{x:q.x,y:r.y+r.h+RADIUS},{x:r.x-RADIUS,y:q.y},{x:r.x+r.w+RADIUS,y:q.y}];
        const from=previous || q; options.sort((a,b)=>distance(a,from)-distance(b,from)); q=options[0];
      }
    }
    return clamp(q);
  }

  function segmentRect(a, b, rect, margin = 0) {
    const left = rect.x - margin, right = rect.x + rect.w + margin;
    const top = rect.y - margin, bottom = rect.y + rect.h + margin;
    let lo = 0, hi = 1;
    const dx = b.x - a.x, dy = b.y - a.y;
    for (const [p, q] of [[-dx, a.x - left], [dx, right - a.x], [-dy, a.y - top], [dy, bottom - a.y]]) {
      if (Math.abs(p) < 1e-9) { if (q < 0) return false; }
      else {
        const t = q / p;
        if (p < 0) lo = Math.max(lo, t); else hi = Math.min(hi, t);
        if (lo > hi) return false;
      }
    }
    return true;
  }
  function hits(points, rect, margin = 0) {
    return points.slice(1).some((p, i) => segmentRect(points[i], p, rect, margin));
  }
  function simplify(points, tolerance = 1.2) {
    if (points.length <= 2) return points.map(point);
    const a = points[0], b = points[points.length - 1];
    const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
    let max = 0, at = 0;
    for (let i = 1; i < points.length - 1; i++) {
      const p = points[i];
      const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
      const d = Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
      if (d > max) { max = d; at = i; }
    }
    if (max <= tolerance) return [point(a), point(b)];
    return [...simplify(points.slice(0, at + 1), tolerance).slice(0, -1), ...simplify(points.slice(at), tolerance)];
  }

  // A visible 10-unit endpoint magnet helps fingers; it never adds free ink.
  function snapEndpoint(raw, level) {
    const p = point(raw);
    let best = p, min = 10;
    const surfaces = [
      ...level.chair.flatMap(r => [
        { a: { x: r.x, y: r.y }, b: { x: r.x + r.w, y: r.y } },
        { a: { x: r.x, y: r.y + r.h }, b: { x: r.x + r.w, y: r.y + r.h } }
      ]),
      ...solidRects(level).map(r => ({ a: { x: r.x + RADIUS, y: r.y - RADIUS }, b: { x: r.x + r.w - RADIUS, y: r.y - RADIUS } })),
      ...(level.version >= 2 ? solidRects(level).flatMap(r => [
        {a:{x:r.x-RADIUS,y:r.y+RADIUS},b:{x:r.x-RADIUS,y:r.y+r.h-RADIUS}},
        {a:{x:r.x+r.w+RADIUS,y:r.y+RADIUS},b:{x:r.x+r.w+RADIUS,y:r.y+r.h-RADIUS}},
        {a:{x:r.x+RADIUS,y:r.y+r.h+RADIUS},b:{x:r.x+r.w-RADIUS,y:r.y+r.h+RADIUS}}
      ]) : [])
    ];
    for (const anchor of mechanics(level).anchors || []) {
      const d=distance(p,anchor); if(d<min){min=d;best={x:anchor.x,y:anchor.y};}
    }
    for (const { a, b } of surfaces) {
      const q = { x: Math.max(a.x, Math.min(b.x, p.x)), y: Math.max(a.y, Math.min(b.y, p.y)) };
      const d = distance(p, q);
      if (d < min) { min = d; best = q; }
    }
    return best;
  }

  function validateStroke(level, raw) {
    level = Content.resolve(level);
    if (!Array.isArray(raw) || raw.length < 2) return { valid: false, code: 'empty', message: '先画一笔，再请阿稳试坐。' };
    if (raw.length > 2000) return { valid: false, code: 'complex', message: '这一笔绕太多圈啦，试试简单一点。' };
    const sampled = raw.map(point);
    if (sampled.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return { valid: false, code: 'invalid', message: '没有读到完整笔画，请重画。' };
    const ink = length(sampled);
    if (ink < 10) return { valid: false, code: 'short', message: '这只是个点，再画长一点点。' };
    if (ink > level.ink + 0.1) return { valid: false, code: 'ink', message: '墨水超支了。清除后试着走短一点。', ink };
    if (sampled.some(p => p.x < 24 || p.x > 696 || p.y < drawTop(level) || p.y > drawBottom(level))) {
      return { valid: false, code: 'bounds', message: level.version >= 2 ? '请在标线以下的开放画区补线，本关画区以规则提示为准。' : '只能在椅面及以下的画区补线，不要画到人身上。', ink };
    }
    // Check the actual simplified collision geometry as well as the input; a
    // corner simplification must never sneak through a thin wall or cat zone.
    const points = simplify(sampled);
    if (zones(level).some(zone => hits(sampled, zone, RADIUS) || hits(points, zone, RADIUS))) {
      return { valid: false, code: 'cat', message: '嘘！这笔碰到粉色猫区了。绕开整块领地，给老板留点空隙。', ink, points };
    }
    if (solidRects(level).some(r => hits(sampled, r, -1) || hits(points, r, -1))) {
      return { valid: false, code: 'terrain', message: '墨水不能钻进实心地板或台阶。脚尖停在表面即可。', ink, points };
    }
    for(const {def,params} of Content.instances(level)) {
      const error=def.stroke?.({level,sampled,points,api},params);
      if(error) return {valid:false,...error,ink,points};
    }
    return { valid: true, ink, points, attached: level.chair.some(r => hits(points, r, RADIUS + 1)), anchorCount:anchorMatches(level,points).length };
  }

  const physical = { friction: 0.95, frictionStatic: 1.5, restitution: 0, slop: 0.025 };
  function rectBody(r, options) {
    return Bodies.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, { ...physical, ...options });
  }
  function inkParts(points) {
    const parts = [];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], len = distance(a, b);
      if (len < 0.3) continue;
      parts.push(Bodies.rectangle((a.x + b.x) / 2, (a.y + b.y) / 2, len + 0.8, RADIUS * 2, {
        ...physical, angle: Math.atan2(b.y - a.y, b.x - a.x), density: 0.0007, label: 'ink'
      }));
    }
    for (const p of points) parts.push(Bodies.circle(p.x, p.y, RADIUS, { ...physical, density: 0.0007, label: 'ink' }, 12));
    return parts;
  }

  function createTrial(level, raw) {
    level = Content.resolve(level);
    const stroke = validateStroke(level, raw);
    if (!stroke.valid) return { valid: false, stroke };
    const engine = Engine.create({ positionIterations: 10, velocityIterations: 8, constraintIterations: 6, enableSleeping: false });
    Object.assign(engine.gravity, {x:gravityAt(level,0).x,y:gravityAt(level,0).y});
    const terrain = Content.get('core/terrain').create(level.terrain,{rectBody});
    Composite.add(engine.world, terrain);
    const parts = Content.get('core/chair').create(level.chair,{rectBody});
    const seatY = level.chair[0].y;
    // The seated dummy holds the chair: a rigid payload, not an arbitrary force
    // at a magic anchor. Its mass and high centre of gravity affect every frame.
    const person = Bodies.rectangle(level.load.x, seatY - 37, 40, 69, { ...physical, label: 'person' });
    Body.setMass(person, level.load.mass);
    parts.push(person);
    if (level.load.cat) {
      const cat = Bodies.rectangle(level.load.catX, seatY - 21, 42, 35, { ...physical, label: 'passenger-cat' });
      Body.setMass(cat, level.load.catMass);
      parts.push(cat);
    }
    const ink = inkParts(stroke.points);
    let looseInk = null;
    if (stroke.attached) parts.push(...ink);
    else {
      looseInk = Body.create({ parts: ink, ...physical, frictionAir: 0.012, label: 'loose-ink' });
      Composite.add(engine.world, looseInk);
    }
    const chair = Body.create({ parts, ...physical, frictionAir: 0.012, label: 'loaded-chair' });
    // Matter sums part inertias about their own centres; include the parallel-
    // axis terms for this tall, sparse frame (Matter's inertia scale is 4).
    for (const body of [chair, looseInk].filter(Boolean)) {
      Body.setInertia(body, body.parts.slice(1).reduce((sum, part) => sum + part.inertia + 4 * part.mass * distance(part.position, body.position) ** 2, 0));
    }
    Composite.add(engine.world, chair);
    const catZones = Content.get('core/cats').create(zones(level),{rectBody});
    Composite.add(engine.world, catZones);
    const origin = { ...chair.position }, inkOrigin = looseInk ? { ...looseInk.position } : origin;
    const trial = {
      valid: true, engine, level, stroke, chair, looseInk, origin, inkOrigin, terrain, catZones, bindings: [],
      removedTerrain: new Set(), drops: [], events: [], dropImpact: false,
      dynamicBodies: [chair,...(looseInk ? [looseInk] : [])], modules: Content.runtime(level),
      elapsed: 0, ended: false, outcome: null, maxTilt: 0, unstableMs: 0, stableMs: 0,
      diagnostics: { attached: stroke.attached, startCOM: { ...origin }, contacts: [] }
    };
    Content.call(trial.modules,'init',{trial,api,Matter});
    return trial;
  }

  function transform(p, body, origin) {
    const c = Math.cos(body.angle), s = Math.sin(body.angle);
    const x = p.x - origin.x, y = p.y - origin.y;
    return { x: body.position.x + x * c - y * s, y: body.position.y + x * s + y * c };
  }
  function contacts(trial) {
    const found = [];
    for (const pair of trial.engine.pairs.list) {
      if (!pair.isActive || pair.isSensor) continue;
      const a = pair.bodyA.parent, b = pair.bodyB.parent;
      if (!((a === trial.chair && b.isStatic && !trial.removedTerrain.has(trial.terrain.indexOf(b))) || (b === trial.chair && a.isStatic && !trial.removedTerrain.has(trial.terrain.indexOf(a))))) continue;
      for (const p of pair.collision.supports) if (p) found.push({ x: p.x, y: p.y });
    }
    for(const binding of trial.bindings) if(binding.body===trial.chair) found.push({...binding.constraint.pointA,kind:'anchor'});
    return found;
  }
  function failureCause(trial, fallback) {
    if (!trial.stroke.attached) return {code:'detached',reason:trial.bindings.length ? '线挂住了，木椅却没接上。挂点只托住与它相连的东西。' : '这一笔没接上木椅，松手后只是自由落体。让笔画碰到椅面或旧椅脚。'};
    for(const {def,params,state} of [...trial.modules].sort((a,b)=>(a.def.failurePriority||100)-(b.def.failurePriority||100))) {
      const cause=def.failure?.({trial,api,Matter},params,state);if(cause) return cause;
    }
    return fallback;
  }
  function fail(trial, code, reason) {
    if (!trial.outcome) trial.outcome = { success: false, code, reason };
  }
  function step(trial) {
    if (!trial.valid || trial.ended) return trial;
    const context={trial,api,Matter};
    Content.call(trial.modules,'beforeStep',context);
    trial.events=ruleEvents(trial.level).filter(event=>event.at<=trial.elapsed+1e-6);
    Engine.update(trial.engine, DT);
    trial.elapsed += DT;
    Content.call(trial.modules,'afterStep',context);
    const tilt = Math.abs(trial.chair.angle) * 180 / Math.PI;
    trial.maxTilt = Math.max(trial.maxTilt, tilt);
    const seat = transform({ x: trial.level.load.x, y: trial.level.chair[0].y }, trial.chair, trial.origin);
    if (trial.catZones.some(zone => Query.collides(zone, trial.dynamicBodies).length)) {
      fail(trial, 'cat', trial.drops.length ? '结构或落球碰到了粉色猫区，老板醒了。给真实运动也留一点安全余地。' : '结构碰到了粉色猫区。线可以绕弯，但要给晃动也留一点余地。');
    }
    if (tilt > 24) {
      const cause=failureCause(trial,{code:'tipped',reason:'重心跑出了落脚范围，椅子翻了。试着把脚落得更稳、更靠外；空洞不能承重。'});
      fail(trial,cause.code,cause.reason);
    }
    if (seat.y > trial.level.chair[0].y + 65 || seat.x < 40 || seat.x > 680) {
      const cause=failureCause(trial,{code:'fell',reason:'支撑没有接住重量，座面掉下去了。脚尖要碰到实心表面，不是停在空中。'});
      fail(trial,cause.code,cause.reason);
    }
    if (tilt < 10 && Math.abs(trial.chair.speed) < 0.6) trial.stableMs += DT;
    else trial.stableMs = 0;
    trial.diagnostics.contacts = contacts(trial);
    if (trial.elapsed >= DURATION - 0.01) {
      trial.ended = true;
      if (!trial.outcome) {
        if (tilt > 10 || trial.stableMs < 700 || !trial.diagnostics.contacts.length) {
          const cause=failureCause(trial,{code:'wobbly',reason:'五秒到了，还没坐稳。稍微扩大落脚范围，并让脚尖贴住承重表面。'});
          fail(trial,cause.code,cause.reason);
        } else {
          const stars = trial.stroke.ink <= trial.level.gold ? 3 : trial.stroke.ink <= trial.level.ink * 0.91 ? 2 : 1;
          trial.outcome = { success: true, code: 'stable', stars, reason: '连续承重 5 秒，最后稳稳坐住。' };
        }
      }
      trial.outcome = { ...trial.outcome, ink: Math.round(trial.stroke.ink), maxTilt: Math.round(trial.maxTilt * 10) / 10, duration: DURATION };
    }
    return trial;
  }
  function simulate(level, points) {
    const trial = createTrial(level, points);
    if (!trial.valid) return { success: false, code: trial.stroke.code, reason: trial.stroke.message, valid: false };
    while (!trial.ended) step(trial);
    return { ...trial.outcome, valid: true, attached: trial.stroke.attached, contacts: trial.diagnostics.contacts, position: { ...trial.chair.position }, events:trial.events, anchorCount:trial.bindings.filter(b=>b.body===trial.chair).length };
  }
  const api = { DT, DURATION, RADIUS, rectBody, anchorMatches, mechanics, drawTop, drawBottom, gravityAt, ruleEvents, ruleStatus, closestOnStroke, constrainPoint, zones, activeForces, length, distance, segmentRect, simplify, snapEndpoint, validateStroke, createTrial, transform, step, simulate };
  for(const name of ['mechanics','drawTop','drawBottom','gravityAt','ruleEvents','ruleStatus','anchorMatches','constrainPoint','zones','activeForces']) {
    const fn=api[name];api[name]=(level,...args)=>fn(Content.resolve(level),...args);
  }
  api.snapEndpoint=(raw,level)=>snapEndpoint(raw,Content.resolve(level));
  return api;
});
