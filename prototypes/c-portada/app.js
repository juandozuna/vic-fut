/* =====================================================================
   vic-fut · Propuesta C · «Portada»
   Editorial, emocional: el club como portada de revista.
   Sin dependencias. Datos: window.VICFUT (shared/teams.js).
   ===================================================================== */
(function () {
  'use strict';

  var V = window.VICFUT;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var appEl = $('#app'), viewEl = $('#view'), mastEl = $('#masthead'), navEl = $('#tabbar'),
      layerRoot = $('#layer'), curtainEl = $('#curtain'), toastEl = $('#toast');

  if (!V || !V.teams || !V.order) {
    viewEl.innerHTML = '<div class="empty"><p class="d">Sin datos</p><p>No se pudo cargar <code>shared/teams.js</code>.</p></div>';
    return;
  }

  /* ------------------------------------------------------------------
     Utilidades
     ------------------------------------------------------------------ */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // Solo se permiten <b> y </b> en bullets de historia.
  function richB(s) { return esc(s).replace(/&lt;(\/?)b&gt;/g, '<$1b>'); }
  function arr(a) { return Array.isArray(a) ? a : []; }
  function num(n, d) { return typeof n === 'number' && !isNaN(n) ? n : (d == null ? 0 : d); }
  function hash(str) {
    var h = 2166136261, s = String(str), i;
    for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function minNum(m) {
    var s = String(m == null ? '' : m), p = s.split('+');
    var n = parseInt(p[0], 10) || 0;
    return n + (p[1] ? (parseInt(p[1], 10) || 0) / 100 : 0);
  }
  function fmtThousands(n) { return String(Math.round(num(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function fmtCount(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + ' M';
    if (n >= 1000) return (n / 1000).toFixed(1).replace('.', ',').replace(',0', '') + ' mil';
    return String(n);
  }

  // Colores y contraste (WCAG)
  function hexOf(str) {
    var m = String(str || '').match(/#([0-9a-f]{6}|[0-9a-f]{3})\b/i);
    if (!m) return null;
    var h = m[1];
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    return '#' + h.toLowerCase();
  }
  function rgb(h) { var n = parseInt(hexOf(h).slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function lum(h) {
    var c = rgb(h).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) {
    if (!hexOf(a) || !hexOf(b)) return 1;
    var x = lum(a), y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  // Primer candidato que cumple el contraste mínimo; si ninguno, el de mayor contraste.
  function pick(bg, cands, min) {
    var list = cands.concat(['#ffffff', '#111111']).filter(function (c) { return !!hexOf(c); }), best = list[0], bc = 0, i;
    for (i = 0; i < list.length; i++) {
      var c = contrast(bg, list[i]);
      if (c >= min) return hexOf(list[i]);
      if (c > bc) { bc = c; best = list[i]; }
    }
    return hexOf(best);
  }

  // Fechas (las fechas ISO se tratan como días de calendario, sin zona)
  var DOW = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
  var DOWL = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var MON = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  function pd(iso) { var p = String(iso).split('-').map(Number); return new Date(Date.UTC(p[0], (p[1] || 1) - 1, p[2] || 1)); }
  function todayIso() { return V.today || new Date().toISOString().slice(0, 10); }
  function fmtDate(iso, withYear) {
    if (!iso) return '';
    var d = pd(iso);
    return DOW[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + (withYear ? ' ' + d.getUTCFullYear() : '');
  }
  function fmtLong(iso) {
    if (!iso) return '';
    var d = pd(iso);
    return DOWL[d.getUTCDay()] + ' ' + d.getUTCDate() + ' de ' + MON[d.getUTCMonth()].toLowerCase();
  }
  function daysTo(iso) { return iso ? Math.round((pd(iso) - pd(todayIso())) / 864e5) : null; }

  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* almacenamiento no disponible */ } }
  };
  var KEY = 'vicfut:c-portada:';

  /* ------------------------------------------------------------------
     Iconos (SVG en línea)
     ------------------------------------------------------------------ */
  var ICONS = {
    home: '<path d="M4 3.5h16v17H4z"/><path d="M4 9.5h16M8 13.5h8M8 17h5"/>',
    matches: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.6l3.4 2.5-1.3 4H9.9l-1.3-4z"/><path d="M12 3.5v4.1M15.4 10.1l3.9-1.3M14.1 14.1l2.4 3.5M9.9 14.1l-2.4 3.5M8.6 10.1l-3.9-1.3"/>',
    season: '<path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0z"/><path d="M7.5 6H4.5a3 3 0 0 0 3.2 4M16.5 6h3a3 3 0 0 1-3.2 4M12 13.5V17M8.5 20.5h7M10 17h4v3.5h-4z"/>',
    history: '<path d="M3 5.5c3-1.2 6-1.2 9 .8 3-2 6-2 9-.8v13.5c-3-1.2-6-1.2-9 .8-3-2-6-2-9-.8z"/><path d="M12 6.3v14"/>',
    more: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
    heart: '<path d="M12 20.5s-7.6-4.6-9.3-9.6A5 5 0 0 1 12 6.6a5 5 0 0 1 9.3 4.3c-1.7 5-9.3 9.6-9.3 9.6z"/>',
    save: '<path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/>',
    share: '<path d="M12 3.5v11.5M7.5 8 12 3.5 16.5 8M5 12.5v8h14v-8"/>',
    back: '<path d="M15 4.5 7.5 12l7.5 7.5"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    chev: '<path d="M6.5 9.5 12 15l5.5-5.5"/>',
    arrow: '<path d="M4.5 12h15M13.5 6l6 6-6 6"/>',
    play: '<path d="M8 5v14l11-7z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    star: '<path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/>',
    swap: '<path d="M7 7.5h12M15.5 4 19 7.5 15.5 11M17 16.5H5M8.5 13 5 16.5 8.5 20"/>'
  };
  function ic(name, cls, filled) {
    return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false"' +
      (filled ? ' fill="currentColor"' : ' fill="none"') + ' stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || '') + '</svg>';
  }
  var BALL = '<svg class="ball" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="#fff" stroke="#111" stroke-width="1.2"/><path d="M8 4.6l2.4 1.7-.9 2.8h-3l-.9-2.8z" fill="#111"/></svg>';

  /* ------------------------------------------------------------------
     Estado
     ------------------------------------------------------------------ */
  var T = null; // equipo activo
  var SCREENS = ['home', 'matches', 'season', 'history', 'more'];
  var S = {
    screen: 'home',
    compFilter: 'all',
    seasonSel: null,      // etiqueta de temporada en Partidos
    seasonView: null,     // etiqueta de temporada en Temporadas
    seasonTab: 'resumen',
    histCat: 'all',
    histFocus: null,
    seen: {},
    settings: LS.get(KEY + 'settings', null) || {
      dark: false,
      goals: true, kickoff: true, news: false, reduce: false
    }
  };
  var mqReduce = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function reduced() { return !!(mqReduce.matches || S.settings.reduce); }

  function likesKey() { return KEY + 'likes:' + T.id; }
  function savesKey() { return KEY + 'saves:' + T.id; }
  function getLikes() { return LS.get(likesKey(), {}) || {}; }
  function getSaves() { return LS.get(savesKey(), {}) || {}; }

  /* ------------------------------------------------------------------
     Acceso a datos (defensivo)
     ------------------------------------------------------------------ */
  function teamByCode(code) {
    for (var i = 0; i < V.order.length; i++) { var t = V.teams[V.order[i]]; if (t && t.code === code) return t; }
    return null;
  }
  function kitOf(code) {
    var k = (V.kit && V.kit(code, T)) || V.genericKit || { bg: '#e7ebf1', fg: '#0d1b2a', ring: '#9aa7b5' };
    var solid = hexOf(k.bg) || '#e7ebf1';
    return { bg: k.bg || solid, solid: solid, ring: hexOf(k.ring) || solid, fg: pick(solid, [k.fg], 4.5), striped: !/^#/.test(String(k.bg || '').trim()) };
  }
  function nameOf(code) {
    if (code === T.code) return T.short || T.name;
    if (V.teamName) { var n = V.teamName(code, T); if (n) return n; }
    var o = V.opponents && V.opponents[code];
    return (o && o.name) || code;
  }
  function monoOf(code) {
    var t = teamByCode(code);
    return t ? (t.monogram || t.code) : String(code || '?').slice(0, 3);
  }
  // Color sólido "de marca" para barras y acentos.
  function colorOf(code) {
    var t = teamByCode(code);
    if (t && t.colors && t.colors.primary) return t.colors.primary;
    var k = kitOf(code);
    if (lum(k.solid) > 0.7) return pick('#ffffff', [k.ring, k.fg], 2.2);
    return k.solid;
  }
  function compOf(code) { return (V.comps && V.comps[code]) || { name: code || '', short: code || '' }; }
  function fx(id) { return id ? (V.fixture ? V.fixture(T, id) : null) || null : null; }
  function detailOf(fid) {
    if (V.matchDetail) return V.matchDetail(T, fid);
    return T.featuredMatch && T.featuredMatch.fixtureId === fid ? T.featuredMatch : null;
  }
  function nextFixture() {
    var f = T.nextMatch && fx(T.nextMatch.fixtureId);
    if (f) return f;
    return arr(T.fixtures).filter(function (x) { return x.status === 'up'; })[0] || null;
  }
  function lastResult() {
    var ft = arr(T.fixtures).filter(function (x) { return x.status === 'ft'; });
    return ft[ft.length - 1] || null;
  }
  function resultOf(f) {
    if (f.result) return f.result;
    if (f.status !== 'ft') return null;
    var mine = f.home === T.code ? f.hs : f.as, theirs = f.home === T.code ? f.as : f.hs;
    return mine > theirs ? 'W' : mine < theirs ? 'L' : 'D';
  }
  var RES = { W: 'Victoria', D: 'Empate', L: 'Derrota' };
  var RES1 = { W: 'V', D: 'E', L: 'D' };
  function seasons() {
    var list = [{ label: (T.season && T.season.label) || 'Actual', fixtures: arr(T.fixtures), current: true }];
    var by = {};
    arr(T.archive).forEach(function (f) {
      var k = f.season || 'Archivo';
      if (!by[k]) { by[k] = { label: k, fixtures: [], current: false }; list.push(by[k]); }
      by[k].fixtures.push(f);
    });
    return list;
  }
  function seasonByLabel(lbl) {
    var all = seasons();
    for (var i = 0; i < all.length; i++) if (all[i].label === lbl) return all[i];
    return all[0];
  }
  function summarize(fixtures) {
    var s = { played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
    fixtures.forEach(function (f) {
      if (f.status !== 'ft') return;
      var home = f.home === T.code, r = resultOf(f);
      s.played++; s.gf += num(home ? f.hs : f.as); s.ga += num(home ? f.as : f.hs);
      if (r === 'W') s.w++; else if (r === 'D') s.d++; else if (r === 'L') s.l++;
    });
    return s;
  }
  function shortName(n) {
    n = String(n || '');
    if (n.length <= 11) return n;
    var parts = n.split(' ').filter(function (p) { return p && p !== 'Jr' && p !== 'Jr.'; });
    return parts[parts.length - 1] || n;
  }
  var POS = { GK: 'Portero', DEF: 'Defensa', MID: 'Centrocampista', FWD: 'Delantero', POR: 'Porteros', MED: 'Centrocampistas', DEL: 'Delanteros' };

  /* ------------------------------------------------------------------
     Tema
     ------------------------------------------------------------------ */
  var PAPER = '#f2eee6', INK = '#0c0c0e';
  function applyTheme() {
    var c = T.colors || {}, r = document.documentElement.style;
    var pri = hexOf(c.primary) || '#333333', acc = hexOf(c.accent) || '#ffcc00';
    var onPri = pick(pri, [c.onPrimary], 4.5), onAcc = pick(acc, [c.onAccent], 4.5);
    var dark = !!S.settings.dark, bg = dark ? INK : PAPER;
    var hi = pick(pri, [c.gold, acc, onPri], 3);
    var set = {
      '--pri': pri, '--pri-d': hexOf(c.primaryDark) || pri, '--acc': acc, '--acc-d': hexOf(c.accentDark) || acc,
      '--on-pri': onPri, '--on-acc': onAcc, '--tint': hexOf(c.bgTint) || '#eeeeee',
      // Resalte sobre el color primario (≥3:1, texto grande)
      '--hi': hi, '--on-hi': pick(hi, [pri, c.onAccent, c.onGold], 4.5),
      // Acento legible sobre negro (tarjetas oscuras, stories)
      '--acc-dk': pick(INK, [acc, c.gold, '#ffffff'], 4.5),
      // Color del club usable como texto sobre el fondo de la app (≥4.5:1)
      '--pri-t': pick(bg, dark ? [acc, c.gold, '#ffffff'] : [pri, c.primaryDark], 4.5),
      // Color para bloques de acento sobre el fondo (detalle gráfico)
      '--acc-t': pick(bg, dark ? [acc, c.gold] : [c.accentDark, pri], 3),
      '--kit-bg': (T.kit && T.kit.bg) || pri,
      '--kit-fg': pick(hexOf(T.kit && T.kit.bg) || pri, [T.kit && T.kit.fg], 4.5),
      '--kit-ring': hexOf(T.kit && T.kit.ring) || acc
    };
    Object.keys(set).forEach(function (k) { r.setProperty(k, set[k]); });
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.classList.toggle('reduce', !!S.settings.reduce);
    var meta = $('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', pri);
    document.title = (T.short || T.name) + ' · Portada · vic-fut';
  }

  /* ------------------------------------------------------------------
     Piezas reutilizables
     ------------------------------------------------------------------ */
  function monoBadge(code, cls) {
    var k = kitOf(code);
    return '<span class="mono ' + (cls || '') + (k.striped ? ' striped' : '') + '" style="--mbg:' + esc(k.bg) + ';--msolid:' + k.solid + ';--mfg:' + k.fg + ';--mring:' + k.ring + '" aria-hidden="true"><b>' + esc(monoOf(code)) + '</b></span>';
  }
  function demoBadge(on) { return on ? '<span class="demo-badge" title="Datos de demostración">Datos demo</span>' : ''; }
  function fitClass(s) { var n = String(s).length; return n > 13 ? 'fit-xs' : n > 10 ? 'fit-s' : n > 7 ? 'fit-m' : ''; }

  function half(code, score, side, showScore) {
    var k = kitOf(code);
    return '<span class="sc-half sc-' + side + '" style="--hbg:' + k.solid + ';--hfg:' + k.fg + ';--hstripe:' + esc(k.bg) + '">' +
      '<span class="sc-mono">' + esc(monoOf(code)) + '</span>' +
      '<span class="sc-nm">' + esc(nameOf(code)) + '</span>' +
      (showScore ? '<span class="sc-n">' + esc(score) + '</span>' : '') + '</span>';
  }
  function scoreCard(f, opts) {
    opts = opts || {};
    var comp = compOf(f.comp), r = resultOf(f), up = f.status !== 'ft';
    var label = nameOf(f.home) + ' ' + (up ? 'contra ' : num(f.hs) + ', ') + nameOf(f.away) + (up ? '' : ' ' + num(f.as)) + '. ' +
      (up ? 'Por jugarse' : 'Final') + '. ' + comp.name + ', ' + (f.round || '') + '. Ver ficha';
    return '<button class="sc ' + (opts.big ? 'sc-big' : '') + (up ? ' sc-up' : '') + '" data-act="match" data-fid="' + esc(f.id) + '" aria-label="' + esc(label) + '">' +
      '<span class="sc-top"><span class="sc-comp">' + esc(comp.short || comp.name) + (f.round ? ' · ' + esc(f.round) : '') + '</span>' +
      '<span class="sc-date">' + esc(f.label ? f.label + ' · ' : '') + esc(fmtDate(f.date)) + '</span></span>' +
      '<span class="sc-field">' + half(f.home, f.hs, 'h', !up) + half(f.away, f.as, 'a', !up) +
      (up ? '<span class="sc-vs d">VS</span>' : '') + '</span>' +
      (r ? '<span class="sc-res res-' + r + '">' + RES[r] + '</span>' : '') +
      '</button>';
  }

  /* ------------------------------------------------------------------
     Cabecera y barra de pestañas
     ------------------------------------------------------------------ */
  function renderMast() {
    mastEl.innerHTML =
      '<button class="club-pill" data-act="team-sheet" aria-haspopup="dialog" aria-label="Cambiar de club. Club actual: ' + esc(T.name) + '">' +
      monoBadge(T.code, 'mono-s') + '<span class="club-pill-name d">' + esc(T.short || T.name) + '</span>' + ic('chev', 'ic-s') + '</button>' +
      '<p class="edition"><span class="edition-k d">Portada</span><span>' + esc(fmtDate(todayIso(), true)) + '</span></p>';
  }
  var TABS = [['home', 'Inicio'], ['matches', 'Partidos'], ['season', 'Temporadas'], ['history', 'Historia'], ['more', 'Más']];
  function renderNav() {
    navEl.innerHTML = TABS.map(function (t) {
      var on = S.screen === t[0];
      return '<button class="tab' + (on ? ' on' : '') + '" data-act="tab" data-screen="' + t[0] + '"' + (on ? ' aria-current="page"' : '') + '>' +
        ic(t[0]) + '<span>' + t[1] + '</span></button>';
    }).join('');
  }

  /* ------------------------------------------------------------------
     INICIO
     ------------------------------------------------------------------ */
  function storyGroups() {
    var g = [], nx = nextFixture(), last = lastResult(), L = T.liveDemo, se = T.season || {};
    if (nx) {
      var opp = nx.home === T.code ? nx.away : nx.home;
      g.push({ id: 'next', label: 'Próximo', face: { code: opp }, slides: [{ type: 'next', f: nx }, { type: 'countdown', f: nx }] });
    }
    if (last) g.push({ id: 'last', label: 'Resultado', face: { text: num(last.hs) + '-' + num(last.as) }, slides: [{ type: 'result', f: last }].concat(arr(se.form).length ? [{ type: 'form' }] : []) });
    if (L) g.push({ id: 'live', label: 'En vivo', face: { text: 'LIVE', live: true }, slides: [{ type: 'live' }] });
    if (se.label) g.push({ id: 'season', label: 'Temporada', face: { text: se.leaguePos ? se.leaguePos + 'º' : se.label }, slides: [{ type: 'season' }] });
    if (arr(T.news).length) g.push({ id: 'news', label: 'Noticias', face: { text: '0' + Math.min(9, T.news.length) }, slides: T.news.slice(0, 4).map(function (n) { return { type: 'news', n: n }; }) });
    arr(T.history).slice(0, 6).forEach(function (h) {
      g.push({ id: 'h-' + h.id, label: String(h.kicker || h.title || '').split('·')[0].trim().toLowerCase(), face: { text: h.badge || '★', cw: h.colorway }, slides: [{ type: 'history', h: h }] });
    });
    return g;
  }
  function ringFace(face) {
    if (face.code) {
      var k = kitOf(face.code);
      return '<span class="ring-face" style="background:' + esc(k.bg) + ';color:' + k.fg + '"><b class="d">' + esc(monoOf(face.code)) + '</b></span>';
    }
    return '<span class="ring-face cw-' + (face.cw || (face.live ? 'live' : 'primary')) + '"><b class="d' + (String(face.text).length > 3 ? ' sm' : '') + '">' + esc(face.text) + '</b></span>';
  }
  function storiesRow() {
    var gs = storyGroups(), seen = S.seen[T.id] || {};
    return '<section class="stories" aria-label="Stories del club"><ul class="stories-list">' + gs.map(function (g, i) {
      return '<li><button class="ring' + (seen[g.id] ? ' seen' : '') + (g.face.live ? ' is-live' : '') + '" data-act="story" data-g="' + i + '" aria-label="Story: ' + esc(g.label) + (seen[g.id] ? ' (vista)' : '') + '">' +
        ringFace(g.face) + '<span class="ring-label">' + esc(g.label) + '</span></button></li>';
    }).join('') + '</ul></section>';
  }
  function coverBlock() {
    var f = nextFixture();
    if (!f) {
      return '<section class="cover"><div class="cover-bg" aria-hidden="true"><span class="cover-mono d">' + esc(T.monogram) + '</span></div>' +
        '<div class="cover-in"><p class="kicker"><span class="tag tag-hi">Temporada en pausa</span></p><h1 class="cover-h d">' + esc(T.motto || T.name) + '</h1></div></section>';
    }
    var comp = compOf(f.comp), dd = daysTo(f.date), home = f.home === T.code;
    var hn = nameOf(f.home), an = nameOf(f.away);
    var stadium = f.stadium || (home && T.stadium && T.stadium.name) || (f.venue === 'A' ? 'Fuera de casa' : '');
    return '<section class="cover" aria-labelledby="coverH">' +
      '<div class="cover-bg" aria-hidden="true"><span class="cover-stripes"></span><span class="cover-mono d">' + esc(T.monogram) + '</span></div>' +
      '<div class="cover-in">' +
      '<p class="kicker"><span class="tag tag-hi">Próximo partido</span><span>' + esc(comp.short || comp.name) + (f.round ? ' · ' + esc(f.round) : '') + '</span></p>' +
      '<h1 class="cover-h d" id="coverH"><span class="' + fitClass(hn) + '">' + esc(hn) + '</span><span class="cover-vs">vs</span><span class="' + fitClass(an) + '">' + esc(an) + '</span></h1>' +
      '<div class="cover-foot">' +
      '<div class="count"><b class="d">' + (dd === 0 ? 'HOY' : esc(Math.max(0, num(dd)))) + '</b><span>' + (dd === 0 ? '' : dd === 1 ? 'día' : 'días') + '</span></div>' +
      '<p class="cover-meta"><strong>' + esc(fmtDate(f.date)) + (f.time ? ' · ' + esc(f.time) : '') + '</strong><span>' + esc(stadium) + '</span></p>' +
      '</div>' +
      '<button class="pill pill-hi" data-act="match" data-fid="' + esc(f.id) + '">Ver previa ' + ic('arrow', 'ic-s') + '</button>' +
      '</div></section>';
  }

  /* ---------- Partido EN VIVO (demo) ---------- */
  var LIVE = null, liveTimer = null, LIVE_MS = 1600;
  function liveReset() {
    var L = T && T.liveDemo;
    if (!L) { LIVE = null; return; }
    var st = arr(L.startScore);
    LIVE = { minute: num(L.startMinute, 60), hs: num(st[0]), as: num(st[1]), events: arr(L.events).slice(), idx: 0, ended: false, endTicks: 0 };
  }
  function liveStart() {
    clearInterval(liveTimer);
    liveReset();
    if (LIVE) liveTimer = setInterval(liveTick, LIVE_MS);
  }
  function liveTick() {
    if (!LIVE || document.hidden) return;
    var L = T.liveDemo, script = arr(L.script), goal = null;
    if (LIVE.ended) {
      if (++LIVE.endTicks > 6) { liveReset(); updateLive(null); }
      return;
    }
    LIVE.minute++;
    while (LIVE.idx < script.length && minNum(script[LIVE.idx].min) <= LIVE.minute) {
      var ev = script[LIVE.idx++];
      LIVE.events.push(ev);
      if (ev.type === 'goal') { if (ev.side === 'home') LIVE.hs++; else LIVE.as++; goal = ev; }
    }
    if (LIVE.minute >= 90 && LIVE.idx >= script.length) { LIVE.minute = 90; LIVE.ended = true; }
    updateLive(goal);
  }
  function liveFixture() {
    var L = T.liveDemo;
    return { id: '__live', comp: L.comp, round: L.label || 'Partido de demostración', home: L.home, away: L.away, status: 'live', hs: LIVE ? LIVE.hs : 0, as: LIVE ? LIVE.as : 0, date: todayIso() };
  }
  function liveDetail() {
    var L = T.liveDemo;
    return { lineups: L.lineups || null, events: LIVE ? LIVE.events : arr(L.events), stats: arr(L.stats), playerHeat: L.playerHeat || {}, live: true, note: 'Partido de demostración: avanza solo.' };
  }
  function evText(ev) { return ev.player ? ev.player : (ev.type === 'goal' ? 'Gol del rival' : (ev.detail || '')); }
  function liveCardInner() {
    var L = T.liveDemo;
    var last = LIVE && LIVE.events.length ? LIVE.events[LIVE.events.length - 1] : null;
    return '<div class="live-top"><span class="live-dot">' + (LIVE && LIVE.ended ? 'Final' : 'En vivo') + '</span><span class="live-lbl">' + esc(L.label || 'Partido de demostración') + '</span>' +
      '<span class="live-min d" aria-live="off">' + (LIVE ? (LIVE.ended ? 'FT' : LIVE.minute + '’') : '') + '</span></div>' +
      '<span class="sc-field live-field">' + half(L.home, LIVE ? LIVE.hs : 0, 'h', true) + half(L.away, LIVE ? LIVE.as : 0, 'a', true) + '</span>' +
      '<span class="live-last">' + (last ? '<b class="d">' + esc(last.min) + '’</b> ' + evIcon(last.type) + ' ' + esc(evText(last)) + (last.detail && last.player ? ' · <span class="mut">' + esc(last.detail) + '</span>' : '') : 'Arranca la demo') + '</span>';
  }
  function liveBlock() {
    if (!T.liveDemo || !LIVE) return '';
    return '<section class="sec"><h2 class="sec-h d">En directo</h2>' +
      '<button class="live-card" id="liveCard" data-act="live" aria-label="Partido en vivo de demostración. Abrir ficha en directo">' + liveCardInner() + '</button></section>';
  }
  function goalFlash(host, ev) {
    if (!host || reduced()) return;
    var el = document.createElement('span');
    el.className = 'goal-flash';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<b class="d">¡GOL!</b><small>' + esc(evText(ev)) + ' ' + esc(ev.min) + '’</small>';
    host.appendChild(el);
    setTimeout(function () { el.remove(); }, 2600);
  }
  function updateLive(goal) {
    var card = $('#liveCard');
    if (card) {
      card.innerHTML = liveCardInner();
      if (goal) { card.classList.remove('scored'); void card.offsetWidth; card.classList.add('scored'); goalFlash(card, goal); }
    }
    var mini = $('#liveMini');
    if (mini) mini.innerHTML = liveMiniInner();
    stack.forEach(function (L) { if (L.type === 'match' && L.data.fid === '__live') renderLayer(L, true); });
    if (goal && S.settings.goals) {
      var L0 = T.liveDemo;
      toast('⚽ ¡Gol! ' + evText(goal) + ' ' + goal.min + '’ · ' + monoOf(L0.home) + ' ' + LIVE.hs + '-' + LIVE.as + ' ' + monoOf(L0.away));
      var top = stack[stack.length - 1];
      if (top && top.type === 'match' && top.data.fid === '__live') goalFlash($('.mx-hero', top.el), goal);
    }
  }

  function lastBlock() {
    var f = lastResult();
    if (!f) return '';
    return '<section class="sec"><h2 class="sec-h d">Último resultado</h2>' + scoreCard(f, { big: true }) + '</section>';
  }
  function newsBlock() {
    var n = arr(T.news);
    if (!n.length) return '';
    return '<section class="sec"><h2 class="sec-h d">Lo último</h2><ol class="news">' + n.map(function (it, i) {
      return '<li class="news-it"><span class="news-n d" aria-hidden="true">' + String(i + 1).padStart(2, '0') + '</span><div>' +
        '<p class="news-k"><span>' + esc(it.tag || '') + '</span><span>' + esc(it.dateLabel || fmtDate(it.date)) + '</span></p>' +
        '<h3 class="news-t d">' + esc(it.title) + '</h3><p class="news-b">' + esc(it.body || '') + '</p></div></li>';
    }).join('') + '</ol>' + (T.newsNote ? '<p class="note">' + esc(T.newsNote) + '</p>' : '') + '</section>';
  }
  function mottoBand() {
    var m = esc(T.motto || T.name);
    var item = '<span>' + m + '</span><span class="star">' + ic('star', '', true) + '</span>';
    return '<section class="band" aria-label="Lema del club"><p class="sr">' + m + '</p><div class="band-track d" aria-hidden="true">' + item + item + item + item + '</div></section>';
  }
  function renderHome() {
    return storiesRow() + coverBlock() + '<div class="pad">' + liveBlock() + lastBlock() + newsBlock() + '</div>' + mottoBand();
  }

  /* ------------------------------------------------------------------
     PARTIDOS
     ------------------------------------------------------------------ */
  function liveMiniInner() {
    var L = T.liveDemo;
    return '<span class="live-dot">' + (LIVE && LIVE.ended ? 'Final' : 'En vivo') + '</span>' +
      '<span class="lm-t d">' + esc(monoOf(L.home)) + ' <b>' + (LIVE ? LIVE.hs : 0) + '</b>–<b>' + (LIVE ? LIVE.as : 0) + '</b> ' + esc(monoOf(L.away)) + '</span>' +
      '<span class="lm-m d">' + (LIVE ? (LIVE.ended ? 'FT' : LIVE.minute + '’') : '') + '</span>' + ic('arrow', 'ic-s');
  }
  function upRow(f) {
    var d = pd(f.date), comp = compOf(f.comp), home = f.home === T.code, opp = home ? f.away : f.home;
    return '<li><button class="up" data-act="match" data-fid="' + esc(f.id) + '" aria-label="' + esc(nameOf(f.home) + ' contra ' + nameOf(f.away) + ', ' + fmtLong(f.date) + (f.time ? ' a las ' + f.time : '') + '. ' + comp.name) + '">' +
      '<span class="up-date"><b class="d">' + d.getUTCDate() + '</b><span>' + MON[d.getUTCMonth()] + '</span><span>' + DOW[d.getUTCDay()] + '</span></span>' +
      '<span class="up-main"><span class="up-comp">' + esc(comp.short || comp.name) + (f.round ? ' · ' + esc(f.round) : '') + '</span>' +
      '<span class="up-t d">' + (home ? 'vs ' : 'en ') + esc(nameOf(opp)) + '</span>' +
      '<span class="up-meta">' + (f.time ? esc(f.time) + ' · ' : '') + (home ? 'Local' : f.venue === 'N' ? 'Neutral' : 'Visitante') + '</span></span>' +
      monoBadge(opp, 'mono-m') + '</button></li>';
  }
  function renderMatches() {
    var all = seasons(), cur = seasonByLabel(S.seasonSel || all[0].label);
    var comps = [];
    cur.fixtures.forEach(function (f) { if (comps.indexOf(f.comp) < 0) comps.push(f.comp); });
    if (S.compFilter !== 'all' && comps.indexOf(S.compFilter) < 0) S.compFilter = 'all';
    var list = cur.fixtures.filter(function (f) { return S.compFilter === 'all' || f.comp === S.compFilter; });
    var ups = list.filter(function (f) { return f.status !== 'ft'; });
    var fts = list.filter(function (f) { return f.status === 'ft'; }).slice().reverse();
    var h = '<header class="page-h"><p class="kicker"><span>Calendario y resultados</span>' + demoBadge(cur.current && T.season && T.season.isDemo) + '</p><h1 class="page-t d">Partidos</h1></header>';
    if (all.length > 1) {
      h += '<div class="chips seg" role="group" aria-label="Temporada">' + all.map(function (s) {
        var on = s.label === cur.label;
        return '<button class="chip' + (on ? ' on' : '') + '" data-act="msea" data-v="' + esc(s.label) + '" aria-pressed="' + on + '">' + esc(s.label) + '</button>';
      }).join('') + '</div>';
    }
    h += '<div class="chips" role="group" aria-label="Competición"><button class="chip' + (S.compFilter === 'all' ? ' on' : '') + '" data-act="comp" data-v="all" aria-pressed="' + (S.compFilter === 'all') + '">Todas</button>' +
      comps.map(function (c) {
        var on = S.compFilter === c, co = compOf(c);
        return '<button class="chip' + (on ? ' on' : '') + '" data-act="comp" data-v="' + esc(c) + '" aria-pressed="' + on + '">' + esc(co.short || co.name) + '</button>';
      }).join('') + '</div><div class="pad">';
    if (cur.current && T.liveDemo && LIVE && S.compFilter === 'all') {
      h += '<button class="live-mini" id="liveMini" data-act="live" aria-label="Partido en vivo de demostración">' + liveMiniInner() + '</button>';
    }
    if (ups.length) h += '<section class="sec"><h2 class="sec-h d">Próximos</h2><ul class="ups">' + ups.map(upRow).join('') + '</ul></section>';
    if (fts.length) h += '<section class="sec"><h2 class="sec-h d">Resultados</h2><div class="cards">' + fts.map(function (f) { return scoreCard(f); }).join('') + '</div></section>';
    if (!ups.length && !fts.length) h += '<div class="empty"><p class="d">Sin partidos</p><p>No hay partidos de esta competición en ' + esc(cur.label) + '.</p></div>';
    if (!cur.current) h += '<p class="note">Archivo: selección de partidos destacados de la temporada ' + esc(cur.label) + '.</p>';
    return h + '</div>';
  }

  /* ------------------------------------------------------------------
     FICHA DE PARTIDO
     ------------------------------------------------------------------ */
  function matchCtx(fid) {
    if (fid === '__live' && T.liveDemo) return { f: liveFixture(), d: liveDetail() };
    var f = fx(fid);
    return f ? { f: f, d: detailOf(fid) } : null;
  }
  function mxHero(f) {
    var comp = compOf(f.comp), up = f.status === 'up', live = f.status === 'live';
    var status = live ? (LIVE && LIVE.ended ? 'Final · demo' : 'En vivo · ' + (LIVE ? LIVE.minute : '') + '’') : up ? 'Por jugarse' : 'Final';
    var hk = kitOf(f.home), ak = kitOf(f.away);
    return '<div class="mx-hero' + (up ? ' is-up' : '') + '">' +
      '<div class="mx-split">' +
      '<div class="mx-side mx-h" style="--hbg:' + hk.solid + ';--hfg:' + hk.fg + ';--hstripe:' + esc(hk.bg) + '"><span class="mx-mono d">' + esc(monoOf(f.home)) + '</span><span class="mx-nm d">' + esc(nameOf(f.home)) + '</span>' + (up ? '' : '<span class="mx-n d">' + num(f.hs) + '</span>') + '</div>' +
      '<div class="mx-side mx-a" style="--hbg:' + ak.solid + ';--hfg:' + ak.fg + ';--hstripe:' + esc(ak.bg) + '"><span class="mx-mono d">' + esc(monoOf(f.away)) + '</span><span class="mx-nm d">' + esc(nameOf(f.away)) + '</span>' + (up ? '' : '<span class="mx-n d">' + num(f.as) + '</span>') + '</div>' +
      (up ? '<span class="mx-vs d" aria-hidden="true">VS</span>' : '') +
      '</div>' +
      '<p class="mx-status"><span class="mx-st' + (live ? ' live-dot' : '') + '">' + esc(status) + '</span><span>' + esc(comp.short || comp.name) + (f.round ? ' · ' + esc(f.round) : '') + '</span>' +
      (f.date && !live ? '<span>' + esc(fmtDate(f.date, true)) + (f.time ? ' · ' + esc(f.time) : '') + '</span>' : '') + '</p>' +
      '<p class="sr" aria-live="polite">' + esc(nameOf(f.home)) + (up ? ' contra ' : ' ' + num(f.hs) + ', ') + esc(nameOf(f.away)) + (up ? '' : ' ' + num(f.as)) + '. ' + esc(status) + '</p>' +
      '</div>';
  }
  function upcomingBody(f) {
    var dd = daysTo(f.date), comp = compOf(f.comp), home = f.home === T.code, opp = home ? f.away : f.home;
    var stadium = f.stadium || (home && T.stadium && T.stadium.name) || '';
    var prev = arr(T.fixtures).concat(arr(T.archive)).filter(function (x) { return x.status === 'ft' && (x.home === opp || x.away === opp); }).pop();
    var h = '<div class="pending"><p class="kicker"><span class="tag tag-pri">Por jugarse</span></p>' +
      '<p class="pending-n d">' + (dd === 0 ? 'Hoy' : dd > 0 ? 'Faltan ' + dd + (dd === 1 ? ' día' : ' días') : fmtDate(f.date)) + '</p>' +
      '<dl class="facts">' +
      '<div><dt>Fecha</dt><dd>' + esc(fmtLong(f.date)) + '</dd></div>' +
      '<div><dt>Hora</dt><dd>' + esc(f.time || 'Por confirmar') + '</dd></div>' +
      '<div><dt>Competición</dt><dd>' + esc(comp.name) + '</dd></div>' +
      (stadium ? '<div><dt>Estadio</dt><dd>' + esc(stadium) + '</dd></div>' : '<div><dt>Condición</dt><dd>' + (f.venue === 'N' ? 'Campo neutral' : 'Visitante') + '</dd></div>') +
      '</dl><p class="pending-copy">Las alineaciones, los ratings y las estadísticas aparecerán cuando ruede el balón.</p></div>';
    if (prev) h += '<section class="sec"><h2 class="sec-h d">Último cara a cara</h2>' + scoreCard(prev) + '</section>';
    return h;
  }
  function mxTabs(tab) {
    var tabs = [['ratings', 'Ratings'], ['stats', 'Estadísticas'], ['summary', 'Resumen']];
    return '<div class="mx-tabs" role="tablist" aria-label="Secciones del partido">' + tabs.map(function (t) {
      var on = tab === t[0];
      return '<button class="mx-tab' + (on ? ' on' : '') + '" role="tab" id="mxt-' + t[0] + '" aria-selected="' + on + '" aria-controls="mxp" tabindex="' + (on ? 0 : -1) + '" data-act="mtab" data-v="' + t[0] + '">' + t[1] + '</button>';
    }).join('') + '</div>';
  }
  function ratingCls(r) { return r == null ? 'rt-na' : r >= 8 ? 'rt-8' : r >= 7 ? 'rt-7' : r >= 6 ? 'rt-6' : 'rt-5'; }
  function mvpOf(d) {
    var best = null;
    ['home', 'away'].forEach(function (side) {
      var lu = d.lineups && d.lineups[side];
      if (!lu) return;
      arr(lu.players).concat(arr(lu.bench)).forEach(function (p) { if (p.rating != null && (!best || p.rating > best.rating)) best = p; });
    });
    return best;
  }
  function plChip(p, side, i, code, mvp, maxRow) {
    var k = kitOf(code), row = num(p.row), x = p.x == null ? 0.5 : p.x;
    var rr = maxRow ? row / maxRow : 0;
    var top = side === 'home' ? 95 - rr * 41 : 4.5 + rr * 41;
    var left = 9 + (side === 'home' ? x : 1 - x) * 82;
    var marks = '';
    for (var g = 0; g < num(p.goals); g++) marks += BALL;
    if (num(p.assists)) marks += '<span class="as-mk" title="Asistencia">A' + (p.assists > 1 ? p.assists : '') + '</span>';
    if (num(p.yellow)) marks += '<span class="card-mk y"></span>';
    if (num(p.red)) marks += '<span class="card-mk r"></span>';
    return '<button class="pl" style="left:' + left.toFixed(1) + '%;top:' + top.toFixed(1) + '%" data-act="player" data-side="' + side + '" data-list="players" data-i="' + i + '" aria-label="' + esc(p.name + ', ' + (POS[p.pos] || '') + ', rating ' + (p.rating == null ? 'sin nota' : p.rating) + (p === mvp ? ', MVP' : '')) + '">' +
      '<span class="pl-shirt' + (k.striped ? ' striped' : '') + '" style="--sbg:' + esc(k.bg) + ';--ssolid:' + k.solid + ';--sfg:' + k.fg + ';--sring:' + k.ring + '"><b>' + esc(p.num != null ? p.num :  String(p.name || '?').charAt(0)) + '</b></span>' +
      (p.rating != null ? '<span class="pl-rt ' + ratingCls(p.rating) + '">' + Number(p.rating).toFixed(1) + '</span>' : '') +
      (p === mvp ? '<span class="pl-mvp" aria-hidden="true">' + ic('star', '', true) + '</span>' : '') +
      (marks ? '<span class="pl-marks" aria-hidden="true">' + marks + '</span>' : '') +
      (p.subOut ? '<span class="pl-sub" aria-hidden="true">↓' + esc(p.subOut) + '’</span>' : '') +
      '<span class="pl-name">' + esc(shortName(p.name)) + '</span></button>';
  }
  function ratingsTab(f, d) {
    if (!d.lineups || !d.lineups.home || !d.lineups.away) {
      return '<div class="empty"><p class="d">Sin alineaciones</p><p>Este partido no tiene alineaciones ni ratings disponibles.</p></div>';
    }
    var mvp = mvpOf(d), h = '';
    var maxR = function (lu) { return arr(lu.players).reduce(function (m, p) { return Math.max(m, num(p.row)); }, 1); };
    var hl = d.lineups.home, al = d.lineups.away;
    h += '<div class="pitch-wrap">' +
      '<p class="pitch-lbl top"><b class="d">' + esc(nameOf(f.away)) + '</b><span>' + esc(al.formation || '') + (al.coach ? ' · ' + esc(al.coach) : '') + '</span></p>' +
      '<div class="pitch" role="group" aria-label="Alineaciones en el campo">' +
      '<div class="pitch-lines" aria-hidden="true"><i class="pl-half"></i><i class="pl-circle"></i><i class="pl-box t"></i><i class="pl-box b"></i><i class="pl-six t"></i><i class="pl-six b"></i></div>' +
      arr(al.players).map(function (p, i) { return plChip(p, 'away', i, f.away, mvp, maxR(al)); }).join('') +
      arr(hl.players).map(function (p, i) { return plChip(p, 'home', i, f.home, mvp, maxR(hl)); }).join('') +
      '</div>' +
      '<p class="pitch-lbl bot"><b class="d">' + esc(nameOf(f.home)) + '</b><span>' + esc(hl.formation || '') + (hl.coach ? ' · ' + esc(hl.coach) : '') + '</span></p></div>';
    if (mvp) h += '<p class="mvp-line">' + ic('star', '', true) + ' <span>MVP del partido:</span> <b>' + esc(mvp.name) + '</b> <span class="pl-rt ' + ratingCls(mvp.rating) + '">' + Number(mvp.rating).toFixed(1) + '</span></p>';
    var bench = function (lu, side, code) {
      var b = arr(lu.bench);
      if (!b.length) return '<p class="mut">Sin datos de banquillo</p>';
      return '<ul class="bench">' + b.map(function (p, i) {
        var played = p.rating != null || num(p.minutes) > 0;
        var inner = '<span class="bench-n">' + esc(p.num != null ? p.num : '–') + '</span><span class="bench-nm">' + esc(p.name) + (p.subIn ? ' <small>↑' + esc(p.subIn) + '’</small>' : '') + '</span>' +
          (p.rating != null ? '<span class="pl-rt ' + ratingCls(p.rating) + '">' + Number(p.rating).toFixed(1) + '</span>' : '');
        return '<li>' + (played ? '<button class="bench-it" data-act="player" data-side="' + side + '" data-list="bench" data-i="' + i + '" aria-label="' + esc(p.name + ', suplente') + '">' + inner + '</button>' : '<span class="bench-it off">' + inner + '</span>') + '</li>';
      }).join('') + '</ul>';
    };
    h += '<section class="sec"><h2 class="sec-h d">Banquillo</h2><div class="bench-cols"><div><h3 class="bench-h">' + esc(nameOf(f.home)) + '</h3>' + bench(hl, 'home', f.home) +
      '</div><div><h3 class="bench-h">' + esc(nameOf(f.away)) + '</h3>' + bench(al, 'away', f.away) + '</div></div></section>';
    return h;
  }
  function statsTab(f, d) {
    var st = arr(d.stats);
    if (!st.length) return '<div class="empty"><p class="d">Sin estadísticas</p><p>No hay estadísticas para este partido.</p></div>';
    var hc = colorOf(f.home), ac = colorOf(f.away);
    if (contrast(hc, ac) < 1.5) {
      var at = teamByCode(f.away), alt = [at && at.colors && at.colors.accent, kitOf(f.away).ring, S.settings.dark ? '#8a8a93' : '#3a3a40'];
      ac = alt.filter(function (c) { return hexOf(c) && contrast(hc, c) >= 1.5; })[0] || '#8a8a93';
    }
    return '<div class="stats" style="--hc:' + hc + ';--ac:' + ac + '"><p class="stats-legend"><span><i class="sw h"></i>' + esc(nameOf(f.home)) + '</span><span>' + esc(nameOf(f.away)) + '<i class="sw a"></i></span></p>' +
      st.map(function (s) {
        var hv = num(s[1]), av = num(s[2]), tot = hv + av || 1, pct = String(s[0]).toLowerCase().indexOf('pose') === 0;
        var hp = Math.round(hv / tot * 100);
        return '<div class="stat"><p class="stat-row"><b class="d' + (hv >= av ? ' lead' : '') + '">' + hv + (pct ? '%' : '') + '</b><span>' + esc(s[0]) + '</span><b class="d' + (av >= hv ? ' lead' : '') + '">' + av + (pct ? '%' : '') + '</b></p>' +
          '<div class="stat-bar" role="img" aria-label="' + esc(s[0] + ': ' + nameOf(f.home) + ' ' + hv + ', ' + nameOf(f.away) + ' ' + av) + '"><i class="h" style="width:' + hp + '%"></i><i class="a" style="width:' + (100 - hp) + '%"></i></div></div>';
      }).join('') + '</div>';
  }
  function evIcon(type) {
    switch (type) {
      case 'goal': return BALL;
      case 'yellow': return '<span class="card-mk y" aria-hidden="true"></span>';
      case 'red': return '<span class="card-mk r" aria-hidden="true"></span>';
      case 'sub': return '<span class="ev-sub" aria-hidden="true">⇅</span>';
      case 'var': return '<span class="ev-var" aria-hidden="true">VAR</span>';
      case 'pen_save': return '<span class="ev-var" aria-hidden="true">PEN</span>';
      default: return '<span class="ev-dot" aria-hidden="true"></span>';
    }
  }
  var EVN = { goal: 'Gol', yellow: 'Amarilla', red: 'Roja', sub: 'Cambio', var: 'VAR', pen_save: 'Penalti parado' };
  function summaryTab(f, d) {
    var evs = arr(d.events).slice().sort(function (a, b) { return minNum(a.min) - minNum(b.min); });
    if (!evs.length) return '<div class="empty"><p class="d">Sin eventos</p><p>No hay eventos registrados para este partido.</p></div>';
    var hs = 0, as = 0, ht = false, out = '<ol class="tl">';
    if (f.status === 'live') out += '<li class="tl-mark live">' + (LIVE && LIVE.ended ? 'Final del partido' : 'En juego · ' + (LIVE ? LIVE.minute : '') + '’') + '</li>';
    out += '<li class="tl-mark">Pitido inicial</li>';
    evs.forEach(function (e) {
      if (!ht && minNum(e.min) > 45.5 && String(e.min).indexOf('45+') !== 0) { ht = true; out += '<li class="tl-mark">Descanso · ' + hs + '-' + as + '</li>'; }
      var score = '';
      if (e.type === 'goal') { if (e.side === 'home') hs++; else as++; score = '<span class="tl-score d">' + hs + '-' + as + '</span>'; }
      out += '<li class="tl-ev ' + (e.side === 'away' ? 'away' : 'home') + (e.type === 'goal' ? ' is-goal' : '') + '">' +
        '<span class="tl-min d">' + esc(e.min) + '’</span>' +
        '<span class="tl-body">' + evIcon(e.type) + '<span><b>' + esc(evText(e)) + '</b>' + score +
        '<small>' + esc(EVN[e.type] || '') + (e.type === 'sub' && e.playerOut ? ' · sale ' + esc(e.playerOut) : e.detail && e.detail !== evText(e) ? ' · ' + esc(e.detail) : '') + '</small></span></span></li>';
    });
    if (f.status === 'ft') out += '<li class="tl-mark end">Final · ' + num(f.hs) + '-' + num(f.as) + '</li>';
    return out + '</ol>';
  }
  function matchPage(data) {
    var ctx = matchCtx(data.fid);
    var head = '<div class="pg-bar"><button class="icon-btn" data-act="back" aria-label="Volver">' + ic('back') + '</button><p class="pg-bar-t d">Ficha del partido</p></div>';
    if (!ctx) return head + '<div class="empty"><p class="d">Partido no encontrado</p></div>';
    var f = ctx.f, d = ctx.d, h = head + mxHero(f);
    if (f.status === 'up') return h + '<div class="pad">' + upcomingBody(f) + '</div>';
    if (!d) {
      var feat = T.featuredMatch && T.featuredMatch.fixtureId;
      return h + '<div class="pad"><div class="empty"><p class="d">Sin ficha ampliada</p><p>Para este partido solo tenemos el resultado. Los ratings y el campo están disponibles en el partido destacado.</p>' +
        (feat && feat !== f.id ? '<button class="pill pill-pri" data-act="match-swap" data-fid="' + esc(feat) + '">Ver partido destacado ' + ic('arrow', 'ic-s') + '</button>' : '') + '</div></div>';
    }
    var tab = data.tab || 'ratings';
    var body = tab === 'stats' ? statsTab(f, d) : tab === 'summary' ? summaryTab(f, d) : ratingsTab(f, d);
    return h + mxTabs(tab) + '<div class="pad mx-panel" id="mxp" role="tabpanel" aria-labelledby="mxt-' + tab + '">' +
      ((d.ratingsDemo || d.live || d.note) ? '<p class="note note-top">' + demoBadge(true) + ' ' + esc(d.note || 'Ratings y mapas de calor de demostración.') + '</p>' : '') + body + '</div>';
  }

  /* ---------- Hoja de jugador + mapa de calor ---------- */
  function genHeat(p) {
    var s = hash(p.name) % 233280 || 7;
    function r() { s = (s * 9301 + 49297) % 233280; return s / 233280; }
    var cx = { GK: 0.08, DEF: 0.3, MID: 0.52, FWD: 0.76 }[p.pos] || 0.5;
    var cy = p.x == null ? 0.5 : p.x, sx = p.pos === 'GK' ? 0.05 : 0.17, sy = p.pos === 'GK' ? 0.12 : 0.2, out = [];
    for (var i = 0; i < 26; i++) {
      out.push([Math.max(0.02, Math.min(0.98, cx + (r() + r() + r() - 1.5) * sx)), Math.max(0.03, Math.min(0.97, cy + (r() + r() + r() - 1.5) * sy)), 0.35 + r() * 0.65]);
    }
    return out;
  }
  function heatSvg(pts) {
    var W = 300, H = 192, blobs = '', cores = '';
    pts.forEach(function (q) {
      var x = 6 + num(q[0]) * (W - 12), y = 6 + num(q[1]) * (H - 12), i = num(q[2], 0.5);
      blobs += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="20" fill="#ffc400" fill-opacity="' + (0.18 + i * 0.3).toFixed(2) + '"/>';
      if (i > 0.62) cores += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="10" fill="#ff3d1a" fill-opacity="' + (i * 0.55).toFixed(2) + '"/>';
    });
    var line = 'fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.5"';
    return '<svg class="heat" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Mapa de calor: zonas del campo por las que se movió el jugador. Ataca hacia la derecha.">' +
      '<defs><filter id="hblur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter><clipPath id="hclip"><rect x="6" y="6" width="' + (W - 12) + '" height="' + (H - 12) + '" rx="6"/></clipPath></defs>' +
      '<rect x="0" y="0" width="' + W + '" height="' + H + '" rx="10" fill="#14231b"/>' +
      '<g clip-path="url(#hclip)"><g filter="url(#hblur)">' + blobs + cores + '</g></g>' +
      '<rect x="6" y="6" width="' + (W - 12) + '" height="' + (H - 12) + '" rx="4" ' + line + '/>' +
      '<line x1="' + W / 2 + '" y1="6" x2="' + W / 2 + '" y2="' + (H - 6) + '" ' + line + '/><circle cx="' + W / 2 + '" cy="' + H / 2 + '" r="24" ' + line + '/>' +
      '<rect x="6" y="' + (H / 2 - 44) + '" width="44" height="88" ' + line + '/><rect x="' + (W - 50) + '" y="' + (H / 2 - 44) + '" width="44" height="88" ' + line + '/>' +
      '<path d="M' + (W - 70) + ' 18h46m-8-5 8 5-8 5" stroke="rgba(255,255,255,.7)" stroke-width="1.6" fill="none"/></svg>';
  }
  function playerSheet(data) {
    var ctx = matchCtx(data.fid);
    var lu = ctx && ctx.d && ctx.d.lineups && ctx.d.lineups[data.side];
    var p = lu && arr(lu[data.list])[data.i];
    if (!p) return '<div class="sheet" role="dialog" aria-modal="true" aria-label="Jugador"><p>Jugador no disponible</p></div>';
    var code = data.side === 'home' ? ctx.f.home : ctx.f.away, k = kitOf(code), mvp = mvpOf(ctx.d) === p;
    var heat = (ctx.d.playerHeat || {})[p.name];
    var pts = arr(heat).length ? heat : genHeat(p);
    var stat = function (v, l) { return '<div><b class="d">' + esc(v) + '</b><span>' + l + '</span></div>'; };
    return '<div class="scrim" data-act="close-sheet"></div><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="plName">' +
      '<span class="grab" aria-hidden="true"></span><button class="icon-btn sheet-x" data-act="close-sheet" aria-label="Cerrar">' + ic('close') + '</button>' +
      '<div class="ps-head" style="--sbg:' + esc(k.bg) + ';--sfg:' + k.fg + '">' +
      '<span class="ps-shirt d">' + esc(p.num != null ? p.num : String(p.name).charAt(0)) + '</span>' +
      '<div class="ps-id"><p class="kicker"><span>' + esc(POS[p.pos] || p.pos || '') + ' · ' + esc(nameOf(code)) + '</span>' + (mvp ? '<span class="tag tag-hi">' + ic('star', 'ic-s', true) + ' MVP</span>' : '') + '</p>' +
      '<h2 class="ps-name d" id="plName">' + esc(p.name) + '</h2></div>' +
      '<div class="ps-rating ' + ratingCls(p.rating) + '"><b class="d">' + (p.rating != null ? Number(p.rating).toFixed(1) : '–') + '</b><span>Rating</span></div></div>' +
      '<div class="ps-stats">' + stat(num(p.minutes) + '’', 'Minutos') + stat(num(p.goals), 'Goles') + stat(num(p.assists), 'Asist.') + stat(num(p.yellow) + num(p.red), 'Tarjetas') + '</div>' +
      ((p.subOut || p.subIn) ? '<p class="mut ps-sub">' + (p.subIn ? 'Entró en el minuto ' + esc(p.subIn) : 'Sustituido en el minuto ' + esc(p.subOut)) + '</p>' : '') +
      '<h3 class="sec-h d">Mapa de calor</h3>' + heatSvg(pts) +
      '<p class="note">' + demoBadge(true) + (arr(heat).length ? ' Mapa de calor de demostración.' : ' Mapa de calor generado a partir de su posición (demo).') + '</p></div>';
  }

  /* ------------------------------------------------------------------
     TEMPORADAS
     ------------------------------------------------------------------ */
  function formRow(form, big) {
    return '<ol class="form' + (big ? ' form-big' : '') + '" aria-label="Racha: ' + esc(form.map(function (r) { return RES[r] || r; }).join(', ')) + '">' +
      form.map(function (r) { return '<li class="res-' + esc(r) + ' d" aria-hidden="true">' + (RES1[r] || esc(r)) + '</li>'; }).join('') + '</ol>';
  }
  function renderSeason() {
    var all = seasons(), cur = seasonByLabel(S.seasonView || all[0].label), se = T.season || {};
    var sum = cur.current ? { played: num(se.played), w: num(se.w), d: num(se.d), l: num(se.l), gf: num(se.gf), ga: num(se.ga) } : summarize(cur.fixtures);
    var tot = (sum.w + sum.d + sum.l) || 1;
    var h = '<section class="s-cover">' +
      '<div class="s-cover-bg" aria-hidden="true"><span class="d">' + (cur.current && se.leaguePos ? esc(se.leaguePos) : esc(T.monogram)) + '</span></div>' +
      '<p class="kicker"><span class="tag tag-hi">Temporada</span>' + demoBadge(cur.current && se.isDemo) + '</p>' +
      '<h1 class="s-title d">' + esc(cur.label) + '</h1>' +
      (cur.current ? '<p class="s-sub"><b class="d">' + (se.leaguePos ? esc(se.leaguePos) + 'º' : '–') + '</b><span>en ' + esc((compOf(T.leagueComp).name) || T.league || 'liga') + '<br><strong>' + num(se.points) + ' puntos</strong> · ' + esc(se.leaderNote || '') + '</span></p>'
        : '<p class="s-sub"><span>Selección de partidos del archivo</span></p>') +
      '</section>';
    if (all.length > 1) {
      h += '<div class="chips" role="group" aria-label="Temporada">' + all.map(function (s) {
        var on = s.label === cur.label;
        return '<button class="chip' + (on ? ' on' : '') + '" data-act="ssea" data-v="' + esc(s.label) + '" aria-pressed="' + on + '">' + esc(s.label) + '</button>';
      }).join('') + '</div>';
    }
    h += '<div class="wdl" role="group" aria-label="Balance' + (cur.current ? ' en liga' : '') + '">' +
      '<div class="wdl-b w"><b class="d">' + sum.w + '</b><span>Victorias</span></div>' +
      '<div class="wdl-b d0"><b class="d">' + sum.d + '</b><span>Empates</span></div>' +
      '<div class="wdl-b l"><b class="d">' + sum.l + '</b><span>Derrotas</span></div></div>' +
      '<div class="wdl-bar" aria-hidden="true"><i class="w" style="flex:' + sum.w / tot + '"></i><i class="d0" style="flex:' + sum.d / tot + '"></i><i class="l" style="flex:' + sum.l / tot + '"></i></div>';
    var tabs = [['resumen', 'Resumen'], ['resultados', 'Resultados'], ['plantilla', 'Plantilla']];
    h += '<div class="mx-tabs s-tabs" role="tablist" aria-label="Secciones de la temporada">' + tabs.map(function (t) {
      var on = S.seasonTab === t[0];
      return '<button class="mx-tab' + (on ? ' on' : '') + '" role="tab" id="st-' + t[0] + '" aria-selected="' + on + '" aria-controls="stp" tabindex="' + (on ? 0 : -1) + '" data-act="stab" data-v="' + t[0] + '">' + t[1] + '</button>';
    }).join('') + '</div><div class="pad" id="stp" role="tabpanel" aria-labelledby="st-' + S.seasonTab + '">';

    if (S.seasonTab === 'resultados') {
      var fts = cur.fixtures.filter(function (f) { return f.status === 'ft'; }).slice().reverse();
      h += fts.length ? '<div class="cards">' + fts.map(function (f) { return scoreCard(f); }).join('') + '</div>' : '<div class="empty"><p class="d">Aún sin resultados</p></div>';
    } else if (S.seasonTab === 'plantilla') {
      var sq = arr(T.squad);
      if (!sq.length) h += '<div class="empty"><p class="d">Sin plantilla</p></div>';
      ['POR', 'DEF', 'MED', 'DEL'].forEach(function (pos) {
        var ps = sq.filter(function (p) { return p.pos === pos; });
        if (!ps.length) return;
        h += '<section class="sec"><h2 class="sec-h d">' + POS[pos] + ' <small>' + ps.length + '</small></h2><ul class="squad">' + ps.map(function (p) {
          return '<li><span class="sq-n d">' + esc(p.num != null ? p.num : '–') + '</span><span class="sq-nm">' + esc(p.name) + '</span><span class="sq-nat">' + esc(p.nat || '') + '</span></li>';
        }).join('') + '</ul></section>';
      });
      var other = sq.filter(function (p) { return ['POR', 'DEF', 'MED', 'DEL'].indexOf(p.pos) < 0; });
      if (other.length) h += '<ul class="squad">' + other.map(function (p) { return '<li><span class="sq-n d">' + esc(p.num || '–') + '</span><span class="sq-nm">' + esc(p.name) + '</span></li>'; }).join('') + '</ul>';
      if (T.squadNote) h += '<p class="note">' + esc(T.squadNote) + '</p>';
    } else {
      var diff = sum.gf - sum.ga;
      h += '<section class="sec"><h2 class="sec-h d">Goles' + (cur.current ? ' en liga' : '') + '</h2><div class="goals">' +
        '<div><b class="d">' + sum.gf + '</b><span>A favor</span></div><div><b class="d">' + sum.ga + '</b><span>En contra</span></div>' +
        '<div class="gd"><b class="d">' + (diff > 0 ? '+' : '') + diff + '</b><span>Diferencia</span></div></div></section>';
      if (cur.current && arr(se.form).length) h += '<section class="sec"><h2 class="sec-h d">Racha</h2>' + formRow(arr(se.form), true) + '<p class="mut small">Últimos ' + se.form.length + ' partidos, todas las competiciones. El más reciente, a la derecha.</p></section>';
      if (cur.current && se.allComps) {
        var a = se.allComps;
        h += '<section class="sec"><h2 class="sec-h d">Todas las competiciones</h2><dl class="facts facts-4">' +
          '<div><dt>Jugados</dt><dd class="d">' + num(a.played) + '</dd></div><div><dt>V-E-D</dt><dd class="d">' + num(a.w) + '-' + num(a.d) + '-' + num(a.l) + '</dd></div>' +
          '<div><dt>Goles</dt><dd class="d">' + num(a.gf) + ':' + num(a.ga) + '</dd></div><div><dt>% Vict.</dt><dd class="d">' + Math.round(num(a.w) / (num(a.played) || 1) * 100) + '%</dd></div></dl></section>';
      }
      if (cur.current && arr(se.competitions).length) {
        h += '<section class="sec"><h2 class="sec-h d">Competiciones</h2><ul class="comps">' + se.competitions.map(function (c) {
          return '<li><span class="comp-ic" aria-hidden="true">' + esc(c.icon || '') + '</span><span class="comp-nm"><b>' + esc(c.name) + '</b><span>' + esc(c.status || '') + '</span></span>' +
            '<span class="comp-st ' + (c.state === 'run' ? 'run' : 'up') + '">' + (c.state === 'run' ? 'En juego' : 'Próximamente') + '</span></li>';
        }).join('') + '</ul></section>';
      }
      if (arr(T.honours).length) {
        h += '<section class="sec"><h2 class="sec-h d">Palmarés</h2><ul class="honours">' + T.honours.map(function (x) {
          return '<li><b class="d">' + num(x.count) + '</b><span>' + esc(x.label) + '</span></li>';
        }).join('') + '</ul>' + (T.honoursNote ? '<p class="note">' + esc(T.honoursNote) + '</p>' : '') + '</section>';
      }
      if (cur.current && se.source) h += '<p class="note">Fuente: ' + esc(se.source) + '</p>';
    }
    return h + '</div>';
  }

  /* ------------------------------------------------------------------
     HISTORIA (feed vertical a pantalla completa)
     ------------------------------------------------------------------ */
  function baseLikes(id) { return 1800 + hash(T.id + ':' + id) % 46000; }
  function catLabel(key) {
    var c = arr(T.historyCategories).filter(function (x) { return x[0] === key; })[0];
    return c ? c[1] : key;
  }
  function histList() {
    var saves = getSaves();
    return arr(T.history).filter(function (h) {
      if (S.histCat === 'all') return true;
      if (S.histCat === '__saved') return !!saves[h.id];
      return arr(h.cats).indexOf(S.histCat) >= 0 || h.cat === S.histCat;
    });
  }
  function railBtn(act, id, on, icon, label, count) {
    return '<button class="rail-b' + (on ? ' on' : '') + '" data-act="' + act + '" data-id="' + esc(id) + '" aria-pressed="' + on + '" aria-label="' + label + '">' +
      '<span class="rail-ic">' + ic(icon, '', on) + '</span><span class="rail-c">' + count + '</span></button>';
  }
  function histCard(h, i, n, likes, saves) {
    var cw = h.colorway === 'accent' ? 'accent' : h.colorway === 'dark' ? 'dark' : 'primary';
    var liked = !!likes[h.id], saved = !!saves[h.id], cat = arr(h.cats)[0] || h.cat;
    var s = h.score;
    return '<article class="hcard cw-' + cw + '" id="h-' + esc(h.id) + '" data-id="' + esc(h.id) + '" aria-roledescription="historia" aria-label="' + esc(h.title) + '">' +
      '<div class="hcard-bg" aria-hidden="true"><span class="hcard-badge d ' + fitClass(h.badge || '') + '">' + esc(h.badge || '') + '</span><span class="hcard-stripes"></span></div>' +
      '<p class="hcard-idx d" aria-hidden="true">' + String(i + 1).padStart(2, '0') + '<span>/' + String(n).padStart(2, '0') + '</span></p>' +
      '<div class="hcard-in">' +
      '<p class="kicker">' + (cat ? '<span class="tag tag-cat">' + esc(catLabel(cat)) + '</span>' : '') + '</p>' +
      '<p class="hcard-k">' + esc(h.kicker || '') + '</p>' +
      '<h2 class="hcard-t d' + (String(h.title).length > 22 ? ' long' : '') + '">' + esc(h.title) + '</h2>' +
      (h.subtitle ? '<p class="hcard-s">' + esc(h.subtitle) + '</p>' : '') +
      (s ? '<div class="hscore"><span class="hs-t">' + esc(s.home) + '</span><b class="d">' + esc(s.hs) + '<i>–</i>' + esc(s.as) + '</b><span class="hs-t">' + esc(s.away) + '</span>' + (s.caption ? '<small>' + esc(s.caption) + '</small>' : '') + '</div>' : '') +
      (arr(h.grid).length ? '<ul class="hgrid">' + h.grid.map(function (g) { return '<li><b class="d">' + esc(g.value) + '</b><span>' + esc(g.label) + '</span></li>'; }).join('') + '</ul>' : '') +
      (arr(h.bullets).length ? '<ul class="hbul">' + h.bullets.slice(0, (s || arr(h.grid).length) ? 2 : 3).map(function (b) { return '<li>' + richB(b) + '</li>'; }).join('') + '</ul>' : '') +
      (h.fact ? '<p class="hfact"><span class="d">Dato</span>' + esc(h.fact) + '</p>' : '') +
      (h.fixtureId && fx(h.fixtureId) ? '<button class="pill pill-on" data-act="match" data-fid="' + esc(h.fixtureId) + '">Ver partido ' + ic('arrow', 'ic-s') + '</button>' : '') +
      '</div>' +
      '<div class="rail" role="group" aria-label="Acciones">' +
      railBtn('like', h.id, liked, 'heart', liked ? 'Quitar me gusta' : 'Me gusta', fmtCount(baseLikes(h.id) + (liked ? 1 : 0))) +
      railBtn('save', h.id, saved, 'save', saved ? 'Quitar de guardados' : 'Guardar', saved ? 'Guardado' : 'Guardar') +
      '<button class="rail-b" data-act="share" data-id="' + esc(h.id) + '" aria-label="Compartir"><span class="rail-ic">' + ic('share') + '</span><span class="rail-c">Enviar</span></button>' +
      '</div></article>';
  }
  function renderHistory() {
    var list = histList(), likes = getLikes(), saves = getSaves(), nSaved = Object.keys(saves).filter(function (k) { return saves[k]; }).length;
    var cats = arr(T.historyCategories);
    if (!cats.length) cats = [['all', 'Todo']];
    var chips = cats.map(function (c) {
      var on = S.histCat === c[0];
      return '<button class="chip' + (on ? ' on' : '') + '" data-act="hcat" data-v="' + esc(c[0]) + '" aria-pressed="' + on + '">' + esc(c[1]) + '</button>';
    }).join('') + '<button class="chip' + (S.histCat === '__saved' ? ' on' : '') + '" data-act="hcat" data-v="__saved" aria-pressed="' + (S.histCat === '__saved') + '">' + ic('save', 'ic-s', true) + ' Guardados' + (nSaved ? ' · ' + nSaved : '') + '</button>';
    var body = list.length ? list.map(function (h, i) { return histCard(h, i, list.length, likes, saves); }).join('')
      : '<article class="hcard cw-dark hcard-empty"><div class="hcard-in"><p class="hcard-k">Guardados</p><h2 class="hcard-t d">Aún no has guardado nada</h2><p class="hcard-s">Pulsa ' + ic('save', 'ic-s') + ' en cualquier historia para tenerla aquí.</p>' +
        '<button class="pill pill-hi" data-act="hcat" data-v="all">Ver todas las historias</button></div></article>';
    return '<div class="hchips"><div class="chips chips-dark" role="group" aria-label="Categorías">' + chips + '</div></div>' +
      '<div class="hfeed" id="hfeed" aria-label="Historia del club">' + body + '</div>';
  }

  /* ------------------------------------------------------------------
     MÁS
     ------------------------------------------------------------------ */
  function toggleRow(key, label, hint) {
    var on = !!S.settings[key];
    return '<li><button class="toggle" role="switch" aria-checked="' + on + '" data-act="setting" data-v="' + key + '"><span class="tg-l"><b>' + label + '</b>' + (hint ? '<small>' + hint + '</small>' : '') + '</span><span class="tg-sw" aria-hidden="true"><i></i></span></button></li>';
  }
  function renderMore() {
    var st = T.stadium || {};
    var facts = [
      ['Fundación', T.founded], ['Estadio', st.name], ['Ciudad', st.city],
      ['Aforo', st.capacity ? fmtThousands(st.capacity) + (st.capacityNote ? ' · ' + st.capacityNote.toLowerCase() : '') : null],
      ['Entrenador', T.coach ? T.coach + (T.coachNote ? ' (' + T.coachNote + ')' : '') : null],
      ['Liga', T.league], ['País', T.country]
    ].filter(function (x) { return x[1] != null && x[1] !== ''; });
    return '<section class="club">' +
      '<div class="club-bg" aria-hidden="true"><span class="d">' + esc(T.monogram) + '</span></div>' +
      monoBadge(T.code, 'mono-xl') +
      '<h1 class="club-t d">' + esc(T.name) + '</h1>' +
      (T.motto ? '<p class="club-motto">«' + esc(T.motto) + '»</p>' : '') +
      (T.hashtag ? '<p class="club-tag">' + esc(T.hashtag) + '</p>' : '') +
      '<button class="pill pill-hi" data-act="team-sheet" aria-haspopup="dialog">' + ic('swap', 'ic-s') + ' Cambiar de club</button></section>' +
      '<div class="pad"><section class="sec"><h2 class="sec-h d">Ficha del club</h2><dl class="kv">' + facts.map(function (f) {
        return '<div><dt>' + f[0] + '</dt><dd>' + esc(f[1]) + '</dd></div>';
      }).join('') + '</dl></section>' +
      '<section class="sec"><h2 class="sec-h d">Notificaciones</h2><ul class="toggles">' +
      toggleRow('goals', 'Goles', 'Aviso en cada gol del partido en vivo') + toggleRow('kickoff', 'Inicio del partido', '30 minutos antes') + toggleRow('news', 'Noticias del club') + '</ul></section>' +
      '<section class="sec"><h2 class="sec-h d">Pantalla</h2><ul class="toggles">' +
      toggleRow('dark', 'Modo oscuro') + toggleRow('reduce', 'Reducir movimiento', 'Las stories no avanzan solas') + '</ul></section>' +
      '<section class="sec about"><h2 class="sec-h d">Acerca de</h2>' +
      '<p><b>vic-fut · Portada</b> es una propuesta de diseño para una app no oficial de fans. Los clubes se muestran solo con monograma y colores: sin escudos ni marcas oficiales.</p>' +
      (T.season && T.season.isDemo ? '<p>' + demoBadge(true) + ' La temporada en curso de este club es de demostración.</p>' : '') +
      '<p class="mut small">Inspirado en patrones de Formula 1, NFL y TikTok (vía Mobbin)</p>' +
      '<p class="small"><a href="../../index.html" target="_top">Ver las tres propuestas</a></p></section></div>';
  }

  /* ------------------------------------------------------------------
     Render de la vista principal
     ------------------------------------------------------------------ */
  function render(opts) {
    opts = opts || {};
    appEl.setAttribute('data-screen', S.screen);
    renderMast();
    renderNav();
    var html = S.screen === 'matches' ? renderMatches() : S.screen === 'season' ? renderSeason() : S.screen === 'history' ? renderHistory() : S.screen === 'more' ? renderMore() : renderHome();
    viewEl.innerHTML = '<div class="screen' + (opts.anim && !reduced() ? ' enter' : '') + '">' + html + '</div>';
    if (!opts.keepScroll) viewEl.scrollTop = 0;
    if (S.screen === 'history' && S.histFocus) {
      var el = document.getElementById('h-' + S.histFocus), feed = $('#hfeed');
      if (el && feed) feed.scrollTop = el.offsetTop;
      S.histFocus = null;
    }
  }
  function go(screen) {
    if (SCREENS.indexOf(screen) < 0) screen = 'home';
    var changed = S.screen !== screen;
    S.screen = screen;
    render({ anim: changed });
    if (changed) viewEl.focus({ preventScroll: true });
  }

  /* ------------------------------------------------------------------
     Capas: ficha de partido, hojas, stories
     ------------------------------------------------------------------ */
  var stack = [];
  function setInert() {
    var base = [mastEl, viewEl, navEl];
    base.forEach(function (el) { el.inert = stack.length > 0; if (stack.length) el.setAttribute('aria-hidden', 'true'); else el.removeAttribute('aria-hidden'); });
    stack.forEach(function (L, i) { L.el.inert = i < stack.length - 1; });
  }
  function renderLayer(L, keep) {
    var sc = keep ? (L.el.querySelector('.pg') || {}).scrollTop : 0;
    if (L.type === 'match') {
      // Conserva el foco al refrescar (el partido en vivo se actualiza solo)
      var a = document.activeElement, sel = null;
      if (keep && a && L.el.contains(a) && a.getAttribute('data-act')) {
        sel = '[data-act="' + a.getAttribute('data-act') + '"]' + ['data-v', 'data-i', 'data-side', 'data-list', 'data-fid'].map(function (k) {
          return a.hasAttribute(k) ? '[' + k + '="' + CSS.escape(a.getAttribute(k)) + '"]' : '';
        }).join('');
      }
      L.el.innerHTML = '<div class="pg" role="dialog" aria-modal="true" aria-label="Ficha del partido">' + matchPage(L.data) + '</div>';
      if (keep) L.el.querySelector('.pg').scrollTop = sc;
      if (sel) { var nf = L.el.querySelector(sel); if (nf) nf.focus({ preventScroll: true }); }
    } else if (L.type === 'player') L.el.innerHTML = playerSheet(L.data);
    else if (L.type === 'teams') L.el.innerHTML = teamSheet();
    else if (L.type === 'story') renderStory();
  }
  function pushLayer(type, data) {
    var el = document.createElement('div');
    el.className = 'lyr lyr-' + type;
    el.style.zIndex = String(10 + stack.length * 10);
    layerRoot.appendChild(el);
    var L = { type: type, data: data || {}, el: el, ret: document.activeElement };
    stack.push(L);
    renderLayer(L);
    setInert();
    if (reduced()) el.classList.add('on'); else requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('on'); }); });
    var f = el.querySelector('[data-autofocus]') || el.querySelector('button, [href], [tabindex]:not([tabindex="-1"])');
    if (f) f.focus({ preventScroll: true });
    return L;
  }
  function popLayer() {
    var L = stack.pop();
    if (!L) return;
    if (L.type === 'story') stStop();
    L.el.classList.remove('on');
    L.el.classList.add('off');
    setTimeout(function () { L.el.remove(); }, reduced() ? 0 : 300);
    setInert();
    if (L.ret && document.contains(L.ret)) L.ret.focus({ preventScroll: true });
  }
  function closeAll() { while (stack.length) { var L = stack.pop(); if (L.type === 'story') stStop(); L.el.remove(); } setInert(); }
  function topLayer() { return stack[stack.length - 1]; }
  function openMatch(fid, tab) {
    var ctx = matchCtx(fid);
    if (!ctx) { toast('Partido no disponible'); return; }
    pushLayer('match', { fid: fid, tab: tab || (fid === '__live' ? 'summary' : 'ratings') });
  }

  /* ---------- Selector de club ---------- */
  function teamSheet() {
    return '<div class="scrim" data-act="close-sheet"></div><div class="sheet sheet-teams" role="dialog" aria-modal="true" aria-labelledby="tsT">' +
      '<span class="grab" aria-hidden="true"></span><button class="icon-btn sheet-x" data-act="close-sheet" aria-label="Cerrar">' + ic('close') + '</button>' +
      '<p class="kicker"><span>Tu equipo, tu portada</span></p><h2 class="sheet-t d" id="tsT">Elige tu club</h2><ul class="teams">' +
      V.order.map(function (id) {
        var t = V.teams[id];
        if (!t) return '';
        var c = t.colors || {}, pri = hexOf(c.primary) || '#333', on = t.id === T.id;
        var k = (V.kit && V.kit(t.code, t)) || t.kit || {};
        return '<li><button class="team-opt' + (on ? ' on' : '') + '" data-act="set-team" data-v="' + esc(id) + '" aria-pressed="' + on + '"' + (on ? ' data-autofocus' : '') + ' style="--tbg:' + pri + ';--tfg:' + pick(pri, [c.onPrimary], 4.5) + ';--tacc:' + (hexOf(c.accent) || '#fc0') + '">' +
          '<span class="mono mono-l" style="--mbg:' + esc(k.bg || pri) + ';--mfg:' + pick(hexOf(k.bg) || pri, [k.fg], 4.5) + ';--mring:' + (hexOf(k.ring) || '#fff') + '"><b>' + esc(t.monogram || t.code) + '</b></span>' +
          '<span class="team-txt"><b class="d">' + esc(t.name) + '</b><span>' + esc(t.motto || '') + '</span></span>' +
          (on ? '<span class="team-cur">' + ic('check', 'ic-s') + ' Actual</span>' : ic('arrow', 'ic-s')) +
          '</button></li>';
      }).join('') + '</ul></div>';
  }

  /* ---------- Stories ---------- */
  var ST = null, ST_MS = 6000;
  function stSlideHtml(sl) {
    var f = sl.f, se = T.season || {};
    if (sl.type === 'next' || sl.type === 'countdown') {
      var comp = compOf(f.comp), dd = daysTo(f.date);
      if (sl.type === 'countdown') {
        return '<div class="ss ss-pri"><p class="ss-k">Cuenta atrás</p><p class="ss-giant d">' + (dd === 0 ? 'HOY' : esc(Math.max(0, num(dd)))) + '</p>' +
          '<p class="ss-h d">' + (dd === 0 ? 'Día de partido' : dd === 1 ? 'día para el partido' : 'días para el partido') + '</p>' +
          '<p class="ss-p">' + esc(fmtLong(f.date)) + (f.time ? ' · ' + esc(f.time) : '') + '<br>' + esc(f.stadium || (f.venue === 'A' ? 'Fuera de casa' : '')) + '</p></div>';
      }
      return '<div class="ss ss-split" style="background:' + kitOf(f.away).solid + '"><div class="ss-half" style="--hbg:' + kitOf(f.home).solid + ';--hfg:' + kitOf(f.home).fg + '"><span class="d">' + esc(nameOf(f.home)) + '</span></div>' +
        '<span class="ss-vs d">VS</span>' +
        '<div class="ss-half" style="--hbg:' + kitOf(f.away).solid + ';--hfg:' + kitOf(f.away).fg + '"><span class="d">' + esc(nameOf(f.away)) + '</span></div>' +
        '<p class="ss-cap"><span class="tag tag-hi">' + esc(comp.short || comp.name) + '</span> ' + esc(f.round || '') + '</p></div>';
    }
    if (sl.type === 'result') {
      return '<div class="ss ss-split ss-res" style="background:' + kitOf(f.away).solid + '"><div class="ss-half" style="--hbg:' + kitOf(f.home).solid + ';--hfg:' + kitOf(f.home).fg + '"><b class="d">' + num(f.hs) + '</b><span class="d">' + esc(nameOf(f.home)) + '</span></div>' +
        '<div class="ss-half" style="--hbg:' + kitOf(f.away).solid + ';--hfg:' + kitOf(f.away).fg + '"><b class="d">' + num(f.as) + '</b><span class="d">' + esc(nameOf(f.away)) + '</span></div>' +
        '<p class="ss-cap"><span class="tag tag-hi">' + (RES[resultOf(f)] || 'Final') + '</span> ' + esc(compOf(f.comp).short || '') + ' · ' + esc(fmtDate(f.date)) + '</p></div>';
    }
    if (sl.type === 'form') {
      return '<div class="ss ss-dark"><p class="ss-k">Racha · últimos ' + arr(se.form).length + '</p><p class="ss-h d">Así llega el equipo</p>' + formRow(arr(se.form), true) +
        '<p class="ss-p">' + num(se.allComps && se.allComps.w) + ' victorias en ' + num(se.allComps && se.allComps.played) + ' partidos esta temporada.</p></div>';
    }
    if (sl.type === 'live') {
      var L = T.liveDemo;
      return '<div class="ss ss-live"><p class="ss-k"><span class="live-dot">En vivo</span> · demo</p><p class="ss-giant d">' + (LIVE ? LIVE.minute : '') + '’</p>' +
        '<p class="ss-h d">' + esc(monoOf(L.home)) + ' ' + (LIVE ? LIVE.hs : 0) + '–' + (LIVE ? LIVE.as : 0) + ' ' + esc(monoOf(L.away)) + '</p><p class="ss-p">' + esc(nameOf(L.home)) + ' contra ' + esc(nameOf(L.away)) + '. El partido avanza solo: sigue cada gol en directo.</p></div>';
    }
    if (sl.type === 'season') {
      return '<div class="ss ss-pri"><p class="ss-k">Temporada ' + esc(se.label || '') + ' ' + demoBadge(se.isDemo) + '</p><p class="ss-giant d">' + (se.leaguePos ? esc(se.leaguePos) + 'º' : '–') + '</p>' +
        '<p class="ss-h d">' + num(se.points) + ' puntos</p><p class="ss-p">' + num(se.w) + 'V · ' + num(se.d) + 'E · ' + num(se.l) + 'D en ' + esc(T.league || 'liga') + '.<br>' + esc(se.leaderNote || '') + '</p></div>';
    }
    if (sl.type === 'news') {
      var n = sl.n;
      return '<div class="ss ss-dark"><p class="ss-k"><span class="tag tag-hi">' + esc(n.tag || 'Noticia') + '</span> ' + esc(n.dateLabel || '') + '</p><p class="ss-h ss-h-xl d">' + esc(n.title) + '</p><p class="ss-p">' + esc(n.body || '') + '</p></div>';
    }
    if (sl.type === 'history') {
      var h = sl.h, cw = h.colorway === 'accent' ? 'acc' : h.colorway === 'dark' ? 'dark' : 'pri';
      return '<div class="ss ss-' + cw + '"><span class="ss-bgnum d" aria-hidden="true">' + esc(h.badge || '') + '</span><p class="ss-k">' + esc(h.kicker || '') + '</p>' +
        '<p class="ss-h ss-h-xl d">' + esc(h.title) + '</p><p class="ss-p">' + esc(h.subtitle || '') + '</p>' +
        (h.score ? '<p class="ss-score d">' + esc(h.score.hs) + '–' + esc(h.score.as) + '<small>' + esc(h.score.home) + ' · ' + esc(h.score.away) + '</small></p>' : '') + '</div>';
    }
    return '';
  }
  function stCta(sl) {
    if (sl.type === 'next' || sl.type === 'countdown') return ['Ver previa', 'match', sl.f.id];
    if (sl.type === 'result') return ['Ver partido', 'match', sl.f.id];
    if (sl.type === 'form' || sl.type === 'season') return ['Ver temporada', 'tab', 'season'];
    if (sl.type === 'live') return ['Seguir en directo', 'live', ''];
    if (sl.type === 'news') return ['Ver partidos', 'tab', 'matches'];
    if (sl.type === 'history') return ['Leer en Historia', 'hist', sl.h.id];
    return null;
  }
  function renderStory() {
    var L = stack.filter(function (x) { return x.type === 'story'; })[0];
    if (!L || !ST) return;
    var g = ST.groups[ST.g], sl = g.slides[ST.s], cta = stCta(sl);
    (S.seen[T.id] = S.seen[T.id] || {})[g.id] = true;
    L.el.innerHTML = '<div class="story" role="dialog" aria-modal="true" aria-label="Stories de ' + esc(T.short || T.name) + '">' +
      '<div class="st-bars" aria-hidden="true">' + g.slides.map(function (_, i) { return '<span><i style="transform:scaleX(' + (i < ST.s ? 1 : 0) + ')"></i></span>'; }).join('') + '</div>' +
      '<div class="st-head">' + monoBadge(T.code, 'mono-s') + '<p><b>' + esc(g.label) + '</b><span>' + esc(T.short || T.name) + ' · ' + (ST.g + 1) + '/' + ST.groups.length + '</span></p>' +
      '<button class="icon-btn" data-act="st-pause" aria-label="' + (ST.paused ? 'Reproducir' : 'Pausar') + '">' + ic(ST.paused ? 'play' : 'pause', '', ST.paused) + '</button>' +
      '<button class="icon-btn" data-act="st-close" aria-label="Cerrar stories" data-autofocus>' + ic('close') + '</button></div>' +
      '<div class="st-stage" id="stStage"><div class="st-slide' + (reduced() ? '' : ' in') + '" aria-live="polite">' + stSlideHtml(sl) + '</div>' +
      '<button class="st-nav prev" data-act="st-prev" aria-label="Anterior"></button><button class="st-nav next" data-act="st-next" aria-label="Siguiente"></button></div>' +
      (cta ? '<div class="st-cta"><button class="pill pill-hi" data-act="st-cta" data-k="' + cta[1] + '" data-v="' + esc(cta[2]) + '">' + esc(cta[0]) + ' ' + ic('arrow', 'ic-s') + '</button></div>' : '') +
      (ST.paused && reduced() ? '<p class="st-hint">Toca a la derecha para avanzar</p>' : '') + '</div>';
    var close = L.el.querySelector('[data-act="st-close"]');
    if (close && document.activeElement === document.body) close.focus({ preventScroll: true });
  }
  function stBar() {
    if (!ST) return;
    var bars = $$('.st-bars i');
    if (bars[ST.s]) bars[ST.s].style.transform = 'scaleX(' + Math.min(1, ST.elapsed / ST_MS) + ')';
  }
  function stLoop(ts) {
    if (!ST) return;
    var dt = ST.last ? ts - ST.last : 0;
    ST.last = ts;
    if (!ST.paused && !ST.hold && !document.hidden) ST.elapsed += Math.min(dt, 100);
    stBar();
    if (ST.elapsed >= ST_MS) stStep(1);
    ST && (ST.raf = requestAnimationFrame(stLoop));
  }
  function stStep(d) {
    if (!ST) return;
    var g = ST.groups[ST.g];
    ST.elapsed = 0;
    if (d > 0) {
      if (ST.s < g.slides.length - 1) ST.s++;
      else if (ST.g < ST.groups.length - 1) { ST.g++; ST.s = 0; }
      else { popLayer(); refreshRings(); return; }
    } else {
      if (ST.s > 0) ST.s--;
      else if (ST.g > 0) { ST.g--; ST.s = 0; }
    }
    renderStory();
  }
  function openStories(gi) {
    ST = { groups: storyGroups(), g: gi || 0, s: 0, elapsed: 0, paused: reduced(), hold: false, last: 0 };
    if (!ST.groups.length) { ST = null; return; }
    pushLayer('story');
    ST.raf = requestAnimationFrame(stLoop);
  }
  function stStop() { if (ST) cancelAnimationFrame(ST.raf); ST = null; refreshRings(); }
  function refreshRings() {
    var row = $('.stories');
    if (row && S.screen === 'home') { var tmp = document.createElement('div'); tmp.innerHTML = storiesRow(); row.replaceWith(tmp.firstChild); }
  }

  /* ------------------------------------------------------------------
     Cambio de club
     ------------------------------------------------------------------ */
  var switching = false;
  function setTeam(id, opts) {
    opts = opts || {};
    if (!V.teams[id]) id = V.defaultTeam && V.teams[V.defaultTeam] ? V.defaultTeam : V.order[0];
    if (T && T.id === id && !opts.force) { if (stack.length && topLayer().type === 'teams') popLayer(); return; }
    var next = V.getTeam ? V.getTeam(id) : V.teams[id];
    LS.set(KEY + 'team', id);
    var swap = function () {
      T = next;
      S.compFilter = 'all'; S.seasonSel = null; S.seasonView = null; S.histCat = 'all';
      closeAll();
      applyTheme();
      liveStart();
      render({ anim: false, keepScroll: false });
    };
    if (opts.instant || reduced() || !T) { swap(); return; }
    if (switching) { swap(); return; }
    switching = true;
    var c = next.colors || {};
    curtainEl.style.setProperty('--cbg', hexOf(c.primary) || '#333');
    curtainEl.style.setProperty('--cfg', pick(hexOf(c.primary) || '#333', [c.onPrimary], 4.5));
    curtainEl.style.setProperty('--cacc', hexOf(c.accent) || '#fc0');
    $('#curtainMono').innerHTML = '<b class="d">' + esc(next.monogram || next.code) + '</b><span class="d">' + esc(next.motto || next.name) + '</span>';
    curtainEl.className = 'curtain in';
    setTimeout(function () {
      swap();
      curtainEl.className = 'curtain in hold';
      setTimeout(function () {
        curtainEl.className = 'curtain out';
        setTimeout(function () { curtainEl.className = 'curtain'; switching = false; }, 520);
      }, 260);
    }, 480);
  }

  /* ------------------------------------------------------------------
     Toast
     ------------------------------------------------------------------ */
  var toastT;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('on'); }, 2600);
  }

  /* ------------------------------------------------------------------
     Eventos
     ------------------------------------------------------------------ */
  function toggleStore(kind, id) {
    var getter = kind === 'like' ? getLikes : getSaves, key = kind === 'like' ? likesKey() : savesKey();
    var o = getter(); o[id] = !o[id]; if (!o[id]) delete o[id];
    LS.set(key, o);
    return !!o[id];
  }
  function refreshRail(id) {
    var card = document.getElementById('h-' + id);
    if (!card) return;
    var likes = getLikes(), saves = getSaves(), liked = !!likes[id], saved = !!saves[id];
    var rail = card.querySelector('.rail');
    rail.innerHTML = railBtn('like', id, liked, 'heart', liked ? 'Quitar me gusta' : 'Me gusta', fmtCount(baseLikes(id) + (liked ? 1 : 0))) +
      railBtn('save', id, saved, 'save', saved ? 'Quitar de guardados' : 'Guardar', saved ? 'Guardado' : 'Guardar') +
      '<button class="rail-b" data-act="share" data-id="' + esc(id) + '" aria-label="Compartir"><span class="rail-ic">' + ic('share') + '</span><span class="rail-c">Enviar</span></button>';
    // Contador del chip «Guardados»
    var chip = $('.hchips [data-v="__saved"]');
    if (chip) { var n = Object.keys(saves).length; chip.innerHTML = ic('save', 'ic-s', true) + ' Guardados' + (n ? ' · ' + n : ''); }
  }
  function burst(card) {
    if (!card || reduced()) return;
    var b = document.createElement('span');
    b.className = 'burst';
    b.setAttribute('aria-hidden', 'true');
    b.innerHTML = ic('heart', '', true);
    card.appendChild(b);
    setTimeout(function () { b.remove(); }, 900);
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]');
    if (!t) return;
    var act = t.getAttribute('data-act'), v = t.getAttribute('data-v');
    switch (act) {
      case 'tab': closeAll(); go(t.getAttribute('data-screen')); break;
      case 'team-sheet': pushLayer('teams'); break;
      case 'set-team': setTeam(v); break;
      case 'close-sheet': popLayer(); break;
      case 'back': popLayer(); break;
      case 'story': openStories(parseInt(t.getAttribute('data-g'), 10) || 0); break;
      case 'match': openMatch(t.getAttribute('data-fid')); break;
      case 'match-swap': popLayer(); openMatch(t.getAttribute('data-fid')); break;
      case 'live': openMatch('__live'); break;
      case 'mtab': {
        var L = topLayer();
        if (L && L.type === 'match') {
          L.data.tab = v; renderLayer(L, true);
          var nt = L.el.querySelector('#mxt-' + v); if (nt) nt.focus({ preventScroll: true });
        }
        break;
      }
      case 'player': {
        var M = topLayer();
        if (M && M.type === 'match') pushLayer('player', { fid: M.data.fid, side: t.getAttribute('data-side'), list: t.getAttribute('data-list'), i: parseInt(t.getAttribute('data-i'), 10) });
        break;
      }
      case 'comp': S.compFilter = v; render({ keepScroll: true }); break;
      case 'msea': S.seasonSel = v; S.compFilter = 'all'; render({ keepScroll: true }); break;
      case 'ssea': S.seasonView = v; render({ keepScroll: true }); break;
      case 'stab': S.seasonTab = v; render({ keepScroll: true }); var st = $('#st-' + v); if (st) st.focus({ preventScroll: true }); break;
      case 'hcat': S.histCat = v; render(); break;
      case 'like': {
        var on = toggleStore('like', t.getAttribute('data-id'));
        refreshRail(t.getAttribute('data-id'));
        if (on) burst(document.getElementById('h-' + t.getAttribute('data-id')));
        var nb = $('#h-' + CSS.escape(t.getAttribute('data-id')) + ' [data-act="like"]'); if (nb) nb.focus({ preventScroll: true });
        break;
      }
      case 'save': {
        var id = t.getAttribute('data-id'), sv = toggleStore('save', id);
        toast(sv ? 'Guardado en «Guardados»' : 'Quitado de «Guardados»');
        if (S.histCat === '__saved' && !sv) render({ keepScroll: true });
        else { refreshRail(id); var sb = $('#h-' + CSS.escape(id) + ' [data-act="save"]'); if (sb) sb.focus({ preventScroll: true }); }
        break;
      }
      case 'share': {
        var h = arr(T.history).filter(function (x) { return x.id === t.getAttribute('data-id'); })[0];
        var text = h ? (h.title + ' · ' + (T.short || T.name)) : T.name;
        var url = location.href.split('#')[0];
        if (navigator.share) navigator.share({ title: text, text: text, url: url }).catch(function () {});
        else if (navigator.clipboard) navigator.clipboard.writeText(text + ' — ' + url).then(function () { toast('Enlace copiado'); }, function () { toast('No se pudo copiar'); });
        else toast('Compartir no disponible');
        break;
      }
      case 'setting': {
        S.settings[v] = !S.settings[v];
        LS.set(KEY + 'settings', S.settings);
        if (v === 'dark' || v === 'reduce') applyTheme();
        t.setAttribute('aria-checked', String(!!S.settings[v]));
        if (v === 'dark') render({ keepScroll: true });
        break;
      }
      case 'st-close': popLayer(); break;
      case 'st-prev': stStep(-1); break;
      case 'st-next': stStep(1); break;
      case 'st-pause': if (ST) { ST.paused = !ST.paused; renderStory(); stBar(); var pb = $('[data-act="st-pause"]'); if (pb) pb.focus(); } break;
      case 'st-cta': {
        var k = t.getAttribute('data-k');
        popLayer();
        if (k === 'match') openMatch(v);
        else if (k === 'live') openMatch('__live');
        else if (k === 'tab') go(v);
        else if (k === 'hist') { S.histCat = 'all'; S.histFocus = v; closeAll(); go('history'); }
        break;
      }
    }
  });

  // Doble toque en una historia = me gusta
  viewEl.addEventListener('dblclick', function (e) {
    var card = e.target.closest('.hcard');
    if (!card || e.target.closest('button') || !card.getAttribute('data-id')) return;
    var id = card.getAttribute('data-id');
    if (!getLikes()[id]) toggleStore('like', id);
    refreshRail(id); burst(card);
  });

  // Stories: mantener pulsado = pausa; deslizar hacia abajo = cerrar
  var ptr = null;
  layerRoot.addEventListener('pointerdown', function (e) {
    if (!ST || !e.target.closest('.st-stage')) return;
    ptr = { x: e.clientX, y: e.clientY, t: Date.now() };
    ST.hold = true;
  });
  layerRoot.addEventListener('pointermove', function (e) {
    if (!ptr) return;
    var dy = e.clientY - ptr.y, st = $('.story');
    if (st && dy > 0 && !reduced()) st.style.transform = 'translateY(' + dy * 0.6 + 'px) scale(' + (1 - Math.min(dy, 300) / 3000) + ')';
  });
  function ptrEnd(e) {
    if (!ptr) return;
    var dy = e.clientY - ptr.y, dx = e.clientX - ptr.x, held = Date.now() - ptr.t;
    var st = $('.story');
    if (st) st.style.transform = '';
    if (ST) ST.hold = false;
    ptr = null;
    if (dy > 90 && Math.abs(dx) < 80) { e.preventDefault(); popLayer(); swallowClick = true; return; }
    if (held > 350) swallowClick = true; // pulsación larga = pausa, no navegación
  }
  var swallowClick = false;
  layerRoot.addEventListener('pointerup', ptrEnd);
  layerRoot.addEventListener('pointercancel', function () { ptr = null; if (ST) ST.hold = false; var st = $('.story'); if (st) st.style.transform = ''; });
  layerRoot.addEventListener('click', function (e) { if (swallowClick) { swallowClick = false; e.stopPropagation(); e.preventDefault(); } }, true);

  document.addEventListener('keydown', function (e) {
    var L = topLayer();
    if (e.key === 'Escape' && L) { e.preventDefault(); popLayer(); return; }
    if (L && L.type === 'story') {
      if (e.key === 'ArrowRight') { e.preventDefault(); stStep(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); stStep(-1); }
      else if (e.key === ' ' && ST && !e.target.closest('button')) { e.preventDefault(); ST.paused = !ST.paused; renderStory(); }
    }
    // Flechas entre pestañas (patrón tablist)
    var tab = e.target.closest && e.target.closest('[role="tab"]');
    if (tab && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      var tabs = $$('[role="tab"]', tab.parentNode), i = tabs.indexOf(tab);
      var nx = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      if (nx) { e.preventDefault(); nx.click(); }
    }
    // Trampa de foco simple en capas modales
    if (e.key === 'Tab' && L) {
      var f = $$('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])', L.el).filter(function (x) { return x.offsetParent !== null; });
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      else if (!L.el.contains(document.activeElement)) { e.preventDefault(); f[0].focus(); }
    }
  });

  // Mensajes desde la página índice (iframe)
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'vicfut:team') setTeam(e.data.team);
  });
  if (mqReduce.addEventListener) mqReduce.addEventListener('change', function () { applyTheme(); });

  /* ------------------------------------------------------------------
     Arranque
     ------------------------------------------------------------------ */
  var qs = new URLSearchParams(location.search);
  var qTeam = qs.get('team'), qScreen = qs.get('screen');
  var startId = (qTeam && V.teams[qTeam]) ? qTeam : (LS.get(KEY + 'team', null) && V.teams[LS.get(KEY + 'team', null)] ? LS.get(KEY + 'team', null) : (V.defaultTeam || V.order[0]));
  T = V.getTeam ? V.getTeam(startId) : V.teams[startId];
  applyTheme();
  liveStart();
  if (qScreen === 'match') {
    S.screen = 'matches';
    render();
    var feat = T.featuredMatch && T.featuredMatch.fixtureId;
    if (feat) openMatch(feat, 'ratings'); else if (T.liveDemo) openMatch('__live', 'ratings');
  } else {
    S.screen = SCREENS.indexOf(qScreen) >= 0 ? qScreen : 'home';
    render();
  }
  // API de depuración/integración
  window.vicfutPortada = { setTeam: setTeam, go: go, openMatch: openMatch };
})();
