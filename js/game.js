(function () {
  'use strict';
  const P = window.RescuePhysics, { levels } = window.RescueLevels;
  const $ = id => document.getElementById(id);
  const canvas = $('game-canvas');
  const KEY = 'save-one-stroke:v1';
  const state = { level: levels[0], mode: 'ready', points: [], validation: null, trial: null, drawing: false, pointerId: null, hintIndex: 0, keyboard: null };
  let records = {}, storageOK = true, muted = true, audio = null, toastTimer = null, lastTime = performance.now(), accumulator = 0;
  let lastClock = '', didBonk = false;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    for (const level of levels) {
      const value = saved.records?.[level.id];
      if (value && Number.isInteger(value.stars) && value.stars >= 1 && value.stars <= 3 && Number.isFinite(value.ink) && value.ink >= 10 && value.ink <= level.ink + 1) records[level.id] = { stars: value.stars, ink: value.ink };
    }
    muted = saved.muted !== false;
  } catch { storageOK = false; }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify({ records, muted })); }
    catch { storageOK = false; $('save-note').textContent = '浏览器未允许保存；当前这次仍可正常玩。'; }
  }
  function toast(message) {
    clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500);
  }
  function sound(kind) {
    if (muted) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      audio.resume().catch(() => {});
      const notes = kind === 'win' ? [523, 659, 784, 1047] : kind === 'fail' ? [196, 131, 98] : kind === 'draw' ? [520] : [330, 440];
      notes.forEach((hz, i) => {
        const osc = audio.createOscillator(), gain = audio.createGain(), t = audio.currentTime + i * .09;
        osc.type = kind === 'fail' ? 'triangle' : 'sine'; osc.frequency.setValueAtTime(hz, t);
        gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(.045, t + .015); gain.gain.exponentialRampToValueAtTime(.001, t + .16);
        osc.connect(gain); gain.connect(audio.destination); osc.start(t); osc.stop(t + .18);
      });
    } catch { /* Audio is optional; unsupported or blocked contexts stay silent. */ }
  }
  function renderSound() {
    $('sound-button').setAttribute('aria-pressed', String(!muted));
    $('sound-button').setAttribute('aria-label', muted ? '开启音效' : '关闭音效');
    $('sound-button').querySelector('span').textContent = muted ? '音效关' : '音效开';
  }
  function renderRecords() {
    const total = Object.values(records).reduce((n, r) => n + r.stars, 0);
    $('total-stars').innerHTML = `${total} <small>/ 15</small>`;
    $('level-nav').replaceChildren(...levels.map(level => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'level-button';
      const r = records[level.id];
      if (r) button.classList.add('completed');
      if (level.id === state.level.id) button.setAttribute('aria-current', 'step');
      button.setAttribute('aria-label', `第${level.id}关 ${level.title}${r ? `，已获${r.stars}星` : '，未通关'}`);
      button.dataset.level = level.id;
      button.innerHTML = `<span class="nav-num">${String(level.id).padStart(2, '0')}</span><span class="nav-copy"><span class="nav-name">${level.title}</span><span class="nav-stars" aria-hidden="true">${r ? '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars) : '· · ·'}</span></span>`;
      button.addEventListener('click', () => selectLevel(level.id));
      return button;
    }));
    const best = records[state.level.id];
    $('personal-stars').textContent = best ? '★ '.repeat(best.stars) + '☆ '.repeat(3 - best.stars) : '☆ ☆ ☆';
    $('personal-stars').setAttribute('aria-label', best ? `本关最佳${best.stars}星` : '本关尚无成绩');
    $('personal-best').textContent = best ? `最省的一笔：${best.ink} 墨水 · ${best.stars === 3 ? '省墨大师' : '还可以再省一点'}` : '还没留下你的神来之笔。';
    $('gold-target').textContent = `≤ ${state.level.gold} 墨水`;
    if (!storageOK) $('save-note').textContent = '存储暂不可用；本次游玩成绩仍会保留。';
  }
  function setStatus(text, warning = false) {
    $('stroke-status').textContent = text; $('stroke-status').parentElement.classList.toggle('warning', warning);
  }
  function updateInk() {
    const used = Math.min(state.level.ink, P.length(state.points));
    const remaining = Math.max(0, state.level.ink - used);
    $('ink-left').textContent = Math.round(remaining);
    $('ink-total').textContent = ` / ${state.level.ink}`;
    $('ink-fill').style.width = `${remaining / state.level.ink * 100}%`;
    $('ink-track').classList.toggle('low', remaining < state.level.ink * .2);
    $('ink-track').setAttribute('aria-valuemax', state.level.ink);
    $('ink-track').setAttribute('aria-valuenow', Math.round(remaining));
    $('gold-marker').style.left = `${(1 - state.level.gold / state.level.ink) * 100}%`;
  }
  function releasePointer() {
    const id = state.pointerId; state.pointerId = null;
    if (id !== null && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  }
  function destroyTrial() {
    if (state.trial?.engine) { Matter.Composite.clear(state.trial.engine.world, false); Matter.Engine.clear(state.trial.engine); }
    state.trial = null;
  }
  function reset(announce = true) {
    state.drawing = false; releasePointer(); destroyTrial();
    state.mode = 'ready'; state.points = []; state.validation = null; state.keyboard = null; accumulator = 0;
    $('result-panel').hidden = true; $('trial-clock').hidden = true;
    $('canvas-wrap').classList.remove('is-running');
    $('board-badge').hidden = false; $('board-state').textContent = '等你补一笔';
    $('reset-label').textContent = '清除重画'; $('test-label').innerHTML = '请阿稳试坐 <span aria-hidden="true">→</span>';
    $('test-button').disabled = true; $('hint-button').disabled = false;
    setStatus(announce ? '墨水补满！换个思路，再救一笔。' : '按住画一笔 → 松手 → 请阿稳试坐');
    updateInk();
  }
  function selectLevel(id, fromHash = false) {
    const level = levels.find(l => l.id === id) || levels[0];
    state.level = level; state.hintIndex = 0; reset(false);
    $('hint-panel').hidden = true; $('level-number').textContent = String(level.id).padStart(2, '0');
    $('level-tag').textContent = level.tag; $('level-title').textContent = level.title;
    $('level-brief').textContent = level.brief; $('condition-text').textContent = level.condition;
    document.title = `救一笔！第 ${level.id} 关 · ${level.title}`;
    if (!fromHash) history.replaceState(null, '', `#level=${level.id}`);
    renderRecords();
  }
  function hashLevel() {
    const value = new URLSearchParams(location.hash.slice(1)).get('level');
    return Number(value) >= 1 && Number(value) <= levels.length && Number.isInteger(Number(value)) ? Number(value) : 1;
  }

  function toWorld(event) {
    const r = canvas.getBoundingClientRect();
    return { x: (event.clientX - r.left) * 720 / r.width, y: (event.clientY - r.top) * 480 / r.height };
  }
  function constrain(p) {
    const q = { x: Math.max(24, Math.min(696, p.x)), y: Math.max(state.level.chair[0].y - 4, Math.min(465, p.y)) };
    for (const r of state.level.terrain) {
      if (q.x >= r.x && q.x <= r.x + r.w && q.y > r.y - P.RADIUS) q.y = Math.min(q.y, r.y - P.RADIUS);
    }
    return q;
  }
  function startStroke(p) {
    if (state.mode !== 'ready' || state.points.length) { toast('只准补一笔哦。想换笔画，先点「清除重画」。'); return false; }
    if (p.y < state.level.chair[0].y - 14) { setStatus('从木椅附近开始，在椅面及以下画线。', true); return false; }
    state.points = [P.snapEndpoint(constrain(p), state.level)]; state.drawing = true;
    $('test-button').disabled = true; setStatus('一笔可以拐弯。让支架碰上木椅，再找个落脚点。');
    $('board-state').textContent = '墨水施工中'; return true;
  }
  function addPoint(p) {
    if (!state.drawing) return;
    const q = constrain(p), prev = state.points[state.points.length - 1], d = P.distance(prev, q);
    if (d < 1.7) return;
    const left = Math.max(0, state.level.ink - P.length(state.points));
    if (d > left) {
      if (left > .05) state.points.push({ x: prev.x + (q.x - prev.x) * left / d, y: prev.y + (q.y - prev.y) * left / d });
      finishStroke(); setStatus('墨水用完，已自动收笔。可以试坐，也可以清除重画。', true);
    } else if (state.points.length < 1900) state.points.push(q);
    updateInk();
  }
  function finishStroke() {
    if (!state.drawing) return;
    state.drawing = false; releasePointer();
    if (state.points.length > 1) {
      const snapped = P.snapEndpoint(state.points[state.points.length - 1], state.level);
      const next = [...state.points.slice(0, -1), snapped];
      if (P.length(next) <= state.level.ink + .01) state.points = next;
    }
    state.validation = P.validateStroke(state.level, state.points);
    $('test-button').disabled = !state.validation.valid;
    if (!state.validation.valid) {
      setStatus(state.validation.message, true); $('board-state').textContent = '这一笔需要调整';
    } else if (state.validation.attached) {
      setStatus('已接上木椅 ✓ 能不能坐稳？点试坐看真实结果。'); $('board-state').textContent = '支架已焊接，等待试坐'; sound('draw');
    } else {
      setStatus('还没接上木椅：这条线会自由掉落。仍可试坐观察。', true); $('board-state').textContent = '悬空支架，注意接头';
    }
    updateInk();
  }
  function runTrial() {
    if (state.mode === 'running' || state.drawing) return;
    if (state.mode === 'result') {
      if (state.trial.outcome.success) {
        if (state.level.id < levels.length) selectLevel(state.level.id + 1);
        else { selectLevel(1); toast('五关毕业！回到第一关，把省墨星星收齐吧。'); }
      } else reset();
      return;
    }
    const trial = P.createTrial(state.level, state.points);
    if (!trial.valid) { setStatus(trial.stroke.message, true); return; }
    state.trial = trial; state.mode = 'running'; state.keyboard = null; didBonk = false; accumulator = 0; lastTime = performance.now(); lastClock = '';
    $('canvas-wrap').classList.add('is-running'); $('result-panel').hidden = true; $('trial-clock').hidden = false;
    $('board-state').textContent = '阿稳已就座'; $('test-button').disabled = true; $('hint-button').disabled = true;
    $('test-label').textContent = '试坐中…'; $('reset-label').textContent = '立即重试';
    setStatus('正在真实承重：绿色小箭头是实际接触点。随时可重试。'); sound('start');
  }
  function completeTrial() {
    const result = state.trial.outcome, level = state.level;
    state.mode = 'result'; $('canvas-wrap').classList.remove('is-running');
    $('trial-clock').hidden = true; $('board-badge').hidden = true; $('result-panel').hidden = false;
    $('result-panel').classList.toggle('failed', !result.success);
    $('result-eyebrow').textContent = result.success ? `${'★'.repeat(result.stars)}${'☆'.repeat(3 - result.stars)}  急救成功` : '本次试坐 · 未通过';
    $('result-title').textContent = result.success ? ['保住了，能坐！', '稳稳的，有点东西！', '神来一笔，坐稳了！'][result.stars - 1] : result.code === 'cat' ? '老板醒了，快跑！' : '阿稳：我先躺会儿。';
    $('result-quip').textContent = result.success ? level.success : level.failure;
    $('result-reason').textContent = result.reason;
    $('result-stats').textContent = `用墨 ${result.ink} / ${level.ink}　·　最大倾斜 ${result.maxTilt}°　·　试坐 5 秒`;
    $('test-button').disabled = false; $('hint-button').disabled = false; $('reset-label').textContent = result.success ? '挑战更省' : '清除重画';
    $('test-label').textContent = result.success ? level.id < levels.length ? '救下一把椅子 →' : '五关毕业，再挑战 ↺' : '再救一次 →';
    if (result.success) {
      const previous = records[level.id];
      records[level.id] = { stars: Math.max(previous?.stars || 0, result.stars), ink: Math.min(previous?.ink ?? Infinity, result.ink) };
      persist(); renderRecords(); sound('win');
      const finished = levels.every(l => records[l.id]);
      setStatus(finished ? '五把椅子全部获救！你已获得「首席一笔工程师」称号。' : '急救成功，成绩已记录。也可以再挑战更少墨水。');
    } else { setStatus('没关系，不扣命。清除重画只要一下，提示也不扣分。'); if (!didBonk) sound('fail'); }
  }

  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || state.drawing || !event.isPrimary) return;
    if (startStroke(toWorld(event))) { event.preventDefault(); state.keyboard = null; state.pointerId = event.pointerId; canvas.setPointerCapture(event.pointerId); canvas.focus({ preventScroll: true }); }
  });
  canvas.addEventListener('pointermove', event => {
    if (!state.drawing || event.pointerId !== state.pointerId) return;
    event.preventDefault();
    const events = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [];
    for (const e of events.length ? events : [event]) addPoint(toWorld(e));
  });
  canvas.addEventListener('pointerup', event => {
    if (event.pointerId !== state.pointerId) return;
    addPoint(toWorld(event)); finishStroke();
  });
  canvas.addEventListener('pointercancel', event => {
    if (event.pointerId === state.pointerId) { reset(false); setStatus('刚才的手势被中断了，墨水已返还，请重新画。'); }
  });
  canvas.addEventListener('lostpointercapture', () => { if (state.drawing && state.pointerId !== null) finishStroke(); });
  canvas.addEventListener('keydown', event => {
    if (state.mode !== 'ready') return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
      event.preventDefault(); state.keyboard ||= { x: 404, y: 264 };
      if (event.key === ' ') { if (state.drawing) finishStroke(); else startStroke(state.keyboard); }
      else {
        const n = event.shiftKey ? 2 : 6;
        state.keyboard = constrain({ x: state.keyboard.x + (event.key === 'ArrowRight' ? n : event.key === 'ArrowLeft' ? -n : 0), y: state.keyboard.y + (event.key === 'ArrowDown' ? n : event.key === 'ArrowUp' ? -n : 0) });
        if (state.drawing) addPoint(state.keyboard);
      }
    }
  });
  document.addEventListener('keydown', event => {
    if ($('help-dialog').open || event.ctrlKey || event.metaKey || event.altKey || ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
    if (event.key.toLowerCase() === 'r') { event.preventDefault(); reset(); }
    if (event.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') { event.preventDefault(); runTrial(); }
  });
  $('test-button').addEventListener('click', runTrial);
  $('reset-button').addEventListener('click', () => reset());
  $('hint-button').addEventListener('click', () => {
    state.hintIndex = Math.min(state.hintIndex + 1, state.level.hint.length);
    $('hint-panel').hidden = false; $('hint-title').textContent = `灵感便签 ${state.hintIndex} / ${state.level.hint.length}`;
    $('hint-text').textContent = state.level.hint[state.hintIndex - 1];
  });
  $('sound-button').addEventListener('click', () => { muted = !muted; renderSound(); persist(); if (!muted) sound('start'); });
  $('help-button').addEventListener('click', () => $('help-dialog').showModal());
  $('close-help').addEventListener('click', () => $('help-dialog').close());
  $('got-it').addEventListener('click', () => $('help-dialog').close());
  $('help-dialog').addEventListener('click', event => { if (event.target === $('help-dialog')) { const r = event.target.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close(); } });
  $('share-button').addEventListener('click', async () => {
    const url = new URL(location.href); url.hash = `level=${state.level.id}`;
    let copied = false;
    try { await navigator.clipboard.writeText(url.href); copied = true; }
    catch {
      const field = document.createElement('textarea'); field.value = url.href; field.style.cssText = 'position:fixed;left:-9999px'; document.body.append(field); field.select();
      try { copied = document.execCommand('copy'); } catch { /* Browser may deny both clipboard APIs. */ }
      field.remove(); $('share-button').focus({ preventScroll: true });
    }
    toast(copied ? `已复制第 ${state.level.id} 关挑战链接。本机服务地址仅本机可用。` : '复制未获许可，请从地址栏复制当前关卡链接。');
  });
  window.addEventListener('hashchange', () => selectLevel(hashLevel(), true));
  document.addEventListener('visibilitychange', () => { lastTime = performance.now(); accumulator = 0; });
  function resize() { const width = canvas.getBoundingClientRect().width; const dpr = Math.min(devicePixelRatio || 1, 2); canvas.width = Math.round(width * dpr); canvas.height = Math.round(width * dpr * 2 / 3); }
  new ResizeObserver(resize).observe(canvas);
  function frame(now) {
    const delta = Math.min(80, Math.max(0, now - lastTime)); lastTime = now;
    if (state.mode === 'running' && !document.hidden && !$('help-dialog').open) {
      accumulator += delta;
      while (accumulator >= P.DT && !state.trial.ended) { P.step(state.trial); accumulator -= P.DT; }
      const label = Math.max(0, (P.DURATION - state.trial.elapsed) / 1000).toFixed(1);
      if (label !== lastClock) { $('clock-text').textContent = label; $('clock-fill').style.width = `${Math.max(0, 1 - state.trial.elapsed / P.DURATION) * 100}%`; lastClock = label; }
      if (state.trial.outcome && !state.trial.outcome.success && !didBonk) { didBonk = true; sound('fail'); setStatus(state.trial.outcome.reason, true); }
      if (state.trial.ended) completeTrial();
    }
    RescueRenderer.draw(canvas, state, now);
    requestAnimationFrame(frame);
  }
  renderSound(); selectLevel(hashLevel()); resize(); requestAnimationFrame(frame);
  // Read-only diagnostics for acceptance/debugging. No path injection or forced wins.
  window.rescueDebug = Object.freeze({
    snapshot: () => ({ level: state.level.id, mode: state.mode, drawing: state.drawing, points: state.points.map(p => ({ ...p })), validation: state.validation ? { valid: state.validation.valid, attached: state.validation.attached, code: state.validation.code } : null, outcome: state.trial?.ended ? { ...state.trial.outcome } : null, elapsed: state.trial?.elapsed || 0, records: JSON.parse(JSON.stringify(records)) })
  });
})();
