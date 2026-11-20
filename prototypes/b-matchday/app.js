/* =====================================================================
   vic-fut · Dirección B «Matchday»
   Una sola página sin dependencias. Todos los datos salen de
   window.VICFUT (shared/teams.js). Nada de datos de club en este archivo.
   ===================================================================== */
(function () {
  'use strict';

  var V = window.VICFUT;
  var view = document.getElementById('view');
  if (!V || !V.teams) {
    view.innerHTML = '<div class="empty"><h3>Sin datos</h3><p>No se pudo cargar shared/teams.js.</p></div>';
    return;
  }

  /* ------------------------------------------------------------ utils */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var LSKEY = 'vicfut.b.';
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(LSKEY + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(LSKEY + k, JSON.stringify(v)); } catch (e) { /* almacenamiento no disponible */ } }
  };
  var mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function reduced() { return !!mqReduce.matches; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function richB(s) { return esc(s).replace(/&lt;(\/?)b&gt;/g, '<$1b>'); }
  function arr(a) { return Array.isArray(a) ? a : []; }
  function num(n, d) { var x = parseFloat(n); return isNaN(x) ? (d == null ? 0 : d) : x; }
  function minNum(m) {
    if (m == null) return 0;
    var p = String(m).split('+');
    return (parseInt(p[0], 10) || 0) + (p[1] ? (parseInt(p[1], 10) || 0) / 100 : 0);
  }
  function hash(str) { var h = 2166136261; str = String(str); for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function icon(id, cls) { return '<svg class="' + (cls || '') + '" aria-hidden="true" focusable="false"><use href="#' + id + '"/></svg>'; }

  var DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  var DOWL = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var MONL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function pd(iso) {
    if (!iso) return null;
    var p = String(iso).split('-');
    if (p.length < 3) return null;
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function todayIso() {
    if (V.today) return V.today;
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function fdate(iso, long) {
    var d = pd(iso); if (!d) return '';
    return long ? DOWL[d.getDay()] + ' ' + d.getDate() + ' de ' + MONL[d.getMonth()] : DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()];
  }
  function daysTo(iso) { var a = pd(todayIso()), b = pd(iso); return a && b ? Math.round((b - a) / 864e5) : null; }
  function countdown(iso) {
    var n = daysTo(iso);
    if (n == null) return '';
    if (n < 0) return 'Ya disputado';
    if (n === 0) return 'Hoy';
    if (n === 1) return 'Mañana';
    return 'Faltan ' + n + ' días';
  }

  var RES = { W: 'V', D: 'E', L: 'D' };
  var RESL = { W: 'Victoria', D: 'Empate', L: 'Derrota' };
  var POSL = { GK: 'Portero', DEF: 'Defensa', MID: 'Centrocampista', FWD: 'Delantero', POR: 'Porteros', MED: 'Centrocampistas', DEL: 'Delanteros' };

  /* ------------------------------------------------------------ state */
  var params = new URLSearchParams(location.search);
  var S = {
    screen: 'home', back: 'home',
    matchId: null, matchTab: 'ratings', side: 'home',
    comp: 'all', season: null,
    seasonTab: 'resumen', seasonScope: 'liga',
    histCat: 'all',
    likes: store.get('likes', {}), saves: store.get('saves', {}),
    remind: store.get('remind', {}),
    dark: store.get('dark', null),
    notif: store.get('notif', true),
    goals: store.get('goals', true)
  };
  var T = null;
  var SCREENS = ['home', 'matches', 'match', 'season', 'history', 'more'];

  /* ---------------------------------------------------- team helpers */
  function teamByCode(code) {
    for (var id in V.teams) if (V.teams[id] && V.teams[id].code === code) return V.teams[id];
    return null;
  }
  function tname(code) {
    if (!code) return '—';
    if (code === T.code) return T.short || T.name;
    try { if (V.teamName) { var n = V.teamName(code, T); if (n) return n; } } catch (e) { /* sigue */ }
    var o = V.opponents && V.opponents[code]; if (o && o.name) return o.name;
    var t = teamByCode(code); return t ? (t.short || t.name) : code;
  }
  function tfull(code) {
    if (code === T.code) return T.name;
    var t = teamByCode(code); if (t) return t.name;
    var o = V.opponents && V.opponents[code]; return o && o.name ? o.name : tname(code);
  }
  function mono(code) {
    if (code === T.code) return T.monogram || code;
    var t = teamByCode(code);
    return t ? (t.monogram || code) : String(code || '?').slice(0, 3);
  }
  function kitOf(code) {
    var k = null;
    try { k = V.kit ? V.kit(code, T) : null; } catch (e) { k = null; }
    return k || V.genericKit || { bg: '#e7ebf1', fg: '#0d1b2a', ring: '#9aa7b5' };
  }
  function kitStyle(k) { return '--kbg:' + esc(k.bg) + ';--kfg:' + esc(k.fg) + ';--kring:' + esc(k.ring || k.fg); }
  function isStriped(k) { return /gradient/.test(k.bg || ''); }
  function crest(code, size) {
    var k = kitOf(code), m = mono(code);
    var cls = 'crest ' + (size || '') + (m.length >= 3 ? ' m3' : '') + (isStriped(k) ? ' striped' : '');
    return '<span class="' + cls + '" style="' + kitStyle(k) + '" aria-hidden="true"><b>' + esc(m) + '</b></span>';
  }
  function compOf(code) { return (V.comps && V.comps[code]) || { name: code || '', short: code || '', color: '#5a6b7d' }; }
  function compTag(code, extra) {
    var c = compOf(code);
    return '<span class="comp" style="--cc:' + esc(c.color) + '"><i></i>' + esc(c.short || c.name) + (extra ? ' · ' + esc(extra) : '') + '</span>';
  }
  function demoBadge(ghost) { return '<span class="demo-badge' + (ghost ? ' ghost' : '') + '">DATOS DEMO</span>'; }

  /* ------------------------------------------------- fixture helpers */
  function fixtures() { return arr(T.fixtures); }
  function getFx(id) {
    if (!id) return null;
    if (id === '__live') return liveFx();
    var f = null;
    try { f = V.fixture ? V.fixture(T, id) : null; } catch (e) { f = null; }
    if (!f) f = fixtures().concat(arr(T.archive)).filter(function (x) { return x.id === id; })[0] || null;
    return f;
  }
  function detailOf(id) {
    if (id === '__live') return liveDetail();
    var d = null;
    try { d = V.matchDetail ? V.matchDetail(T, id) : null; } catch (e) { d = null; }
    if (!d) {
      if (T.featuredMatch && T.featuredMatch.fixtureId === id) d = T.featuredMatch;
      else d = arr(T.extraMatches).filter(function (m) { return m.fixtureId === id; })[0] || null;
    }
    return d;
  }
  function resultOf(f) {
    if (f.result) return f.result;
    if (f.status !== 'ft' || f.hs == null) return null;
    var us = f.home === T.code ? f.hs : f.as, them = f.home === T.code ? f.as : f.hs;
    return us > them ? 'W' : us < them ? 'L' : 'D';
  }
  function opponentOf(f) { return f.home === T.code ? f.away : f.home; }
  function nextMatch() {
    var f = getFx(T.nextMatch && T.nextMatch.fixtureId);
    if (f && f.status === 'up') return f;
    return fixtures().filter(function (x) { return x.status === 'up'; })[0] || f || null;
  }
  function finished(list) { return arr(list).filter(function (f) { return f.status === 'ft'; }); }

  /* ------------------------------------------------------- live demo */
  var L = null, liveTimer = null;
  function liveFx() {
    var d = T.liveDemo; if (!d) return null;
    return { id: '__live', home: d.home, away: d.away, comp: d.comp || 'DEMO', round: d.label || 'Partido de demostración', status: 'live', date: todayIso(), time: null, hs: L ? L.hs : 0, as: L ? L.as : 0, venue: d.home === T.code ? 'H' : 'A' };
  }
  function liveDetail() {
    var d = T.liveDemo; if (!d) return null;
    return { fixtureId: '__live', lineups: d.lineups || null, events: L ? L.events : arr(d.events), stats: arr(d.stats), playerHeat: {}, ratingsDemo: true, live: true };
  }
  function liveReset() {
    var d = T.liveDemo;
    if (!d) { L = null; return; }
    var sc = arr(d.startScore);
    L = { min: num(d.startMinute, 0), hs: num(sc[0], 0), as: num(sc[1], 0), events: arr(d.events).slice(), i: 0, done: false, wait: 0, fresh: null };
  }
  function evText(ev) {
    if (!ev) return '';
    if (ev.type === 'goal') return (ev.player || 'Gol') + (ev.detail ? ' · ' + ev.detail : '');
    if (ev.type === 'sub') return (ev.player || '') + (ev.playerOut ? ' por ' + ev.playerOut : '');
    return (ev.player ? ev.player + ' · ' : '') + (ev.detail || '');
  }
  function liveTick() {
    if (!L || !T.liveDemo) return;
    if (L.done) {
      L.wait++;
      if (L.wait > 6) { liveReset(); liveUpdate(true); }
      return;
    }
    L.min++;
    var sc = arr(T.liveDemo.script), changed = false;
    while (L.i < sc.length && Math.floor(minNum(sc[L.i].min)) <= L.min) {
      var ev = sc[L.i++];
      L.events.push(ev); L.fresh = ev; changed = true;
      if (ev.type === 'goal') { if (ev.side === 'home') L.hs++; else L.as++; goalFx(ev); }
    }
    if (L.min >= 90 && L.i >= sc.length) { L.min = 90; L.done = true; L.wait = 0; changed = true; }
    liveUpdate(changed);
  }
  function liveMinLabel() { return !L ? '' : L.done ? 'Final' : L.min + "'"; }
  function liveUpdate(changed) {
    if (!L) return;
    $$('[data-live="min"]').forEach(function (el) { el.textContent = liveMinLabel(); });
    $$('[data-live="score"]').forEach(function (el) { el.textContent = L.hs + ' - ' + L.as; });
    $$('[data-live="dot"]').forEach(function (el) { el.classList.toggle('ended', L.done); el.lastChild.textContent = L.done ? 'FINAL' : 'EN VIVO'; });
    $$('[data-live="last"]').forEach(function (el) { el.innerHTML = lastEventHtml(); });
    if (changed && S.screen === 'match' && S.matchId === '__live') {
      renderMatchHeader();
      if (S.matchTab !== 'ratings') renderPanel();
    }
  }
  function lastEventHtml() {
    var ev = L && L.events[L.events.length - 1];
    if (!ev) return '<span>Sin incidencias todavía</span>';
    return '<span class="m">' + esc(ev.min) + "'</span>" + evIcon(ev) + '<span><b>' + esc(evTitle(ev)) + '</b> ' + esc(evSub(ev)) + '</span>';
  }
  function goalFx(ev) {
    var who = ev.player || tname(ev.side === 'home' ? T.liveDemo.home : T.liveDemo.away);
    $$('[data-live="burst"]').forEach(function (el) {
      el.innerHTML = '<span class="rays"></span><div><div class="g">¡GOL!</div><div class="p">' + esc(who) + ' · ' + esc(ev.min) + "'</div></div>";
      el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
      setTimeout(function () { el.classList.remove('go'); }, 2700);
    });
    $$('[data-live="score"]').forEach(function (el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); });
    if (S.goals && !(S.screen === 'home' || (S.screen === 'match' && S.matchId === '__live'))) {
      toast('⚽ ¡Gol! ' + who + ' ' + ev.min + "' · " + tname(T.liveDemo.home) + ' ' + L.hs + '-' + L.as + ' ' + tname(T.liveDemo.away));
    }
  }
  function startLive() {
    if (liveTimer) clearInterval(liveTimer);
    liveTimer = setInterval(liveTick, 1600);
  }

  /* ------------------------------------------------------------ theme */
  function applyTheme() {
    var c = T.colors || {}, st = document.documentElement.style;
    var map = {
      '--primary': c.primary || '#1d4ed8', '--primary-dark': c.primaryDark || c.primary || '#1e3a8a',
      '--accent': c.accent || '#f59e0b', '--accent-dark': c.accentDark || c.accent || '#b45309',
      '--on-primary': c.onPrimary || '#ffffff', '--on-accent': c.onAccent || '#111111',
      '--tint': c.bgTint || '#eef2f7'
    };
    for (var k in map) st.setProperty(k, map[k]);
    var meta = $('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', map['--primary']);
    document.title = 'vic-fut · Matchday · ' + (T.short || T.name);
  }
  function applyDark() {
    var dark = S.dark == null ? false : !!S.dark;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }

  function setTeam(id, opts) {
    opts = opts || {};
    if (!id || !V.teams[id]) return;
    if (T && T.id === id && !opts.force) return;
    var go = function () {
      T = V.getTeam(id);
      store.set('team', id);
      S.comp = 'all'; S.season = null; S.histCat = 'all'; S.side = 'home';
      if (S.screen === 'match') { S.matchId = (T.featuredMatch && T.featuredMatch.fixtureId) || null; S.matchTab = 'ratings'; }
      applyTheme();
      liveReset();
      closeSheet(true);
      render(true);
    };
    if (T && !opts.instant && document.startViewTransition && !reduced()) {
      try { document.startViewTransition(go); } catch (e) { go(); }
    } else go();
    if (T && !opts.instant && !opts.silent) setTimeout(function () { toast('Ahora sigues a ' + T.name); }, 380);
  }

  function syncUrl() {
    try {
      var p = new URLSearchParams(location.search);
      p.set('team', T.id);
      p.set('screen', S.screen);
      history.replaceState(null, '', location.pathname + '?' + p.toString() + location.hash);
    } catch (e) { /* file:// o iframe sin permiso */ }
  }

  /* ---------------------------------------------------------- appbar */
  var TITLES = { home: 'Inicio', matches: 'Partidos', season: 'Temporada', history: 'Historia', more: 'Más' };
  function renderBar() {
    var bar = $('#appbar');
    var demo = T.season && T.season.isDemo;
    if (S.screen === 'match') {
      var f = getFx(S.matchId);
      bar.className = 'appbar compact';
      bar.innerHTML = '<div class="ab-row">' +
        '<button type="button" class="icon-btn" data-act="back" aria-label="Volver">' + icon('i-back') + '</button>' +
        '<span class="ab-mtitle">' + (f ? esc(compOf(f.comp).name) : 'Partido') + '</span><span class="ab-spacer"></span>' +
        clubPill(true) + '</div>';
      return;
    }
    var sub = {
      home: T.hashtag || T.motto || '',
      matches: (T.season && T.season.label ? 'Temporada ' + T.season.label : '') + (T.league ? ' · ' + T.league : ''),
      season: (T.season && T.season.label) || '',
      history: T.name + ' desde ' + (T.founded || ''),
      more: T.name
    }[S.screen] || '';
    bar.className = 'appbar' + (S.screen === 'history' ? ' compact-ish' : '');
    bar.innerHTML = '<div class="ab-row">' + clubPill(false) + '<span class="ab-spacer"></span>' +
      (demo && S.screen !== 'history' ? demoBadge() : '') +
      '<button type="button" class="icon-btn" data-act="settings" aria-label="Ajustes">' + icon('t-more') + '</button>' +
      '</div><div class="ab-title"><h1>' + esc(S.screen === 'home' ? (T.short || T.name) : TITLES[S.screen]) + '</h1><span class="sub">' + esc(sub) + '</span></div>';
  }
  function clubPill(small) {
    return '<button type="button" class="club-pill" data-act="teams" aria-haspopup="dialog" aria-label="Cambiar de club. Club actual: ' + esc(T.name) + '">' +
      crest(T.code, 'sm') + (small ? '' : '<span class="nm">' + esc(T.name) + '</span>') + icon('i-chevd') + '</button>';
  }

  /* ------------------------------------------------------ fixture row */
  function fxRow(f, opts) {
    opts = opts || {};
    var live = f.status === 'live', up = f.status === 'up';
    var r = resultOf(f);
    var mid;
    if (up) mid = '<span class="pill time">' + esc(f.time || 'Por conf.') + '</span>';
    else if (live) mid = '<span class="pill live" data-live="score">' + (L ? L.hs + ' - ' + L.as : '') + '</span>';
    else mid = '<span class="pill ' + (opts.colorPill && r ? r : '') + '">' + esc(f.hs) + '<i>-</i>' + esc(f.as) + '</span>';
    var hasDet = !live && f.status === 'ft' && !!detailOf(f.id);
    var dateTxt = live ? '<span data-live="min">' + liveMinLabel() + '</span> · En vivo' : fdate(f.date);
    var label = tfull(f.home) + (up ? ' contra ' : ' ' + f.hs + ', ') + tfull(f.away) + (up ? '' : ' ' + f.as) + '. ' + compOf(f.comp).name + (f.round ? ', ' + f.round : '') + '. ' + fdate(f.date, true) + (up && f.time ? ' a las ' + f.time : '') + (r ? '. ' + RESL[r] : '');
    return '<button type="button" class="fx' + (live ? ' is-live' : '') + '" data-act="match" data-v="' + esc(f.id) + '" aria-label="' + esc(label) + '">' +
      '<span class="fx-line">' +
        '<span class="fx-name h' + (f.home === T.code ? ' me' : '') + '">' + esc(tname(f.home)) + '</span>' + crest(f.home, 'sm') + mid + crest(f.away, 'sm') +
        '<span class="fx-name a' + (f.away === T.code ? ' me' : '') + '">' + esc(tname(f.away)) + '</span>' +
      '</span>' +
      '<span class="fx-meta">' + compTag(f.comp) + '<span>' + esc(f.round || '') + '</span><span>·</span><span>' + dateTxt + '</span>' + (hasDet ? '<span class="chip-ratings">Ratings</span>' : '') + (f.label ? '<span class="chip-ratings">' + esc(f.label) + '</span>' : '') + '</span>' +
      '<span class="fx-side">' + (r ? '<span class="res ' + r + '" aria-hidden="true">' + RES[r] + '</span>' : icon('i-chev', 'chev')) + '</span>' +
      '</button>';
  }

  /* ============================================================ HOME */
  function viewHome() {
    var nx = nextMatch();
    var h = '<div class="band"></div><div class="pad">';
    h += nx ? heroCard(nx) : '<section class="card"><div class="empty"><h3>Sin próximos partidos</h3><p>El calendario aún no está publicado.</p></div></section>';
    if (T.liveDemo) h += liveCard();
    h += tableCard();
    h += recentCard();
    h += newsCard();
    h += '</div>';
    return h;
  }
  function heroCard(f) {
    var cd = countdown(f.date);
    var venue = f.venue === 'H' ? (f.stadium || (T.stadium && T.stadium.name) || 'En casa') : f.venue === 'N' ? 'Campo neutral' : 'Fuera de casa';
    var on = !!S.remind[T.id + ':' + f.id];
    return '<section class="card hero" aria-labelledby="nxTitle">' +
      '<div class="hero-top"><span id="nxTitle" class="grow"><b style="color:var(--text)">Próximo partido</b></span>' + compTag(f.comp, f.round) + '</div>' +
      '<div class="hero-mid">' +
        '<div class="hero-team">' + crest(f.home, 'lg') + '<span class="nm">' + esc(tname(f.home)) + '</span><span class="tag">Local</span></div>' +
        '<div class="hero-time"><div class="big">' + esc(f.time || '--:--') + '</div><div class="d">' + esc(fdate(f.date)) + '</div>' + (cd ? '<span class="countdown">' + esc(cd) + '</span>' : '') + '</div>' +
        '<div class="hero-team">' + crest(f.away, 'lg') + '<span class="nm">' + esc(tname(f.away)) + '</span><span class="tag">Visitante</span></div>' +
      '</div>' +
      '<div class="hero-foot"><span class="venue">' + icon('i-pin') + '<span>' + esc(venue) + '</span></span>' +
        '<button type="button" class="btn ghost" data-act="remind" data-v="' + esc(f.id) + '" aria-pressed="' + on + '" aria-label="Recordatorio del partido">' + icon('i-bell') + (on ? 'Avisaré' : 'Avisar') + '</button>' +
        '<button type="button" class="btn" data-act="match" data-v="' + esc(f.id) + '">Previa</button>' +
      '</div></section>';
  }
  function liveCard() {
    var d = T.liveDemo;
    return '<section class="card" aria-label="Partido en vivo (demostración)">' +
      '<div class="card-h"><span class="live-dot" data-live="dot"><span></span>' + (L && L.done ? 'FINAL' : 'EN VIVO') + '</span><span class="grow muted small" style="font-weight:600">' + esc(d.label || 'Partido de demostración') + '</span><span class="live-min" data-live="min">' + liveMinLabel() + '</span></div>' +
      '<button type="button" class="live-body" data-act="match" data-v="__live" aria-label="Abrir partido en vivo: ' + esc(tfull(d.home)) + ' contra ' + esc(tfull(d.away)) + '">' +
        '<span class="live-team">' + crest(d.home, 'md') + '<span>' + esc(tname(d.home)) + '</span></span>' +
        '<span class="live-score" data-live="score" aria-live="polite">' + (L ? L.hs + ' - ' + L.as : '') + '</span>' +
        '<span class="live-team a">' + crest(d.away, 'md') + '<span>' + esc(tname(d.away)) + '</span></span>' +
      '</button>' +
      '<div class="live-last" data-live="last">' + lastEventHtml() + '</div>' +
      '<div class="goal-burst" data-live="burst" aria-hidden="true"></div>' +
      '</section>';
  }

  /* Tabla de liga orientativa: la fila del club usa datos de season; el
     resto se construye de forma determinista (siempre marcada DEMO). */
  function leagueTable() {
    var s = T.season || {};
    var pos = Math.max(1, num(s.leaguePos, 1));
    var played = num(s.played, 0), pts = num(s.points, 0), gd = num(s.gf, 0) - num(s.ga, 0);
    var leagueCode = T.leagueComp;
    var other = null;
    var m = /^(?:¡Líder!\s*)?(.+?),\s*(?:(líder)|(\d+)º)\s+con\s+(\d+)/i.exec(s.leaderNote || '');
    if (m) {
      var nm = m[1].trim(), code = null;
      for (var id in V.teams) if (V.teams[id].name === nm || V.teams[id].short === nm) code = V.teams[id].code;
      if (!code && V.opponents) for (var c in V.opponents) if (V.opponents[c].name === nm) code = c;
      if (code && code !== T.code) other = { code: code, pos: m[2] ? 1 : num(m[3], 1), pts: num(m[4], 0) };
    }
    var seen = {}; seen[T.code] = 1; if (other) seen[other.code] = 1;
    var pool = [];
    fixtures().forEach(function (f) {
      if (leagueCode && f.comp !== leagueCode) return;
      var o = opponentOf(f); if (!seen[o]) { seen[o] = 1; pool.push(o); }
    });
    var rows = Math.max(5, pos + 1), out = [], h = hash(T.id);
    for (var p = 1; p <= rows; p++) {
      if (p === pos) { out.push({ pos: p, code: T.code, pl: played, gd: gd, pts: pts, me: true }); continue; }
      if (other && other.pos === p) { out.push({ pos: p, code: other.code, pl: played, gd: Math.max(gd - 2, 0) + 4 - p, pts: other.pts }); continue; }
      var code2 = pool.length ? pool[(h + p * 7) % pool.length] : 'XXX';
      pool.splice(pool.indexOf(code2), 1);
      var dp = p < pos ? (pos - p) * 2 + ((h >> p) & 1) : -((p - pos) * 2 + ((h >> p) & 1));
      out.push({ pos: p, code: code2, pl: played - ((h >> (p + 3)) & 1), gd: gd + dp * 2 - 1, pts: Math.max(0, pts + dp) });
    }
    // Ordenación coherente: puntos descendentes según posición
    for (var i = 1; i < out.length; i++) if (out[i].pts > out[i - 1].pts) out[i].pts = out[i - 1].pts - (out[i].me ? 0 : 1);
    return out;
  }
  function tableCard() {
    var s = T.season || {};
    if (!s.leaguePos) return '';
    var rows = leagueTable(), lc = compOf(T.leagueComp);
    var zone = function (p) { return p <= 4 ? 'var(--win)' : p <= 6 ? '#e08a00' : 'transparent'; };
    return '<section class="card" aria-labelledby="tblH">' +
      '<div class="card-h"><span class="grow" id="tblH">Clasificación · ' + esc(T.league || lc.name) + '</span>' + demoBadge(true) + '</div>' +
      '<table class="ltable"><thead><tr><th scope="col" style="text-align:center">#</th><th scope="col">Equipo</th><th scope="col">PJ</th><th scope="col">DG</th><th scope="col">Pts</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr class="' + (r.me ? 'me' : '') + '"' + (r.me ? ' aria-current="true"' : '') + '><td class="pos" style="--zone:' + zone(r.pos) + '">' + r.pos + '</td>' +
          '<td class="tm"><span>' + crest(r.code, 'xs') + '<em>' + esc(tname(r.code)) + '</em></span></td>' +
          '<td>' + r.pl + '</td><td>' + (r.gd > 0 ? '+' : '') + r.gd + '</td><td class="pts">' + r.pts + '</td></tr>';
      }).join('') +
      '</tbody></table>' +
      '<div class="card-f">' + esc(s.leaderNote || '') + (s.leaderNote ? ' · ' : '') + 'Fila de ' + esc(T.short || T.name) + ' con datos de la temporada; resto orientativo.</div>' +
      '</section>';
  }
  function recentCard() {
    var ft = finished(fixtures()).slice(-5).reverse();
    if (!ft.length) return '';
    var form = ft.slice().reverse();
    return '<section class="card" aria-labelledby="recH">' +
      '<div class="card-h"><span class="grow" id="recH">Racha y resultados</span><button type="button" class="link" data-act="go" data-v="matches">Ver todos' + icon('i-chev') + '</button></div>' +
      '<div class="form-row" role="list" aria-label="Últimos cinco partidos">' + form.map(function (f) {
        var r = resultOf(f), us = f.home === T.code ? f.hs : f.as, th = f.home === T.code ? f.as : f.hs;
        return '<div class="form-it" role="listitem" aria-label="' + esc(RESL[r] + ' ' + us + '-' + th + ' contra ' + tfull(opponentOf(f))) + '"><span class="res ' + r + '">' + RES[r] + '</span><span class="sc">' + us + '-' + th + '</span><span class="op">' + esc(opponentOf(f)) + '</span></div>';
      }).join('') + '</div>' +
      '<div class="hair" style="border-top:1px solid var(--line)">' + ft.slice(0, 3).map(function (f) { return fxRow(f); }).join('') + '</div>' +
      '</section>';
  }
  function newsCard() {
    var n = arr(T.news);
    if (!n.length) return '';
    return '<section class="card" aria-labelledby="newsH"><div class="card-h"><span class="grow" id="newsH">Lo último</span></div>' +
      '<div class="hair" style="border-top:1px solid var(--line)">' + n.map(function (it) {
        return '<article class="news"><div class="thumb" aria-hidden="true"><span>' + esc(it.icon || '⚽') + '</span></div><div>' +
          '<div class="tg"><span>' + esc(it.tag || 'Noticia') + '</span><span class="dt">' + esc(it.dateLabel || fdate(it.date)) + '</span></div>' +
          '<h3>' + esc(it.title) + '</h3><p>' + esc(it.body || '') + '</p></div></article>';
      }).join('') + '</div>' +
      (T.newsNote ? '<div class="card-f">' + esc(T.newsNote) + '</div>' : '') + '</section>';
  }

  /* ========================================================= MATCHES */
  function seasonsList() {
    var cur = (T.season && T.season.label) || 'Actual', list = [cur];
    arr(T.archive).forEach(function (f) { if (f.season && list.indexOf(f.season) < 0) list.push(f.season); });
    return list;
  }
  function viewMatches() {
    var seasons = seasonsList();
    if (!S.season || seasons.indexOf(S.season) < 0) S.season = seasons[0];
    var current = S.season === seasons[0];
    var list = current ? fixtures() : arr(T.archive).filter(function (f) { return f.season === S.season; });
    var comps = [];
    list.forEach(function (f) { if (comps.indexOf(f.comp) < 0) comps.push(f.comp); });
    if (S.comp !== 'all' && comps.indexOf(S.comp) < 0) S.comp = 'all';
    var shown = list.filter(function (f) { return S.comp === 'all' || f.comp === S.comp; });
    var up = shown.filter(function (f) { return f.status === 'up'; });
    var ft = shown.filter(function (f) { return f.status === 'ft'; }).slice().reverse();
    var lv = shown.filter(function (f) { return f.status === 'live'; });

    var h = '<div class="sticky" style="border-bottom:1px solid var(--line)">' +
      '<div style="display:flex;gap:8px;align-items:center;padding:10px 12px 0">' +
      '<label class="sr" for="seasonSel">Temporada</label>' +
      '<select class="select" id="seasonSel" data-act="season">' + seasons.map(function (s) { return '<option' + (s === S.season ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select>' +
      '<span class="muted small num" style="margin-left:auto">' + shown.length + ' partidos · ' + ft.length + ' jugados</span></div>' +
      '<div class="chips" role="group" aria-label="Filtrar por competición">' +
      chipBtn('comp', 'all', 'Todas', list.length, S.comp === 'all') +
      comps.map(function (c) { var ci = compOf(c); return chipBtn('comp', c, ci.short || ci.name, list.filter(function (f) { return f.comp === c; }).length, S.comp === c, ci.color); }).join('') +
      '</div></div><div class="pad">';

    if (current && T.liveDemo && (S.comp === 'all' || S.comp === 'DEMO')) {
      h += '<section class="card"><div class="card-h"><span class="live-dot" data-live="dot"><span></span>' + (L && L.done ? 'FINAL' : 'EN VIVO') + '</span><span class="grow muted small">Demostración</span></div><div class="hair">' + fxRow(liveFx()) + '</div></section>';
    }
    lv.forEach(function (f) { h += '<section class="card"><div class="hair">' + fxRow(f) + '</div></section>'; });
    if (up.length) h += listCard('Próximos partidos', up);
    if (ft.length) h += listCard('Resultados', ft, true);
    if (!up.length && !ft.length) h += '<section class="card">' + emptyState('Sin partidos', 'No hay partidos para este filtro.') + '</section>';
    h += '</div>';
    return h;
  }
  function chipBtn(act, v, label, n, on, color) {
    return '<button type="button" class="chip" data-act="' + act + '" data-v="' + esc(v) + '" aria-pressed="' + !!on + '"' + (color ? ' style="--cc:' + esc(color) + '"' : '') + '>' + (color ? '<i></i>' : '') + esc(label) + (n != null ? '<span class="n">' + n + '</span>' : '') + '</button>';
  }
  function listCard(title, list, results) {
    var h = '<section class="card"><div class="card-h"><span class="grow">' + esc(title) + '</span><span class="muted small num">' + list.length + '</span></div>';
    var lastMonth = null;
    list.forEach(function (f) {
      var d = pd(f.date), mk = d ? d.getFullYear() + '-' + d.getMonth() : '';
      if (mk !== lastMonth) { h += '<div class="month">' + (d ? MONL[d.getMonth()] + ' ' + d.getFullYear() : 'Sin fecha') + '</div>'; lastMonth = mk; }
      h += '<div class="hair" style="border-top:1px solid var(--line)">' + fxRow(f, { colorPill: results }) + '</div>';
    });
    return h + '</section>';
  }
  function emptyState(title, text, extra) {
    return '<div class="empty"><svg class="ill" viewBox="0 0 112 76" aria-hidden="true"><rect x="2" y="2" width="108" height="72" rx="8" fill="none" stroke="currentColor" stroke-width="2.5" opacity=".35"/><path d="M56 2v72" stroke="currentColor" stroke-width="2" opacity=".35"/><circle cx="56" cy="38" r="12" fill="none" stroke="currentColor" stroke-width="2" opacity=".35"/><rect x="2" y="22" width="16" height="32" fill="none" stroke="currentColor" stroke-width="2" opacity=".35"/><rect x="94" y="22" width="16" height="32" fill="none" stroke="currentColor" stroke-width="2" opacity=".35"/><circle cx="80" cy="52" r="9" fill="var(--card)" stroke="currentColor" stroke-width="2.5"/><path d="M80 47v5l3 2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>' +
      '<h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>' + (extra || '') + '</div>';
  }

  /* =========================================================== MATCH */
  function viewMatch() {
    var f = getFx(S.matchId);
    if (!f) return '<div class="pad"><section class="card">' + emptyState('Partido no encontrado', 'Este partido no existe en los datos del club.', '<button type="button" class="btn" data-act="go" data-v="matches">Ver partidos</button>') + '</section></div>';
    var tabs = f.status === 'up' ? [] : [['ratings', 'Ratings'], ['stats', 'Estadísticas'], ['resumen', 'Resumen']];
    if (tabs.length && !tabs.some(function (t) { return t[0] === S.matchTab; })) S.matchTab = 'ratings';
    var h = '<div id="mhead"></div>';
    if (tabs.length) {
      h += '<div class="stickybar"><div class="ttabs" role="tablist" aria-label="Detalle del partido">' + tabs.map(function (t) {
        var on = S.matchTab === t[0];
        return '<button type="button" class="ttab" role="tab" id="tab-' + t[0] + '" aria-controls="panel" aria-selected="' + on + '" tabindex="' + (on ? 0 : -1) + '" data-act="mtab" data-v="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</div></div>';
    }
    h += '<div id="panel" role="' + (tabs.length ? 'tabpanel' : 'region') + '"' + (tabs.length ? ' aria-labelledby="tab-' + S.matchTab + '"' : ' aria-label="Previa"') + '></div>';
    return h;
  }
  function renderMatchHeader() {
    var el = $('#mhead'); if (!el) return;
    var f = getFx(S.matchId); if (!f) return;
    var det = detailOf(S.matchId);
    var live = f.status === 'live', up = f.status === 'up';
    var score, st;
    if (up) { score = '<div class="big">' + esc(f.time || '--:--') + '</div>'; st = '<span class="st">' + esc(countdown(f.date) || 'Por jugarse') + '</span>'; }
    else if (live) { score = '<div class="big" data-live="score">' + L.hs + ' - ' + L.as + '</div>'; st = '<span class="st live" data-live="min">' + liveMinLabel() + '</span>'; }
    else { score = '<div class="big">' + esc(f.hs) + ' - ' + esc(f.as) + '</div>'; st = '<span class="st">Final</span>'; }
    var goals = { home: [], away: [] };
    if (det) arr(det.events).forEach(function (e) { if (e.type === 'goal' && goals[e.side]) goals[e.side].push((e.player || 'Gol') + " " + e.min + "'"); });
    var hasGoals = goals.home.length || goals.away.length;
    var venue = f.stadium || (f.venue === 'H' && T.stadium ? T.stadium.name : '');
    el.innerHTML = '<section class="mhead" aria-label="Marcador">' +
      '<div class="mh-comp"><span>' + esc(compOf(f.comp).name) + (f.round ? ' · ' + esc(f.round) : '') + '</span></div>' +
      '<div class="mh-comp" style="opacity:.75;margin-top:2px"><span>' + esc(live ? 'Hoy · en directo' : fdate(f.date, true)) + (f.season ? ' · ' + esc(f.season) : '') + '</span></div>' +
      '<div class="mh-row">' +
        '<div class="mh-team">' + crest(f.home, 'lg') + '<span>' + esc(tname(f.home)) + '</span></div>' +
        '<div class="mh-score">' + score + st + '</div>' +
        '<div class="mh-team">' + crest(f.away, 'lg') + '<span>' + esc(tname(f.away)) + '</span></div>' +
      '</div>' +
      (hasGoals ? '<div class="mh-scorers"><div class="h">' + goals.home.map(function (g) { return '<span>' + esc(g) + '</span>'; }).join('') + '</div><div class="mid">' + icon('i-ball') + '</div><div>' + goals.away.map(function (g) { return '<span>' + esc(g) + '</span>'; }).join('') + '</div></div>' : '') +
      (venue ? '<div class="mh-venue">' + icon('i-pin') + esc(venue) + '</div>' : '') +
      '</section>';
  }
  function renderPanel() {
    var el = $('#panel'); if (!el) return;
    var f = getFx(S.matchId); if (!f) return;
    var det = detailOf(S.matchId);
    if (f.status === 'up') { el.innerHTML = previewPanel(f); return; }
    if (S.matchTab === 'ratings') el.innerHTML = ratingsPanel(f, det);
    else if (S.matchTab === 'stats') el.innerHTML = statsPanel(f, det);
    else el.innerHTML = timelinePanel(f, det);
  }
  function noDetail(what) {
    var fm = T.featuredMatch && T.featuredMatch.fixtureId;
    return '<div class="pad"><section class="card">' + emptyState(what + ' no disponibles', 'Este prototipo solo tiene datos detallados de algunos partidos.', fm && fm !== S.matchId ? '<button type="button" class="btn" data-act="match" data-v="' + esc(fm) + '">Ver partido destacado</button>' : '') + '</section></div>';
  }

  function previewPanel(f) {
    var on = !!S.remind[T.id + ':' + f.id];
    var opp = opponentOf(f);
    var all = fixtures().concat(arr(T.archive));
    var h2h = finished(all).filter(function (x) { return opponentOf(x) === opp; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; })[0];
    var last5 = finished(fixtures()).slice(-5);
    var h = '<div class="pad">' +
      '<section class="card">' + emptyState('Partido por jugarse', 'Se juega el ' + fdate(f.date, true) + (f.time ? ' a las ' + f.time : '') + '. Las alineaciones, valoraciones y estadísticas aparecerán cuando empiece.',
        '<button type="button" class="btn ghost" data-act="remind" data-v="' + esc(f.id) + '" aria-pressed="' + on + '">' + icon('i-bell') + (on ? 'Te avisaremos' : 'Avisarme al empezar') + '</button>') + '</section>';
    if (last5.length) {
      h += '<section class="card"><div class="card-h"><span class="grow">Forma de ' + esc(T.short || T.name) + '</span><span class="muted small">últimos ' + last5.length + '</span></div><div class="form-row">' +
        last5.map(function (x) { var r = resultOf(x), us = x.home === T.code ? x.hs : x.as, th = x.home === T.code ? x.as : x.hs; return '<div class="form-it"><span class="res ' + r + '">' + RES[r] + '</span><span class="sc">' + us + '-' + th + '</span><span class="op">' + esc(opponentOf(x)) + '</span></div>'; }).join('') + '</div></section>';
    }
    h += '<section class="card"><div class="card-h"><span class="grow">Datos del partido</span></div><div class="hair" style="border-top:1px solid var(--line)">' +
      kv('Competición', compOf(f.comp).name + (f.round ? ' · ' + f.round : '')) +
      kv('Fecha', fdate(f.date, true)) + kv('Hora', f.time ? f.time + ' (hora peninsular)' : 'Por confirmar') +
      kv('Estadio', f.stadium || (f.venue === 'H' && T.stadium ? T.stadium.name : 'Campo del ' + tname(opp))) + '</div></section>';
    if (h2h) h += '<section class="card"><div class="card-h"><span class="grow">Último enfrentamiento</span></div><div class="hair">' + fxRow(h2h, { colorPill: true }) + '</div></section>';
    return h + '</div>';
  }
  function kv(k, v) { return '<div class="srow"><span class="muted small" style="font-weight:600">' + esc(k) + '</span><span class="small" style="font-weight:700;text-align:right">' + esc(v) + '</span></div>'; }

  /* ---- ratings */
  function rtClass(r) {
    if (r == null || isNaN(r)) return '';
    return r < 5.5 ? 'r1' : r < 6.3 ? 'r2' : r < 6.9 ? 'r3' : r < 7.5 ? 'r4' : r < 8.4 ? 'r5' : 'r6';
  }
  function rtChip(r, big) { return r == null ? '' : '<span class="rt ' + rtClass(r) + (big ? ' big' : '') + '">' + Number(r).toFixed(1) + '</span>'; }
  function allPlayers(det) {
    var out = [];
    ['home', 'away'].forEach(function (side) {
      var lu = det.lineups && det.lineups[side]; if (!lu) return;
      arr(lu.players).forEach(function (p) { out.push(p); });
      arr(lu.bench).forEach(function (p) { if (p.sub || num(p.minutes, 0) > 0) out.push(p); });
    });
    return out;
  }
  function mvpOf(det) {
    var best = null;
    allPlayers(det).forEach(function (p) { if (p.rating != null && (!best || p.rating > best.rating)) best = p; });
    return best;
  }
  function ratingsPanel(f, det) {
    if (!det || !det.lineups || !det.lineups.home || !det.lineups.away) return noDetail('Alineaciones y valoraciones');
    var mvp = mvpOf(det);
    var lh = det.lineups.home, la = det.lineups.away;
    var side = S.side === 'away' ? 'away' : 'home';
    var lu = det.lineups[side], code = side === 'home' ? f.home : f.away;
    var h = '<div style="padding:12px 12px 0"><div class="seg" role="group" aria-label="Equipo">' +
      ['home', 'away'].map(function (s) { var c = s === 'home' ? f.home : f.away; return '<button type="button" data-act="side" data-v="' + s + '" aria-pressed="' + (side === s) + '">' + crest(c, 'xs') + '<span>' + esc(tname(c)) + '</span></button>'; }).join('') +
      '</div></div>';
    h += '<div class="lineup-top"><span>Formación <b>' + esc(lu.formation || '—') + '</b></span><span>' + (lu.coach ? 'Entrenador: <b>' + esc(lu.coach) + '</b>' : '') + '</span></div>';
    h += '<div class="pitch" role="group" aria-label="Alineaciones en el campo. Local abajo, visitante arriba.">' + pitchLines() +
      '<span class="flab t">' + crest(f.away, 'xs') + esc(la.formation || '') + '</span><span class="flab b">' + crest(f.home, 'xs') + esc(lh.formation || '') + '</span>' +
      pitchSide(lh, 'home', f.home, mvp, side) + pitchSide(la, 'away', f.away, mvp, side) + '</div>';
    h += '<div class="scale" aria-hidden="true"><span>Nota</span>' + [5.0, 6.0, 6.6, 7.2, 8.0, 9.0].map(function (r) { return rtChip(r); }).join('') + '<span class="mvp-leg"><i>' + icon('i-star') + '</i>MVP</span></div>';
    if (det.ratingsDemo) h += '<div class="note-strip">' + demoBadge(true) + '<span>Valoraciones y mapas de calor de demostración</span></div>';
    h += '<div class="pad">';
    h += playerListCard('Titulares · ' + tname(code), lu.players, side, 'players', mvp);
    var bench = arr(lu.bench);
    h += bench.length ? playerListCard('Suplentes', bench, side, 'bench', mvp) : '<section class="card"><div class="card-h"><span class="grow">Suplentes</span></div><div class="card-f" style="border:0;padding-top:0">Sin datos de suplentes para este partido.</div></section>';
    if (det.note) h += '<p class="src">' + esc(det.note) + '</p>';
    return h + '</div>';
  }
  function pitchLines() {
    return '<svg class="lines" viewBox="0 0 68 112" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="rgba(255,255,255,.55)" stroke-width=".4">' +
      '<rect x="2" y="2" width="64" height="108"/><path d="M2 56h64"/><circle cx="34" cy="56" r="8"/>' +
      '<rect x="15" y="2" width="38" height="16"/><rect x="25" y="2" width="18" height="6"/><rect x="15" y="94" width="38" height="16"/><rect x="25" y="104" width="18" height="6"/>' +
      '<path d="M27 18a8 8 0 0014 0M27 94a8 8 0 0114 0"/></g><circle cx="34" cy="56" r=".8" fill="rgba(255,255,255,.7)"/></svg>';
  }
  function pitchSide(lu, side, code, mvp, sel) {
    var players = arr(lu.players);
    var maxRow = Math.max.apply(null, players.map(function (p) { return num(p.row, 0); }).concat([1]));
    var k = kitOf(code), striped = isStriped(k);
    return players.map(function (p, i) {
      var row = num(p.row, 0), x = Math.min(1, Math.max(0, num(p.x, 0.5)));
      var top = side === 'home' ? 93 - row * (37 / maxRow) : 7 + row * (37 / maxRow);
      var left = side === 'home' ? 9 + x * 82 : 9 + (1 - x) * 82;
      var evs = '';
      for (var g = 0; g < Math.min(3, num(p.goals, 0)); g++) evs += icon('i-ball');
      for (var a = 0; a < Math.min(2, num(p.assists, 0)); a++) evs += icon('i-boot', 'boot');
      if (p.red) evs += '<i class="card-r"></i>'; else if (p.yellow) evs += '<i class="card-y"></i>';
      var lbl = p.name + (p.num != null ? ', dorsal ' + p.num : '') + (p.rating != null ? ', nota ' + p.rating : '') + (num(p.goals, 0) ? ', ' + p.goals + ' gol' + (p.goals > 1 ? 'es' : '') : '') + (num(p.assists, 0) ? ', ' + p.assists + ' asistencia' + (p.assists > 1 ? 's' : '') : '') + (mvp === p ? ', jugador del partido' : '');
      return '<button type="button" class="pl' + (sel !== side ? ' dim' : '') + '" style="left:' + left.toFixed(1) + '%;top:' + top.toFixed(1) + '%" data-act="player" data-v="' + side + ':players:' + i + '" aria-label="' + esc(lbl) + '">' +
        '<span class="shirt' + (striped ? ' striped' : '') + '" style="' + kitStyle(k) + '"><b>' + esc(p.num != null ? p.num : (p.name || '?').charAt(0)) + '</b>' +
          (p.rating != null ? '<span class="rt ' + rtClass(p.rating) + '">' + Number(p.rating).toFixed(1) + '</span>' : '') +
          (mvp === p ? '<span class="mvp">' + icon('i-star') + '</span>' : '') +
          (evs ? '<span class="evs">' + evs + '</span>' : '') +
          (p.subOut ? '<span class="subo">' + icon('i-down') + '</span>' : '') +
        '</span><span class="nm">' + esc(shortName(p.name)) + '</span></button>';
    }).join('');
  }
  function shortName(n) {
    n = String(n || '');
    if (n.length <= 9) return n;
    var parts = n.split(' ');
    return parts.length > 1 ? parts[parts.length - 1] : n;
  }
  function playerListCard(title, list, side, group, mvp) {
    return '<section class="card"><div class="card-h"><span class="grow">' + esc(title) + '</span><span class="muted small">Nota</span></div><div class="hair" style="border-top:1px solid var(--line)">' +
      arr(list).map(function (p, i) {
        var unused = group === 'bench' && !p.sub && !num(p.minutes, 0);
        var meta = [];
        meta.push(esc(POSL[p.pos] || p.pos || ''));
        if (p.subOut) meta.push('<span class="out" style="display:inline-flex;align-items:center;gap:2px">' + icon('i-down') + esc(p.subOut) + "'</span>");
        if (p.subIn) meta.push('<span class="in" style="display:inline-flex;align-items:center;gap:2px">' + icon('i-up') + esc(p.subIn) + "'</span>");
        if (unused) meta.push('No jugó');
        var ic = '';
        for (var g = 0; g < num(p.goals, 0); g++) ic += icon('i-ball');
        for (var a = 0; a < num(p.assists, 0); a++) ic += '<span style="color:#1d4ed8">' + icon('i-boot') + '</span>';
        if (p.red) ic += '<i style="width:8px;height:11px;border-radius:1.5px;background:#e01e1e;display:inline-block"></i>';
        else if (p.yellow) ic += '<i style="width:8px;height:11px;border-radius:1.5px;background:#f6c400;display:inline-block"></i>';
        if (mvp === p) ic += '<span style="color:#e0a800">' + icon('i-star') + '</span>';
        return '<button type="button" class="prow" data-act="player" data-v="' + side + ':' + group + ':' + i + '"' + (unused ? ' style="opacity:.6"' : '') + '>' +
          '<span class="no">' + esc(p.num != null ? p.num : '–') + '</span>' +
          '<span class="who"><b>' + esc(p.name) + '</b><small>' + meta.join('<span aria-hidden="true">·</span>') + (ic ? '<span class="icons">' + ic + '</span>' : '') + '</small></span>' +
          (p.rating != null ? rtChip(p.rating) : '<span class="muted small">–</span>') + '</button>';
      }).join('') + '</div></section>';
  }

  /* ---- player sheet + heatmap */
  function openPlayer(ref) {
    var f = getFx(S.matchId), det = detailOf(S.matchId);
    if (!f || !det || !det.lineups) return;
    var p3 = ref.split(':'), side = p3[0], group = p3[1], idx = +p3[2];
    var lu = det.lineups[side]; if (!lu) return;
    var p = arr(lu[group])[idx]; if (!p) return;
    var code = side === 'home' ? f.home : f.away, k = kitOf(code);
    var mvp = mvpOf(det) === p;
    var cards = p.red ? 'Roja' : p.yellow ? 'Amarilla' : '0';
    var heat = (det.playerHeat && det.playerHeat[p.name]) || genHeat(p, lu);
    var demoHeat = !(det.playerHeat && det.playerHeat[p.name]);
    var html = '<div class="grab" aria-hidden="true"></div>' +
      '<div class="p-head"><span class="shirt' + (isStriped(k) ? ' striped' : '') + '" style="' + kitStyle(k) + '"><b>' + esc(p.num != null ? p.num : (p.name || '?').charAt(0)) + '</b></span>' +
      '<div><h2 id="sheetTitle">' + esc(p.name) + (mvp ? icon('i-star') : '') + '</h2><small>' + esc((POSL[p.pos] || p.pos || '') + ' · ' + tfull(code)) + (mvp ? ' · Jugador del partido' : '') + '</small></div>' +
      (p.rating != null ? rtChip(p.rating, true) : '') + '</div>' +
      '<div class="p-stats"><div><b>' + esc(num(p.minutes, 0)) + "'</b><small>Minutos</small></div><div><b>" + esc(num(p.goals, 0)) + '</b><small>Goles</small></div><div><b>' + esc(num(p.assists, 0)) + '</b><small>Asist.</small></div><div><b style="font-size:15px;line-height:23px">' + cards + '</b><small>Tarjeta</small></div></div>' +
      ((p.subIn || p.subOut) ? '<div class="p-sub">' + (p.subIn ? '<span class="in" style="color:var(--win)">' + icon('i-up') + 'Entró en el ' + esc(p.subIn) + "'</span>" : '') + (p.subOut ? '<span style="color:var(--loss)">' + icon('i-down') + 'Salió en el ' + esc(p.subOut) + "'</span>" : '') + '</div>' : '') +
      '<div class="heat"><h3>Mapa de calor ' + (demoHeat || det.ratingsDemo ? demoBadge(true) : '') + '</h3><canvas id="heatCv" role="img" aria-label="Mapa de calor de ' + esc(p.name) + ': zonas del campo por las que más se movió"></canvas>' +
      '<div class="dir"><span>Propia portería</span><span>Ataca →</span></div></div>' +
      '<div style="padding:12px 14px 0"><button type="button" class="btn ghost" style="width:100%" data-act="close">Cerrar</button></div>';
    openSheet(html);
    drawHeat($('#heatCv'), heat);
  }
  function genHeat(p, lu) {
    var maxRow = Math.max.apply(null, arr(lu.players).map(function (q) { return num(q.row, 0); }).concat([1]));
    var row = p.row != null ? num(p.row, 0) : ({ GK: 0, DEF: 1, MID: 2, FWD: 3 }[p.pos] || 2) * maxRow / 3;
    var cx = p.pos === 'GK' ? 0.07 : 0.14 + (row / maxRow) * 0.66, cy = p.x != null ? num(p.x, 0.5) : 0.5;
    var s = hash(p.name || 'x') % 233280, out = [];
    function r() { s = (s * 9301 + 49297) % 233280; return s / 233280; }
    var n = p.pos === 'GK' ? 18 : 36;
    for (var i = 0; i < n; i++) {
      var sx = p.pos === 'GK' ? 0.08 : 0.22, sy = p.pos === 'GK' ? 0.2 : 0.24;
      out.push([Math.max(0.02, Math.min(0.98, cx + (r() + r() + r() - 1.5) * sx)), Math.max(0.03, Math.min(0.97, cy + (r() + r() + r() - 1.5) * sy)), 0.35 + r() * 0.65]);
    }
    return out;
  }
  function drawHeat(cv, pts) {
    if (!cv || !cv.getContext) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = cv.clientWidth || 320, H = Math.round(W * 68 / 105);
    cv.width = W * dpr; cv.height = H * dpr;
    var ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    // césped
    for (var i = 0; i < 10; i++) { ctx.fillStyle = i % 2 ? '#2a7d43' : '#2f8a4a'; ctx.fillRect(i * W / 10, 0, W / 10 + 1, H); }
    // intensidad
    var off = document.createElement('canvas'); off.width = W; off.height = H;
    var o = off.getContext('2d'), rad = W * 0.085;
    arr(pts).forEach(function (pt) {
      var x = num(pt[0], .5) * W, y = num(pt[1], .5) * H, a = num(pt[2], .6);
      var g = o.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, 'rgba(0,0,0,' + (0.32 * a) + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
      o.fillStyle = g; o.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    });
    var img = o.getImageData(0, 0, W, H), d = img.data;
    for (var j = 0; j < d.length; j += 4) {
      var v = Math.min(1, d[j + 3] / 200);
      if (v < 0.04) { d[j + 3] = 0; continue; }
      var c = v < .35 ? [80, 220, 90] : v < .6 ? [250, 220, 50] : v < .8 ? [250, 140, 30] : [235, 50, 40];
      d[j] = c[0]; d[j + 1] = c[1]; d[j + 2] = c[2]; d[j + 3] = Math.round(Math.min(.85, .25 + v * .75) * 255);
    }
    o.putImageData(img, 0, 0);
    ctx.drawImage(off, 0, 0);
    // líneas
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.2;
    var m = 4; ctx.strokeRect(m, m, W - 2 * m, H - 2 * m);
    ctx.beginPath(); ctx.moveTo(W / 2, m); ctx.lineTo(W / 2, H - m); ctx.stroke();
    ctx.beginPath(); ctx.arc(W / 2, H / 2, H * 0.135, 0, Math.PI * 2); ctx.stroke();
    var bw = W * 0.157, bh = H * 0.59, sw = W * 0.052, sh = H * 0.27;
    ctx.strokeRect(m, (H - bh) / 2, bw, bh); ctx.strokeRect(W - m - bw, (H - bh) / 2, bw, bh);
    ctx.strokeRect(m, (H - sh) / 2, sw, sh); ctx.strokeRect(W - m - sw, (H - sh) / 2, sw, sh);
  }

  /* ---- stats */
  function statsPanel(f, det) {
    if (!det || !arr(det.stats).length) return noDetail('Estadísticas');
    var usHome = f.home === T.code, usAway = f.away === T.code;
    var h = '<div class="pad"><section class="card"><div class="legend"><span>' + crest(f.home, 'xs') + esc(tname(f.home)) + '</span><span>' + esc(tname(f.away)) + crest(f.away, 'xs') + '</span></div>' +
      '<div class="hair">' + arr(det.stats).map(function (s) {
        var lbl = s[0], hv = num(s[1], 0), av = num(s[2], 0), tot = hv + av || 1;
        var pct = /posesi/i.test(lbl) ? '%' : '';
        var hCls = usHome ? 'us' : 'rv', aCls = usAway ? 'us' : 'rv';
        return '<div class="stat"><div class="stat-top"><span class="stat-v h ' + (hv > av ? 'lead ' : '') + (usHome ? '' : 'rv') + '">' + esc(s[1]) + pct + '</span><span class="l">' + esc(lbl) + '</span><span class="stat-v a ' + (av > hv ? 'lead ' : '') + (usAway ? 'us' : '') + '">' + esc(s[2]) + pct + '</span></div>' +
          '<div class="bars" aria-hidden="true"><span class="h"><i class="' + hCls + '" style="width:' + (hv / tot * 100).toFixed(1) + '%"></i></span><span class="a"><i class="' + aCls + '" style="width:' + (av / tot * 100).toFixed(1) + '%"></i></span></div></div>';
      }).join('') + '</div></section>';
    if (det.live) h += '<p class="src">Estadísticas de demostración del partido en vivo.</p>';
    return h + '</div>';
  }

  /* ---- timeline */
  function evTitle(ev) {
    if (ev.type === 'goal') return ev.player || 'Gol';
    if (ev.type === 'sub') return ev.player || 'Cambio';
    return ev.player || ({ yellow: 'Tarjeta amarilla', red: 'Tarjeta roja', var: 'Revisión VAR', pen_save: 'Penalti parado' }[ev.type] || 'Incidencia');
  }
  function evSub(ev) {
    if (ev.type === 'goal') return ev.assist ? 'Asist. ' + ev.assist : (ev.detail || 'Gol');
    if (ev.type === 'sub') return ev.playerOut ? 'Sale ' + ev.playerOut : (ev.detail || 'Cambio');
    if (ev.type === 'yellow' && !ev.detail) return 'Tarjeta amarilla';
    if (ev.type === 'red' && !ev.detail) return 'Tarjeta roja';
    return ev.detail || '';
  }
  function evIcon(ev) {
    var t = ev.type, inner;
    if (t === 'goal') inner = icon('i-ball');
    else if (t === 'yellow') inner = '<i class="cd"></i>';
    else if (t === 'red') inner = '<i class="cd r"></i>';
    else if (t === 'sub') inner = '<span style="display:flex;flex-direction:column;line-height:0"><span style="color:var(--win)">' + icon('i-up') + '</span></span>';
    else if (t === 'var') inner = '<span class="var">VAR</span>';
    else if (t === 'pen_save') inner = '<span class="var" style="border-radius:50%">P</span>';
    else inner = '<span class="var">•</span>';
    return '<span class="ico" aria-hidden="true">' + inner + '</span>';
  }
  var EVL = { goal: 'Gol', yellow: 'Amarilla', red: 'Roja', sub: 'Cambio', var: 'VAR', pen_save: 'Penalti parado' };
  function timelinePanel(f, det) {
    if (!det || !arr(det.events).length) {
      if (f.status === 'ft') return '<div class="pad"><section class="card">' + emptyState('Final: ' + tname(f.home) + ' ' + f.hs + ' - ' + f.as + ' ' + tname(f.away), 'No hay cronología de incidencias para este partido en el prototipo.') + '</section></div>';
      return noDetail('Incidencias');
    }
    var evs = arr(det.events).map(function (e, i) { return { e: e, i: i }; }).sort(function (a, b) { return minNum(a.e.min) - minNum(b.e.min) || a.i - b.i; });
    var hs = 0, as = 0, htDone = false, rows = [];
    var live = f.status === 'live';
    var fresh = live && L ? L.fresh : null;
    evs.forEach(function (o) {
      var e = o.e;
      if (!htDone && minNum(e.min) > 45.99) { rows.push('<div class="tl-mark"><span>Descanso · ' + hs + ' - ' + as + '</span></div>'); htDone = true; }
      if (e.type === 'goal') { if (e.side === 'home') hs++; else as++; }
      var side = e.side === 'away' ? 'a' : 'h';
      var aria = e.min + "'. " + (EVL[e.type] || '') + ' de ' + tname(e.side === 'away' ? f.away : f.home) + ': ' + evTitle(e) + '. ' + evSub(e);
      rows.push('<div class="ev ' + esc(e.type) + (e === fresh ? ' new' : '') + '" role="listitem" aria-label="' + esc(aria) + '"><span class="min">' + esc(e.min) + "'</span>" +
        '<div class="side ' + side + '">' + evIcon(e) + '<div class="txt"><b>' + esc(evTitle(e)) + (e.type === 'goal' ? ' <span class="sc">(' + hs + '-' + as + ')</span>' : '') + '</b><small>' + esc(evSub(e)) + '</small></div></div></div>');
    });
    if (!htDone && (!live || (L && L.min > 45))) rows.push('<div class="tl-mark"><span>Descanso · ' + hs + ' - ' + as + '</span></div>');
    var endLbl = live ? (L && L.done ? 'Final · ' : 'En juego · ') + (L ? L.hs + ' - ' + L.as : '') : 'Final · ' + f.hs + ' - ' + f.as;
    rows.reverse();
    return '<div class="pad"><section class="card"><div class="legend"><span>' + crest(f.home, 'xs') + esc(tname(f.home)) + '</span><span>' + esc(tname(f.away)) + crest(f.away, 'xs') + '</span></div>' +
      '<div class="tl" role="list" aria-label="Cronología, del final al inicio"><div class="tl-mark"><span>' + esc(endLbl) + '</span></div>' + rows.join('') + '<div class="tl-mark"><span>Inicio</span></div></div></section>' +
      (det.note ? '<p class="src">' + esc(det.note) + '</p>' : '') + '</div>';
  }

  /* ========================================================== SEASON */
  function viewSeason() {
    var s = T.season || {};
    var lc = compOf(T.leagueComp);
    var h = '<div class="band"></div><div class="pad" style="padding-bottom:0"><section class="card">' +
      '<div class="s-hero"><div class="s-pos"><b>' + esc(s.leaguePos || '–') + 'º</b><small>' + esc((lc.short || '').toUpperCase()) + '</small></div>' +
      '<div><h2>' + esc(T.league || lc.name) + ' ' + esc(s.label || '') + (s.isDemo ? demoBadge() : '') + '</h2><p>' + esc(s.leaderNote || '') + '</p></div></div>' +
      '<div class="kpis"><div class="kpi"><b>' + num(s.points) + '</b><small>Puntos</small></div><div class="kpi"><b>' + num(s.played) + '</b><small>Jugados</small></div><div class="kpi"><b>' + num(s.gf) + '</b><small>A favor</small></div><div class="kpi"><b>' + num(s.ga) + '</b><small>En contra</small></div></div>' +
      '</section></div>';
    var tabs = [['resumen', 'Resumen'], ['resultados', 'Resultados'], ['plantilla', 'Plantilla']];
    h += '<div class="stickybar" style="margin-top:12px"><div class="ttabs" role="tablist" aria-label="Temporada">' + tabs.map(function (t) {
      var on = S.seasonTab === t[0];
      return '<button type="button" class="ttab" role="tab" id="stab-' + t[0] + '" aria-selected="' + on + '" tabindex="' + (on ? 0 : -1) + '" aria-controls="spanel" data-act="stab" data-v="' + t[0] + '">' + t[1] + '</button>';
    }).join('') + '</div></div><div id="spanel" role="tabpanel" aria-labelledby="stab-' + S.seasonTab + '">' + seasonPanel() + '</div>';
    return h;
  }
  function seasonPanel() {
    if (S.seasonTab === 'resultados') return seasonResults();
    if (S.seasonTab === 'plantilla') return seasonSquad();
    return seasonSummary();
  }
  function seasonSummary() {
    var s = T.season || {};
    var scope = S.seasonScope === 'all' && s.allComps ? s.allComps : s;
    var w = num(scope.w), d = num(scope.d), l = num(scope.l), pj = num(scope.played) || (w + d + l) || 1;
    var gf = num(scope.gf), ga = num(scope.ga);
    var ft = finished(fixtures());
    var cs = ft.filter(function (f) { return (f.home === T.code ? f.as : f.hs) === 0; });
    var csN = S.seasonScope === 'all' ? cs.length : cs.filter(function (f) { return f.comp === T.leagueComp; }).length;
    var h = '<div class="pad">';
    h += '<section class="card"><div class="card-h"><span class="grow">Balance</span></div><div style="padding:0 14px 10px"><div class="seg" role="group" aria-label="Ámbito">' +
      '<button type="button" data-act="scope" data-v="liga" aria-pressed="' + (S.seasonScope !== 'all') + '">' + esc(T.league || 'Liga') + '</button>' +
      '<button type="button" data-act="scope" data-v="all" aria-pressed="' + (S.seasonScope === 'all') + '"' + (s.allComps ? '' : ' disabled') + '>Todas</button></div></div>' +
      '<div class="wdl"><div class="wdl-bar" role="img" aria-label="' + w + ' victorias, ' + d + ' empates, ' + l + ' derrotas"><i style="flex:' + w + ';background:var(--win)"></i><i style="flex:' + d + ';background:var(--draw)"></i><i style="flex:' + l + ';background:var(--loss)"></i></div>' +
      '<div class="wdl-leg"><span><i style="background:var(--win)"></i>Victorias <b>' + w + '</b></span><span><i style="background:var(--draw)"></i>Empates <b>' + d + '</b></span><span><i style="background:var(--loss)"></i>Derrotas <b>' + l + '</b></span></div></div>' +
      '<div class="mini-grid"><div><b>' + num(scope.played) + '</b><small>Partidos</small></div><div><b>' + (gf - ga > 0 ? '+' : '') + (gf - ga) + '</b><small>Dif. goles</small></div><div><b>' + (gf / pj).toFixed(1) + '</b><small>Goles/partido</small></div></div>' +
      '<div class="mini-grid"><div><b>' + Math.round(w / pj * 100) + '%</b><small>% victorias</small></div><div><b>' + csN + '</b><small>Porterías a cero</small></div><div><b>' + (ga / pj).toFixed(1) + '</b><small>Encajados/part.</small></div></div>' +
      '</section>';
    var last = ft.slice(-5);
    var form = arr(s.form);
    if (last.length || form.length) {
      h += '<section class="card"><div class="card-h"><span class="grow">Racha · últimos 5</span><span class="muted small">más antiguo → reciente</span></div><div class="form-row">' +
        (last.length ? last.map(function (f) {
          var r = resultOf(f), us = f.home === T.code ? f.hs : f.as, th = f.home === T.code ? f.as : f.hs;
          return '<button type="button" class="form-it" data-act="match" data-v="' + esc(f.id) + '" aria-label="' + esc(RESL[r] + ' ' + us + '-' + th + ' contra ' + tfull(opponentOf(f))) + '"><span class="res ' + r + '">' + RES[r] + '</span><span class="sc">' + us + '-' + th + '</span><span class="op">' + esc(opponentOf(f)) + '</span></button>';
        }).join('') : form.map(function (r) { return '<div class="form-it"><span class="res ' + r + '">' + RES[r] + '</span></div>'; }).join('')) + '</div></section>';
    }
    var comps = arr(s.competitions);
    if (comps.length) {
      h += '<section class="card"><div class="card-h"><span class="grow">Competiciones</span></div><div class="hair" style="border-top:1px solid var(--line)">' + comps.map(function (c) {
        var info = null, ab = null; for (var k in V.comps) if (V.comps[k].name === c.name) { info = V.comps[k]; ab = k; }
        if (!ab) ab = String(c.name || '').replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ ]/g, '').split(' ').map(function (w2) { return w2.charAt(0); }).join('').slice(0, 3).toUpperCase();
        return '<div class="crow"><span class="cico" style="--cc:' + esc(info ? info.color : '#5a6b7d') + '" aria-hidden="true">' + esc(ab) + '</span><div><b>' + esc(c.name) + '</b><small>' + esc(c.status || '') + '</small></div><span class="state ' + (c.state === 'run' ? 'run' : 'up') + '">' + (c.state === 'run' ? 'En juego' : 'Próximamente') + '</span></div>';
      }).join('') + '</div></section>';
    }
    if (s.source) h += '<p class="src">' + esc(s.source) + '</p>';
    return h + '</div>';
  }
  function seasonResults() {
    var ft = finished(fixtures());
    var comps = [];
    ft.forEach(function (f) { if (comps.indexOf(f.comp) < 0) comps.push(f.comp); });
    if (S.comp !== 'all' && comps.indexOf(S.comp) < 0) S.comp = 'all';
    var list = ft.filter(function (f) { return S.comp === 'all' || f.comp === S.comp; }).reverse();
    var h = '<div class="chips" role="group" aria-label="Filtrar por competición">' + chipBtn('comp', 'all', 'Todas', ft.length, S.comp === 'all') +
      comps.map(function (c) { var ci = compOf(c); return chipBtn('comp', c, ci.short || ci.name, ft.filter(function (f) { return f.comp === c; }).length, S.comp === c, ci.color); }).join('') + '</div>';
    h += '<div class="pad top0">' + (list.length ? listCard('Resultados ' + ((T.season && T.season.label) || ''), list, true) : '<section class="card">' + emptyState('Sin resultados', 'Todavía no se ha jugado ningún partido.') + '</section>') + '</div>';
    return h;
  }
  function seasonSquad() {
    var sq = arr(T.squad);
    if (!sq.length) return '<div class="pad"><section class="card">' + emptyState('Plantilla no disponible', 'No hay datos de plantilla para este club.') + '</section></div>';
    var groups = ['POR', 'DEF', 'MED', 'DEL'], h = '<div class="pad">';
    groups.concat(sq.map(function (p) { return p.pos; }).filter(function (p, i, a) { return groups.indexOf(p) < 0 && a.indexOf(p) === i; })).forEach(function (g) {
      var ps = sq.filter(function (p) { return p.pos === g; });
      if (!ps.length) return;
      h += '<section class="card"><div class="card-h"><span class="grow">' + esc(POSL[g] || g) + '</span><span class="muted small num">' + ps.length + '</span></div><div class="hair" style="border-top:1px solid var(--line)">' +
        ps.map(function (p) { return '<div class="squad-row"><span class="no">' + esc(p.num != null ? p.num : '–') + '</span><b>' + esc(p.name) + '</b>' + (p.nat ? '<span class="nat" title="Nacionalidad">' + esc(p.nat) + '</span>' : '<span></span>') + '</div>'; }).join('') + '</div></section>';
    });
    if (T.squadNote) h += '<p class="src">' + esc(T.squadNote) + '</p>';
    return h + '</div>';
  }

  /* ========================================================= HISTORY */
  function hkey(id) { return T.id + ':' + id; }
  function viewHistory() {
    var cats = arr(T.historyCategories);
    if (!cats.length) cats = [['all', 'Todo']];
    var valid = S.histCat === 'saved' || cats.some(function (c) { return c[0] === S.histCat; });
    if (!valid) S.histCat = 'all';
    var items = arr(T.history).filter(function (it) {
      if (S.histCat === 'all') return true;
      if (S.histCat === 'saved') return !!S.saves[hkey(it.id)];
      return it.cat === S.histCat || arr(it.cats).indexOf(S.histCat) >= 0;
    });
    var savedN = arr(T.history).filter(function (it) { return S.saves[hkey(it.id)]; }).length;
    var h = '<div class="hbar"><div class="chips" role="group" aria-label="Categorías">' +
      cats.map(function (c) { return chipBtn('hcat', c[0], c[1], null, S.histCat === c[0]); }).join('') +
      chipBtn('hcat', 'saved', '🔖 Guardados', savedN, S.histCat === 'saved') + '</div></div>';
    h += '<div class="feed" id="feed" tabindex="0" aria-label="Historias del club. Desliza o usa las flechas para avanzar.">';
    if (!items.length) {
      h += '<div class="story cw-dark" style="grid-template-columns:1fr"><div class="st-body" style="align-items:center;text-align:center;padding-right:22px">' +
        '<div class="st-badge" style="align-self:center">' + icon('i-save') + '</div><h2>' + (S.histCat === 'saved' ? 'Aún no has guardado historias' : 'Sin historias') + '</h2>' +
        '<p class="subt">' + (S.histCat === 'saved' ? 'Pulsa el marcador en cualquier historia para encontrarla aquí.' : 'No hay historias en esta categoría.') + '</p>' +
        '<button type="button" class="btn st-cta" style="align-self:center" data-act="hcat" data-v="all">Ver todas</button></div></div>';
    }
    items.forEach(function (it, i) { h += storyCard(it, i, items.length); });
    return h + '</div>';
  }
  function storyCard(it, i, n) {
    var liked = !!S.likes[hkey(it.id)], saved = !!S.saves[hkey(it.id)];
    var likes = 120 + hash(T.id + it.id) % 4800 + (liked ? 1 : 0);
    var cw = { accent: 'cw-accent', dark: 'cw-dark' }[it.colorway] || 'cw-primary';
    var b = '<article class="story ' + cw + '" aria-roledescription="historia" aria-label="' + esc((i + 1) + ' de ' + n + ': ' + it.title) + '">' +
      '<div class="art" aria-hidden="true"><span class="stripe"></span><span class="ghost">' + esc(it.badge || T.monogram) + '</span>' +
      '<svg viewBox="0 0 100 100"><g fill="none" stroke="currentColor" stroke-width="2"><circle cx="50" cy="50" r="46"/><circle cx="50" cy="50" r="30"/><circle cx="50" cy="50" r="14"/><path d="M4 50h92M50 4v92"/></g></svg></div>' +
      '<div class="st-body">' +
      '<div class="st-kicker"><span>' + esc(it.kicker || '') + '</span></div>' +
      (it.badge ? '<div class="st-badge">' + esc(it.badge) + '</div>' : '') +
      '<h2>' + esc(it.title) + '</h2>' + (it.subtitle ? '<p class="subt">' + esc(it.subtitle) + '</p>' : '');
    if (it.score) {
      var sc = it.score;
      b += '<div class="st-score"><div class="row"><span>' + esc(sc.home) + '</span><span class="pill">' + esc(sc.hs) + '<i>-</i>' + esc(sc.as) + '</span><span>' + esc(sc.away) + '</span></div>' + (sc.caption ? '<div class="cap">' + esc(sc.caption) + '</div>' : '') + '</div>';
    }
    if (arr(it.grid).length) b += '<div class="st-grid">' + it.grid.map(function (g) { return '<div><b>' + esc(g.value) + '</b><small>' + esc(g.label) + '</small></div>'; }).join('') + '</div>';
    if (arr(it.bullets).length) b += '<ul>' + it.bullets.map(function (x) { return '<li><span>' + richB(x) + '</span></li>'; }).join('') + '</ul>';
    if (it.fact) b += '<div class="st-fact"><b>¿Sabías que…?</b>' + esc(it.fact) + '</div>';
    if (it.fixtureId && getFx(it.fixtureId)) b += '<button type="button" class="btn st-cta" data-act="match" data-v="' + esc(it.fixtureId) + '">Ver partido' + icon('i-chev') + '</button>';
    b += '</div><div class="st-rail">' +
      '<button type="button" class="st-act" data-act="like" data-v="' + esc(it.id) + '" aria-pressed="' + liked + '" aria-label="Me gusta"><span class="c">' + icon('i-heart') + '</span><span class="num">' + fmtK(likes) + '</span></button>' +
      '<button type="button" class="st-act" data-act="save" data-v="' + esc(it.id) + '" aria-pressed="' + saved + '" aria-label="Guardar"><span class="c">' + icon('i-save') + '</span><span>' + (saved ? 'Guardado' : 'Guardar') + '</span></button>' +
      '<button type="button" class="st-act" data-act="share" data-v="' + esc(it.id) + '" aria-label="Compartir"><span class="c">' + icon('i-share') + '</span><span>Compartir</span></button>' +
      '<span class="st-count" aria-hidden="true">' + (i + 1) + '/' + n + '</span></div></article>';
    return b;
  }
  function fmtK(n) { return n >= 1000 ? (n / 1000).toFixed(1).replace('.', ',') + ' mil' : String(n); }

  /* ============================================================ MORE */
  function viewMore() {
    var st = T.stadium || {};
    var h = '<div class="band"></div><div class="pad">' +
      '<section class="card"><div class="club-card">' + crest(T.code, 'xl') + '<div><h2>' + esc(T.name) + '</h2><p class="motto">«' + esc(T.motto || '') + '»</p><p>' + esc((T.league || '') + (T.country ? ' · ' + T.country : '')) + '</p></div></div>' +
      '<div class="facts"><div><small>Fundado</small><b class="num">' + esc(T.founded || '—') + '</b></div><div><small>Entrenador</small><b>' + esc(T.coach || '—') + '</b></div>' +
      '<div><small>Estadio</small><b>' + esc(st.name || '—') + '</b></div><div><small>Ciudad · aforo</small><b class="num">' + esc(st.city || '') + (st.capacity ? ' · ' + Number(st.capacity).toLocaleString('es-ES') : '') + '</b></div></div>' +
      (st.capacityNote || T.coachNote ? '<div class="card-f">' + esc([st.capacityNote, T.coachNote].filter(Boolean).join(' · ')) + '</div>' : '') + '</section>';
    var hon = arr(T.honours);
    if (hon.length) {
      h += '<section class="card"><div class="card-h"><span class="grow">Palmarés</span></div><div class="hon">' + hon.map(function (x) { return '<div><b>' + esc(x.count) + '</b><small>' + esc(x.label) + '</small></div>'; }).join('') + '</div>' + (T.honoursNote ? '<div class="card-f">' + esc(T.honoursNote) + '</div>' : '') + '</section>';
    }
    h += '<div class="section-label">Club</div><section class="card"><div class="hair">' +
      '<button type="button" class="srow" data-act="teams" aria-haspopup="dialog"><span><b>Equipo favorito</b><small>Cambia el club y todo se adapta</small></span><span class="end">' + crest(T.code, 'xs') + esc(T.short || T.name) + icon('i-chev') + '</span></button>' +
      '</div></section>';
    h += '<div class="section-label" id="ajustes">Ajustes</div><section class="card"><div class="hair">' +
      switchRow('notif', 'Notificaciones', 'Avisos de partidos y noticias', S.notif) +
      switchRow('goals', 'Alertas de gol', 'Aviso en pantalla durante el partido en vivo', S.goals) +
      switchRow('dark', 'Modo oscuro', 'Interfaz oscura para la noche', !!S.dark) +
      '</div></section>';
    h += '<div class="section-label">Acerca de</div><section class="card"><div class="hair">' +
      '<div class="srow"><span><b>vic-fut · Matchday</b><small>Prototipo B · datos ' + esc((T.season && T.season.label) || '') + '</small></span><span class="end">' + (T.season && T.season.isDemo ? demoBadge(true) : '') + '</span></div>' +
      (T.season && T.season.source ? '<div class="srow"><span><b>Fuente de datos</b><small>' + esc(T.season.source) + '</small></span></div>' : '') +
      '<div class="srow"><span><b>Sin escudos oficiales</b><small>Cada club se muestra con su monograma y sus colores. Ilustraciones originales.</small></span></div>' +
      '</div></section>';
    h += '<p class="credit">Inspirado en patrones de FotMob, Premier League y DAZN (vía Mobbin)</p></div>';
    return h;
  }
  function switchRow(key, title, sub, on) {
    return '<button type="button" class="srow" role="switch" aria-checked="' + !!on + '" data-act="toggle" data-v="' + key + '"><span><b>' + esc(title) + '</b><small>' + esc(sub) + '</small></span><span class="switch" aria-hidden="true"></span></button>';
  }

  /* ========================================================== SHEETS */
  var lastFocus = null;
  function openSheet(html) {
    var sh = $('#sheet'), sc = $('#scrim');
    lastFocus = document.activeElement;
    sh.innerHTML = html;
    sh.hidden = false; sc.hidden = false;
    setTimeout(function () { var b = sh.querySelector('[aria-checked="true"], button'); (b || sh).focus(); }, 30);
  }
  function closeSheet(silent) {
    var sh = $('#sheet'), sc = $('#scrim');
    if (sh.hidden) return;
    sh.hidden = true; sc.hidden = true; sh.innerHTML = '';
    if (!silent && lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }
  function openTeams() {
    var html = '<div class="grab" aria-hidden="true"></div><div class="sheet-h"><h2 id="sheetTitle">Elige tu club</h2><button type="button" class="icon-btn" data-act="close" aria-label="Cerrar">×</button></div>' +
      '<div class="hair" role="radiogroup" aria-labelledby="sheetTitle" style="border-top:1px solid var(--line)">' + arr(V.order).filter(function (id) { return V.teams[id]; }).map(function (id) {
        var t = V.teams[id], c = t.colors || {}, k = t.kit || {}, on = T.id === id;
        var m = t.monogram || t.code;
        return '<button type="button" class="club-opt" role="radio" aria-checked="' + on + '" data-act="team" data-v="' + esc(id) + '">' +
          '<span class="crest md' + (m.length >= 3 ? ' m3' : '') + (isStriped(k) ? ' striped' : '') + '" style="' + kitStyle({ bg: k.bg || c.primary, fg: k.fg || c.onPrimary, ring: k.ring || c.accent }) + '" aria-hidden="true"><b>' + esc(m) + '</b></span>' +
          '<span><b>' + esc(t.name) + '</b><small>' + esc((t.league || '') + (t.stadium && t.stadium.name ? ' · ' + t.stadium.name : '')) + '</small>' +
          '<span class="sw" aria-hidden="true"><i style="background:' + esc(c.primary) + '"></i><i style="background:' + esc(c.accent) + '"></i><i style="background:' + esc(c.primaryDark || c.primary) + '"></i></span></span>' +
          '<span class="ok" aria-hidden="true">' + icon('i-check') + '</span></button>';
      }).join('') + '</div>' +
      '<p class="src" style="padding:10px 14px 0">El cambio se aplica a colores, datos, historia y ajustes del club.</p>';
    openSheet(html);
  }

  /* ----------------------------------------------------------- toast */
  var toastT = null;
  function toast(msg) {
    var el = $('#toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('show'); }, 2400);
  }

  /* ========================================================== RENDER */
  var VIEWS = { home: viewHome, matches: viewMatches, match: viewMatch, season: viewSeason, history: viewHistory, more: viewMore };
  function render(resetScroll) {
    if (SCREENS.indexOf(S.screen) < 0) S.screen = 'home';
    renderBar();
    view.className = 'view v-' + S.screen + (reduced() ? '' : ' enter');
    view.innerHTML = VIEWS[S.screen]();
    if (S.screen === 'match') { renderMatchHeader(); renderPanel(); }
    if (resetScroll !== false) view.scrollTop = 0;
    var navScreen = S.screen === 'match' ? S.back : S.screen;
    $$('#tabbar .tab').forEach(function (b) {
      if (b.getAttribute('data-v') === navScreen) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    setTimeout(function () { view.classList.remove('enter'); }, 400);
    syncUrl();
  }
  function go(screen) {
    if (SCREENS.indexOf(screen) < 0 || screen === 'match') return;
    if (screen === S.screen) { view.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' }); var fd = $('#feed'); if (fd) fd.scrollTop = 0; return; }
    if (screen === 'matches' || screen === 'season') S.comp = 'all';
    S.screen = screen;
    render();
  }
  function openMatch(id) {
    if (S.screen !== 'match') S.back = S.screen;
    S.matchId = id;
    var f = getFx(id);
    S.matchTab = id === '__live' ? 'resumen' : 'ratings';
    S.side = f && f.away === T.code ? 'away' : 'home';
    S.screen = 'match';
    closeSheet(true);
    render();
    var hd = $('#appbar .icon-btn'); if (hd) hd.focus({ preventScroll: true });
  }

  /* ========================================================= EVENTS */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    var act = el.getAttribute('data-act'), v = el.getAttribute('data-v');
    switch (act) {
      case 'go': go(v); break;
      case 'match': openMatch(v); break;
      case 'back': S.screen = S.back || 'home'; render(); break;
      case 'teams': openTeams(); break;
      case 'team': setTeam(v); break;
      case 'close': closeSheet(); break;
      case 'settings':
        if (S.screen !== 'more') { S.screen = 'more'; render(); }
        var a = $('#ajustes'); if (a) a.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
        break;
      case 'mtab':
        S.matchTab = v;
        $$('.ttab[data-act="mtab"]').forEach(function (t) { var on = t.getAttribute('data-v') === v; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; });
        $('#panel').setAttribute('aria-labelledby', 'tab-' + v);
        renderPanel();
        keepTabsInView();
        break;
      case 'side': S.side = v; var y = view.scrollTop; renderPanel(); view.scrollTop = y; break;
      case 'player': openPlayer(v); break;
      case 'comp': S.comp = v; rerenderKeep(); break;
      case 'stab':
        S.seasonTab = v; S.comp = 'all';
        $$('.ttab[data-act="stab"]').forEach(function (t) { var on = t.getAttribute('data-v') === v; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; });
        $('#spanel').setAttribute('aria-labelledby', 'stab-' + v);
        $('#spanel').innerHTML = seasonPanel();
        keepTabsInView();
        break;
      case 'scope': S.seasonScope = v; var y2 = view.scrollTop; $('#spanel').innerHTML = seasonPanel(); view.scrollTop = y2; break;
      case 'hcat': S.histCat = v; render(false); break;
      case 'like': case 'save': toggleStory(act, v, el); break;
      case 'share': shareStory(v); break;
      case 'remind':
        var key = T.id + ':' + v; S.remind[key] = !S.remind[key]; if (!S.remind[key]) delete S.remind[key];
        store.set('remind', S.remind);
        var on = !!S.remind[key];
        $$('[data-act="remind"][data-v="' + v + '"]').forEach(function (b) { b.setAttribute('aria-pressed', on); b.lastChild.textContent = on ? (b.closest('.hero') ? 'Avisaré' : 'Te avisaremos') : (b.closest('.hero') ? 'Avisar' : 'Avisarme al empezar'); });
        toast(on ? 'Te avisaremos antes del partido' : 'Recordatorio eliminado');
        break;
      case 'toggle': toggleSetting(v, el); break;
    }
  });
  document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'seasonSel') { S.season = e.target.value; S.comp = 'all'; render(false); var s = $('#seasonSel'); if (s) s.focus(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !$('#sheet').hidden) { closeSheet(); return; }
    // Trampa de foco simple en la hoja
    if (e.key === 'Tab' && !$('#sheet').hidden) {
      var f = $$('#sheet button'); if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
    // Flechas en pestañas
    var tab = e.target.closest && e.target.closest('[role="tab"]');
    if (tab && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      var tabs = $$('[role="tab"]', tab.parentNode), i = tabs.indexOf(tab);
      var n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      n.focus(); n.click(); e.preventDefault();
    }
    // Flechas en el feed de historia
    if (e.target.id === 'feed' && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'PageDown' || e.key === 'PageUp')) {
      var fd = e.target; e.preventDefault();
      fd.scrollBy({ top: (e.key === 'ArrowDown' || e.key === 'PageDown' ? 1 : -1) * fd.clientHeight, behavior: reduced() ? 'auto' : 'smooth' });
    }
  });
  function keepTabsInView() {
    var bar = $('.stickybar'); if (!bar) return;
    if (view.scrollTop > bar.offsetTop) view.scrollTop = bar.offsetTop;
  }
  function rerenderKeep() {
    var y = view.scrollTop;
    if (S.screen === 'season') { $('#spanel').innerHTML = seasonPanel(); }
    else render(false);
    view.scrollTop = y;
  }
  function toggleStory(act, id, el) {
    var map = act === 'like' ? S.likes : S.saves, k = hkey(id);
    if (map[k]) delete map[k]; else map[k] = 1;
    store.set(act === 'like' ? 'likes' : 'saves', map);
    var on = !!map[k];
    el.setAttribute('aria-pressed', on);
    el.classList.remove('pop'); void el.offsetWidth; if (on) el.classList.add('pop');
    if (act === 'like') { el.lastChild.textContent = fmtK(120 + hash(T.id + id) % 4800 + (on ? 1 : 0)); }
    else {
      el.lastChild.textContent = on ? 'Guardado' : 'Guardar';
      var n = arr(T.history).filter(function (it) { return S.saves[hkey(it.id)]; }).length;
      var chip = $('.chip[data-v="saved"] .n'); if (chip) chip.textContent = n;
      toast(on ? 'Guardado en «Guardados»' : 'Eliminado de «Guardados»');
    }
  }
  function shareStory(id) {
    var it = arr(T.history).filter(function (x) { return x.id === id; })[0]; if (!it) return;
    var text = it.title + ' — ' + (it.subtitle || '') + ' ' + (T.hashtag || '');
    if (navigator.share) { navigator.share({ title: it.title, text: text }).catch(function () { /* cancelado */ }); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('Texto copiado para compartir'); }, function () { toast('Compartir no disponible aquí'); });
    } else toast('Compartir no disponible aquí');
  }
  function toggleSetting(k, el) {
    if (k === 'dark') { S.dark = !S.dark; store.set('dark', S.dark); applyDark(); el.setAttribute('aria-checked', !!S.dark); return; }
    S[k] = !S[k]; store.set(k, S[k]); el.setAttribute('aria-checked', !!S[k]);
    toast(k === 'notif' ? (S.notif ? 'Notificaciones activadas' : 'Notificaciones desactivadas') : (S.goals ? 'Alertas de gol activadas' : 'Alertas de gol desactivadas'));
  }

  // Cambio de equipo desde la página contenedora (iframe)
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'vicfut:team') setTeam(e.data.team);
  });
  // API pequeña para depurar / integrar
  window.vicfutB = { setTeam: setTeam, go: go, openMatch: openMatch };

  /* ============================================================ INIT */
  (function init() {
    var pt = params.get('team'), saved = store.get('team', null);
    var id = (pt && V.teams[pt]) ? pt : (saved && V.teams[saved]) ? saved : (V.defaultTeam && V.teams[V.defaultTeam] ? V.defaultTeam : arr(V.order)[0]);
    var scr = params.get('screen');
    if (SCREENS.indexOf(scr) >= 0) S.screen = scr;
    T = V.getTeam(id);
    store.set('team', T.id);
    applyTheme(); applyDark();
    liveReset();
    if (S.screen === 'match') {
      S.back = 'matches';
      S.matchId = (T.featuredMatch && T.featuredMatch.fixtureId) || (finished(fixtures()).slice(-1)[0] || {}).id || null;
      S.matchTab = 'ratings';
      var f = getFx(S.matchId); S.side = f && f.away === T.code ? 'away' : 'home';
    }
    render();
    startLive();
  })();
})();
