/* Animationen für Vortrag 2.
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

  /* ===== Kontextfenster: jeder Baustein kostet Platz ===== */

  register('kontext', function (root, inst) {
    var W = 1100, H = 190, s = svg(root, W, H);
    var BX = 20, BW = 1060, BY = 56, BH = 64, CAP = 128;
    var PARTS = [
      { n: 'System-Prompt', short: 'System', k: 2, c: C.navy, on: true },
      { n: 'Euer Prompt', short: 'Prompt', k: 1, c: C.orange, on: true },
      { n: '10 Skills (nur Kurzbeschreibung)', short: '', k: 1, c: '#4F7CAC', on: false },
      { n: 'MCP-Server mit vielen Tools', short: 'MCP-Tools', k: 30, c: '#6B7F99', on: false },
      { n: 'Dokumente (RAG)', short: 'Dokumente', k: 20, c: '#2F5C73', on: false },
      { n: 'Gesprächsverlauf', short: 'Verlauf', k: 25, c: '#7F8FA6', on: false },
      { n: 'Agent: Zwischenergebnisse', short: 'Zwischenergebnisse', k: 40, c: '#B24A00', on: false }
    ];
    text(s, BX, 34, 'Kontextfenster: 128k Tokens (Beispielgröße, alle Werte sind Demowerte)', { 'font-size': 20, 'font-weight': 700 });
    el('rect', { x: BX, y: BY, width: BW, height: BH, fill: '#F4F6F8', stroke: C.navy, 'stroke-width': 1.5 }, s);
    PARTS.forEach(function (p) {
      p.cur = p.on ? p.k : 0;
      p.rect = el('rect', { y: BY, height: BH, fill: p.c }, s);
      p.label = text(s, 0, BY + BH / 2 + 6, '', { 'font-size': 15, fill: C.white });
    });
    var status = text(s, BX, BY + BH + 38, '', { 'font-size': 22, 'font-weight': 700 });
    var hint = text(s, BX, BY + BH + 66, '', { 'font-size': 17, fill: C.muted });

    function render() {
      var x = BX, used = 0;
      PARTS.forEach(function (p) {
        used += p.on ? p.k : 0;
        var w = Math.max(0, Math.min(p.cur / CAP * BW, BX + BW - x));
        p.rect.setAttribute('x', x);
        p.rect.setAttribute('width', w);
        p.label.setAttribute('x', x + 8);
        p.label.textContent = p.short && w > 12 + p.short.length * 8.5 ? p.short : '';
        x += w;
      });
      var free = CAP - used;
      status.setAttribute('fill', free < 0 ? C.bad : C.navy);
      status.textContent = free < 0
        ? 'Voll: ' + used + 'k von ' + CAP + 'k. Es passt nicht mehr alles rein.'
        : 'Belegt: ' + used + 'k von ' + CAP + 'k. Frei für die Antwort: ' + free + 'k';
      hint.textContent = free < 0
        ? 'Ältere Inhalte fliegen raus oder der Aufruf scheitert. Das Modell arbeitet mit dem, was übrig bleibt.'
        : used > CAP / 2
          ? 'Mehr als die Hälfte ist weg, bevor die Antwort anfängt. Und alles muss bei jedem Aufruf neu verarbeitet werden.'
          : 'Jeder Baustein kostet Platz, Geld und Zeit. Schaltet unten Bausteine dazu.';
    }
    inst.tick = function (dt) {
      PARTS.forEach(function (p) { p.cur = approach(p.cur, p.on ? p.k : 0, dt); });
      render();
    };
    var bar = controls(root);
    PARTS.forEach(function (p) {
      checkbox(bar, p.n + ' (≈' + p.k + 'k)', p.on, function (v) { p.on = v; });
    });
    render();
  });

  /* ===== Skill: erst die Beschreibung, dann bei Bedarf mehr ===== */

  register('skill', function (root, inst) {
    var W = 1100, H = 372, s = svg(root, W, H);
    var LX = 20, LW = 440, RX = 560, RW = 520, T = 14;
    var FILES = [
      { n: 'Name + Beschreibung', sub: 'steht oben in SKILL.md', y: 44 },
      { n: 'Anleitung', sub: 'der Rest von SKILL.md', y: 128 },
      { n: 'Skripte und Vorlagen', sub: 'liegen im Ordner', y: 212 }
    ];
    var ITEMS = [
      { t: 0.5, y: 44, tok: 100, file: 0, s: 'Skill release-notes: schreibt Release Notes im Teamstil' },
      { t: 3, y: 96, tok: 0, file: -1, s: 'Ihr: Schreibt die Release Notes für v2.4' },
      { t: 5.5, y: 148, tok: 800, file: 1, s: 'Anleitung: Aufbau, Ton, Vorlage ...' },
      { t: 8.5, y: 200, tok: 200, file: 2, s: 'Ergebnis des Skripts: 12 Commits seit v2.3' },
      { t: 11, y: 252, tok: 0, file: -1, s: 'Antwort: Release Notes für v2.4' }
    ];
    var CAPS = [
      [0, '1. Beim Start liegt nur Name und Beschreibung im Kontext. Das ist wenig.'],
      [3, '2. Die Frage passt zur Beschreibung. Das Modell entscheidet: Den Skill brauche ich.'],
      [5.5, '3. Erst jetzt wird die Anleitung geladen.'],
      [8.5, '4. Das Skript läuft auf dem Rechner. Nur sein Ergebnis kommt in den Kontext.'],
      [11, '5. Fertig. Was der Skill nicht brauchte, hat nie Platz gekostet.']
    ];
    var t = 0;
    text(s, LX, 28, 'Der Skill-Ordner (auf der Platte)', { 'font-size': 18, 'font-weight': 700 });
    text(s, RX, 28, 'Der Kontext des Modells', { 'font-size': 18, 'font-weight': 700 });
    FILES.forEach(function (f) {
      f.rect = el('rect', { x: LX, y: f.y, width: LW, height: 68, fill: '#fff', stroke: C.navy, 'stroke-width': 1.5 }, s);
      text(s, LX + 18, f.y + 30, f.n, { 'font-size': 20, 'font-weight': 700 });
      text(s, LX + 18, f.y + 54, f.sub, { 'font-size': 16, fill: C.muted });
    });
    ITEMS.forEach(function (it) {
      it.g = el('g', { opacity: 0 }, s);
      el('rect', { x: RX, y: it.y, width: RW, height: 42, fill: it.file < 0 ? '#F4F6F8' : '#FFF3EB', stroke: it.file < 0 ? C.grey : C.orange, 'stroke-width': 1.5 }, it.g);
      text(it.g, RX + 14, it.y + 27, it.s, { 'font-size': 16 });
    });
    var cap = text(s, LX, 324, '', { 'font-size': 19, 'font-weight': 700 });
    var count = text(s, LX, 354, '', { 'font-size': 17, fill: C.muted });

    function render() {
      var tokens = 0, caption = CAPS[0][1];
      ITEMS.forEach(function (it) {
        var o = Math.max(0, Math.min(1, (t - it.t) / 0.5));
        it.g.setAttribute('opacity', o);
        if (t >= it.t) tokens += it.tok;
      });
      CAPS.forEach(function (c) { if (t >= c[0]) caption = c[1]; });
      FILES.forEach(function (f, i) {
        var on = ITEMS.some(function (it) { return it.file === i && t >= it.t - 0.6 && t < it.t + 2; });
        f.rect.setAttribute('stroke', on ? C.orange : C.navy);
        f.rect.setAttribute('stroke-width', on ? 4 : 1.5);
      });
      cap.textContent = caption;
      count.textContent = 'Vom Skill belegt: ' + fmt(tokens) + ' Tokens (Beispielwerte)';
    }
    inst.reset = function () { t = 0; render(); };
    inst.tick = function (dt) {
      t += dt;
      if (t >= T) { t = T; finish(inst); }
      render();
    };
    playButtons(controls(root), inst);
    render();
  });

  /* ===== Tool-Aufruf: das Modell bittet, die App führt aus ===== */

  register('toolloop', function (root, inst) {
    var W = 1100, H = 350, s = svg(root, W, H);
    var X = [110, 380, 650, 940], NAMES = ['Ihr', 'App (Host)', 'Modell', 'MCP-Server'];
    var STEP = 2.2, T0 = 0.3;
    var STEPS = [
      [0, 1, 'Wie viele Tickets sind offen?', 'Jemand stellt eine Frage.'],
      [1, 2, 'Frage + Tool-Liste', 'Die App schickt die Frage und eine Liste der Tools mit Beschreibung ans Modell.'],
      [2, 1, 'tickets_zaehlen(offen)', 'Das Modell führt nichts selbst aus. Es schreibt nur: Ich hätte gern dieses Tool mit diesen Parametern.'],
      [1, 3, 'tickets_zaehlen(offen)', 'Die App ruft den MCP-Server auf. Er übersetzt in den Aufruf des echten Systems, oft eine REST-API.'],
      [3, 1, 'Ergebnis: 17', 'Das System liefert das Ergebnis zurück.'],
      [1, 2, 'Ergebnis: 17', 'Die App gibt das Ergebnis ans Modell weiter.'],
      [2, 1, 'Es sind 17 Tickets offen.', 'Erst jetzt formuliert das Modell die Antwort.'],
      [1, 0, 'Es sind 17 Tickets offen.', 'Die App zeigt sie an. Das war ein einzelner Tool-Aufruf.']
    ];
    var t = 0;
    var defs = el('defs', {}, s);
    var mk = el('marker', { id: 'ah-tool', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' }, defs);
    el('path', { d: 'M0,0 L10,5 L0,10 z', fill: C.navy }, mk);
    X.forEach(function (x, i) {
      el('line', { x1: x, y1: 52, x2: x, y2: 312, stroke: C.grey, 'stroke-dasharray': '4 5' }, s);
      el('rect', { x: x - 85, y: 8, width: 170, height: 42, fill: i === 2 ? C.orange : C.navy }, s);
      text(s, x, 36, NAMES[i], { 'text-anchor': 'middle', 'font-size': 19, 'font-weight': 700, fill: C.white });
    });
    STEPS.forEach(function (st, i) {
      var y = 78 + i * 31, x1 = X[st[0]], x2 = X[st[1]];
      st.line = el('line', { x1: x1, y1: y, x2: x1, y2: y, stroke: C.navy, 'stroke-width': 2.5, 'marker-end': 'url(#ah-tool)' }, s);
      st.lab = text(s, (x1 + x2) / 2, y - 7, st[2], { 'text-anchor': 'middle', 'font-size': 16, opacity: 0 });
      st.y = y;
    });
    var cap = text(s, 20, 340, '', { 'font-size': 18, 'font-weight': 700 });

    function render() {
      var cur = -1;
      STEPS.forEach(function (st, i) {
        var p = Math.max(0, Math.min(1, (t - T0 - i * STEP) / 0.9));
        var x1 = X[st[0]], x2 = X[st[1]];
        st.line.setAttribute('x2', x1 + (x2 - x1) * p);
        st.line.setAttribute('opacity', p > 0 ? 1 : 0);
        st.lab.setAttribute('opacity', p > 0 ? 1 : 0);
        st.lab.setAttribute('font-weight', p > 0 && t < T0 + (i + 1) * STEP ? 700 : 400);
        if (p > 0) cur = i;
      });
      cap.textContent = cur >= 0 ? STEPS[cur][3] : 'Mit Abspielen geht es los.';
      cap.setAttribute('fill', cur === 2 ? C.orange : C.navy);
    }
    inst.reset = function () { t = 0; render(); };
    inst.tick = function (dt) {
      t += dt;
      if (t >= T0 + STEPS.length * STEP) finish(inst);
      render();
    };
    playButtons(controls(root), inst);
    render();
  });

  /* ===== MCP: ein Stecker statt vieler Kabel ===== */

  register('mcp', function (root, inst) {
    var W = 1100, H = 290, s = svg(root, W, H);
    var APPS = ['Chat', 'IDE', 'Agent'], SYS = ['Ticketsystem', 'Git', 'Datenbank', 'Wiki'];
    var mode = 0, direct = [], viaApp = [], viaSys = [];
    var ay = function (i) { return 40 + i * 82; }, sy = function (j) { return 20 + j * 62; };
    APPS.forEach(function (a, i) {
      el('rect', { x: 20, y: ay(i), width: 180, height: 52, fill: C.navy }, s);
      text(s, 110, ay(i) + 33, a, { 'text-anchor': 'middle', fill: C.white, 'font-weight': 700 });
    });
    SYS.forEach(function (n, j) {
      el('rect', { x: 880, y: sy(j), width: 200, height: 46, fill: '#fff', stroke: C.navy, 'stroke-width': 1.5 }, s);
      text(s, 980, sy(j) + 30, n, { 'text-anchor': 'middle' });
    });
    APPS.forEach(function (a, i) {
      SYS.forEach(function (n, j) {
        direct.push(el('line', { x1: 200, y1: ay(i) + 26, x2: 880, y2: sy(j) + 23, stroke: C.grey, 'stroke-width': 1.5 }, s));
      });
      viaApp.push(el('line', { x1: 200, y1: ay(i) + 26, x2: 470, y2: 145, stroke: C.orange, 'stroke-width': 2.5 }, s));
    });
    SYS.forEach(function (n, j) { viaSys.push(el('line', { x1: 630, y1: 145, x2: 880, y2: sy(j) + 23, stroke: C.orange, 'stroke-width': 2.5 }, s)); });
    var hub = el('g', {}, s);
    el('rect', { x: 470, y: 85, width: 160, height: 120, fill: C.orange }, hub);
    text(hub, 550, 140, 'MCP', { 'text-anchor': 'middle', fill: C.white, 'font-size': 28, 'font-weight': 700 });
    text(hub, 550, 168, 'ein Standard', { 'text-anchor': 'middle', fill: C.white, 'font-size': 16 });
    var out = text(s, 20, 278, '', { 'font-size': 20, 'font-weight': 700 });
    var op = [1, 0];
    function render() {
      direct.forEach(function (l) { l.setAttribute('opacity', op[0]); });
      viaApp.concat(viaSys).forEach(function (l) { l.setAttribute('opacity', op[1]); });
      hub.setAttribute('opacity', op[1]);
      out.textContent = mode === 0
        ? 'Ohne MCP: 3 × 4 = 12 Anbindungen, jede einzeln gebaut und gepflegt.'
        : 'Mit MCP: 3 + 4 = 7. Eine neue App oder ein neues System bringt nur eine Anbindung dazu.';
    }
    inst.tick = function (dt) {
      op[0] = approach(op[0], mode === 0 ? 1 : 0.08, dt);
      op[1] = approach(op[1], mode === 1 ? 1 : 0, dt);
      render();
    };
    choice(controls(root), [{ label: 'Ohne MCP', value: 0 }, { label: 'Mit MCP', value: 1 }], 0, function (v) { mode = v; });
    render();
  });

  /* ===== Workflow oder Agent ===== */

  register('agent', function (root, inst) {
    var W = 1100, H = 372, s = svg(root, W, H);
    var TOOLS = ['Logs lesen', 'Code suchen', 'Test starten', 'Ticket schreiben'];
    var mode = 0, g = el('g', {}, s), nodes = [], path = [], seg = 0, u = 0, wait = 0, calls = 0, tools = [];
    var count = text(s, 20, 30, '', { 'font-size': 22, 'font-weight': 700 });
    var info = text(s, 20, 358, '', { 'font-size': 18, fill: C.muted });
    var route = text(s, 20, 328, '', { 'font-size': 17, fill: C.navy });
    var dot = el('circle', { r: 9, fill: C.orange }, s);

    function node(x, y, w, h, label, round) {
      var r = round
        ? el('circle', { cx: x + w / 2, cy: y + h / 2, r: w / 2, fill: C.navy }, g)
        : el('rect', { x: x, y: y, width: w, height: h, fill: '#fff', stroke: C.navy, 'stroke-width': 1.5 }, g);
      text(g, x + w / 2, y + h / 2 + 6, label, { 'text-anchor': 'middle', 'font-size': 18, fill: round ? C.white : C.navy });
      var n = { x: x + w / 2, y: y + h / 2, rect: r, round: round, label: label };
      nodes.push(n);
      return n;
    }
    function build() {
      g.textContent = ''; nodes = [];
      if (mode === 0) {
        var a = node(40, 120, 260, 70, 'Logs holen (Code)'), b = node(420, 120, 260, 70, 'KI fasst zusammen'), c = node(800, 120, 260, 70, 'Ticket anlegen (Code)');
        [[300, 420], [680, 800]].forEach(function (p) { el('line', { x1: p[0], y1: 155, x2: p[1], y2: 155, stroke: C.navy, 'stroke-width': 2 }, g); });
        b.call = true;
        path = [a, b, c];
      } else {
        var pos = [[40, 40], [40, 230], [860, 40], [860, 230]];
        pos.forEach(function (p) {
          el('line', { x1: 550, y1: 165, x2: p[0] + 100, y2: p[1] + 27, stroke: C.grey, 'stroke-width': 1.5 }, g);
        });
        var hub = node(490, 105, 120, 120, 'Modell', true);
        tools = pos.map(function (p, i) { return node(p[0], p[1], 200, 54, TOOLS[i]); });
        hub.call = true;
        var n = 3 + Math.floor(Math.random() * 4), last = -1;
        path = [hub];
        for (var k = 0; k < n; k++) {
          var j; do { j = Math.floor(Math.random() * 4); } while (j === last);
          last = j; path.push(tools[j], hub);
        }
      }
    }
    function arrive(n) {
      nodes.forEach(function (m) { if (!m.round) m.rect.setAttribute('fill', '#fff'); });
      if (!n.round) n.rect.setAttribute('fill', '#FFF3EB');
      if (n.call) calls++;
      count.textContent = 'LLM-Aufrufe: ' + calls + '   ·   Schritte: ' + (mode === 0 ? '3, immer gleich' : 'offen');
    }
    function text2() {
      route.textContent = mode === 1 && seg >= path.length - 1
        ? 'Dieser Lauf: ' + path.filter(function (n) { return !n.round; }).map(function (n) { return n.label; }).join(' → ') + ' → fertig'
        : '';
      info.textContent = seg >= path.length - 1
        ? (mode === 0 ? 'Fertig. Der Ablauf stand vorher fest: planbar, günstig, leicht zu testen.'
          : 'Das Modell hat den Weg selbst gewählt. Weitere Läufe können und sollen anders aussehen!')
        : (mode === 0 ? 'Der Ablauf steht im Code. Das Modell füllt nur einen Schritt.'
          : 'Nach jedem Schritt entscheidet das Modell neu: Was als Nächstes? Oder bin ich fertig?');
    }
    inst.reset = function () {
      build(); seg = 0; u = 0; wait = 0.4; calls = 0;
      arrive(path[0]); text2();
      dot.setAttribute('cx', path[0].x); dot.setAttribute('cy', path[0].y);
    };
    inst.tick = function (dt) {
      if (wait > 0) { wait -= dt; return; }
      u += dt / 0.8;
      if (u >= 1) {
        seg++; u = 0; arrive(path[seg]); wait = 0.35;
        dot.setAttribute('cx', path[seg].x); dot.setAttribute('cy', path[seg].y);
        if (seg >= path.length - 1) { text2(); finish(inst); }
        return;
      }
      var a = path[seg], b = path[seg + 1], e = ease(u);
      dot.setAttribute('cx', lerp(a.x, b.x, e));
      dot.setAttribute('cy', lerp(a.y, b.y, e));
    };
    var bar = controls(root);
    choice(bar, [{ label: 'Workflow: Ablauf steht fest', value: 0 }, { label: 'Agent: Modell entscheidet', value: 1 }], 0,
      function (v) { mode = v; inst.reset(); inst.playing = true; inst.sync(); });
    playButtons(bar, inst);
    inst.reset();
  });

  /* ===== Entscheidungshilfe: Fragen statt Bauchgefühl ===== */

  register('entscheider', function (root, inst) {
    var TREE = {
      q1: { q: 'Ist der Ablauf immer gleich, und kennt ihr alle Schritte vorher?', y: 'wf', n: 'q2' },
      q2: { q: 'Reicht dem Modell, was ihr ihm in den Text schreiben könnt?', y: 'q3', n: 'q4' },
      q3: { q: 'Schreibt ihr dieselben Anweisungen immer wieder neu?', y: 'skill', n: 'prompt' },
      q4: { q: 'Braucht das Modell Live-Daten oder soll es etwas in einem System auslösen?', y: 'q5', n: 'rag' },
      q5: { q: 'Muss das Modell selbst entscheiden, welche Schritte nötig sind?', y: 'agent', n: 'tool' },
      wf: { r: 'Workflow oder Skript', w: 'Die KI übernimmt höchstens einzelne Schritte, zum Beispiel das Formulieren.', e: 'Release Notes: Ein Skript sammelt die Commits, das Modell schreibt den Text.' },
      prompt: { r: 'Ein guter Prompt', w: 'Rolle, Aufgabe, Format, ein Beispiel. Mehr braucht es nicht.', e: 'Einen Bescheid in einfacher Sprache zusammenfassen.' },
      skill: { r: 'Ein Skill', w: 'Anweisungen und Vorlagen einmal aufschreiben. Das Modell lädt sie bei Bedarf.', e: 'Folientexte nach festen Regeln auf KI-Floskeln prüfen.' },
      rag: { r: 'Dokumente mitgeben (RAG)', w: 'Passende Textstücke werden vor der Frage in den Prompt gelegt. Ein Werkzeug ist nicht nötig.', e: 'Fragen zum internen Handbuch beantworten.' },
      tool: { r: 'Tool oder MCP-Server, fester Ablauf', w: 'Der Weg steht fest. Nur die Daten oder die Aktion kommen aus einem System.', e: 'Offene Tickets abfragen und in eine Zusammenfassung einbauen.' },
      agent: { r: 'Ein Agent mit Tools', w: 'Das Modell wählt die Schritte. Dann gehören Limits, Freigaben und Tracing von Anfang an dazu.', e: 'Ein Coding-Agent: Dateien lesen, ändern, Tests starten.' }
    };
    var box = div('dec', root), trail = [];
    function show(id) {
      box.textContent = '';
      var n = TREE[id];
      var tr = div('dec-trail', box);
      tr.textContent = trail.length ? 'Eure Antworten: ' + trail.join(' → ') : 'Beantwortet die Fragen von oben nach unten.';
      if (n.q) {
        div('dec-q', box).textContent = n.q;
        var bar = div('dec-btns', box);
        button(bar, 'Ja', function () { trail.push('Ja'); show(n.y); });
        button(bar, 'Nein', function () { trail.push('Nein'); show(n.n); }, 'ghost');
        if (trail.length) button(bar, 'Zurück', function () { trail.pop(); show(back(id)); }, 'ghost');
      } else {
        var c = div('dec-res', box);
        div('dec-lbl', c).textContent = 'Das reicht:';
        div('dec-r', c).textContent = n.r;
        div('dec-w', c).textContent = n.w;
        div('dec-e', c).textContent = 'Beispiel: ' + n.e;
        button(div('dec-btns', box), 'Nochmal von vorn', function () { trail = []; show('q1'); }, 'ghost');
      }
    }
    // Vorgänger suchen, damit "Zurück" auch aus dem Ergebnis funktioniert
    function back(id) {
      var cur = 'q1';
      for (var i = 0; i < trail.length; i++) cur = TREE[cur][trail[i] === 'Ja' ? 'y' : 'n'];
      return cur;
    }
    show('q1');
  });

  /* ===== Die tödliche Dreierkombination ===== */

  register('trifecta', function (root, inst) {
    var W = 1100, H = 360, s = svg(root, W, H);
    var LEGS = [
      { n: 'Private Daten', ex: 'z. B. private Repos, Postfach', cx: 400, cy: 130, c: C.navy, lx: 290, la: 'end', ly: 70, on: true },
      { n: 'Fremde Inhalte lesen', ex: 'z. B. Issues, Mails, Webseiten', cx: 520, cy: 130, c: C.orange, lx: 630, la: 'start', ly: 70, on: true },
      { n: 'Nach außen senden', ex: 'z. B. Pull Request, E-Mail, HTTP', cx: 460, cy: 235, c: '#2F5C73', lx: 350, la: 'end', ly: 300, on: false }
    ];
    var R = 95;
    var tgt = [1, 1, 0], cur = [1, 1, 0];
    LEGS.forEach(function (l) {
      l.circle = el('circle', { cx: l.cx, cy: l.cy, r: R, fill: l.c, 'fill-opacity': 0, stroke: l.c, 'stroke-width': 2.5 }, s);
      text(s, l.lx, l.ly, l.n, { 'text-anchor': l.la, 'font-size': 20, 'font-weight': 700, fill: l.c });
      text(s, l.lx, l.ly + 22, l.ex, { 'text-anchor': l.la, 'font-size': 15, fill: C.muted });
    });
    var mark = el('g', { opacity: 0 }, s);
    el('circle', { cx: 460, cy: 160, r: 22, fill: C.bad }, mark);
    text(mark, 460, 170, '!', { 'text-anchor': 'middle', 'font-size': 28, 'font-weight': 700, fill: C.white });
    var head = text(s, 740, 150, '', { 'font-size': 26, 'font-weight': 700 });
    var lines = [0, 1, 2].map(function (i) { return text(s, 740, 184 + i * 26, '', { 'font-size': 17 }); });
    var fall = [0, 1, 2, 3].map(function (i) { return text(s, 740, 262 + i * 22, '', { 'font-size': 15, fill: C.muted }); });
    var FALL = ['Mai 2025, Invariant Labs: Ein Issue in', 'einem öffentlichen Repo brachte den Agenten', 'dazu, private Daten in einen öffent-', 'lichen Pull Request zu schreiben.'];
    var verdict = {
      3: ['Datenabfluss möglich', ['Ein einziger manipulierter Text genügt:', 'Der Agent liest ihn, holt private Daten', 'und schickt sie nach außen.'], C.bad],
      2: ['Noch kein Abfluss', ['Erst die dritte Fähigkeit macht es', 'gefährlich. Im Zweifel eine streichen.', ''], C.navy],
      1: ['Unkritisch', ['Eine Fähigkeit allein ist normal.', '', ''], C.ok],
      0: ['Unkritisch', ['Ohne Fähigkeiten ist es ein Chatbot.', '', ''], C.ok]
    };
    var github = false;
    function sum() { return tgt[0] + tgt[1] + tgt[2]; }
    function render() {
      LEGS.forEach(function (l, i) { l.circle.setAttribute('fill-opacity', 0.04 + 0.26 * cur[i]); });
      var n = sum(), v = verdict[n];
      mark.setAttribute('opacity', n === 3 ? 1 : 0);
      head.textContent = v[0]; head.setAttribute('fill', v[2]);
      lines.forEach(function (l, i) { l.textContent = v[1][i]; });
      fall.forEach(function (f, i) { f.textContent = github && n === 3 ? FALL[i] : ''; });
    }
    inst.tick = function (dt) {
      for (var i = 0; i < 3; i++) cur[i] = approach(cur[i], tgt[i], dt);
      render();
    };
    var bar = controls(root), btns = [];
    LEGS.forEach(function (l, i) {
      btns.push(button(bar, l.n, function () { tgt[i] = tgt[i] ? 0 : 1; github = false; sync(); }, 'ghost'));
    });
    label(bar, 'Fälle');
    button(bar, 'GitHub-MCP (Mai 2025)', function () { tgt = [1, 1, 1]; github = true; sync(); });
    button(bar, 'Chatbot im Intranet', function () { tgt = [1, 0, 0]; github = false; sync(); }, 'ghost');
    function sync() { btns.forEach(function (b, i) { b.classList.toggle('active', !!tgt[i]); }); render(); }
    sync();
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
