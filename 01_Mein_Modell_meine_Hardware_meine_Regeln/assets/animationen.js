/* Animationen für Vortrag 1.
   Stil wie samwho.dev: einfache Formen, ruhige Bewegung, Steuerung direkt unter der Grafik.
   Jede Animation hängt an <div class="anim" data-anim="name"> und läuft nur, wenn ihre Folie sichtbar ist. */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var C = {
    navy: '#13253C', orange: '#FF6800', light: '#DCEEF4', blue: '#AEC3E0',
    grey: '#B0B8C4', muted: '#5B6B7F', ok: '#2E7D4F', bad: '#C62828', white: '#ffffff'
  };
  var factories = {}, instances = [], started = false;
  function register(name, factory) { factories[name] = factory; }

  /* ===== Helfer ===== */

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, s, attrs) {
    var a = { x: x, y: y, 'font-size': 18, fill: C.navy };
    for (var k in attrs) a[k] = attrs[k];
    var t = el('text', a, parent);
    t.textContent = s;
    return t;
  }
  function div(cls, parent) {
    var d = document.createElement('div');
    d.className = cls;
    parent.appendChild(d);
    return d;
  }
  function move(node, x, y) { node.setAttribute('transform', 'translate(' + x + ',' + y + ')'); }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function approach(v, target, dt) { return v + (target - v) * Math.min(1, dt * 6); }
  function fmt(n, max, min) {
    return n.toLocaleString('de-DE', { minimumFractionDigits: min || 0, maximumFractionDigits: max || 0 });
  }

  function svg(root, w, h) {
    var s = el('svg', { viewBox: '0 0 ' + w + ' ' + h, width: w, height: h, 'class': 'anim-svg' });
    root.appendChild(s);
    return s;
  }
  function controls(root) { return div('anim-controls', root); }
  function label(bar, s) {
    var l = document.createElement('span');
    l.className = 'anim-label';
    l.textContent = s;
    bar.appendChild(l);
  }
  function button(bar, s, onClick, cls) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'ordix-btn small' + (cls ? ' ' + cls : '');
    b.textContent = s;
    b.addEventListener('click', function (e) { e.stopPropagation(); onClick(b); b.blur(); });
    bar.appendChild(b);
    return b;
  }
  // Umschalter: genau eine Option ist aktiv
  function choice(bar, options, value, onChange) {
    var buttons = options.map(function (o) {
      return button(bar, o.label, function () { select(o.value); onChange(o.value); }, 'ghost');
    });
    function select(v) { options.forEach(function (o, i) { buttons[i].classList.toggle('active', o.value === v); }); }
    select(value);
    return select;
  }
  function slider(bar, s, min, max, step, value, show, onInput) {
    var l = document.createElement('label');
    var name = document.createElement('span');
    var input = document.createElement('input');
    var out = document.createElement('strong');
    name.textContent = s;
    input.type = 'range'; input.min = min; input.max = max; input.step = step; input.value = value;
    out.textContent = show(value);
    input.addEventListener('input', function () { out.textContent = show(+input.value); onInput(+input.value); });
    // Fokus abgeben, damit der Presenter danach wieder die Folien steuert
    input.addEventListener('change', function () { input.blur(); });
    l.appendChild(name); l.appendChild(input); l.appendChild(out);
    bar.appendChild(l);
  }
  function checkbox(bar, s, checked, onChange) {
    var l = document.createElement('label');
    var input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.addEventListener('change', function () { onChange(input.checked); input.blur(); });
    l.appendChild(input);
    l.appendChild(document.createTextNode(s));
    bar.appendChild(l);
  }
  function playButtons(bar, inst) {
    var play = button(bar, inst.playing ? 'Pause' : 'Abspielen', function () {
      if (inst.finished) { inst.reset(); inst.playing = true; } else { inst.playing = !inst.playing; }
      inst.sync();
    });
    inst.sync = function () { play.textContent = inst.playing ? 'Pause' : 'Abspielen'; };
    button(bar, 'Neustart', function () { inst.reset(); inst.playing = true; inst.sync(); }, 'ghost');
    label(bar, 'Tempo');
    choice(bar, [{ label: '0,5×', value: 0.5 }, { label: '1×', value: 1 }, { label: '2×', value: 2 }], inst.speed,
      function (v) { inst.speed = v; });
  }
  // Ohne Autoplay: nach dem Ende anhalten, statt von vorn zu beginnen
  function finish(inst) {
    if (inst.finished) return;
    inst.finished = true;
    inst.playing = false;
    if (inst.sync) inst.sync();
  }

  /* ===== Inference: Token für Token ===== */

  register('tokens', function (root, inst) {
    var W = 1100, H = 300, s = svg(root, W, H);
    var PROMPT = ['Was', 'ist', 'eigentlich', 'Inference', '?'];
    var ANSWER = ['Das', 'Modell', 'rät', 'das', 'nächste', 'Token', '.'];
    var MX = 550, MY = 175, ROW_Y = 36;

    text(s, 30, 22, 'Kontext: alles, was das Modell in diesem Durchlauf sieht (vereinfacht: jedes Wort ein Token)', { 'font-size': 15, fill: C.muted });
    el('rect', { x: MX - 150, y: MY - 45, width: 300, height: 95, rx: 6, fill: C.light, stroke: C.navy, 'stroke-width': 2 }, s);
    var glow = el('rect', { x: MX - 150, y: MY - 45, width: 300, height: 95, rx: 6, fill: C.orange, opacity: 0 }, s);
    text(s, MX, MY, 'Modell', { 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 20 });
    text(s, MX, MY + 26, 'Gewichte im VRAM der GPU', { 'text-anchor': 'middle', 'font-size': 15, fill: C.muted });
    var info = text(s, 30, 290, '', { 'font-size': 17 });
    var layer = el('g', {}, s);
    var chips, dots, phase, t, emitted, emitting;

    function chip(word, color) {
      var w = 18 + word.length * 10.5;
      var g = el('g', {}, layer);
      el('rect', { width: w, height: 34, rx: 4, fill: color }, g);
      text(g, w / 2, 23, word, { 'text-anchor': 'middle', fill: C.white, 'font-size': 17, 'font-weight': 600 });
      return { g: g, w: w, x: 0, y: ROW_Y };
    }
    function rowEnd() {
      var x = 30;
      chips.forEach(function (c) { x += c.w + 8; });
      return x;
    }
    function begin(p) {
      phase = p;
      t = 0;
      if (p === 'flow') {
        dots = chips.map(function (c) {
          return { node: el('circle', { r: 5, fill: C.orange }, layer), x0: c.x + c.w / 2, y0: ROW_Y + 34 };
        });
        info.textContent = emitted === 0
          ? 'Der Prompt wird in Tokens zerlegt und einmal komplett durch das Modell geschickt'
          : 'Durchlauf ' + (emitted + 1) + ': ' + chips.length + ' Tokens rein, 1 neues Token raus';
      } else if (p === 'emit') {
        emitting = chip(ANSWER[emitted], C.orange);
        emitting.x0 = MX - emitting.w / 2;
        emitting.y0 = MY - 17;
        emitting.x1 = rowEnd();
      } else if (p === 'done') {
        info.textContent = 'Jedes neue Token kostet einen kompletten Durchlauf. Inference ist vor allem Rechenzeit auf der GPU.';
      }
    }
    inst.reset = function () {
      layer.textContent = '';
      chips = [];
      var x = 30;
      PROMPT.forEach(function (w) {
        var c = chip(w, C.navy);
        c.x = x;
        x += c.w + 8;
        move(c.g, c.x, c.y);
        chips.push(c);
      });
      emitted = 0;
      glow.setAttribute('opacity', 0);
      begin('flow');
    };
    inst.tick = function (dt) {
      t += dt;
      if (phase === 'flow') {
        var d = 0.8, stagger = 0.05;
        dots.forEach(function (o, i) {
          var k = Math.min(1, Math.max(0, (t - i * stagger) / d)), e = ease(k);
          o.node.setAttribute('cx', lerp(o.x0, MX, e));
          o.node.setAttribute('cy', lerp(o.y0, MY - 45, e));
          o.node.setAttribute('opacity', k >= 1 ? 0 : 1);
        });
        if (t > d + dots.length * stagger) {
          dots.forEach(function (o) { o.node.remove(); });
          begin('think');
        }
      } else if (phase === 'think') {
        glow.setAttribute('opacity', 0.35 * Math.sin(Math.PI * Math.min(1, t / 0.5)));
        if (t > 0.5) { glow.setAttribute('opacity', 0); begin('emit'); }
      } else if (phase === 'emit') {
        var c = emitting, e = ease(Math.min(1, t / 0.8));
        move(c.g, lerp(c.x0, c.x1, e), lerp(c.y0, ROW_Y, e));
        if (t >= 0.8) {
          c.x = c.x1;
          chips.push(c);
          emitted++;
          begin(emitted < ANSWER.length ? 'pause' : 'done');
        }
      } else if (phase === 'pause') {
        if (t > 0.35) begin('flow');
      } else if (phase === 'done') {
        if (t > 4) inst.reset();
      }
    };
    inst.reset();
    playButtons(controls(root), inst);
  });

  /* ===== KV Cache: Merkzettel statt alles neu rechnen ===== */

  register('kvcache', function (root, inst) {
    var PROMPT = ['Was', 'ist', 'ein', 'KV', 'Cache', '?'];
    var ANSWER = ['Ein', 'Merkzettel', 'für', 'jedes', 'Token', '.'];
    var KV_MB = 0.131;   // pro Token, z. B. Mistral 7B in BF16 (gleicher Wert wie im VRAM-Rechner)
    var W = 1100, H = 300, s = svg(root, W, H);
    var ROW_Y = 36, MARK_Y = 76, SHELF_Y = 178;
    var mode = 'cache';

    text(s, 30, 22, 'Kontext (vereinfacht: jedes Wort ein Token)', { 'font-size': 15, fill: C.muted });
    text(s, 30, 112, 'Orange markiert: wird in diesem Schritt neu berechnet', { 'font-size': 15, fill: C.muted });
    var shelfLabel = text(s, 30, 166, '', { 'font-size': 15, 'font-weight': 700 });
    var shelfInfo = text(s, 30, 240, '', { 'font-size': 15, fill: C.muted });
    var work = text(s, 30, 285, '', { 'font-size': 17 });
    var layer = el('g', {}, s);
    var chips, cached, phase, t, emitted, computing, first, workNo, workCache, emitting;

    function chip(word, color) {
      var w = 18 + word.length * 10.5;
      var g = el('g', {}, layer);
      el('rect', { width: w, height: 34, rx: 4, fill: color }, g);
      text(g, w / 2, 23, word, { 'text-anchor': 'middle', fill: C.white, 'font-size': 17, 'font-weight': 600 });
      var mark = el('rect', { y: MARK_Y, width: w, height: 10, fill: C.orange, opacity: 0 }, layer);
      return { g: g, w: w, mark: mark, color: color };
    }
    function place(c, x) {
      c.x = x;
      move(c.g, x, ROW_Y);
      c.mark.setAttribute('x', x);
    }
    function rowEnd() {
      var x = 30;
      chips.forEach(function (c) { x += c.w + 8; });
      return x;
    }
    function begin(p) {
      phase = p;
      t = 0;
      if (p === 'compute') {
        computing = mode === 'cache' ? chips.slice(cached) : chips.slice();
        workNo += chips.length;
        workCache += first ? chips.length : 1;
        first = false;
      } else if (p === 'emit') {
        emitting = chip(ANSWER[emitted], C.orange);
        place(emitting, rowEnd());
        emitting.g.setAttribute('opacity', 0);
      }
      render();
    }
    function render() {
      if (mode === 'cache') {
        shelfLabel.textContent = 'KV Cache im VRAM: ' + cached + ' Tokens gemerkt';
        shelfInfo.textContent = cached + ' Tokens × ' + fmt(KV_MB, 2, 2) + ' MB = ' + fmt(cached * KV_MB, 1, 1) +
          ' MB pro Anfrage (z. B. Mistral 7B). Bei 32.000 Tokens sind es schon rund 4 GB.';
      } else {
        shelfLabel.textContent = 'Kein Cache: Jeder Schritt rechnet alle Tokens noch einmal';
        shelfInfo.textContent = '';
      }
      work.textContent = 'Rechenarbeit bisher: ohne Cache ' + workNo + ' Token-Berechnungen  ·  mit Cache ' + workCache;
    }
    function addToShelf(from, to) {
      if (mode !== 'cache') return;
      for (var i = from; i < to; i++) {
        el('rect', { x: 30 + i * 30, y: SHELF_Y, width: 26, height: 30, rx: 3, fill: chips[i].color }, layer);
      }
    }
    inst.reset = function () {
      layer.textContent = '';
      chips = [];
      var x = 30;
      PROMPT.forEach(function (w) { var c = chip(w, C.navy); place(c, x); x += c.w + 8; chips.push(c); });
      cached = emitted = workNo = workCache = 0;
      first = true;
      begin('compute');
    };
    inst.tick = function (dt) {
      t += dt;
      if (phase === 'compute') {
        var o = 0.85 * Math.sin(Math.PI * Math.min(1, t / 0.8));
        computing.forEach(function (c) { c.mark.setAttribute('opacity', o); });
        if (t > 0.8) {
          if (mode === 'cache') { addToShelf(cached, chips.length); cached = chips.length; }
          render();
          begin(emitted < ANSWER.length ? 'emit' : 'done');
        }
      } else if (phase === 'emit') {
        var e = ease(Math.min(1, t / 0.5));
        emitting.g.setAttribute('opacity', e);
        move(emitting.g, emitting.x, lerp(ROW_Y + 30, ROW_Y, e));
        if (t > 0.5) { chips.push(emitting); emitted++; begin('pause'); }
      } else if (phase === 'pause') {
        if (t > 0.3) begin('compute');
      } else if (phase === 'done') {
        if (inst.auto && t > 4) inst.reset();
        else if (!inst.auto && t > 0.3) finish(inst);
      }
    };
    var bar = controls(root);
    choice(bar, [{ label: 'Ohne KV Cache', value: 'none' }, { label: 'Mit KV Cache', value: 'cache' }], mode,
      function (v) { mode = v; inst.reset(); if (!inst.auto) { inst.playing = true; if (inst.sync) inst.sync(); } });
    playButtons(bar, inst);
    inst.reset();
  });

  /* ===== vLLM: nacheinander oder Continuous Batching ===== */

  register('batching', function (root, inst) {
    var W = 1100, H = 320, s = svg(root, W, H);
    var GX = 470, GY = 50, GW = 260, GH = 230;
    var SLOTS = 16, QUEUE_VISIBLE = 56;
    var STEP = { seq: 0.10, batch: 0.13 };   // Sekunden pro Token-Schritt; Batching macht jeden Schritt nur etwas langsamer
    var mode = 'seq', rate = 2;
    var reqs, spawnAcc, stepAcc, time, finished, tokens, started, waitSum;

    text(s, 30, 30, 'Neue Anfragen', { 'font-size': 15, fill: C.muted });
    text(s, 270, 30, 'Warteschlange', { 'font-size': 15, fill: C.muted });
    el('rect', { x: GX, y: GY, width: GW, height: GH, rx: 6, fill: C.light, stroke: C.navy, 'stroke-width': 2 }, s);
    text(s, GX + GW / 2, GY - 14, 'GPU mit Modell', { 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 17 });
    text(s, 880, 30, 'Fertig', { 'font-size': 15, fill: C.muted });
    var more = text(s, 270, 285, '', { 'font-size': 15, fill: C.bad });
    var stats = text(s, 30, 314, '', { 'font-size': 17 });
    var layer = el('g', {}, s);

    function slotPos(i) {
      if (mode === 'seq') return [GX + GW / 2, GY + GH / 2];
      return [GX + 40 + (i % 4) * 60, GY + 35 + Math.floor(i / 4) * 53];
    }
    function freeSlot(active) {
      for (var i = 0; i < SLOTS; i++) {
        if (!active.some(function (r) { return r.slot === i; })) return i;
      }
      return 0;
    }
    function spawn() {
      var r = { x: 40, y: 60 + Math.random() * 210, state: 'queue', total: 4 + Math.floor(Math.random() * 9), done: 0, t0: time };
      r.g = el('g', {}, layer);
      r.outer = el('circle', { r: 10, fill: C.white, stroke: C.navy, 'stroke-width': 2 }, r.g);
      r.inner = el('circle', { r: 0, fill: C.orange }, r.g);
      reqs.push(r);
    }
    function is(state) { return function (r) { return r.state === state; }; }

    inst.reset = function () {
      layer.textContent = '';
      reqs = [];
      spawnAcc = stepAcc = time = finished = tokens = started = waitSum = 0;
    };
    inst.tick = function (dt) {
      time += dt;
      spawnAcc += dt;
      while (spawnAcc >= 1 / rate) { spawnAcc -= 1 / rate; spawn(); }

      var cap = mode === 'seq' ? 1 : SLOTS;
      var active = reqs.filter(is('active')), queue = reqs.filter(is('queue'));
      while (active.length < cap && queue.length) {
        var r = queue.shift();
        r.state = 'active';
        r.slot = freeSlot(active);
        active.push(r);
        started++;
        waitSum += time - r.t0;
      }

      // Pro Schritt bekommt jede aktive Anfrage genau ein neues Token
      if (!active.length) stepAcc = 0;
      stepAcc += dt;
      while (stepAcc >= STEP[mode]) {
        stepAcc -= STEP[mode];
        active.forEach(function (r) {
          if (r.state !== 'active') return;
          r.done++;
          tokens++;
          if (r.done >= r.total) {
            r.state = 'done';
            r.tDone = time;
            finished++;
            r.tx = 880 + Math.random() * 190;
            r.ty = 50 + Math.random() * 230;
            r.outer.setAttribute('fill', C.navy);
            r.inner.setAttribute('fill', C.navy);
          }
        });
      }

      queue = reqs.filter(is('queue'));
      queue.forEach(function (r, i) {
        r.hidden = i >= QUEUE_VISIBLE;
        r.tx = r.hidden ? 300 : 430 - (i % 7) * 26;
        r.ty = r.hidden ? 260 : 70 + Math.floor(i / 7) * 26;
      });
      more.textContent = queue.length > QUEUE_VISIBLE ? '+ ' + (queue.length - QUEUE_VISIBLE) + ' weitere warten' : '';

      reqs.forEach(function (r) {
        if (r.state === 'active') { var p = slotPos(r.slot); r.tx = p[0]; r.ty = p[1]; }
        r.x = approach(r.x, r.tx, dt);
        r.y = approach(r.y, r.ty, dt);
        move(r.g, r.x, r.y);
        r.inner.setAttribute('r', 10 * Math.min(1, r.done / r.total));
        var op = r.hidden ? 0 : 1;
        if (r.state === 'done') op = Math.max(0, 1 - (time - r.tDone - 1.5));
        r.g.setAttribute('opacity', op);
      });
      reqs = reqs.filter(function (r) {
        var gone = r.state === 'done' && time - r.tDone > 2.6;
        if (gone) r.g.remove();
        return !gone;
      });

      stats.textContent = 'Fertig: ' + finished +
        '  ·  Warten: ' + queue.length +
        '  ·  Ø Wartezeit: ' + fmt(started ? waitSum / started : 0, 1, 1) + ' s' +
        '  ·  Tokens pro Sekunde: ' + fmt(time > 0 ? tokens / time : 0);
    };

    var bar = controls(root);
    choice(bar, [
      { label: 'Nacheinander', value: 'seq' },
      { label: 'Continuous Batching (vLLM)', value: 'batch' }
    ], mode, function (v) { mode = v; inst.reset(); });
    slider(bar, 'Anfragen pro Sekunde', 0.5, 8, 0.5, rate, function (v) { return fmt(v, 1); }, function (v) { rate = v; });
    playButtons(bar, inst);
    inst.reset();
  });

  /* ===== VRAM-Rechner: Gewichte + KV Cache ===== */

  register('vram', function (root) {
    // KV Cache pro Token in MB (BF16) = 2 × Schichten × KV-Köpfe × Kopfgröße × 2 Byte, aus der config.json typischer Modelle
    var MODELS = [
      { label: '7B', p: 7, kv: 0.131, hint: 'z. B. Mistral 7B' },
      { label: '24B', p: 24, kv: 0.164, hint: 'z. B. Mistral Small' },
      { label: '32B', p: 32, kv: 0.262, hint: 'z. B. Qwen3-32B' },
      { label: '70B', p: 70, kv: 0.328, hint: 'z. B. Llama 3 70B' },
      { label: '235B', p: 235, kv: 0.193, hint: 'z. B. Qwen3-235B-A22B' },
      { label: '480B', p: 480, kv: 0.254, hint: 'z. B. Qwen3-Coder-480B' }
    ];
    var PREC = [{ label: 'BF16', b: 2 }, { label: 'FP8', b: 1 }, { label: 'INT4', b: 0.5 }];
    var GPU_GB = 80, UTIL = 0.9, BUFFER = 3, WIDTH = 1100;
    var st = { m: 2, b: 2, ctx: 32, users: 16, gpus: 1 };

    var bar = div('vram-bar', root);
    var gpus = div('vram-gpus', bar);
    var segW = div('vram-seg w', bar), segK = div('vram-seg kv', bar), segB = div('vram-seg buf', bar);
    var over = div('vram-over', bar);
    var limit = div('vram-limit', bar);
    var legend = div('vram-legend', root);
    legend.innerHTML = '<span class="k w"></span>Gewichte <span class="k kv"></span>KV Cache ' +
      '<span class="k buf"></span>Puffer <span class="k lim"></span>90 % nutzbar (vLLM Standard)';
    var verdict = div('vram-verdict', root);
    var calc = div('vram-calc', root);

    var c1 = controls(root), c2 = controls(root);
    label(c1, 'Modell');
    choice(c1, MODELS.map(function (m, i) { return { label: m.label, value: i }; }), st.m, function (v) { st.m = v; update(); });
    label(c1, 'Präzision');
    choice(c1, PREC.map(function (p) { return { label: p.label, value: p.b }; }), st.b, function (v) { st.b = v; update(); });
    slider(c2, 'Kontext', 4, 128, 4, st.ctx, function (v) { return v + 'k'; }, function (v) { st.ctx = v; update(); });
    slider(c2, 'Parallele Anfragen', 1, 64, 1, st.users, String, function (v) { st.users = v; update(); });
    slider(c2, 'H100', 1, 8, 1, st.gpus, function (v) { return v + ' × 80 GB'; }, function (v) { st.gpus = v; update(); });

    function update() {
      var m = MODELS[st.m];
      var w = m.p * st.b;
      var kv = st.ctx * 1024 * st.users * m.kv / 1000;
      var buf = BUFFER * st.gpus;
      var need = w + kv + buf, cap = st.gpus * GPU_GB, usable = cap * UTIL;
      var px = WIDTH / (Math.max(cap, need) * 1.02);
      function place(node, from, size) { node.style.left = from * px + 'px'; node.style.width = size * px + 'px'; }

      gpus.innerHTML = '';
      for (var i = 0; i < st.gpus; i++) {
        var g = div('vram-gpu', gpus);
        place(g, i * GPU_GB, GPU_GB);
        g.textContent = GPU_GB * px > 70 ? 'H100 ' + (i + 1) : '';
      }
      place(segW, 0, w);
      place(segK, w, kv);
      place(segB, w + kv, buf);
      place(over, cap, Math.max(0, need - cap));
      over.style.display = need > cap ? 'block' : 'none';
      limit.style.left = usable * px + 'px';

      var fits = need <= usable;
      verdict.className = 'vram-verdict ' + (fits ? 'ok' : 'bad');
      verdict.textContent = fits
        ? 'Passt: ' + fmt(need) + ' GB von ' + fmt(usable) + ' GB nutzbar'
        : 'Passt nicht: ' + fmt(need - usable) + ' GB zu viel. Mehr Karten, kleinere Präzision oder weniger Kontext.';
      calc.textContent = 'Gewichte: ' + m.p + ' Mrd. × ' + fmt(st.b, 1) + ' Byte = ' + fmt(w) + ' GB  ·  ' +
        'KV Cache (Worst Case, alle Anfragen mit vollem Kontext): ' + st.ctx + 'k Tokens × ' + st.users + ' × ' + fmt(m.kv, 2, 2) + ' MB = ' + fmt(kv) + ' GB  ·  ' + m.hint;
    }
    update();
  });

  /* ===== Gateway: LiteLLM vor den Modellen ===== */

  register('gateway', function (root, inst) {
    var W = 1100, H = 360, s = svg(root, W, H);
    var CLIENTS = [{ name: 'Chat-Oberfläche', y: 85 }, { name: 'IDE / Coding', y: 165 }, { name: 'Agent mit MCP', y: 245 }];
    var MODELS = [{ name: 'Mistral', y: 110, color: C.navy }, { name: 'Qwen', y: 220, color: C.orange }];
    var CX = 190, LX = 380, LR = 700, MXL = 860, FY = 308;
    var GATES = [{ x: 450, label: 'API Key' }, { x: 540, label: 'Guardrail' }, { x: 630, label: 'Routing' }];
    var opt = { keys: true, guard: true, trace: true }, rate = 2.5;
    var things, labels, spawnAcc, n;

    CLIENTS.forEach(function (c) {
      el('rect', { x: 20, y: c.y - 22, width: 170, height: 44, rx: 4, fill: C.white, stroke: C.navy, 'stroke-width': 1.5 }, s);
      text(s, 105, c.y + 6, c.name, { 'text-anchor': 'middle', 'font-size': 16 });
    });
    el('rect', { x: LX, y: 20, width: LR - LX, height: 270, rx: 6, fill: C.light, stroke: C.navy, 'stroke-width': 2 }, s);
    text(s, (LX + LR) / 2, 46, 'LiteLLM', { 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 19 });
    GATES.forEach(function (g) {
      g.node = el('g', {}, s);
      el('line', { x1: g.x, x2: g.x, y1: 82, y2: 280, stroke: C.navy, 'stroke-width': 1.5, 'stroke-dasharray': '4 5' }, g.node);
      text(g.node, g.x, 72, g.label, { 'text-anchor': 'middle', 'font-size': 14, fill: C.muted });
    });
    MODELS.forEach(function (m) {
      m.rect = el('rect', { x: MXL, y: m.y - 30, width: 180, height: 60, rx: 4, fill: m.color, 'fill-opacity': 0, stroke: m.color, 'stroke-width': 2 }, s);
      text(s, MXL + 90, m.y - 4, 'vLLM', { 'text-anchor': 'middle', 'font-size': 13, fill: C.muted });
      text(s, MXL + 90, m.y + 18, m.name, { 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 700, fill: m.color });
      m.flash = 0;
    });
    var fuse = el('g', {}, s);
    el('rect', { x: LX, y: FY, width: LR - LX, height: 40, rx: 4, fill: C.white, stroke: C.navy, 'stroke-width': 1.5 }, fuse);
    var fuseText = text(fuse, (LX + LR) / 2, FY + 26, '', { 'text-anchor': 'middle', 'font-size': 16 });

    var legend = el('g', {}, s);
    [[30, 318, C.navy, 'none', 'an Mistral'], [150, 318, C.orange, 'none', 'an Qwen'],
     [30, 344, C.grey, 'none', 'ohne gültigen Key'], [200, 344, C.white, C.bad, 'heikler Inhalt']].forEach(function (l) {
      el('circle', { cx: l[0], cy: l[1], r: 7, fill: l[2], stroke: l[3], 'stroke-width': 3 }, legend);
      text(legend, l[0] + 14, l[1] + 5, l[4], { 'font-size': 14, fill: C.muted });
    });
    var stats = text(s, 725, 322, '', { 'font-size': 15 });
    var warn = text(s, 725, 345, '', { 'font-size': 15, fill: C.bad, 'font-weight': 600 });
    var layer = el('g', {}, s);

    function go(r, pts, cb) { r.path = pts.slice(); r.cb = cb; }
    function float(x, y, s) { labels.push({ node: text(layer, x, y, s, { 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, fill: C.bad }), y: y, t: 0 }); }
    function reject(r, gate, s, key) {
      n[key]++;
      r.node.setAttribute('fill', C.bad);
      r.node.setAttribute('stroke', 'none');
      float(gate.x, r.y - 14, s);
      go(r, [[LX, r.c.y], [CX, r.c.y]], function () { r.gone = true; });
    }
    function trace() {
      var x = (LX + LR) / 2 + (Math.random() - 0.5) * 160;
      var t = { x: x, y: 290, speed: 120, node: el('circle', { r: 4, fill: C.blue }, layer) };
      things.push(t);
      go(t, [[x, FY]], function () { t.gone = true; n.traces++; });
    }
    function spawn() {
      var c = CLIENTS[Math.floor(Math.random() * CLIENTS.length)];
      var m = MODELS[Math.floor(Math.random() * MODELS.length)];
      var r = { c: c, x: CX, y: c.y, speed: 360, badKey: Math.random() < 0.15, badPrompt: Math.random() < 0.12 };
      r.node = el('circle', { r: 8, fill: r.badKey ? C.grey : m.color, stroke: r.badPrompt ? C.bad : 'none', 'stroke-width': 3 }, layer);
      things.push(r);
      go(r, [[LX, c.y], [GATES[0].x, c.y]], function () {
        if (r.badKey && opt.keys) return reject(r, GATES[0], '401', 'key');
        if (r.badKey) n.noKey++;
        go(r, [[GATES[1].x, c.y]], function () {
          if (r.badPrompt && opt.guard) return reject(r, GATES[1], 'blockiert', 'guard');
          if (r.badPrompt) n.risky++;
          go(r, [[GATES[2].x, c.y], [LR, c.y], [MXL, m.y]], function () {
            m.flash = 1;
            r.wait = 0.35;
            r.after = function () {
              r.node.setAttribute('fill', C.white);
              r.node.setAttribute('stroke', m.color);
              r.node.setAttribute('stroke-width', 2.5);
              if (opt.trace) trace();
              go(r, [[LR, c.y], [LX, c.y], [CX, c.y]], function () { r.gone = true; n.ok++; });
            };
          });
        });
      });
    }
    function step(r, dt) {
      if (r.wait > 0) {
        r.wait -= dt;
        if (r.wait <= 0 && r.after) { var a = r.after; r.after = null; a(); }
        return;
      }
      var dist = r.speed * dt;
      while (dist > 0 && r.path.length) {
        var p = r.path[0], dx = p[0] - r.x, dy = p[1] - r.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d <= dist) {
          r.x = p[0]; r.y = p[1]; dist -= d;
          r.path.shift();
          if (!r.path.length && r.cb) { var cb = r.cb; r.cb = null; cb(); }
        } else {
          r.x += dx / d * dist; r.y += dy / d * dist; dist = 0;
        }
      }
      r.node.setAttribute('cx', r.x);
      r.node.setAttribute('cy', r.y);
    }
    function render() {
      GATES[0].node.setAttribute('opacity', opt.keys ? 1 : 0.2);
      GATES[1].node.setAttribute('opacity', opt.guard ? 1 : 0.2);
      fuse.setAttribute('opacity', opt.trace ? 1 : 0.3);
      fuseText.textContent = 'Langfuse: ' + n.traces + ' Traces';
      stats.textContent = 'Beantwortet: ' + n.ok + '  ·  Key abgewiesen: ' + n.key + '  ·  Guardrail: ' + n.guard;
      var w = [];
      if (n.noKey) w.push('ohne Key durch: ' + n.noKey);
      if (n.risky) w.push('Heikles durch: ' + n.risky);
      warn.textContent = w.join('  ·  ');
    }

    inst.reset = function () {
      layer.textContent = '';
      things = [];
      labels = [];
      spawnAcc = 0;
      n = { ok: 0, key: 0, guard: 0, traces: 0, noKey: 0, risky: 0 };
      render();
    };
    inst.tick = function (dt) {
      spawnAcc += dt;
      while (spawnAcc >= 1 / rate) { spawnAcc -= 1 / rate; spawn(); }
      things.forEach(function (r) { step(r, dt); });
      things = things.filter(function (r) { if (r.gone) r.node.remove(); return !r.gone; });
      labels = labels.filter(function (l) {
        l.t += dt;
        l.node.setAttribute('y', l.y - l.t * 20);
        l.node.setAttribute('opacity', Math.max(0, 1 - l.t / 1.2));
        if (l.t > 1.2) l.node.remove();
        return l.t <= 1.2;
      });
      MODELS.forEach(function (m) {
        m.flash = Math.max(0, m.flash - dt * 3);
        m.rect.setAttribute('fill-opacity', 0.25 * m.flash);
      });
      render();
    };

    var bar = controls(root);
    checkbox(bar, 'API Keys', opt.keys, function (v) { opt.keys = v; render(); });
    checkbox(bar, 'Guardrails', opt.guard, function (v) { opt.guard = v; render(); });
    checkbox(bar, 'Tracing mit Langfuse', opt.trace, function (v) { opt.trace = v; render(); });
    slider(bar, 'Anfragen pro Sekunde', 0.5, 6, 0.5, rate, function (v) { return fmt(v, 1); }, function (v) { rate = v; });
    playButtons(bar, inst);
    inst.reset();
  });

  /* ===== Kosten: derselbe Verbrauch über eine Cloud-API ===== */

  register('kosten', function (root) {
    // Listenpreise OpenRouter in $ pro 1 Mio. Tokens, Stand 20.10.2026 (Preis-Tracker, vor dem Vortrag live prüfen).
    // Beim 27B weichen die Quellen stark voneinander ab, hier ein Beispielwert.
    var MODELS = [
      { name: 'Qwen3.8 Flash', pin: 0.15, pout: 0.47 },
      { name: 'Qwen3.8 27B', pin: 0.35, pout: 2.75 }
    ];
    var TOKENS_MIO = 5000;     // 5 Mrd. Tokens pro Monat, wie im Projekt
    var SCALE = 7000;          // $ pro Monat für volle Balkenbreite
    var st = { share: 10 };
    var out = div('kosten-out', root);
    var bar = controls(root);
    slider(bar, 'Anteil Output-Tokens', 1, 40, 1, st.share, function (v) { return v + ' %'; }, function (v) { st.share = v; update(); });
    var note = div('kosten-note', root);
    note.textContent = 'Der Anteil ist geschätzt. Der echte Wert steht in Langfuse und in LiteLLM.';

    function update() {
      var rows = MODELS.map(function (m) {
        var inCost = TOKENS_MIO * (1 - st.share / 100) * m.pin;
        var outCost = TOKENS_MIO * (st.share / 100) * m.pout;
        return { m: m, inCost: inCost, outCost: outCost, total: inCost + outCost };
      });
      out.innerHTML = '';
      rows.forEach(function (r) {
        var row = div('kosten-row', out);
        row.innerHTML =
          '<span class="kosten-name">' + r.m.name + '</span>' +
          '<span class="kosten-bar"><i class="in" style="width:' + (r.inCost / SCALE * 100) + '%"></i>' +
          '<i class="out" style="width:' + (r.outCost / SCALE * 100) + '%"></i></span>' +
          '<span class="kosten-val">≈ ' + fmt(Math.round(r.total / 10) * 10) + ' $ pro Monat</span>';
      });
      var own = div('kosten-row own', out);
      own.innerHTML = '<span class="kosten-name">Eigenbetrieb</span><span class="kosten-bar"></span><span class="kosten-val todo">Hardware, Strom, Personal: noch nicht beziffert</span>';
      var cap = div('kosten-cap', out);
      cap.innerHTML = '<span class="k in"></span>Input <span class="k out"></span>Output  ·  5 Mrd. Tokens pro Monat  ·  Preise pro 1 Mio. Tokens: ' +
        MODELS.map(function (m) { return m.name + ' ' + fmt(m.pin, 2, 2) + ' $ / ' + fmt(m.pout, 2, 2) + ' $'; }).join('  ·  ');
    }
    update();
  });

  /* ===== Tokens: wie ein Tokenizer Text zerlegt ===== */

  register('tokenizer', function (root, inst) {
    // Echte Zerlegung, berechnet mit dem Tokenizer von gpt-oss-20b (tokenizer.json, Bibliothek "tokenizers").
    // Jedes Modell hat seinen eigenen Tokenizer, die Zahlen weichen also je nach Modell etwas ab.
    var EXAMPLES = [
      { label: 'Bescheid', words: 5, tokens: [['F', 37], ['asse', 5788], [' diesen', 26938], [' Bes', 14599], ['cheid', 36933], [' kurz', 42505], [' zusammen', 27017], ['.', 13]] },
      { label: 'Englisch', words: 4, tokens: [['Summ', 64614], ['ar', 277], ['ize', 750], [' this', 495], [' notice', 8611], [' briefly', 51088], ['.', 13]] },
      { label: 'Ein Wort', words: 1, tokens: [['Dat', 19298], ['enschutz', 76419], ['grund', 27797], ['ver', 445], ['ordnung', 69459]] },
      { label: 'Amtsdeutsch', words: 9, tokens: [['Der', 13518], [' Antrag', 119001], ['steller', 47504], [' bean', 27771], ['tragt', 196249], [' die', 1076], [' Verl', 143200], ['änger', 42539], ['ung', 988], [' der', 1227], [' Aufenthalt', 147409], ['ser', 599], ['laub', 23899], ['nis', 12113], ['.', 13]] },
      { label: 'Datum', words: 4, tokens: [['Termin', 184169], [':', 25], [' ', 220], ['17', 1422], ['.', 13], ['11', 994], ['.', 13], ['202', 1323], ['6', 21], [',', 11], [' ', 220], ['16', 1125], [':', 25], ['00', 504], [' Uhr', 21489]] }
    ];
    var COLORS = [[C.navy, C.white], [C.orange, C.white], ['#4F6D8F', C.white], [C.blue, C.navy]];
    var W = 1100, H = 240, s = svg(root, W, H);
    var sentence = text(s, 0, 34, '', { 'font-size': 28, 'font-weight': 700 });
    var count = text(s, 0, 232, '', { 'font-size': 18 });
    var layer = el('g', {}, s);
    var idx = 0, chips = [], t = 0, select;

    function show(i) {
      idx = i;
      t = 0;
      if (select) select(i);
      var ex = EXAMPLES[i];
      sentence.textContent = ex.tokens.map(function (tk) { return tk[0]; }).join('');
      layer.textContent = '';
      chips = [];
      var x = 0, y = 70;
      ex.tokens.forEach(function (tk, k) {
        var leading = tk[0].charAt(0) === ' ';
        var body = tk[0].trim() === '' ? '' : tk[0].trim();
        var w = 20 + (body.length + (leading ? 1 : 0)) * 10.5;
        if (x + w > W) { x = 0; y += 80; }
        var col = COLORS[k % COLORS.length];
        var g = el('g', { opacity: 0 }, layer);
        el('rect', { width: w, height: 38, rx: 4, fill: col[0] }, g);
        var label = el('text', { x: w / 2, y: 25, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 600, fill: col[1] }, g);
        if (leading || !body) {
          var sp = el('tspan', { opacity: 0.55 }, label);
          sp.textContent = '␣';
        }
        if (body) { var b = el('tspan', {}, label); b.textContent = body; }
        text(g, w / 2, 58, String(tk[1]), { 'text-anchor': 'middle', 'font-size': 13, fill: C.muted, 'font-family': 'Menlo, Consolas, monospace' });
        chips.push({ g: g, x: x, y: y });
        move(g, x, y - 25);
        x += w + 6;
      });
      count.textContent = 'Wörter: ' + ex.words + '  ·  Tokens: ' + ex.tokens.length +
        '  ·  Tokens pro Wort: ' + fmt(ex.tokens.length / ex.words, 1, 1);
      count.setAttribute('opacity', 0);
    }
    inst.reset = function () { show(idx); };
    inst.tick = function (dt) {
      t += dt;
      chips.forEach(function (c, k) {
        var p = ease(Math.min(1, Math.max(0, (t - k * 0.22) / 0.35)));
        c.g.setAttribute('opacity', p);
        move(c.g, c.x, c.y - 25 * (1 - p));
      });
      var end = chips.length * 0.22 + 0.35;
      count.setAttribute('opacity', Math.min(1, Math.max(0, (t - end) / 0.3)));
      if (!inst.auto && t > end + 0.3) finish(inst);
      else if (inst.auto && t > end + 4) show((idx + 1) % EXAMPLES.length);
    };
    var bar = controls(root);
    select = choice(bar, EXAMPLES.map(function (e, i) { return { label: e.label, value: i }; }), 0,
      function (v) { inst.finished = false; show(v); if (!inst.auto) { inst.playing = true; if (inst.sync) inst.sync(); } });
    playButtons(bar, inst);
    show(0);
  });

  /* ===== Auslagern: N-Gramm-Tabelle vom VRAM in den RAM ===== */

  register('offload', function (root, inst) {
    // Beispielwerte, keine Projektzahlen
    var GB = { vram: 80, compute: 30, ngram: 20 };
    var PX = 6;                       // 480 px Balken = 80 GB
    var VX = 60, BY = 100, BH = 60, RX = 760;
    var W = 1100, H = 300, s = svg(root, W, H);
    var target = 0, k = 0, spawnAcc = 0, dots = [];

    el('rect', { x: 40, y: 50, width: 520, height: 140, rx: 6, fill: C.light, stroke: C.navy, 'stroke-width': 2 }, s);
    text(s, 52, 80, 'GPU: VRAM ' + GB.vram + ' GB (schnell, knapp)', { 'font-size': 16, 'font-weight': 700 });
    el('rect', { x: 700, y: 50, width: 360, height: 140, rx: 6, fill: C.white, stroke: C.navy, 'stroke-width': 2, 'stroke-dasharray': '6 5' }, s);
    text(s, 712, 80, 'RAM, normaler Heap (langsamer, viel)', { 'font-size': 16, 'font-weight': 700 });

    var compute = el('rect', { x: VX, y: BY, width: GB.compute * PX, height: BH, fill: C.navy }, s);
    var computeGlow = el('rect', { x: VX, y: BY, width: GB.compute * PX, height: BH, fill: C.orange, opacity: 0 }, s);
    text(s, VX + GB.compute * PX / 2, BY + 36, 'Rechen-Gewichte', { 'text-anchor': 'middle', fill: C.white, 'font-size': 15, 'font-weight': 600 });
    var kv = el('rect', { y: BY, height: BH, fill: C.orange }, s);
    var kvText = text(s, 0, BY + 36, '', { 'text-anchor': 'middle', fill: C.white, 'font-size': 15, 'font-weight': 600 });
    var ngram = el('g', {}, s);
    el('rect', { width: GB.ngram * PX, height: BH, fill: C.blue }, ngram);
    text(ngram, GB.ngram * PX / 2, 25, 'N-Gramm-', { 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 600 });
    text(ngram, GB.ngram * PX / 2, 44, 'Tabelle', { 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 600 });
    var row = el('rect', { x: 0, width: GB.ngram * PX, height: 4, fill: C.orange, opacity: 0 }, ngram);
    text(s, 52, 184, 'Pro Token: rechnen mit vielen GB Gewichten', { 'font-size': 14, fill: C.muted });
    var lookupNote = text(s, 0, 212, 'Pro Token: ein paar Zeilen lesen, wenige KB', { 'font-size': 14, fill: C.muted });
    var computeFlash = 0, rowFlash = 0;
    text(s, 60, 250, 'Token', { 'font-size': 15, fill: C.muted });
    var info = text(s, 0, 292, '', { 'font-size': 18 });
    var layer = el('g', {}, s);

    function ngramX() { return lerp(VX + GB.compute * PX, RX, ease(k)); }
    function render() {
      var nx = ngramX(), kvFrom = VX + GB.compute * PX + GB.ngram * PX * (1 - ease(k)), kvTo = VX + GB.vram * PX;
      move(ngram, nx, BY);
      lookupNote.setAttribute('x', nx);
      row.setAttribute('opacity', rowFlash);
      computeGlow.setAttribute('opacity', 0.45 * computeFlash);
      kv.setAttribute('x', kvFrom);
      kv.setAttribute('width', kvTo - kvFrom);
      kvText.setAttribute('x', (kvFrom + kvTo) / 2);
      var kvGB = GB.vram - GB.compute - GB.ngram * (1 - ease(k));
      kvText.textContent = 'KV Cache ' + fmt(kvGB) + ' GB';
      info.textContent = target
        ? 'Nachschlagen braucht kaum Bandbreite, das schafft auch der RAM. Der frei gewordene VRAM gehört dem KV Cache (Beispielwerte).'
        : 'Alles im VRAM: Die Tabelle belegt teuren GPU-Speicher, obwohl pro Token nur ein paar Zeilen gelesen werden (Beispielwerte).';
    }
    function spawn() {
      var d = { node: el('circle', { r: 6, fill: C.navy }, layer), t: 0, row: 4 + Math.random() * (BH - 12) };
      dots.push(d);
    }
    // Weg eines Tokens: nachschlagen in der Tabelle, dann rechnen auf der GPU
    function pos(d) {
      var tx = ngramX() + GB.ngram * PX / 2, ty = BY + BH / 2;
      var cx = VX + GB.compute * PX / 2, cy = BY + BH / 2;
      var p = d.t / 1.6;
      if (p < 0.5) { var a = ease(p / 0.5); return [lerp(80, tx, a), lerp(240, ty, a)]; }
      var b = ease((p - 0.5) / 0.5); return [lerp(tx, cx, b), lerp(ty, cy, b)];
    }
    inst.reset = function () { layer.textContent = ''; dots = []; spawnAcc = 0; };
    inst.tick = function (dt) {
      k = Math.max(0, Math.min(1, k + (target ? dt : -dt) / 0.9));
      spawnAcc += dt;
      if (spawnAcc > 0.5) { spawnAcc = 0; spawn(); }
      computeFlash = Math.max(0, computeFlash - dt * 3);
      rowFlash = Math.max(0, rowFlash - dt * 3);
      dots = dots.filter(function (d) {
        d.t += dt;
        var q = d.t / 1.6;
        if (q > 0.45 && q < 0.55) { rowFlash = 1; row.setAttribute('y', d.row); }
        if (q > 0.95) computeFlash = 1;
        var p = pos(d);
        d.node.setAttribute('cx', p[0]);
        d.node.setAttribute('cy', p[1]);
        d.node.setAttribute('opacity', d.t > 1.4 ? Math.max(0, 1 - (d.t - 1.4) / 0.2) : 1);
        if (d.t > 1.6) d.node.remove();
        return d.t <= 1.6;
      });
      render();
    };
    var bar = controls(root);
    choice(bar, [{ label: 'Alles im VRAM', value: 0 }, { label: 'N-Gramm-Tabelle im RAM', value: 1 }], 0, function (v) { target = v; render(); });
    playButtons(bar, inst);
    render();
  });

  /* ===== Registrierung und Takt ===== */

  function visibility() {
    instances.forEach(function (i) { i.visible = !i.section || i.section.classList.contains('present'); });
  }
  function start() {
    if (started) return;
    started = true;
    document.querySelectorAll('.anim[data-anim]').forEach(function (root) {
      var factory = factories[root.getAttribute('data-anim')];
      if (!factory) return;
      var inst = { visible: false, section: root.closest('section'), speed: 1, finished: false };
      inst.auto = root.getAttribute('data-autoplay') !== 'false';
      inst.playing = inst.auto;
      factory(root, inst);
      var reset = inst.reset;
      if (reset) inst.reset = function () { inst.finished = false; reset(); };
      // Als Fragment startet die Animation mit dem Klick, der sie einblendet
      if (root.classList.contains('fragment') && window.Reveal && Reveal.on) {
        Reveal.on('fragmentshown', function (e) {
          if (e.fragment !== root) return;
          if (inst.reset) inst.reset();
          inst.playing = true;
          if (inst.sync) inst.sync();
        });
        Reveal.on('fragmenthidden', function (e) {
          if (e.fragment !== root) return;
          if (inst.reset) inst.reset();
          inst.playing = false;
          if (inst.sync) inst.sync();
        });
      }
      instances.push(inst);
    });
    visibility();
    var last = performance.now();
    requestAnimationFrame(function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      instances.forEach(function (i) { if (i.visible && i.playing && i.tick) i.tick(dt * i.speed); });
      requestAnimationFrame(frame);
    });
  }
  function hook() {
    if (window.Reveal && Reveal.on) {
      Reveal.on('ready', function () { start(); visibility(); });
      Reveal.on('slidechanged', visibility);
      if (Reveal.isReady && Reveal.isReady()) start();
    }
    window.addEventListener('load', function () { setTimeout(function () { start(); visibility(); }, 300); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook); else hook();
})();
