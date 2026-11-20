/* =====================================================================
   vic-fut · Dirección A "Estadio" — lógica de la app
   Sin dependencias. Todos los datos vienen de window.VICFUT (shared/teams.js).
   ===================================================================== */
(function () {
  'use strict';

  var V = window.VICFUT;
  var app = document.getElementById('app');
  if (!V || !V.teams) {
    app.innerHTML = '<p style="padding:40px;color:#fff;font-family:sans-serif">No se pudieron cargar los datos (shared/teams.js).</p>';
    return;
  }

  /* ------------------------------------------------------------ utilidades */
  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // Solo se permite <b> en los textos enriquecidos.
  function rich(s) { return esc(s).replace(/&lt;(\/?)b&gt;/g, '<$1b>'); }
  function arr(a) { return Array.isArray(a) ? a : []; }
  function num(n, d) { return typeof n === 'number' && !isNaN(n) ? n : (d == null ? 0 : d); }
  function minNum(m) { var n = parseInt(String(m), 10); return isNaN(n) ? 0 : n; }
  function minExtra(m) { var p = String(m).split('+'); return minNum(p[0]) + (p[1] ? minNum(p[1]) / 100 : 0); }
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  var reduceMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function reduced() { return reduceMQ.matches || S.prefs.reduce; }

  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('vicfut.a.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('vicfut.a.' + k, JSON.stringify(v)); } catch (e) { /* almacenamiento no disponible */ } }
  };

  /* ---------------------------------------------------------------- color */
  function rgb(hex) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h.replace(/./g, '$&$&');
    var n = parseInt(h.slice(0, 6), 16);
    if (isNaN(n)) return [128, 128, 128];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function toHex(c) { return '#' + c.map(function (v) { return ('0' + Math.round(Math.max(0, Math.min(255, v))).toString(16)).slice(-2); }).join(''); }
  function mix(a, b, t) { var x = rgb(a), y = rgb(b); return toHex([0, 1, 2].map(function (i) { return x[i] + (y[i] - x[i]) * t; })); }
  function lum(hex) {
    return rgb(hex).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); })
      .reduce(function (s, v, i) { return s + v * [0.2126, 0.7152, 0.0722][i]; }, 0);
  }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function readableOn(bg) { return contrast(bg, '#ffffff') >= contrast(bg, '#0b0d12') ? '#ffffff' : '#0b0d12'; }
  // Color de realce legible (AA) sobre un fondo dado.
  function pickHl(cands, bg, toward) {
    for (var i = 0; i < cands.length; i++) if (cands[i] && contrast(cands[i], bg) >= 4.5) return cands[i];
    var base = cands[0] || '#888888', c = base;
    for (var t = 0.1; t <= 1; t += 0.1) { c = mix(base, toward, t); if (contrast(c, bg) >= 4.5) break; }
    return c;
  }

  /* ------------------------------------------------------------- fechas */
  var MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var MESL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  var DIA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  var DIAL = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  function ymd(s) { var p = String(s || '').split('-'); return { y: +p[0], m: +p[1] - 1, d: +p[2] }; }
  function dateObj(s) { var p = ymd(s); return new Date(Date.UTC(p.y, p.m, p.d, 12)); }
  function shortDate(s) { if (!s) return ''; var d = dateObj(s); return DIA[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MES[d.getUTCMonth()]; }
  function longDate(s) { if (!s) return ''; var d = dateObj(s); return DIAL[d.getUTCDay()] + ' ' + d.getUTCDate() + ' de ' + MESL[d.getUTCMonth()].toLowerCase(); }
  function lastSunday(y, m) { var d = new Date(Date.UTC(y, m + 1, 0)); return d.getUTCDate() - d.getUTCDay(); }
  // Hora peninsular española → instante UTC (CET/CEST).
  function kickoff(fx) {
    if (!fx || !fx.date) return null;
    var p = ymd(fx.date), t = String(fx.time || '21:00').split(':');
    var summer = (p.m > 2 && p.m < 9) || (p.m === 2 && p.d >= lastSunday(p.y, 2)) || (p.m === 9 && p.d < lastSunday(p.y, 9));
    return Date.UTC(p.y, p.m, p.d, +t[0] - (summer ? 2 : 1), +t[1] || 0);
  }
  // Reloj de la demo: si el partido ya pasó en el reloj real, usamos VICFUT.today.
  function nowFor(target) {
    var now = Date.now();
    if (target && now > target && V.today) {
      var p = ymd(V.today), d = new Date();
      now = Date.UTC(p.y, p.m, p.d, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
    }
    return now;
  }

  /* -------------------------------------------------------------- estado */
  var S = {
    teamId: null,
    tab: 'home',
    compFilter: 'all',
    seasonSel: null,
    seasonTab: 'resumen',
    histCat: 'all',
    detail: null,             // {kind:'fx', id, tab} | {kind:'live', tab}
    theme: store.get('theme', 'dark'),
    prefs: store.get('prefs', { notif: true, goals: true, lights: true, reduce: false }),
    social: store.get('social', {})  // {teamId: {liked:{}, saved:{}}}
  };
  var T = null; // equipo activo

  function soc() {
    var s = S.social[S.teamId] || (S.social[S.teamId] = { liked: {}, saved: {} });
    s.liked = s.liked || {}; s.saved = s.saved || {};
    return s;
  }

  /* ----------------------------------------------------------- equipos */
  function teamByCode(code) {
    for (var k in V.teams) if (V.teams.hasOwnProperty(k) && V.teams[k].code === code) return V.teams[k];
    return null;
  }
  function nameOf(code) { return V.teamName ? V.teamName(code, T) : code; }
  function longName(code) { var t = teamByCode(code); if (t) return t.name; return (V.opponents[code] && V.opponents[code].name) || code; }
  function kitOf(code) { return (V.kit && V.kit(code, T)) || V.genericKit || { bg: '#ccc', fg: '#111', ring: '#999' }; }
  function isMine(code) { return code === T.code; }
  function comp(code) { return (V.comps && V.comps[code]) || { name: code || '', short: code || '', color: '#8892a6', icon: '' }; }

  // Monograma: equipos VICFUT con sus colores; rivales con su equipación.
  function mono(code, extraCls) {
    var t = teamByCode(code), cls = 'mono' + (extraCls ? ' ' + extraCls : '');
    if (t) {
      var c = t.colors || {};
      return '<span class="' + cls + '" aria-hidden="true" style="--m-bg:' + c.primary + ';--m-bg2:' + c.primaryDark + ';--m-ring:' + c.accent + ';--m-fg:' + (c.onPrimary || '#fff') + '">' + esc(t.monogram || t.code) + '</span>';
    }
    var k = kitOf(code), striped = /gradient/.test(k.bg);
    if (striped) {
      return '<span class="' + cls + '" aria-hidden="true" style="background:' + k.bg + ';--m-ring:' + k.ring + ';--m-fg:' + k.fg + '"><span style="background:rgba(255,255,255,.92);border-radius:50%;width:66%;height:66%;display:grid;place-items:center">' + esc(code) + '</span></span>';
    }
    return '<span class="' + cls + '" aria-hidden="true" style="--m-bg:' + k.bg + ';--m-bg2:' + mix(k.bg, '#000000', 0.18) + ';--m-ring:' + k.ring + ';--m-fg:' + k.fg + '">' + esc(code) + '</span>';
  }
  function kitVars(code) {
    var t = teamByCode(code), k;
    if (t && t.code === T.code) k = T.kit; else k = kitOf(code);
    var striped = /gradient/.test(k.bg);
    return { style: '--kbg:' + k.bg + ';--kfg:' + k.fg + ';--kring:' + k.ring, striped: striped };
  }

  /* ---------------------------------------------------------------- tema */
  var lastHl = null;
  function applyTheme() {
    var c = T.colors || {}, r = document.documentElement.style;
    var primary = c.primary || '#334155', pd = c.primaryDark || mix(primary, '#000000', 0.4);
    var accent = c.accent || '#facc15', ad = c.accentDark || mix(accent, '#000000', 0.3);
    var hlD = pickHl([accent, c.gold, mix(accent, '#ffffff', 0.25)], '#0d1119', '#ffffff');
    var hlL = pickHl([ad, pd, primary], '#f2f4f8', '#000000');
    var vars = {
      '--p': primary, '--pd': pd, '--a': accent, '--ad': ad,
      '--on-p': c.onPrimary || readableOn(primary), '--on-a': c.onAccent || readableOn(accent),
      '--hl-d': hlD, '--on-hl-d': readableOn(hlD), '--hl-l': hlL, '--on-hl-l': readableOn(hlL)
    };
    Object.keys(vars).forEach(function (k) { r.setProperty(k, vars[k]); });
    lastHl = hlD;
    var meta = $('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', pd);
    document.title = T.name + ' · vic-fut Estadio';
    app.setAttribute('data-theme', S.theme === 'light' ? 'light' : 'dark');
    app.classList.toggle('reduce', !!S.prefs.reduce);
    $all('.flood').forEach(function (f) { f.hidden = !S.prefs.lights; });
  }

  /* ------------------------------------------------------- datos derivados */
  function fixtures() { return arr(T.fixtures); }
  function seasonLabel() { return (T.season && T.season.label) || 'Temporada'; }
  function seasonsAvailable() {
    var out = [seasonLabel()];
    arr(T.archive).forEach(function (f) { if (f.season && out.indexOf(f.season) < 0) out.push(f.season); });
    return out;
  }
  function seasonFixtures(label) {
    if (!label || label === seasonLabel()) return fixtures();
    return arr(T.archive).filter(function (f) { return f.season === label; })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  }
  function nextFixture() {
    var f = T.nextMatch && T.nextMatch.fixtureId ? V.fixture(T, T.nextMatch.fixtureId) : null;
    if (!f) f = fixtures().filter(function (x) { return x.status === 'up'; })[0] || null;
    return f;
  }
  function resultFor(f) {
    if (f.result) return f.result;
    if (f.status !== 'ft' || f.hs == null) return null;
    var mineH = isMine(f.home), my = mineH ? f.hs : f.as, op = mineH ? f.as : f.hs;
    return my > op ? 'W' : my < op ? 'L' : 'D';
  }
  var RES_TXT = { W: 'V', D: 'E', L: 'D' };
  var RES_LBL = { W: 'Victoria', D: 'Empate', L: 'Derrota' };

  /* ======================================================== DIRECTO (demo) */
  var L = null;
  function liveSide() { var d = T.liveDemo; if (!d) return null; return d.home === T.code ? 'home' : d.away === T.code ? 'away' : 'home'; }
  function liveReset() {
    if (L) { clearInterval(L.timer); clearTimeout(L.restart); }
    var d = T.liveDemo;
    if (!d) { L = null; return; }
    var sc = arr(d.startScore);
    L = {
      minute: num(d.startMinute, 1),
      score: [num(sc[0]), num(sc[1])],
      events: arr(d.events).slice(),
      idx: 0, ended: false, timer: null
    };
    L.timer = setInterval(liveTick, 1300);
  }
  function liveTick() {
    if (!L || L.ended) return;
    var d = T.liveDemo, script = arr(d.script), changed = false;
    L.minute++;
    while (L.idx < script.length && minNum(script[L.idx].min) <= L.minute) {
      var e = script[L.idx++];
      L.events.push(e); changed = true;
      if (e.type === 'goal') {
        L.score[e.side === 'away' ? 1 : 0]++;
        goalBurst(e);
      }
    }
    if (L.minute >= 90 && L.idx >= script.length) {
      L.minute = 90; L.ended = true; clearInterval(L.timer); changed = true;
      // La demo vuelve a empezar sola tras una pausa.
      L.restart = setTimeout(function () { liveReset(); paintLive(true); }, 15000);
    }
    paintLive(changed);
  }
  function liveMinTxt() { return L ? (L.ended ? 'Final' : L.minute + "'") : ''; }
  function paintLive(structural) {
    if (!L) return;
    $all('[data-live="min"]').forEach(function (el) { el.textContent = liveMinTxt(); });
    $all('[data-live="hs"]').forEach(function (el) { if (el.textContent !== String(L.score[0])) { el.textContent = L.score[0]; bump(el); } });
    $all('[data-live="as"]').forEach(function (el) { if (el.textContent !== String(L.score[1])) { el.textContent = L.score[1]; bump(el); } });
    $all('[data-live="pill"]').forEach(function (el) {
      el.classList.toggle('ended', L.ended);
      el.innerHTML = L.ended ? 'FINAL' : '<i></i>EN VIVO';
    });
    $all('[data-live="replay"]').forEach(function (el) { el.hidden = !L.ended; });
    if (structural && S.detail && S.detail.kind === 'live') renderDetail(true);
  }
  function bump(el) { el.classList.remove('pulse-score'); void el.offsetWidth; el.classList.add('pulse-score'); }
  function goalBurst(e) {
    if (!S.prefs.goals) return;
    var mine = e.side === liveSide();
    var b = $('#goalBurst');
    var d = T.liveDemo, who = e.side === 'home' ? d.home : d.away;
    b.innerHTML = '<div style="position:relative;overflow:hidden;border-radius:28px"><div class="ray"></div><div class="gb"><b>' + (mine ? '¡GOOOL!' : 'Gol') + '</b><span>' +
      esc(e.player || nameOf(who)) + ' · ' + esc(e.min) + '\'</span><small>' + esc(nameOf(d.home)) + ' ' + L.score[0] + '–' + L.score[1] + ' ' + esc(nameOf(d.away)) + '</small></div></div>';
    toast((mine ? '⚽ ¡Gol de ' : '⚽ Gol de ') + nameOf(who) + '! ' + L.score[0] + '–' + L.score[1], true);
    clearTimeout(goalBurst.t);
    goalBurst.t = setTimeout(function () { b.innerHTML = ''; }, reduced() ? 1600 : 2700);
  }

  /* ============================================================== RENDER */
  function renderAll(opts) {
    opts = opts || {};
    renderChrome();
    renderHome(); renderMatches(); renderSeason(); renderHistory(); renderMore();
    renderTeamList();
    if (S.detail) renderDetail();
    if (opts.retheme) {
      $all('.screen').forEach(function (s) { s.classList.remove('retheme'); void s.offsetWidth; s.classList.add('retheme'); });
    }
    paintLive(false);
    tickCountdowns();
  }

  function renderChrome() {
    $('#pillMono').outerHTML = mono(T.code).replace('class="mono"', 'class="mono" id="pillMono"');
    $('#pillName').textContent = T.short || T.name;
    $('#clubPill').setAttribute('aria-label', 'Club: ' + T.name + '. Cambiar de club');
    $('#demoBadge').hidden = !(T.season && T.season.isDemo);
  }

  /* ---------------------------------------------------------------- INICIO */
  function countdownHTML(fx) {
    var k = kickoff(fx); if (!k) return '';
    return '<div class="countdown" data-cd="' + k + '" role="timer" aria-label="Cuenta atrás">' +
      ['d|Días', 'h|Horas', 'm|Min', 's|Seg'].map(function (u) { var p = u.split('|'); return '<div class="cd-box"><span class="cd-n" data-u="' + p[0] + '">--</span><span class="cd-l">' + p[1] + '</span></div>'; }).join('') + '</div>';
  }
  function tickCountdowns() {
    $all('[data-cd]').forEach(function (el) {
      var k = +el.getAttribute('data-cd'), ms = Math.max(0, k - nowFor(k)), s = Math.floor(ms / 1000);
      var v = { d: Math.floor(s / 86400), h: Math.floor(s % 86400 / 3600), m: Math.floor(s % 3600 / 60), s: s % 60 };
      $all('[data-u]', el).forEach(function (n) { var u = n.getAttribute('data-u'); var t = (v[u] < 10 ? '0' : '') + v[u]; if (n.textContent !== t) n.textContent = t; });
    });
  }

  function heroPitchSVG() {
    return '<svg class="hero-pitch" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g fill="none" stroke="#fff" stroke-width=".8"><rect x="6" y="6" width="188" height="108" rx="2"/><line x1="100" y1="6" x2="100" y2="114"/><circle cx="100" cy="60" r="18"/><rect x="6" y="34" width="26" height="52"/><rect x="168" y="34" width="26" height="52"/></g></svg>';
  }

  function heroHTML() {
    var f = nextFixture();
    if (!f) return '<div class="hero glass"><p class="eyebrow">Próximo partido</p><div class="empty" style="margin:10px 0 0;padding:16px">Sin partidos programados por ahora.</div></div>';
    var c = comp(f.comp);
    return '<div class="hero glass">' + heroPitchSVG() +
      '<div class="hero-top"><span class="eyebrow">Próximo partido</span><span class="comp-tag"><span class="comp-dot" style="--c:' + c.color + '"></span>' + esc(c.short || c.name) + (f.round ? ' · ' + esc(f.round) : '') + '</span></div>' +
      '<div class="hero-teams">' +
        '<div class="hero-team">' + mono(f.home) + '<span class="hero-team-name">' + esc(nameOf(f.home)) + '</span><span class="hero-team-tag">Local</span></div>' +
        '<div class="hero-mid"><span class="hero-time">' + esc(f.time || 'VS') + '</span><span class="hero-date">' + esc(shortDate(f.date)) + '</span></div>' +
        '<div class="hero-team">' + mono(f.away) + '<span class="hero-team-name">' + esc(nameOf(f.away)) + '</span><span class="hero-team-tag">Visitante</span></div>' +
      '</div>' + countdownHTML(f) +
      '<p class="hero-venue"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="9" r="2.5" fill="currentColor"/></svg>' +
        esc(f.stadium || (f.venue === 'H' && T.stadium ? T.stadium.name : (f.venue === 'A' ? 'Fuera de casa' : 'Campo neutral'))) + '</p>' +
      '<button type="button" class="hero-cta" data-act="open-fx" data-id="' + esc(f.id) + '">Ver previa <span aria-hidden="true">→</span></button>' +
    '</div>';
  }

  function liveCardHTML() {
    var d = T.liveDemo; if (!d || !L) return '';
    var hW = L.score[0] >= L.score[1], aW = L.score[1] >= L.score[0];
    return '<button type="button" class="mcard glass live" data-act="open-live" aria-label="Partido en vivo: ' + esc(longName(d.home)) + ' contra ' + esc(longName(d.away)) + '">' +
      '<div class="mcard-top"><span class="live-pill" data-live="pill"><i></i>EN VIVO</span><span class="live-min" data-live="min">' + liveMinTxt() + '</span></div>' +
      '<div class="mcard-row' + (hW ? '' : ' lose') + '">' + mono(d.home) + '<span class="nm">' + esc(nameOf(d.home)) + '</span><span class="sc" data-live="hs">' + L.score[0] + '</span></div>' +
      '<div class="mcard-row' + (aW ? '' : ' lose') + '">' + mono(d.away) + '<span class="nm">' + esc(nameOf(d.away)) + '</span><span class="sc" data-live="as">' + L.score[1] + '</span></div>' +
      '<div class="mcard-foot"><span>' + esc(d.label || 'Partido de demostración') + '</span></div>' +
    '</button>';
  }

  function fxCardHTML(f) {
    var c = comp(f.comp), ft = f.status === 'ft', r = resultFor(f);
    var hl = ft && f.hs < f.as, al = ft && f.as < f.hs;
    return '<button type="button" class="mcard glass" data-act="open-fx" data-id="' + esc(f.id) + '">' +
      '<div class="mcard-top"><span style="display:flex;align-items:center;gap:6px"><span class="comp-dot" style="--c:' + c.color + '"></span>' + esc(c.short) + '</span><span>' + esc(shortDate(f.date)) + '</span></div>' +
      '<div class="mcard-row' + (hl ? ' lose' : '') + '">' + mono(f.home) + '<span class="nm">' + esc(nameOf(f.home)) + '</span><span class="sc">' + (ft ? f.hs : '') + '</span></div>' +
      '<div class="mcard-row' + (al ? ' lose' : '') + '">' + mono(f.away) + '<span class="nm">' + esc(nameOf(f.away)) + '</span><span class="sc">' + (ft ? f.as : '') + '</span></div>' +
      '<div class="mcard-foot"><span>' + (ft ? 'Final' : esc(f.time || 'Hora por confirmar')) + '</span>' + (r ? '<span class="res ' + r + '" aria-label="' + RES_LBL[r] + '">' + RES_TXT[r] + '</span>' : '') + '</div>' +
    '</button>';
  }

  function renderHome() {
    var el = $('#scr-home'), fx = fixtures();
    var played = fx.filter(function (f) { return f.status === 'ft'; }).slice(-3).reverse();
    var next = fx.filter(function (f) { return f.status === 'up'; }).slice(0, 3);
    var s = T.season || {};
    var news = arr(T.news).map(function (n) {
      return '<article class="news-item glass"><div class="news-ic" aria-hidden="true">' + esc(n.icon || '📰') + '</div><div>' +
        '<div class="news-meta"><span>' + esc(n.tag || 'Club') + '</span><span>' + esc(n.dateLabel || shortDate(n.date)) + '</span></div>' +
        '<h3>' + esc(n.title) + '</h3>' + (n.body ? '<p>' + esc(n.body) + '</p>' : '') + '</div></article>';
    }).join('');
    el.innerHTML =
      '<div class="welcome"><h1>' + esc(T.name) + '</h1><p>' + esc(T.motto || '') + '</p></div>' +
      heroHTML() +
      '<div class="sec"><div class="sec-h"><h2>Partidos</h2><button type="button" class="link" data-act="goto" data-tab="matches">Ver calendario</button></div>' +
        '<div class="rail" role="list">' + liveCardHTML() + played.map(fxCardHTML).join('') + next.map(fxCardHTML).join('') + '</div></div>' +
      '<div class="sec"><div class="sec-h"><h2>Temporada ' + esc(seasonLabel()) + '</h2><button type="button" class="link" data-act="goto" data-tab="season">Ver todo</button></div>' +
        '<button type="button" class="strip glass" data-act="goto" data-tab="season" aria-label="Ver temporada">' +
          '<div><div class="strip-k">Posición</div><div class="strip-v">' + (s.leaguePos ? s.leaguePos + 'º' : '—') + '</div></div>' +
          '<div><div class="strip-k">Puntos</div><div class="strip-v">' + num(s.points, '—') + '</div></div>' +
          '<div><div class="strip-k">Goles</div><div class="strip-v">' + num(s.gf, 0) + '</div></div>' +
          formHTML(s.form) +
        '</button></div>' +
      '<div class="sec"><div class="sec-h"><h2>Lo último</h2></div><div class="news">' + (news || '<div class="empty glass">No hay noticias todavía.</div>') + '</div>' +
        (T.newsNote ? '<p class="note">' + esc(T.newsNote) + '</p>' : '') + '</div>' +
      '<div class="motto-band"><span class="mono-bg" aria-hidden="true">' + esc(T.monogram || T.code) + '</span><span class="eyebrow">' + esc(T.stadium ? T.stadium.name : '') + '</span><strong>' + esc(T.motto || T.name) + '</strong>' + (T.hashtag ? '<span class="tag">' + esc(T.hashtag) + '</span>' : '') + '</div>';
  }

  function formHTML(form, lg) {
    var f = arr(form);
    if (!f.length) return '<div class="form" aria-label="Sin racha"></div>';
    return '<div class="form' + (lg ? ' lg' : '') + '" role="img" aria-label="Racha: ' + f.map(function (r) { return RES_LBL[r] || r; }).join(', ') + '">' +
      f.map(function (r) { return '<b class="' + esc(r) + '">' + (RES_TXT[r] || esc(r)) + '</b>'; }).join('') + '</div>';
  }

  /* -------------------------------------------------------------- PARTIDOS */
  function fxRowHTML(f) {
    var c = comp(f.comp), ft = f.status === 'ft', r = resultFor(f), d = dateObj(f.date);
    function side(code, sc, lose) {
      return '<span class="fx-t' + (lose ? ' dim' : '') + (isMine(code) ? ' mine' : '') + '">' + mono(code) + '<span class="nm">' + esc(nameOf(code)) + '</span>' + (ft ? '<span class="sc">' + sc + '</span>' : '') + '</span>';
    }
    var label = longName(f.home) + ' contra ' + longName(f.away) + ', ' + longDate(f.date) + (ft ? ', resultado ' + f.hs + ' a ' + f.as : (f.time ? ', ' + f.time : ''));
    return '<button type="button" class="fx glass" data-act="open-fx" data-id="' + esc(f.id) + '" aria-label="' + esc(label) + '">' +
      '<span class="fx-date"><b>' + d.getUTCDate() + '</b><span>' + DIA[d.getUTCDay()] + '</span></span>' +
      '<span class="fx-teams">' + side(f.home, f.hs, ft && f.hs < f.as) + side(f.away, f.as, ft && f.as < f.hs) + '</span>' +
      '<span class="fx-side"><span class="fx-comp"><span class="comp-dot" style="--c:' + c.color + '"></span>' + esc(c.short) + '</span>' +
        (r ? '<span class="res ' + r + '">' + RES_TXT[r] + '</span>' : f.status === 'live' ? '<span class="live-pill"><i></i>VIVO</span>' : '<span class="fx-time">' + esc(f.time || '—') + '</span>') +
      '</span></button>';
  }
  function groupByMonth(list) {
    var out = [], cur = null;
    list.forEach(function (f) {
      var p = ymd(f.date), key = p.y + '-' + p.m;
      if (!cur || cur.key !== key) { cur = { key: key, label: MESL[p.m] + ' ' + p.y, items: [] }; out.push(cur); }
      cur.items.push(f);
    });
    return out;
  }
  function renderMatches() {
    var el = $('#scr-matches');
    var seasons = seasonsAvailable();
    if (seasons.indexOf(S.seasonSel) < 0) S.seasonSel = seasons[0];
    var list = seasonFixtures(S.seasonSel);
    var codes = [];
    list.forEach(function (f) { if (codes.indexOf(f.comp) < 0) codes.push(f.comp); });
    if (S.compFilter !== 'all' && codes.indexOf(S.compFilter) < 0) S.compFilter = 'all';
    var shown = list.filter(function (f) { return S.compFilter === 'all' || f.comp === S.compFilter; });
    var isCurrent = S.seasonSel === seasonLabel();
    var groups = groupByMonth(shown);
    el.innerHTML =
      '<div class="page-title"><div><h1>Partidos</h1><p>' + esc(T.short || T.name) + ' · ' + list.length + ' partidos</p></div>' +
        '<span class="comp-tag">' + esc(S.seasonSel) + '</span>' +
      '</div>' +
      (seasons.length > 1 ? '<div class="chips season-sel" role="group" aria-label="Temporada">' + seasons.map(function (s) { return '<button type="button" class="chip" data-act="season-sel" data-v="' + esc(s) + '" aria-pressed="' + (s === S.seasonSel) + '">' + (s === seasonLabel() ? 'Actual · ' : '') + esc(s) + '</button>'; }).join('') + '</div>' : '') +
      '<div class="chips" role="group" aria-label="Filtrar por competición">' +
        '<button type="button" class="chip" data-act="comp" data-v="all" aria-pressed="' + (S.compFilter === 'all') + '">Todas</button>' +
        codes.map(function (c) { var o = comp(c); return '<button type="button" class="chip" data-act="comp" data-v="' + esc(c) + '" aria-pressed="' + (S.compFilter === c) + '"><span class="comp-dot" style="--c:' + o.color + '"></span>' + esc(o.short) + '</button>'; }).join('') +
      '</div>' +
      (isCurrent && T.liveDemo && L && S.compFilter === 'all' ? '<div class="month">Ahora</div><div class="rail" style="padding-bottom:4px">' + liveCardHTML().replace('class="mcard glass live"', 'class="mcard glass live" style="width:100%"') + '</div>' : '') +
      (groups.length ? groups.map(function (g) { return '<div class="month">' + esc(g.label) + '</div><div class="fx-list">' + g.items.map(fxRowHTML).join('') + '</div>'; }).join('')
        : '<div class="empty glass"><span class="big" aria-hidden="true">🗓️</span>No hay partidos para este filtro.</div>');
  }

  /* --------------------------------------------------------- DETALLE PARTIDO */
  var detailOpener = null;
  function openDetail(d) {
    if (!S.detail) detailOpener = document.activeElement;
    S.detail = d;
    var el = $('#detail');
    el.hidden = false; el.classList.remove('closing');
    renderDetail();
    el.scrollTop = 0;
    var b = $('[data-act="close-detail"]', el); if (b) b.focus({ preventScroll: true });
  }
  function closeDetail() {
    var el = $('#detail');
    if (!S.detail) return;
    S.detail = null;
    if (reduced()) { el.hidden = true; el.innerHTML = ''; }
    else {
      el.classList.add('closing');
      setTimeout(function () { if (!S.detail) { el.hidden = true; el.innerHTML = ''; el.classList.remove('closing'); } }, 280);
    }
    if (detailOpener && document.body.contains(detailOpener)) detailOpener.focus({ preventScroll: true });
  }

  function teamColor(code) {
    if (isMine(code)) return 'var(--hl)';
    var t = teamByCode(code);
    if (t) return t.colors.accent;
    return 'rgba(220,228,240,.62)';
  }
  function bgColor(code) { var t = teamByCode(code); if (t) return t.colors.primary; var k = kitOf(code); return /gradient/.test(k.bg) ? k.ring : (lum(k.bg) > 0.7 ? k.ring : k.bg); }

  function renderDetail(keepScroll) {
    var el = $('#detail'), d = S.detail; if (!d) return;
    var y = el.scrollTop;
    var m, fx, live = d.kind === 'live';
    if (live) {
      var ld = T.liveDemo;
      if (!ld || !L) { closeDetail(); return; }
      fx = { home: ld.home, away: ld.away, comp: ld.comp, round: null, label: null, status: 'live' };
      m = { lineups: ld.lineups, events: L.events, stats: ld.stats, playerHeat: ld.playerHeat };
    } else {
      fx = V.fixture(T, d.id);
      if (!fx) { closeDetail(); return; }
      m = V.matchDetail ? V.matchDetail(T, d.id) : (T.featuredMatch && T.featuredMatch.fixtureId === d.id ? T.featuredMatch : null);
    }
    var c = comp(fx.comp), ft = fx.status === 'ft';
    var hs = live ? L.score[0] : fx.hs, as = live ? L.score[1] : fx.as;
    var goals = arr(m && m.events).filter(function (e) { return e.type === 'goal'; });
    function scorers(side) {
      return goals.filter(function (e) { return e.side === side; }).map(function (e) { return esc(e.player || 'Gol') + ' ' + esc(e.min) + "'"; }).join('<br>');
    }
    var rec = T.season ? (num(T.season.w) + '-' + num(T.season.d) + '-' + num(T.season.l)) : '';
    function sbTeam(code) {
      return '<div class="sb-team">' + mono(code) + '<span class="sb-name">' + esc(nameOf(code)) + '</span><span class="sb-form">' + (isMine(code) ? (fx.season ? esc(fx.season) : esc(rec)) : 'Rival') + '</span></div>';
    }
    var status = live ? '<span class="live-pill" data-live="pill"><i></i>EN VIVO</span> <span class="live-min" data-live="min">' + liveMinTxt() + '</span>' : ft ? 'Final' : fx.status === 'live' ? 'En vivo' : 'Por jugarse';
    var mid = (ft || live)
      ? '<div class="sb-score"><span class="' + (hs < as ? 'ls' : '') + '"' + (live ? ' data-live="hs"' : '') + '>' + hs + '</span><span class="dash">–</span><span class="' + (as < hs ? 'ls' : '') + '"' + (live ? ' data-live="as"' : '') + '>' + as + '</span></div>'
      : '<div class="sb-score" style="font-size:40px">' + esc(fx.time || '—') + '</div>';
    var tabs = [['ratings', 'Ratings'], ['stats', 'Estadísticas'], ['summary', 'Resumen']];
    var hasDetail = !!m && (ft || live);
    var ti = Math.max(0, tabs.map(function (t) { return t[0]; }).indexOf(d.tab));
    if (hasDetail && !tabs[ti]) ti = 0;
    d.tab = tabs[ti][0];

    var html =
      '<div class="detail-bg" style="--hc:' + bgColor(fx.home) + ';--ac:' + bgColor(fx.away) + '"></div>' +
      '<div class="detail-nav"><button type="button" class="icon-btn" data-act="close-detail" aria-label="Volver"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
        '<span class="ttl">' + esc(c.name) + (fx.round ? ' · ' + esc(fx.round) : '') + '</span>' +
        '<button type="button" class="icon-btn" data-act="share-match" aria-label="Compartir partido"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M8 8l4-4 4 4M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>' +
      '<div class="scoreboard">' +
        '<span class="comp-tag"><span class="comp-dot" style="--c:' + c.color + '"></span>' + esc(c.short || c.name) + (fx.label ? ' · ' + esc(fx.label) : '') + '</span>' +
        '<div class="sb-grid">' + sbTeam(fx.home) + '<div class="sb-mid">' + mid + '<div class="sb-status">' + status + '</div></div>' + sbTeam(fx.away) + '</div>' +
        (goals.length ? '<div class="sb-scorers"><div>' + scorers('home') + '</div><div>' + scorers('away') + '</div></div>' : '') +
        (live ? '<button type="button" class="hero-cta" data-act="live-replay" data-live="replay"' + (L.ended ? '' : ' hidden') + '>↻ Repetir directo</button>' : '') +
        '<p class="sb-meta">' + (fx.date ? esc(longDate(fx.date)) + (fx.season ? ' · ' + esc(fx.season) : '') : esc(c.name)) + (fx.stadium ? ' · ' + esc(fx.stadium) : '') + '</p>' +
      '</div>';

    if (hasDetail) {
      html += '<div class="dtabs"><div class="seg" role="tablist" aria-label="Secciones del partido" style="--n:3">' +
        '<span class="seg-ind" style="width:calc((100% - 8px)/3);transform:translateX(' + (ti * 100) + '%)"></span>' +
        tabs.map(function (t, i) { return '<button type="button" role="tab" id="dt-' + t[0] + '" aria-controls="dpane" aria-selected="' + (i === ti) + '" tabindex="' + (i === ti ? 0 : -1) + '" data-act="dtab" data-v="' + t[0] + '">' + t[1] + '</button>'; }).join('') +
        '</div></div><div class="dpane" id="dpane" role="tabpanel" aria-labelledby="dt-' + d.tab + '">' +
        (d.tab === 'ratings' ? ratingsHTML(fx, m, live) : d.tab === 'stats' ? statsHTML(fx, m) : timelineHTML(fx, m, live)) + '</div>';
    } else if (fx.status === 'up') {
      html += '<div class="upcoming glass"><span class="eyebrow">Previa</span><h3 style="margin-top:6px">Por jugarse</h3><p>Las alineaciones, los ratings y las estadísticas aparecerán aquí cuando ruede el balón.</p>' + countdownHTML(fx) + '</div>' +
        infoRowsHTML(fx, c);
    } else {
      html += '<div class="empty glass"><span class="big" aria-hidden="true">📋</span>Todavía no hay alineaciones ni ratings para este partido.<br>Consulta el partido destacado de la temporada.' +
        (T.featuredMatch && T.featuredMatch.fixtureId !== fx.id ? '<br><button type="button" class="hero-cta" data-act="open-fx" data-id="' + esc(T.featuredMatch.fixtureId) + '">Ver partido destacado</button>' : '') + '</div>' + infoRowsHTML(fx, c);
    }
    el.innerHTML = html;
    if (keepScroll) el.scrollTop = y;
    tickCountdowns();
    requestAnimationFrame(function () { $all('.st-bar i[data-w]', el).forEach(function (i) { i.style.width = i.getAttribute('data-w'); }); });
  }

  function infoRowsHTML(fx, c) {
    var rows = [['Competición', c.name], ['Ronda', fx.round], ['Fecha', fx.date ? longDate(fx.date) : null], ['Hora', fx.time ? fx.time + ' (hora peninsular)' : 'Por confirmar'],
      ['Estadio', fx.stadium || (fx.venue === 'A' ? 'Campo del ' + nameOf(fx.home) : null)]];
    return '<div class="info-rows glass">' + rows.filter(function (r) { return r[1]; }).map(function (r) { return '<div class="info-row"><span>' + r[0] + '</span><b>' + esc(r[1]) + '</b></div>'; }).join('') + '</div>';
  }

  function ratingColor(r) {
    if (r == null) return { bg: 'rgba(255,255,255,.18)', fg: '#fff' };
    if (r >= 8) return { bg: '#15803d', fg: '#ffffff' };
    if (r >= 7) return { bg: '#a3e635', fg: '#1a2e05' };
    if (r >= 6.5) return { bg: '#facc15', fg: '#2b2100' };
    if (r >= 6) return { bg: '#fb923c', fg: '#2a1000' };
    return { bg: '#dc2626', fg: '#ffffff' };
  }
  function fmtR(r) { return r == null ? '–' : Number(r).toFixed(1); }

  function pitchLines() {
    return '<svg class="lines" viewBox="0 0 68 112" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="rgba(255,255,255,.28)" stroke-width=".35">' +
      '<rect x="3" y="3" width="62" height="106" rx="1"/><line x1="3" y1="56" x2="65" y2="56"/><circle cx="34" cy="56" r="8"/><circle cx="34" cy="56" r=".6" fill="rgba(255,255,255,.4)"/>' +
      '<rect x="15" y="3" width="38" height="16"/><rect x="25" y="3" width="18" height="6"/><rect x="15" y="93" width="38" height="16"/><rect x="25" y="103" width="18" height="6"/>' +
      '<path d="M27 19a8 8 0 0 0 14 0M27 93a8 8 0 0 1 14 0"/></g></svg>';
  }

  function ratingsHTML(fx, m, live) {
    var lu = m && m.lineups;
    if (!lu || !lu.home || !lu.away) return '<div class="empty glass"><span class="big" aria-hidden="true">🧩</span>Las alineaciones no están disponibles para este partido.</div>';
    var all = arr(lu.home.players).concat(arr(lu.away.players), arr(lu.home.bench), arr(lu.away.bench));
    var best = -1; all.forEach(function (p) { if (p.rating != null && p.rating > best) best = p.rating; });
    var mvpDone = false;
    function sideHTML(side) {
      var L2 = lu[side], ps = arr(L2.players), code = fx[side];
      var maxRow = Math.max.apply(null, ps.map(function (p) { return num(p.row); }).concat([1]));
      var kv = kitVars(code);
      return ps.map(function (p, i) {
        var row = num(p.row), x = num(p.x, 0.5);
        var top = side === 'home' ? 93 - (row / maxRow) * 39.5 : 7 + (row / maxRow) * 39.5;
        var left = side === 'home' ? 8 + x * 84 : 92 - x * 84;
        var rc = ratingColor(p.rating);
        var mvp = !mvpDone && p.rating != null && p.rating === best; if (mvp) mvpDone = true;
        var ev = '';
        for (var g = 0; g < num(p.goals); g++) ev += '<i title="Gol">⚽</i>';
        for (var a = 0; a < num(p.assists); a++) ev += '<i title="Asistencia">🅰️</i>';
        if (p.red) ev += '<i><span class="rcard"></span></i>'; else if (p.yellow) ev += '<i><span class="ycard"></span></i>';
        var label = p.name + ', ' + (p.num ? 'dorsal ' + p.num + ', ' : '') + 'rating ' + fmtR(p.rating) + (mvp ? ', mejor del partido' : '') + (p.goals ? ', ' + p.goals + ' gol' + (p.goals > 1 ? 'es' : '') : '') + (p.assists ? ', ' + p.assists + ' asistencia' + (p.assists > 1 ? 's' : '') : '');
        var initials = p.num != null ? p.num : String(p.name || '?').split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2);
        return '<button type="button" class="pl" style="left:' + left + '%;top:' + top + '%;animation-delay:' + (i * 30 + (side === 'away' ? 160 : 0)) + 'ms" data-act="player" data-side="' + side + '" data-i="' + i + '" aria-label="' + esc(label) + '">' +
          '<span class="pl-av" style="' + kv.style + '">' + (kv.striped ? '<span style="background:rgba(0,0,0,.55);color:#fff;border-radius:50%;width:24px;height:24px;display:grid;place-items:center;font-size:11px">' + esc(initials) + '</span>' : esc(initials)) +
            '<span class="pl-rt" style="--rc:' + rc.bg + ';--rfg:' + rc.fg + '">' + fmtR(p.rating) + '</span>' +
            (mvp ? '<span class="pl-mvp" aria-hidden="true">★</span>' : '') +
            (ev ? '<span class="pl-ev" aria-hidden="true">' + ev + '</span>' : '') +
            (p.subOut ? '<span class="pl-sub" aria-hidden="true">↓' + esc(p.subOut) + '</span>' : '') +
          '</span><span class="pl-nm">' + esc(shortName(p.name)) + '</span></button>';
      }).join('');
    }
    function benchHTML(side) {
      var b = arr(lu[side].bench); if (!b.length) return '';
      var kv = kitVars(fx[side]);
      return b.map(function (p, i) {
        return '<button type="button" class="bench-p" data-act="player" data-side="' + side + '" data-bench="1" data-i="' + i + '" aria-label="' + esc(p.name + (p.sub ? ', entró en el ' + (p.subIn || '') : ', no jugó')) + '">' +
          '<span class="n" style="' + kv.style + '">' + esc(p.num != null ? p.num : '·') + '</span><span class="nm">' + esc(p.name) + (p.sub ? ' <small style="color:var(--win)">↑' + esc(p.subIn || '') + '\'</small>' : '') + '</span><span class="rt">' + (p.rating != null ? fmtR(p.rating) : '') + '</span></button>';
      }).join('');
    }
    var bh = benchHTML('home'), ba = benchHTML('away');
    return '<div class="pitch-wrap">' +
      '<div class="pitch-legend"><span class="who">' + mono(fx.away) + '<span>' + esc(nameOf(fx.away)) + ' · ' + esc(lu.away.formation || '') + '</span></span><span>' + (lu.away.coach ? 'DT: ' + esc(lu.away.coach) : '') + '</span></div>' +
      '<div class="pitch">' + pitchLines() + '<div class="pitch-glow"></div>' + sideHTML('away') + sideHTML('home') + '</div>' +
      '<div class="pitch-legend" style="padding-top:10px"><span class="who">' + mono(fx.home) + '<span>' + esc(nameOf(fx.home)) + ' · ' + esc(lu.home.formation || '') + '</span></span><span>' + (lu.home.coach ? 'DT: ' + esc(lu.home.coach) : '') + '</span></div>' +
    '</div>' +
    (bh || ba ? '<div class="bench glass"><h3>Banquillo</h3>' + (bh ? '<p class="eyebrow" style="margin:0 0 6px">' + esc(nameOf(fx.home)) + '</p><div class="bench-row">' + bh + '</div>' : '') + (ba ? '<p class="eyebrow" style="margin:12px 0 6px">' + esc(nameOf(fx.away)) + '</p><div class="bench-row">' + ba + '</div>' : '') + '</div>' : '') +
    '<p class="demo-note">★ Mejor del partido · Toca un jugador para ver su ficha' + ((m.ratingsDemo || live) ? ' · Ratings de demostración' : '') + '</p>' +
    (m.note ? '<p class="demo-note">' + esc(m.note) + '</p>' : '');
  }
  function shortName(n) {
    n = String(n || ''); if (n.length <= 11) return n;
    var p = n.split(/\s+/); return p.length > 1 ? p[p.length - 1] : n.slice(0, 10) + '…';
  }

  function statsHTML(fx, m) {
    var st = arr(m && m.stats);
    if (!st.length) return '<div class="empty glass">Sin estadísticas para este partido.</div>';
    var hc = teamColor(fx.home), ac = teamColor(fx.away);
    return '<div class="stats glass" style="--hcol:' + hc + ';--acol:' + ac + '">' +
      '<div class="st-head"><span>' + esc(nameOf(fx.home)) + '</span><span>' + esc(nameOf(fx.away)) + '</span></div>' +
      st.map(function (r) {
        var h = num(r[1]), a = num(r[2]), tot = h + a || 1, isPct = /poses/i.test(r[0]);
        var hw = (h / tot * 100).toFixed(1) + '%', aw = (a / tot * 100).toFixed(1) + '%';
        return '<div class="st-row" role="group" aria-label="' + esc(r[0]) + ': ' + h + ' a ' + a + '"><div class="st-lbl"><b>' + h + (isPct ? '%' : '') + '</b><span>' + esc(r[0]) + '</span><b>' + a + (isPct ? '%' : '') + '</b></div>' +
          '<div class="st-bars" aria-hidden="true"><div class="st-bar h"><i data-w="' + hw + '"' + (h > a ? ' class="lead" style="--glowc:' + hc + '"' : '') + '></i></div><div class="st-bar a"><i data-w="' + aw + '"' + (a > h ? ' class="lead" style="--glowc:' + ac + '"' : '') + '></i></div></div></div>';
      }).join('') + '</div>';
  }

  var EV_ICON = { goal: '⚽', yellow: '<span class="ycard" aria-hidden="true"></span>', red: '<span class="rcard" aria-hidden="true"></span>', sub: '🔄', var: '📺', pen_save: '🧤' };
  var EV_TXT = { goal: 'Gol', yellow: 'Amarilla', red: 'Roja', sub: 'Cambio', var: 'VAR', pen_save: 'Penalti parado' };
  function timelineHTML(fx, m, live) {
    var ev = arr(m && m.events).slice().sort(function (a, b) { return minExtra(a.min) - minExtra(b.min); });
    if (!ev.length) return '<div class="empty glass">Sin eventos registrados.</div>';
    var out = [], ht = false;
    function marker(t) { return '<div class="tl-sep"><span></span><span class="tl-marker">' + t + '</span><span></span></div>'; }
    out.push(marker(live ? 'Inicio' : 'Inicio'));
    ev.forEach(function (e) {
      if (!ht && minNum(e.min) > 45) { out.push(marker('Descanso')); ht = true; }
      var side = e.side === 'away' ? 'away' : 'home';
      var who = e.player || (e.type === 'goal' ? 'Gol de ' + nameOf(fx[side]) : EV_TXT[e.type] || '');
      var sub = e.type === 'sub' && e.playerOut ? 'Sale ' + e.playerOut : (e.detail || (e.assist ? 'Asist. ' + e.assist : EV_TXT[e.type] || ''));
      out.push('<div class="tl-item ' + side + (e.type === 'goal' ? ' goal' : '') + '"><span class="tl-min">' + esc(e.min) + '\'</span><div class="tl-card"><b>' + (side === 'home' ? esc(who) + ' ' + (EV_ICON[e.type] || '•') : (EV_ICON[e.type] || '•') + ' ' + esc(who)) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div></div>');
    });
    if (!ht && (!live || L.minute > 45)) out.push(marker('Descanso'));
    if (!live || L.ended) out.push(marker('Final'));
    else out.push(marker('<span class="live-min" data-live="min">' + liveMinTxt() + '</span>'));
    return '<div class="tl" role="list" aria-label="Cronología del partido">' + out.join('') + '</div>';
  }

  /* --------------------------------------------------------- FICHA JUGADOR */
  var sheetOpener = null;
  function openSheet(id) {
    var sh = $('#' + id);
    if (!$('.sheet:not([hidden])')) sheetOpener = document.activeElement;
    $all('.sheet').forEach(function (s) { if (s.id !== id) s.hidden = true; });
    $('#scrim').hidden = false;
    sh.hidden = false; sh.classList.remove('closing');
    var f = sh.querySelector('button, [href], [tabindex]'); if (f) f.focus({ preventScroll: true });
  }
  function closeSheets() {
    var open = $all('.sheet:not([hidden])'); if (!open.length) return;
    $('#scrim').hidden = true;
    open.forEach(function (s) {
      if (reduced()) { s.hidden = true; return; }
      s.classList.add('closing');
      setTimeout(function () { s.hidden = true; s.classList.remove('closing'); }, 240);
    });
    if (sheetOpener && document.body.contains(sheetOpener)) sheetOpener.focus({ preventScroll: true });
  }

  function heatPoints(name, p, m) {
    var h = m && m.playerHeat && m.playerHeat[name];
    if (arr(h).length) return h;
    // Generado de forma determinista según posición y carril.
    var s = hash(name) % 233280 || 7;
    function r() { s = (s * 9301 + 49297) % 233280; return s / 233280; }
    var cx = { GK: 0.08, DEF: 0.3, MID: 0.52, FWD: 0.76 }[p.pos] || 0.5;
    var cy = p.x != null ? p.x : 0.5, sx = p.pos === 'GK' ? 0.08 : 0.32, sy = p.pos === 'GK' ? 0.2 : 0.3, out = [];
    var n = p.pos === 'GK' ? 14 : 34;
    for (var i = 0; i < n; i++) {
      out.push([Math.max(0.02, Math.min(0.98, cx + (r() + r() + r() - 1.5) * sx)), Math.max(0.02, Math.min(0.98, cy + (r() + r() + r() - 1.5) * sy)), 0.35 + r() * 0.65]);
    }
    return out;
  }
  function heatSVG(pts) {
    var W = 105, H = 68;
    return '<svg class="heat" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Mapa de calor del jugador. Ataca hacia la derecha.">' +
      '<defs><radialGradient id="hg"><stop offset="0" stop-color="#ef4444" stop-opacity=".95"/><stop offset=".35" stop-color="#f97316" stop-opacity=".7"/><stop offset=".7" stop-color="#facc15" stop-opacity=".25"/><stop offset="1" stop-color="#facc15" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="hp" x1="0" x2="1"><stop offset="0" stop-color="#0d3a27"/><stop offset=".5" stop-color="#145a3a"/><stop offset="1" stop-color="#0d3a27"/></linearGradient></defs>' +
      '<rect width="' + W + '" height="' + H + '" fill="url(#hp)"/>' +
      pts.map(function (q) { return '<circle cx="' + (q[0] * W).toFixed(1) + '" cy="' + (q[1] * H).toFixed(1) + '" r="' + (7 + num(q[2], .5) * 5).toFixed(1) + '" fill="url(#hg)" opacity="' + (0.35 + num(q[2], .5) * 0.5).toFixed(2) + '"/>'; }).join('') +
      '<g fill="none" stroke="rgba(255,255,255,.45)" stroke-width=".4"><rect x="1" y="1" width="103" height="66"/><line x1="52.5" y1="1" x2="52.5" y2="67"/><circle cx="52.5" cy="34" r="9.15"/><rect x="1" y="13.85" width="16.5" height="40.3"/><rect x="87.5" y="13.85" width="16.5" height="40.3"/><rect x="1" y="24.85" width="5.5" height="18.3"/><rect x="98.5" y="24.85" width="5.5" height="18.3"/></g>' +
      '<path d="M88 63h10m-3-2.2 3 2.2-3 2.2" stroke="rgba(255,255,255,.7)" stroke-width=".6" fill="none"/></svg>';
  }
  var POS_TXT = { GK: 'Portero', DEF: 'Defensa', MID: 'Centrocampista', FWD: 'Delantero' };
  function openPlayer(side, i, bench) {
    var d = S.detail; if (!d) return;
    var fx, m;
    if (d.kind === 'live') { fx = T.liveDemo; m = { lineups: fx.lineups, playerHeat: fx.playerHeat }; }
    else { fx = V.fixture(T, d.id); m = V.matchDetail(T, d.id); }
    if (!m || !m.lineups || !m.lineups[side]) return;
    var p = arr(bench ? m.lineups[side].bench : m.lineups[side].players)[i]; if (!p) return;
    var code = fx[side], kv = kitVars(code), rc = ratingColor(p.rating);
    var played = num(p.minutes) > 0 || p.rating != null;
    var cards = (p.red ? 'Tarjeta roja' : p.yellow ? 'Tarjeta amarilla' : '');
    var sh = $('#playerSheet');
    sh.setAttribute('aria-labelledby', 'psName');
    sh.innerHTML = '<div class="sheet-grab" aria-hidden="true"></div>' +
      '<div class="ps-head"><span class="ps-av" style="' + kv.style + '">' + (kv.striped ? '<span style="background:rgba(0,0,0,.55);color:#fff;border-radius:50%;width:38px;height:38px;display:grid;place-items:center">' + esc(p.num != null ? p.num : '·') + '</span>' : esc(p.num != null ? p.num : '·')) + '</span>' +
        '<div><h2 class="ps-name" id="psName">' + esc(p.name) + '</h2><p class="ps-sub">' + esc(POS_TXT[p.pos] || p.pos || '') + ' · ' + esc(nameOf(code)) + (cards ? ' · ' + cards : '') + (p.subOut ? ' · Sustituido ' + esc(p.subOut) + '\'' : '') + (p.sub ? ' · Entró ' + esc(p.subIn || '') + '\'' : '') + '</p></div>' +
        '<div class="ps-rating" style="--rc:' + rc.bg + ';--rfg:' + rc.fg + '"><b>' + fmtR(p.rating) + '</b><small>Rating</small></div></div>' +
      (played ? '<div class="ps-stats">' +
        [['Minutos', num(p.minutes)], ['Goles', num(p.goals)], ['Asist.', num(p.assists)], ['Tarjetas', num(p.yellow) + num(p.red)]].map(function (s) { return '<div class="ps-stat"><b>' + s[1] + '</b><span>' + s[0] + '</span></div>'; }).join('') + '</div>' +
        '<div class="ps-heat-h"><h3>Mapa de calor</h3><span>Ataca hacia →</span></div>' + heatSVG(heatPoints(p.name, p, m)) +
        '<div class="heat-legend">Menos <i></i> Más</div>'
        : '<div class="empty glass" style="margin:6px 0">No llegó a jugar en este partido.</div>') +
      '<p class="demo-note" style="margin-top:14px">Datos de demostración</p>' +
      '<button type="button" class="hero-cta" style="display:flex;margin:14px auto 0" data-close>Cerrar</button>';
    openSheet('playerSheet');
  }

  /* -------------------------------------------------------------- TEMPORADA */
  function renderSeason() {
    var el = $('#scr-season'), s = T.season || {};
    var tabs = [['resumen', 'Resumen'], ['resultados', 'Resultados'], ['plantilla', 'Plantilla']];
    var ti = Math.max(0, tabs.map(function (t) { return t[0]; }).indexOf(S.seasonTab));
    var body;
    if (S.seasonTab === 'resultados') {
      var played = fixtures().filter(function (f) { return f.status === 'ft'; }).slice().reverse();
      body = played.length ? groupByMonth(played).map(function (g) { return '<div class="month">' + esc(g.label) + '</div><div class="fx-list">' + g.items.map(fxRowHTML).join('') + '</div>'; }).join('')
        : '<div class="empty glass">Aún no se ha jugado ningún partido.</div>';
    } else if (S.seasonTab === 'plantilla') {
      var groups = [['POR', 'Porteros'], ['DEF', 'Defensas'], ['MED', 'Centrocampistas'], ['DEL', 'Delanteros']];
      var sq = arr(T.squad);
      body = (T.coach ? '<div class="glass squad-list" style="margin-top:16px"><div class="sq"><span class="sq-n" aria-hidden="true">DT</span><span><span class="sq-nm">' + esc(T.coach) + '</span><br><small style="color:var(--ink3)">Entrenador' + (T.coachNote ? ' · ' + esc(T.coachNote) : '') + '</small></span><span></span></div></div>' : '') +
        groups.map(function (g) {
          var ps = sq.filter(function (p) { return p.pos === g[0]; }).sort(function (a, b) { return num(a.num, 99) - num(b.num, 99); });
          if (!ps.length) return '';
          return '<div class="squad-group"><div class="sec-h"><h2 style="font-size:16px">' + g[1] + '</h2><span class="eyebrow">' + ps.length + '</span></div><div class="glass squad-list">' +
            ps.map(function (p) { return '<div class="sq"><span class="sq-n">' + esc(p.num != null ? p.num : '–') + '</span><span class="sq-nm">' + esc(p.name) + '</span><span class="sq-nat" title="Nacionalidad">' + esc(p.nat || '') + '</span></div>'; }).join('') + '</div></div>';
        }).join('') + (sq.length ? '' : '<div class="empty glass">Plantilla no disponible.</div>') +
        (T.squadNote ? '<p class="src-note">' + esc(T.squadNote) + '</p>' : '');
    } else {
      var pos = num(s.leaguePos, 0), ringPct = pos ? Math.max(0.06, (21 - pos) / 20) : 0, C = 2 * Math.PI * 44;
      var w = num(s.w), dd = num(s.d), l = num(s.l), ac = s.allComps || null;
      body =
        '<div class="season-hero glass" style="margin-top:16px">' +
          '<div class="pos-ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" fill="none" stroke="var(--line2)" stroke-width="8"/><circle cx="50" cy="50" r="44" fill="none" stroke="var(--hl)" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + (C * ringPct).toFixed(1) + ' ' + C.toFixed(1) + '"/></svg>' +
            '<div class="val"><div><b>' + (pos ? pos + 'º' : '—') + '</b><span>' + esc(T.league || 'Liga') + '</span></div></div></div>' +
          '<div><div class="sh-pts">' + num(s.points) + '<small>pts</small></div><p class="sh-note">' + num(s.played) + ' jornadas' + (s.leaderNote ? ' · ' + esc(s.leaderNote) : '') + '</p></div>' +
        '</div>' +
        '<div class="wdl glass"><div class="eyebrow">Liga · Victorias, empates y derrotas</div>' +
          '<div class="wdl-bar" role="img" aria-label="' + w + ' victorias, ' + dd + ' empates, ' + l + ' derrotas">' + (w ? '<i class="W" style="flex-grow:' + w + '"></i>' : '') + (dd ? '<i class="D" style="flex-grow:' + dd + '"></i>' : '') + (l ? '<i class="L" style="flex-grow:' + l + '"></i>' : '') + '</div>' +
          '<div class="wdl-nums"><div class="W"><b>' + w + '</b><span>Victorias</span></div><div class="D"><b>' + dd + '</b><span>Empates</span></div><div class="L"><b>' + l + '</b><span>Derrotas</span></div></div></div>' +
        '<div class="kpis"><div class="kpi glass"><b>' + num(s.gf) + '</b><span>Goles a favor</span></div><div class="kpi glass"><b>' + num(s.ga) + '</b><span>En contra</span></div><div class="kpi glass"><b>' + (num(s.gf) - num(s.ga) > 0 ? '+' : '') + (num(s.gf) - num(s.ga)) + '</b><span>Diferencia</span></div></div>' +
        '<div class="form-card glass"><div><div class="eyebrow">Racha</div><p style="font-size:12.5px;color:var(--ink2);margin-top:4px">Últimos ' + arr(s.form).length + ' partidos</p></div>' + formHTML(s.form, true) + '</div>' +
        (ac ? '<p class="note" style="padding-top:12px">Todas las competiciones: <b style="color:var(--ink)">' + num(ac.played) + ' PJ · ' + num(ac.w) + 'V ' + num(ac.d) + 'E ' + num(ac.l) + 'D · ' + num(ac.gf) + '–' + num(ac.ga) + '</b></p>' : '') +
        (arr(s.competitions).length ? '<div class="sec"><div class="sec-h"><h2>Competiciones</h2></div><div class="comps">' + arr(s.competitions).map(function (c) {
          return '<div class="comp-row glass"><span class="comp-ic" aria-hidden="true">' + esc(c.icon || '🏆') + '</span><span><b>' + esc(c.name) + '</b><small>' + esc(c.status || '') + '</small></span><span class="state ' + (c.state === 'up' ? 'up' : 'run') + '">' + (c.state === 'up' ? 'Próximamente' : 'En juego') + '</span></div>';
        }).join('') + '</div></div>' : '') +
        (arr(T.honours).length ? '<div class="sec"><div class="sec-h"><h2>Palmarés</h2></div><div class="honours">' + arr(T.honours).map(function (h) { return '<div class="honour glass"><b>' + num(h.count) + '</b><span>' + esc(h.label) + '</span></div>'; }).join('') + '</div>' + (T.honoursNote ? '<p class="note">' + esc(T.honoursNote) + '</p>' : '') + '</div>' : '') +
        (s.source ? '<p class="src-note">Fuente: ' + esc(s.source) + '</p>' : '');
    }
    el.innerHTML =
      '<div class="page-title"><div><h1>Temporada</h1><p>' + esc(seasonLabel()) + ' · ' + esc(T.league || '') + '</p></div></div>' +
      '<div class="seg" role="tablist" aria-label="Secciones de la temporada" style="--n:3"><span class="seg-ind" style="width:calc((100% - 8px)/3);transform:translateX(' + (ti * 100) + '%)"></span>' +
        tabs.map(function (t, i) { return '<button type="button" role="tab" aria-selected="' + (i === ti) + '" tabindex="' + (i === ti ? 0 : -1) + '" data-act="season-tab" data-v="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<div role="tabpanel" aria-label="' + tabs[ti][1] + '">' + body + '</div>';
  }

  /* --------------------------------------------------------------- HISTORIA */
  function likeBase(id) { return 800 + hash(S.teamId + id) % 9200; }
  function fmtK(n) { return n >= 1000 ? (n / 1000).toFixed(1).replace('.', ',') + ' mil' : String(n); }
  function storyHTML(h, i, total) {
    var so = soc(), liked = !!so.liked[h.id], saved = !!so.saved[h.id];
    var cw = h.colorway === 'accent' ? 'cw-accent' : h.colorway === 'dark' ? 'cw-dark' : 'cw-primary';
    var badge = String(h.badge || '');
    return '<article class="story ' + cw + '" data-story="' + esc(h.id) + '" aria-roledescription="historia" aria-label="' + (i + 1) + ' de ' + total + ': ' + esc(h.title) + '">' +
      '<div class="story-lights" aria-hidden="true"></div>' +
      (badge ? '<span class="story-badge' + (badge.length > 2 ? ' long' : '') + '" aria-hidden="true">' + esc(badge) + '</span>' : '') +
      '<p class="story-kicker">' + esc(h.kicker || '') + '</p>' +
      '<h2>' + esc(h.title) + '</h2>' +
      (h.subtitle ? '<p class="story-sub">' + esc(h.subtitle) + '</p>' : '') +
      (h.score ? '<div class="story-score"><div class="row"><span>' + esc(h.score.home) + '</span><span class="num">' + esc(h.score.hs) + ' – ' + esc(h.score.as) + '</span><span>' + esc(h.score.away) + '</span></div>' + (h.score.caption ? '<small>' + esc(h.score.caption) + '</small>' : '') + '</div>' : '') +
      (arr(h.grid).length ? '<div class="story-grid">' + arr(h.grid).map(function (g) { return '<div><b>' + esc(g.value) + '</b><span>' + esc(g.label) + '</span></div>'; }).join('') + '</div>' : '') +
      (arr(h.bullets).length ? '<ul>' + arr(h.bullets).map(function (b) { return '<li>' + rich(b) + '</li>'; }).join('') + '</ul>' : '') +
      (h.fact ? '<p class="story-fact"><b>Dato · </b>' + esc(h.fact) + '</p>' : '') +
      (h.fixtureId && V.fixture(T, h.fixtureId) ? '<button type="button" class="hero-cta" style="align-self:flex-start" data-act="open-fx" data-id="' + esc(h.fixtureId) + '">Ver el partido →</button>' : '') +
      '<div class="story-rail">' +
        '<button type="button" class="srail-btn like" data-act="like" data-id="' + esc(h.id) + '" aria-pressed="' + liked + '" aria-label="Me gusta"><span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg></span><span data-count>' + fmtK(likeBase(h.id) + (liked ? 1 : 0)) + '</span></button>' +
        '<button type="button" class="srail-btn save" data-act="save" data-id="' + esc(h.id) + '" aria-pressed="' + saved + '" aria-label="Guardar"><span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v16l-6-4-6 4z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg></span><span>' + (saved ? 'Guardado' : 'Guardar') + '</span></button>' +
        '<button type="button" class="srail-btn" data-act="share" data-id="' + esc(h.id) + '" aria-label="Compartir"><span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-2.5-6.5z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg></span><span>Compartir</span></button>' +
      '</div></article>';
  }
  function historyList() {
    var so = soc();
    return arr(T.history).filter(function (h) {
      if (S.histCat === 'all') return true;
      if (S.histCat === 'saved') return !!so.saved[h.id];
      return h.cat === S.histCat || arr(h.cats).indexOf(S.histCat) >= 0;
    });
  }
  function renderHistory() {
    var el = $('#scr-history');
    var cats = arr(T.historyCategories).length ? arr(T.historyCategories) : [['all', 'Todo']];
    if (S.histCat !== 'saved' && !cats.some(function (c) { return c[0] === S.histCat; })) S.histCat = 'all';
    var list = historyList();
    var nSaved = Object.keys(soc().saved).filter(function (k) { return soc().saved[k]; }).length;
    el.innerHTML =
      '<div class="story-chips"><div class="chips" role="group" aria-label="Categorías de historia">' +
        cats.map(function (c) { return '<button type="button" class="chip" data-act="hist-cat" data-v="' + esc(c[0]) + '" aria-pressed="' + (S.histCat === c[0]) + '">' + esc(c[1]) + '</button>'; }).join('') +
        '<button type="button" class="chip" data-act="hist-cat" data-v="saved" aria-pressed="' + (S.histCat === 'saved') + '">🔖 Guardados' + (nSaved ? ' (' + nSaved + ')' : '') + '</button>' +
      '</div></div>' +
      (list.length ? '<span class="story-count" aria-hidden="true" id="storyCount">1 / ' + list.length + '</span>' : '') +
      '<div class="feed" id="feed" tabindex="0" aria-label="Historias del club. Desliza verticalmente.">' +
        (list.length ? list.map(function (h, i) { return storyHTML(h, i, list.length); }).join('')
          : '<div class="story story-empty cw-dark"><div><span style="font-size:44px" aria-hidden="true">🔖</span><h2 style="font-size:22px;margin-top:10px">' + (S.histCat === 'saved' ? 'Aún no has guardado historias' : 'Sin historias en esta categoría') + '</h2><p class="story-sub">' + (S.histCat === 'saved' ? 'Pulsa «Guardar» en cualquier historia para encontrarla aquí.' : '') + '</p></div></div>') +
      '</div>';
    var feed = $('#feed', el), cnt = $('#storyCount', el);
    if (feed && cnt) feed.addEventListener('scroll', function () {
      var i = Math.round(feed.scrollTop / Math.max(1, feed.clientHeight));
      cnt.textContent = Math.min(list.length, i + 1) + ' / ' + list.length;
    }, { passive: true });
  }
  function toggleSocial(kind, id, btn) {
    var so = soc(), map = kind === 'like' ? so.liked : so.saved;
    map[id] = !map[id]; if (!map[id]) delete map[id];
    store.set('social', S.social);
    var on = !!map[id];
    btn.setAttribute('aria-pressed', on);
    if (kind === 'like') {
      $('[data-count]', btn).textContent = fmtK(likeBase(id) + (on ? 1 : 0));
      if (on) heartPop(btn.closest('.story'));
    } else {
      btn.lastElementChild.textContent = on ? 'Guardado' : 'Guardar';
      toast(on ? 'Guardado en tu colección' : 'Quitado de guardados');
      var savedChip = $('[data-act="hist-cat"][data-v="saved"]');
      var n = Object.keys(so.saved).length;
      if (savedChip) savedChip.textContent = '🔖 Guardados' + (n ? ' (' + n + ')' : '');
    }
  }
  function heartPop(story) {
    if (!story || reduced()) return;
    var h = document.createElement('span'); h.className = 'story-heart'; h.textContent = '❤️'; h.setAttribute('aria-hidden', 'true');
    story.appendChild(h); setTimeout(function () { h.remove(); }, 950);
  }

  /* -------------------------------------------------------------------- MÁS */
  function renderMore() {
    var el = $('#scr-more'), st = T.stadium || {};
    var info = [['Estadio', st.name], ['Ciudad', st.city], ['Aforo', st.capacity ? Number(st.capacity).toLocaleString('es-ES') + (st.capacityNote ? ' · ' + st.capacityNote.toLowerCase() : '') : null],
      ['Entrenador', T.coach], ['Fundación', T.founded], ['Liga', T.league], ['País', T.country], ['Hashtag', T.hashtag]];
    function sw(k, title, sub) {
      var on = k === 'dark' ? S.theme !== 'light' : !!S.prefs[k];
      return '<div class="set-row"><span id="lbl-' + k + '"><b>' + title + '</b><small>' + sub + '</small></span><button type="button" class="switch" role="switch" aria-checked="' + on + '" aria-labelledby="lbl-' + k + '" data-act="pref" data-k="' + k + '"></button></div>';
    }
    el.innerHTML =
      '<div class="page-title"><div><h1>Más</h1><p>Club, ajustes e información</p></div></div>' +
      '<div class="club-card glass">' + mono(T.code) + '<h2>' + esc(T.name) + '</h2><p class="motto">' + esc(T.motto || '') + '</p>' +
        '<button type="button" class="switch-btn" data-act="open-teams">Cambiar de club</button></div>' +
      '<div class="sec"><div class="sec-h"><h2>El club</h2></div><div class="info-rows glass" style="margin-top:0">' +
        info.filter(function (r) { return r[1] != null && r[1] !== ''; }).map(function (r) { return '<div class="info-row"><span>' + r[0] + '</span><b>' + esc(r[1]) + '</b></div>'; }).join('') + '</div></div>' +
      '<div class="sec"><div class="sec-h"><h2>Ajustes</h2></div><div class="settings glass">' +
        sw('notif', 'Notificaciones de partidos', 'Aviso antes de cada partido') +
        sw('goals', 'Alertas de gol', 'Celebración a pantalla completa en directo') +
        sw('dark', 'Modo oscuro', 'Ambiente de estadio de noche') +
        sw('lights', 'Luces del estadio', 'Focos animados en el fondo') +
        sw('reduce', 'Reducir movimiento', 'Menos animaciones y transiciones') +
      '</div></div>' +
      '<div class="sec"><div class="sec-h"><h2>Acerca de</h2></div><div class="info-rows glass" style="margin-top:0">' +
        '<div class="info-row"><span>App</span><b>vic-fut · Estadio</b></div>' +
        '<div class="info-row"><span>Versión</span><b>Prototipo A · datos v' + esc(V.version || 1) + '</b></div>' +
        '<div class="info-row"><span>Temporada</span><b>' + esc(seasonLabel()) + (T.season && T.season.isDemo ? ' · demo' : '') + '</b></div>' +
      '</div>' +
      '<p class="src-note">Los clubes se muestran solo con monograma y colores: sin escudos ni logotipos oficiales. ' + (T.season && T.season.isDemo ? 'Los datos de la temporada son de demostración. ' : '') + 'Ratings y mapas de calor de demostración.</p></div>' +
      '<p class="credit">Inspirado en patrones de MLS, Apple Sports (vía Mobbin)</p>';
  }

  /* ---------------------------------------------------------- selector club */
  function renderTeamList() {
    $('#teamList').innerHTML = arr(V.order).filter(function (id) { return V.teams[id]; }).map(function (id) {
      var t = V.teams[id], c = t.colors || {}, sel = id === S.teamId;
      return '<button type="button" class="team-opt" role="radio" aria-checked="' + sel + '" data-act="pick-team" data-id="' + esc(id) + '" style="--t-p:' + c.primary + ';--t-pd:' + c.primaryDark + ';--t-a:' + c.accent + ';--t-on:' + (c.onPrimary || '#fff') + ';--t-ona:' + (c.onAccent || '#111') + '">' +
        mono(t.code) + '<span><span class="team-opt-name">' + esc(t.name) + '</span><span class="team-opt-sub" style="display:block">' + esc(t.stadium ? t.stadium.name + ' · ' + t.stadium.city : t.league) + '</span><span class="team-opt-motto" style="display:block">' + esc(t.motto || '') + '</span></span>' +
        '<span class="team-opt-check" aria-hidden="true">' + (sel ? '✓' : '') + '</span></button>';
    }).join('');
    $('#teamList').setAttribute('role', 'radiogroup');
    $('#teamList').setAttribute('aria-label', 'Clubes');
  }

  /* ================================================================= NAV */
  function setTab(tab) {
    if (['home', 'matches', 'history', 'season', 'more'].indexOf(tab) < 0) tab = 'home';
    S.tab = tab;
    $all('.screen').forEach(function (s) { s.hidden = s.getAttribute('data-screen') !== tab; });
    $all('.tab').forEach(function (b) { if (b.getAttribute('data-tab') === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    $('#topbar').classList.toggle('is-overlay', tab === 'history');
    if (S.detail) closeDetail();
  }

  var themeBusy = false;
  function setTeam(id, opts) {
    opts = opts || {};
    if (!V.teams[id]) return;
    if (id === S.teamId && !opts.force) return;
    var first = !T;
    function swap() {
      var keepDetail = S.detail;
      S.teamId = id; T = V.getTeam(id);
      store.set('team', id);
      S.compFilter = 'all'; S.seasonSel = null; S.histCat = 'all';
      liveReset();
      if (keepDetail) {
        if (keepDetail.kind === 'live') S.detail = T.liveDemo ? keepDetail : null;
        else if (T.featuredMatch) S.detail = { kind: 'fx', id: T.featuredMatch.fixtureId, tab: keepDetail.tab || 'ratings' };
        else S.detail = null;
        if (!S.detail) { $('#detail').hidden = true; $('#detail').innerHTML = ''; }
      }
      applyTheme();
      renderAll({ retheme: !first });
      try { var u = new URL(location.href); u.searchParams.set('team', id); history.replaceState(null, '', u); } catch (e) { /* file:// u otros */ }
    }
    if (first || reduced() || opts.instant) { swap(); return; }
    if (themeBusy) { swap(); return; }
    themeBusy = true;
    var w = $('#themeWipe'), t = V.teams[id], c = t.colors || {};
    var pill = $('#clubPill').getBoundingClientRect(), a = app.getBoundingClientRect();
    w.style.setProperty('--wx', ((pill.left + 22 - a.left) / a.width * 100) + '%');
    w.style.setProperty('--wy', ((pill.top + 22 - a.top) / a.height * 100) + '%');
    w.style.setProperty('--w-p', c.primary); w.style.setProperty('--w-pd', c.primaryDark); w.style.setProperty('--w-on', c.onPrimary || '#fff');
    $('#wipeMono').textContent = t.monogram || t.code;
    w.classList.remove('go'); void w.offsetWidth; w.classList.add('go');
    setTimeout(swap, 520);
    setTimeout(function () { w.classList.remove('go'); themeBusy = false; }, 1200);
  }
  window.setTeam = setTeam;

  /* ---------------------------------------------------------------- toast */
  function toast(msg, quiet) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('show'); }, quiet ? 2200 : 1800);
  }
  function share(title, text) {
    var url = location.href.split('#')[0];
    if (navigator.share) { navigator.share({ title: title, text: text, url: url }).catch(function () {}); return; }
    var done = function () { toast('Enlace copiado'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text + ' · ' + url).then(done, function () { toast('Compartir no disponible'); });
    else toast('Compartir no disponible');
  }

  /* --------------------------------------------------------------- eventos */
  app.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]') || e.target.id === 'scrim') { closeSheets(); return; }
    var tabBtn = e.target.closest('.tab');
    if (tabBtn) { setTab(tabBtn.getAttribute('data-tab')); $('#scr-' + S.tab).scrollTop = 0; return; }
    if (e.target.closest('#clubPill')) { openSheet('teamSheet'); return; }
    if (e.target.closest('#bellBtn')) {
      S.prefs.notif = !S.prefs.notif; store.set('prefs', S.prefs); renderMore();
      toast(S.prefs.notif ? '🔔 Avisos de partido activados' : '🔕 Avisos de partido desactivados'); return;
    }
    var b = e.target.closest('[data-act]'); if (!b) return;
    var act = b.getAttribute('data-act'), v = b.getAttribute('data-v'), id = b.getAttribute('data-id');
    switch (act) {
      case 'open-fx': openDetail({ kind: 'fx', id: id, tab: 'ratings' }); break;
      case 'open-live': openDetail({ kind: 'live', tab: 'summary' }); break;
      case 'close-detail': closeDetail(); break;
      case 'goto': setTab(b.getAttribute('data-tab')); $('#scr-' + S.tab).scrollTop = 0; break;
      case 'comp': S.compFilter = v; renderMatches(); focusSame('comp', v); break;
      case 'season-sel': S.seasonSel = v; S.compFilter = 'all'; renderMatches(); focusSame('season-sel', v); break;
      case 'dtab': S.detail.tab = v; renderDetail(true); focusSame('dtab', v); break;
      case 'season-tab': S.seasonTab = v; renderSeason(); focusSame('season-tab', v); break;
      case 'player': openPlayer(b.getAttribute('data-side'), +b.getAttribute('data-i'), b.getAttribute('data-bench') === '1'); break;
      case 'hist-cat': S.histCat = v; renderHistory(); focusSame('hist-cat', v); break;
      case 'like': case 'save': toggleSocial(act, id, b); if (act === 'save' && S.histCat === 'saved') { renderHistory(); } break;
      case 'share': {
        var h = arr(T.history).filter(function (x) { return x.id === id; })[0];
        if (h) share(h.title, T.name + ' · ' + h.title); break;
      }
      case 'share-match': share('vic-fut', T.name + ' · ' + $('.detail-nav .ttl').textContent); break;
      case 'open-teams': openSheet('teamSheet'); break;
      case 'pick-team': closeSheets(); setTeam(id); break;
      case 'pref': {
        var k = b.getAttribute('data-k');
        if (k === 'dark') { S.theme = S.theme === 'light' ? 'dark' : 'light'; store.set('theme', S.theme); }
        else { S.prefs[k] = !S.prefs[k]; store.set('prefs', S.prefs); }
        applyTheme();
        b.setAttribute('aria-checked', k === 'dark' ? S.theme !== 'light' : !!S.prefs[k]);
        break;
      }
      case 'live-replay': liveReset(); renderAll(); break;
    }
  });
  function focusSame(act, v) {
    var el = $('[data-act="' + act + '"][data-v="' + v + '"]'); if (el) el.focus({ preventScroll: true });
  }
  // Doble toque en una historia = me gusta
  app.addEventListener('dblclick', function (e) {
    var st = e.target.closest('.story[data-story]'); if (!st || e.target.closest('button')) return;
    var btn = $('[data-act="like"]', st); if (btn && btn.getAttribute('aria-pressed') !== 'true') toggleSocial('like', st.getAttribute('data-story'), btn);
    else heartPop(st);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if ($('.sheet:not([hidden])')) closeSheets(); else if (S.detail) closeDetail();
      return;
    }
    // Flechas en pestañas (role=tab)
    var tab = e.target.closest && e.target.closest('[role="tab"]');
    if (tab && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      var list = $all('[role="tab"]', tab.parentNode), i = list.indexOf(tab);
      var nx = list[(i + (e.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length];
      nx.click(); e.preventDefault();
    }
    // Trampa de foco en hojas
    var sh = $('.sheet:not([hidden])');
    if (sh && e.key === 'Tab') {
      var f = $all('button, [href], [tabindex]:not([tabindex="-1"])', sh);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { f[f.length - 1].focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { f[0].focus(); e.preventDefault(); }
    }
  });

  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'vicfut:team') setTeam(e.data.team);
  });
  if (reduceMQ.addEventListener) reduceMQ.addEventListener('change', function () { app.classList.toggle('reduce', !!S.prefs.reduce); });

  /* ---------------------------------------------------------------- inicio */
  var params = new URLSearchParams(location.search);
  var startTeam = params.get('team');
  if (!V.teams[startTeam]) startTeam = store.get('team', null);
  if (!V.teams[startTeam]) startTeam = V.defaultTeam && V.teams[V.defaultTeam] ? V.defaultTeam : arr(V.order)[0];
  setTeam(startTeam, { force: true });

  var scr = params.get('screen');
  if (scr === 'match') {
    setTab('matches');
    if (T.featuredMatch) openDetail({ kind: 'fx', id: T.featuredMatch.fixtureId, tab: 'ratings' });
  } else if (scr === 'live') {
    setTab('home'); if (T.liveDemo) openDetail({ kind: 'live', tab: 'summary' });
  } else {
    setTab(scr || 'home');
  }

  setInterval(tickCountdowns, 1000);
})();
