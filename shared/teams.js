/* =====================================================================
   vic-fut · datos compartidos de equipos (window.VICFUT)
   ---------------------------------------------------------------------
   Un solo archivo, sin módulos ni dependencias. Se carga con:
     <script src="../../shared/teams.js"></script>
   Esquema documentado en shared/README.md.

   Fuentes / fiabilidad:
   · Real Madrid (rm): datos tomados del prototipo original (resultados
     2026/27 hasta el 7-nov-2026, noticias, historia, palmarés, plantilla
     y partidos de demostración). Ratings = DEMO.
   · Barcelona (fcb) y Manchester United (mu): temporada 2026/27 = DEMO
     (no verificable). Historia y palmarés = hechos históricos reales;
     los recuentos de títulos están "a fecha de 2024/25".
   · Sin escudos ni logos oficiales: cada club = monograma + colores.
   · Horas de los partidos en hora peninsular española (Europe/Madrid).
   ===================================================================== */
(function (root) {
  'use strict';

  /* ------------------------------------------------------------------
     Utilidades internas para construir datos (no forman parte del API)
     ------------------------------------------------------------------ */
  var WARN = [];

  function stripes(a, b) {
    return 'repeating-linear-gradient(90deg,' + a + ' 0 7px,' + b + ' 7px 14px)';
  }
  function hoops(a, b) {
    return 'repeating-linear-gradient(0deg,' + a + ' 0 7px,' + b + ' 7px 14px)';
  }
  function minNum(m) {
    var n = parseInt(String(m), 10);
    return isNaN(n) ? 0 : Math.min(90, n);
  }

  // Generador determinista de puntos para mapas de calor DEMO.
  // x: 0 = propia portería → 1 = portería rival. y: 0 = banda izquierda → 1 = banda derecha.
  function heat(cx, cy, sx, sy, n, seed) {
    var s = seed || 7, out = [], i;
    function r() { s = (s * 9301 + 49297) % 233280; return s / 233280; }
    for (i = 0; i < n; i++) {
      var x = cx + (r() + r() + r() - 1.5) * sx;
      var y = cy + (r() + r() + r() - 1.5) * sy;
      x = Math.max(0.02, Math.min(0.98, x));
      y = Math.max(0.02, Math.min(0.98, y));
      out.push([Math.round(x * 100) / 100, Math.round(y * 100) / 100, Math.round((0.35 + r() * 0.65) * 100) / 100]);
    }
    return out;
  }

  // Construye una alineación a partir de la formación.
  // xi: [[dorsal, nombre, rating], ...] en orden: portero y luego cada línea
  //     de izquierda a derecha (desde el punto de vista del equipo).
  // bench: [[dorsal, nombre, rating|null, 'GK'|'DEF'|'MID'|'FWD'], ...]
  function lineup(formation, coach, xi, bench) {
    var rows = [1].concat(formation.split('-').map(Number));
    var players = [], k = 0, r, i;
    for (r = 0; r < rows.length; r++) {
      for (i = 0; i < rows[r]; i++) {
        var p = xi[k++];
        if (!p) { WARN.push('Faltan jugadores para ' + formation); continue; }
        players.push({
          num: p[0], name: p[1], rating: p[2],
          pos: r === 0 ? 'GK' : r === 1 ? 'DEF' : r === rows.length - 1 ? 'FWD' : 'MID',
          x: Math.round(((i + 1) / (rows[r] + 1)) * 100) / 100, row: r,
          minutes: 90, goals: 0, assists: 0, yellow: 0, red: 0
        });
      }
    }
    if (k !== xi.length) WARN.push('Sobran jugadores en ' + formation + ' (' + xi.length + ')');
    return {
      formation: formation, coach: coach, players: players,
      bench: (bench || []).map(function (b) {
        return { num: b[0], name: b[1], rating: b[2] == null ? null : b[2], pos: b[3] || null,
                 minutes: 0, goals: 0, assists: 0, yellow: 0, red: 0, sub: false };
      })
    };
  }

  // Aplica los eventos a las alineaciones (goles, asistencias, tarjetas,
  // cambios y minutos) y rellena detail cuando falta.
  function applyEvents(lineups, events, label) {
    function find(side, name) {
      var L = lineups[side], all = L.players.concat(L.bench), i;
      for (i = 0; i < all.length; i++) if (all[i].name === name) return all[i];
      WARN.push(label + ': jugador no encontrado "' + name + '" (' + side + ')');
      return null;
    }
    events.forEach(function (e) {
      var p = e.player ? find(e.side, e.player) : null, m = minNum(e.min);
      if (e.type === 'goal') {
        if (p) p.goals++;
        if (e.assist) { var a = find(e.side, e.assist); if (a) a.assists++; }
        if (!e.detail) e.detail = e.assist ? 'Asist. ' + e.assist : '';
      } else if (e.type === 'yellow') {
        if (p) p.yellow++;
        if (!e.detail) e.detail = 'Tarjeta amarilla';
      } else if (e.type === 'red') {
        if (p) { p.red++; p.minutes = m; }
        if (!e.detail) e.detail = 'Tarjeta roja';
      } else if (e.type === 'sub') {
        var out = e.playerOut ? find(e.side, e.playerOut) : null;
        if (p) { p.sub = true; p.subIn = String(e.min); p.minutes = Math.max(1, 90 - m); }
        if (out) { out.subOut = String(e.min); out.minutes = m; }
        if (!e.detail) e.detail = e.playerOut ? 'Entra por ' + e.playerOut : 'Cambio';
      }
      if (e.detail == null) e.detail = '';
    });
  }

  function match(def) {
    var lu = { home: def.home, away: def.away };
    applyEvents(lu, def.events, def.fixtureId);
    var out = {
      fixtureId: def.fixtureId,
      ratingsDemo: true,
      lineups: lu,
      events: def.events,
      stats: def.stats,
      playerHeat: def.playerHeat || {}
    };
    if (def.note) out.note = def.note;
    return out;
  }

  // Fixture compacto: [id, fecha, hora, comp, ronda, local, visitante, estado, gl, gv, extra]
  function F(id, date, time, comp, round, home, away, status, hs, as, extra) {
    var f = { id: id, date: date, time: time || null, comp: comp, round: round || '',
              home: home, away: away, status: status };
    if (status !== 'up') { f.hs = hs; f.as = as; }
    if (extra) for (var k in extra) if (extra.hasOwnProperty(k)) f[k] = extra[k];
    return f;
  }

  /* ------------------------------------------------------------------
     Competiciones
     ------------------------------------------------------------------ */
  var comps = {
    LIG:  { name: 'LaLiga',                    short: 'LaLiga',     color: '#00529f', bg: '#e8f1fb', icon: '🇪🇸' },
    UCL:  { name: 'Champions League',          short: 'Champions',  color: '#5a2fb8', bg: '#ede7fb', icon: '⭐' },
    UEL:  { name: 'Europa League',             short: 'Europa L.',  color: '#d95f00', bg: '#fdeedf', icon: '🟠' },
    CDR:  { name: 'Copa del Rey',              short: 'Copa',       color: '#b07a00', bg: '#fdf0d9', icon: '👑' },
    SUP:  { name: 'Supercopa de España',       short: 'Supercopa',  color: '#0f7a52', bg: '#e3f6ee', icon: '🛡️' },
    SUE:  { name: 'Supercopa de Europa',       short: 'Sup. Europa', color: '#1d4ed8', bg: '#e6edfd', icon: '🇪🇺' },
    MUN:  { name: 'Mundial de Clubes',         short: 'Mundial',    color: '#b4235a', bg: '#fbe7ef', icon: '🌍' },
    PL:   { name: 'Premier League',            short: 'Premier',    color: '#3d195b', bg: '#efe8f5', icon: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
    FAC:  { name: 'FA Cup',                    short: 'FA Cup',     color: '#a6192e', bg: '#fbe8eb', icon: '🏆' },
    EFL:  { name: 'Carabao Cup',               short: 'Carabao',    color: '#007a3d', bg: '#e2f4ea', icon: '🥤' },
    DEMO: { name: 'Partido de demostración',   short: 'Demo',       color: '#5a6b7d', bg: '#eef1f5', icon: '🎮' }
  };

  /* ------------------------------------------------------------------
     Rivales (equipaciones genéricas, sin escudos)
     ------------------------------------------------------------------ */
  var opponents = {
    // España
    ESP: { name: 'Espanyol',        kit: { bg: stripes('#0b5cab', '#ffffff'), fg: '#0b2a55', ring: '#0b5cab' } },
    RSO: { name: 'Real Sociedad',   kit: { bg: stripes('#0067b1', '#ffffff'), fg: '#0b2a55', ring: '#0067b1' } },
    MAL: { name: 'Málaga',          kit: { bg: stripes('#2a6ebb', '#ffffff'), fg: '#0b2a55', ring: '#2a6ebb' } },
    BET: { name: 'Betis',           kit: { bg: stripes('#00954c', '#ffffff'), fg: '#063d22', ring: '#00954c' } },
    RAY: { name: 'Rayo Vallecano',  kit: { bg: '#ffffff', fg: '#d81e05', ring: '#d81e05' } },
    ELC: { name: 'Elche',           kit: { bg: '#ffffff', fg: '#0a7a3e', ring: '#0a7a3e' } },
    ATM: { name: 'Atlético',        kit: { bg: stripes('#cb3524', '#ffffff'), fg: '#1c2c5b', ring: '#1c2c5b' } },
    VIL: { name: 'Villarreal',      kit: { bg: '#ffe667', fg: '#00447c', ring: '#00447c' } },
    SEV: { name: 'Sevilla',         kit: { bg: '#ffffff', fg: '#d4021d', ring: '#d4021d' } },
    RAC: { name: 'Racing',          kit: { bg: '#ffffff', fg: '#00813f', ring: '#00813f' } },
    VAL: { name: 'Valencia',        kit: { bg: '#ffffff', fg: '#111111', ring: '#111111' } },
    CEL: { name: 'Celta',           kit: { bg: '#8ac3ee', fg: '#0b2a55', ring: '#e4002b' } },
    ALA: { name: 'Alavés',          kit: { bg: stripes('#0761af', '#ffffff'), fg: '#0b2a55', ring: '#0761af' } },
    ATH: { name: 'Athletic',        kit: { bg: stripes('#ee2523', '#ffffff'), fg: '#111111', ring: '#111111' } },
    GIR: { name: 'Girona',          kit: { bg: stripes('#d71920', '#ffffff'), fg: '#5a0b0e', ring: '#d71920' } },
    MLL: { name: 'Mallorca',        kit: { bg: '#e20613', fg: '#ffffff', ring: '#111111' } },
    GET: { name: 'Getafe',          kit: { bg: '#004fa3', fg: '#ffffff', ring: '#ffffff' } },
    OSA: { name: 'Osasuna',         kit: { bg: '#d91a21', fg: '#ffffff', ring: '#0a346f' } },
    // Europa
    INT: { name: 'Inter',           kit: { bg: stripes('#0068a8', '#111111'), fg: '#ffffff', ring: '#0068a8' } },
    ROM: { name: 'Roma',            kit: { bg: '#8e1f2f', fg: '#f0bc42', ring: '#f0bc42' } },
    RBL: { name: 'Leipzig',         kit: { bg: '#ffffff', fg: '#dd0741', ring: '#dd0741' } },
    AEK: { name: 'AEK Atenas',      kit: { bg: '#ffd400', fg: '#111111', ring: '#111111' } },
    PSV: { name: 'PSV',             kit: { bg: stripes('#ed1c24', '#ffffff'), fg: '#111111', ring: '#ed1c24' } },
    OLY: { name: 'Olympiacos',      kit: { bg: '#d7182a', fg: '#ffffff', ring: '#ffffff' } },
    BVB: { name: 'Dortmund',        kit: { bg: '#fde100', fg: '#111111', ring: '#111111' } },
    BEN: { name: 'Benfica',         kit: { bg: '#e83030', fg: '#ffffff', ring: '#ffffff' } },
    BAY: { name: 'Bayern',          kit: { bg: '#dc052d', fg: '#ffffff', ring: '#0066b2' } },
    BRU: { name: 'Brujas',          kit: { bg: stripes('#0063b2', '#111111'), fg: '#ffffff', ring: '#0063b2' } },
    NAP: { name: 'Nápoles',         kit: { bg: '#12a0d7', fg: '#ffffff', ring: '#003c82' } },
    JUV: { name: 'Juventus',        kit: { bg: stripes('#111111', '#ffffff'), fg: '#111111', ring: '#111111' } },
    FCP: { name: 'Oporto',          kit: { bg: stripes('#003f8a', '#ffffff'), fg: '#0b2a55', ring: '#003f8a' } },
    LAZ: { name: 'Lazio',           kit: { bg: '#87d8f7', fg: '#0b2a55', ring: '#0b2a55' } },
    FEN: { name: 'Fenerbahçe',      kit: { bg: stripes('#163962', '#ffed00'), fg: '#ffffff', ring: '#163962' } },
    LYO: { name: 'Lyon',            kit: { bg: '#ffffff', fg: '#14387f', ring: '#da0812' } },
    CLT: { name: 'Celtic',          kit: { bg: hoops('#018749', '#ffffff'), fg: '#063d22', ring: '#018749' } },
    AJX: { name: 'Ajax',            kit: { bg: '#ffffff', fg: '#d2122e', ring: '#d2122e' } },
    // Inglaterra
    ARS: { name: 'Arsenal',         kit: { bg: '#ef0107', fg: '#ffffff', ring: '#ffffff' } },
    FUL: { name: 'Fulham',          kit: { bg: '#ffffff', fg: '#111111', ring: '#111111' } },
    BHA: { name: 'Brighton',        kit: { bg: stripes('#0057b8', '#ffffff'), fg: '#0b2a55', ring: '#0057b8' } },
    CRY: { name: 'Crystal Palace',  kit: { bg: stripes('#1b458f', '#c4122e'), fg: '#ffffff', ring: '#1b458f' } },
    MCI: { name: 'Manchester City', kit: { bg: '#6cabdd', fg: '#0b2a55', ring: '#1c2c5b' } },
    CHE: { name: 'Chelsea',         kit: { bg: '#034694', fg: '#ffffff', ring: '#ffffff' } },
    BRE: { name: 'Brentford',       kit: { bg: stripes('#e30613', '#ffffff'), fg: '#111111', ring: '#111111' } },
    EVE: { name: 'Everton',         kit: { bg: '#003399', fg: '#ffffff', ring: '#ffffff' } },
    LIV: { name: 'Liverpool',       kit: { bg: '#c8102e', fg: '#ffffff', ring: '#f6eb61' } },
    NFO: { name: 'Nottingham Forest', kit: { bg: '#dd0000', fg: '#ffffff', ring: '#ffffff' } },
    NEW: { name: 'Newcastle',       kit: { bg: stripes('#111111', '#ffffff'), fg: '#111111', ring: '#111111' } },
    AVL: { name: 'Aston Villa',     kit: { bg: '#670e36', fg: '#95bfe5', ring: '#95bfe5' } },
    BOU: { name: 'Bournemouth',     kit: { bg: stripes('#da291c', '#111111'), fg: '#ffffff', ring: '#111111' } },
    LEI: { name: 'Leicester',       kit: { bg: '#003090', fg: '#ffffff', ring: '#fdbe11' } },
    SOU: { name: 'Southampton',     kit: { bg: stripes('#d71920', '#ffffff'), fg: '#111111', ring: '#111111' } }
  };

  /* ==================================================================
     REAL MADRID — datos del prototipo original
     ================================================================== */
  var rm = {
    id: 'rm', name: 'Real Madrid', short: 'R. Madrid', code: 'RM', monogram: 'RM',
    motto: 'Hala Madrid y Nada Más', founded: 1902, league: 'LaLiga', leagueComp: 'LIG', country: 'España',
    stadium: { name: 'Santiago Bernabéu', city: 'Madrid', capacity: 83000, capacityNote: 'Aforo aproximado' },
    coach: 'José Mourinho',
    colors: { primary: '#00529f', primaryDark: '#002f5f', accent: '#febe10', accentDark: '#c99400',
              onPrimary: '#ffffff', onAccent: '#0d1b2a', bgTint: '#e8f1fb', text: '#0d1b2a', textMuted: '#5a6b7d' },
    kit: { bg: '#ffffff', fg: '#00529f', ring: '#febe10' },
    shopLabel: 'Tienda oficial',
    hashtag: '#HalaMadridYNadaMás',
    nextMatch: { fixtureId: 'rm-u1' },
    news: [
      { icon: '⚽', tag: 'LaLiga', title: 'Valencia 0-3 Real Madrid',
        body: 'El equipo de Mourinho suma 30 puntos en 12 jornadas y es segundo, a tres del Barcelona.',
        date: '2026-11-07', dateLabel: '7 Nov' },
      { icon: '🏆', tag: 'Champions League', title: 'El PSV visita el Bernabéu el martes 24',
        body: 'Cuatro victorias en cuatro partidos de la fase liga: Inter, Roma, Leipzig y AEK.',
        date: null, dateLabel: 'Próximo' }
    ],
    newsNote: 'Resumen escrito a partir de resultados reales. En la app final las noticias llegarán de una fuente en vivo.',
    season: {
      label: '2026/27', isDemo: false, leaguePos: 2, leaderNote: 'Barcelona, líder con 33',
      source: 'Resultados hasta el 7 de noviembre de 2026 (ESPN) y calendario oficial, según el prototipo original.',
      competitions: [
        { icon: '🇪🇸', name: 'LaLiga', status: '2º · 30 pts', state: 'run' },
        { icon: '⭐', name: 'Champions League', status: '4 de 4 victorias', state: 'run' },
        { icon: '👑', name: 'Copa del Rey', status: 'Debuta en dieciseisavos', state: 'up' }
      ]
    },
    fixtures: [
      F('rm-r1',  '2026-08-22', null, 'LIG', 'Jornada 1',  'ESP', 'RM', 'ft', 1, 2),
      F('rm-r2',  '2026-08-26', null, 'LIG', 'Jornada 2',  'RM', 'RSO', 'ft', 4, 1),
      F('rm-r3',  '2026-08-30', null, 'LIG', 'Jornada 3',  'RM', 'MAL', 'ft', 4, 0),
      F('rm-r4',  '2026-09-04', null, 'LIG', 'Jornada 4',  'BET', 'RM', 'ft', 1, 0),
      F('rm-r5',  '2026-09-08', null, 'UCL', 'Fase liga · J1', 'RM', 'INT', 'ft', 2, 1),
      F('rm-r6',  '2026-09-12', null, 'LIG', 'Jornada 5',  'RM', 'RAY', 'ft', 4, 1),
      F('rm-r7',  '2026-09-15', null, 'LIG', 'Jornada 6',  'ELC', 'RM', 'ft', 2, 3),
      F('rm-r8',  '2026-09-20', null, 'LIG', 'Jornada 7',  'ATM', 'RM', 'ft', 2, 1),
      F('rm-r9',  '2026-10-10', null, 'LIG', 'Jornada 8',  'RM', 'VIL', 'ft', 1, 0),
      F('rm-r10', '2026-10-14', null, 'UCL', 'Fase liga · J2', 'ROM', 'RM', 'ft', 3, 4),
      F('rm-r11', '2026-10-18', null, 'LIG', 'Jornada 9',  'RM', 'SEV', 'ft', 4, 1),
      F('rm-r12', '2026-10-21', null, 'UCL', 'Fase liga · J3', 'RM', 'RBL', 'ft', 4, 1),
      F('rm-r13', '2026-10-25', null, 'LIG', 'Jornada 10', 'FCB', 'RM', 'ft', 1, 2, { label: 'El Clásico' }),
      F('rm-r14', '2026-11-01', null, 'LIG', 'Jornada 11', 'RAC', 'RM', 'ft', 0, 3),
      F('rm-r15', '2026-11-04', null, 'UCL', 'Fase liga · J4', 'AEK', 'RM', 'ft', 2, 3),
      F('rm-r16', '2026-11-07', null, 'LIG', 'Jornada 12', 'VAL', 'RM', 'ft', 0, 3),
      F('rm-u1',  '2026-11-21', '21:00', 'LIG', 'Jornada 13', 'RM', 'CEL', 'up'),
      F('rm-u2',  '2026-11-24', '21:00', 'UCL', 'Fase liga · J5', 'RM', 'PSV', 'up'),
      F('rm-u3',  '2026-11-28', '21:00', 'LIG', 'Jornada 14', 'RM', 'ALA', 'up'),
      F('rm-u4',  '2026-12-02', '19:00', 'LIG', 'Jornada 15', 'RSO', 'RM', 'up'),
      F('rm-u5',  '2026-12-06', '16:15', 'LIG', 'Jornada 16', 'ATH', 'RM', 'up'),
      F('rm-u6',  '2026-12-09', '21:00', 'UCL', 'Fase liga · J6', 'ARS', 'RM', 'up')
    ],
    // Partidos de temporadas anteriores con detalle (del prototipo original).
    archive: [
      F('rm-2526-clasico', '2025-10-26', null, 'LIG', 'Jornada 10', 'RM', 'FCB', 'ft', 2, 1, { season: '2025/26', label: 'El Clásico' }),
      F('rm-2526-val',     '2025-11-01', null, 'LIG', 'Jornada 11', 'RM', 'VAL', 'ft', 4, 0, { season: '2025/26' }),
      F('rm-2425-rso',     '2025-05-24', null, 'LIG', 'Jornada 38', 'RM', 'RSO', 'ft', 2, 0, { season: '2024/25' }),
      F('rm-2324-final',   '2024-06-01', null, 'UCL', 'Final', 'BVB', 'RM', 'ft', 0, 2, { season: '2023/24', venue: 'N', stadium: 'Wembley, Londres' })
    ],
    featuredMatch: match({
      fixtureId: 'rm-2526-clasico',
      note: 'Resultado y goles reales; ratings y mapas de calor DEMO.',
      home: lineup('4-4-2', 'Xabi Alonso', [
        [1, 'Courtois', 7.9],
        [18, 'Carreras', 7.0], [24, 'Huijsen', 7.4], [3, 'Militão', 7.3], [2, 'Carvajal', 7.1],
        [5, 'Bellingham', 8.3], [14, 'Tchouaméni', 7.6], [8, 'Valverde', 7.2], [15, 'Güler', 7.0],
        [7, 'Vinícius Jr', 7.4], [10, 'Mbappé', 8.1]
      ], []),
      away: lineup('4-2-3-1', 'Hansi Flick', [
        [null, 'Szczęsny', 7.6],
        [null, 'Balde', 6.4], [null, 'Eric García', 6.5], [null, 'Cubarsí', 6.7], [null, 'Koundé', 6.6],
        [null, 'De Jong', 6.8], [null, 'Pedri', 7.0],
        [null, 'Rashford', 6.5], [null, 'Fermín', 7.4], [null, 'Lamine Yamal', 6.6],
        [null, 'Ferran Torres', 6.3]
      ], []),
      events: [
        { min: '22', type: 'goal', side: 'home', player: 'Mbappé' },
        { min: '38', type: 'goal', side: 'away', player: 'Fermín' },
        { min: '43', type: 'goal', side: 'home', player: 'Bellingham' },
        { min: '52', type: 'pen_save', side: 'away', player: 'Szczęsny', detail: 'Para un penalti a Mbappé' }
      ],
      stats: [['Posesión', 48, 52], ['Remates', 14, 12], ['A puerta', 6, 4], ['Córners', 5, 7], ['Faltas', 12, 11], ['Pases', 460, 510]],
      playerHeat: {
        'Mbappé': heat(0.78, 0.38, 0.35, 0.45, 28, 11),
        'Bellingham': heat(0.62, 0.5, 0.4, 0.5, 30, 23),
        'Vinícius Jr': heat(0.74, 0.15, 0.4, 0.22, 26, 37)
      }
    }),
    extraMatches: [
      match({
        fixtureId: 'rm-2526-val',
        home: lineup('4-3-3', 'Xabi Alonso', [
          [1, 'Courtois', 7.0],
          [18, 'Carreras', 7.6], [24, 'Huijsen', 7.1], [3, 'Militão', 7.1], [8, 'Valverde', 7.3],
          [5, 'Bellingham', 7.9], [14, 'Tchouaméni', 7.2], [15, 'Güler', 7.6],
          [7, 'Vinícius Jr', 7.6], [10, 'Mbappé', 8.7], [21, 'Brahim', 7.0]
        ], []),
        away: lineup('4-4-2', 'Carlos Corberán', [
          [null, 'Dimitrievski', 6.2],
          [null, 'Gayà', 6.0], [null, 'Copete', 5.9], [null, 'Tárrega', 6.0], [null, 'Foulquier', 6.1],
          [null, 'Diego López', 6.3], [null, 'Pepelu', 6.2], [null, 'Javi Guerra', 6.4], [null, 'Rioja', 6.1],
          [null, 'Danjuma', 6.2], [null, 'Hugo Duro', 6.0]
        ], []),
        events: [
          { min: '19', type: 'goal', side: 'home', player: 'Mbappé', detail: 'Penalti' },
          { min: '31', type: 'goal', side: 'home', player: 'Mbappé', detail: 'Doblete' },
          { min: '44', type: 'goal', side: 'home', player: 'Bellingham' },
          { min: '82', type: 'goal', side: 'home', player: 'Carreras' }
        ],
        stats: [['Posesión', 66, 34], ['Remates', 18, 4], ['A puerta', 9, 1], ['Córners', 8, 2], ['Faltas', 6, 13], ['Pases', 620, 280]]
      }),
      match({
        fixtureId: 'rm-2425-rso',
        home: lineup('4-3-3', 'Carlo Ancelotti', [
          [1, 'Courtois', 7.0],
          [20, 'Fran García', 6.9], [22, 'Rüdiger', 7.0], [35, 'Asencio', 7.2], [17, 'Lucas Vázquez', 7.1],
          [5, 'Bellingham', 7.3], [10, 'Modrić', 7.8], [8, 'Valverde', 7.4],
          [7, 'Vinícius Jr', 7.5], [9, 'Mbappé', 8.6], [15, 'Güler', 7.4]
        ], []),
        away: lineup('4-3-3', 'Imanol Alguacil', [
          [null, 'Remiro', 6.6],
          [null, 'Aihen', 6.3], [null, 'Aguerd', 6.4], [null, 'Zubeldia', 6.5], [null, 'Aramburu', 6.2],
          [null, 'Brais Méndez', 6.4], [null, 'Zubimendi', 6.8], [null, 'Sučić', 6.5],
          [null, 'Barrenetxea', 6.3], [null, 'Oyarzabal', 6.4], [null, 'Kubo', 6.6]
        ], []),
        events: [
          { min: '37', type: 'goal', side: 'home', player: 'Mbappé' },
          { min: '58', type: 'goal', side: 'home', player: 'Mbappé', detail: 'Doblete' }
        ],
        stats: [['Posesión', 58, 42], ['Remates', 15, 8], ['A puerta', 6, 2], ['Córners', 6, 4], ['Faltas', 9, 11], ['Pases', 520, 380]]
      }),
      match({
        fixtureId: 'rm-2324-final',
        home: lineup('4-2-3-1', 'Edin Terzić', [
          [null, 'Kobel', 7.0],
          [null, 'Maatsen', 6.8], [null, 'Schlotterbeck', 6.9], [null, 'Hummels', 7.4], [null, 'Ryerson', 6.5],
          [null, 'Can', 6.4], [null, 'Sabitzer', 7.0],
          [null, 'Adeyemi', 6.6], [null, 'Brandt', 6.5], [null, 'Sancho', 6.9],
          [null, 'Füllkrug', 6.6]
        ], []),
        away: lineup('4-4-2', 'Carlo Ancelotti', [
          [1, 'Courtois', 8.2],
          [23, 'Mendy', 7.2], [6, 'Nacho', 7.3], [22, 'Rüdiger', 7.4], [2, 'Carvajal', 8.4],
          [12, 'Camavinga', 7.1], [8, 'Kroos', 7.6], [15, 'Valverde', 7.3], [5, 'Bellingham', 7.2],
          [7, 'Vinícius Jr', 8.0], [11, 'Rodrygo', 6.9]
        ], []),
        events: [
          { min: '74', type: 'goal', side: 'away', player: 'Carvajal', assist: 'Kroos' },
          { min: '83', type: 'goal', side: 'away', player: 'Vinícius Jr', assist: 'Bellingham' }
        ],
        stats: [['Posesión', 43, 57], ['Remates', 13, 14], ['A puerta', 4, 6], ['Córners', 5, 4], ['Faltas', 8, 9], ['Pases', 420, 560]]
      })
    ],
    liveDemo: (function () {
      var lu = {
        home: lineup('4-2-3-1', null, [
          [null, 'Tzolakis', 7.3],
          [null, 'Ortega', 6.6], [null, 'Pirola', 6.8], [null, 'Retsos', 6.5], [null, 'Rodinei', 6.4],
          [null, 'Mouzakitis', 6.7], [null, 'Hezze', 6.3],
          [null, 'Podence', 6.6], [null, 'Chiquinho', 6.9], [null, 'Gelson Martins', 6.5],
          [null, 'El Kaabi', 6.4]
        ], []),
        away: lineup('4-3-3', 'José Mourinho', [
          [1, 'Courtois', 7.1],
          [18, 'Carreras', 6.9], [4, 'Huijsen', 7.0], [22, 'Rüdiger', 6.8], [12, 'Alexander-Arnold', 7.4],
          [5, 'Bellingham', 7.3], [14, 'Tchouaméni', 7.2], [8, 'Valverde', 7.6],
          [7, 'Vinícius Jr', 7.5], [10, 'Mbappé', 8.4], [15, 'Güler', 7.8]
        ], [[11, 'Rodrygo', null, 'FWD'], [6, 'Camavinga', null, 'MID']])
      };
      var events = [
        { min: '23', type: 'goal', side: 'away', player: 'Mbappé', assist: 'Güler' },
        { min: '41', type: 'yellow', side: 'home', player: 'Hezze' },
        { min: '55', type: 'yellow', side: 'away', player: 'Tchouaméni' }
      ];
      applyEvents(lu, events, 'rm-live');
      return {
        home: 'OLY', away: 'RM', comp: 'DEMO', label: 'Partido de demostración',
        startMinute: 67, startScore: [0, 1],
        events: events,
        script: [
          { min: '72', type: 'sub', side: 'away', player: 'Camavinga', playerOut: 'Bellingham', detail: 'Entra por Bellingham' },
          { min: '78', type: 'yellow', side: 'home', player: 'Chiquinho', detail: 'Tarjeta amarilla' },
          { min: '81', type: 'sub', side: 'away', player: 'Rodrygo', playerOut: 'Vinícius Jr', detail: 'Entra por Vinícius Jr' }
        ],
        stats: [['Posesión', 38, 62], ['Remates', 5, 11], ['A puerta', 2, 5], ['Córners', 3, 6], ['Faltas', 10, 7], ['Pases', 320, 540]],
        lineups: lu
      };
    })(),
    squadNote: 'Plantilla 2026/27 según el prototipo original',
    squad: [
      { num: 1, name: 'Courtois', pos: 'POR', nat: 'BEL' }, { num: 13, name: 'Lunin', pos: 'POR', nat: 'UKR' },
      { num: 2, name: 'Asencio', pos: 'DEF', nat: 'ESP' }, { num: 3, name: 'Militão', pos: 'DEF', nat: 'BRA' },
      { num: 4, name: 'Huijsen', pos: 'DEF', nat: 'ESP' }, { num: 12, name: 'Alexander-Arnold', pos: 'DEF', nat: 'ENG' },
      { num: 16, name: 'Konaté', pos: 'DEF', nat: 'FRA' }, { num: 17, name: 'Cucurella', pos: 'DEF', nat: 'ESP' },
      { num: 18, name: 'Carreras', pos: 'DEF', nat: 'ESP' }, { num: 22, name: 'Rüdiger', pos: 'DEF', nat: 'GER' },
      { num: 23, name: 'Mendy', pos: 'DEF', nat: 'FRA' }, { num: 24, name: 'Dumfries', pos: 'DEF', nat: 'NED' },
      { num: 5, name: 'Bellingham', pos: 'MED', nat: 'ENG' }, { num: 6, name: 'Camavinga', pos: 'MED', nat: 'FRA' },
      { num: 8, name: 'Valverde', pos: 'MED', nat: 'URU' }, { num: 14, name: 'Tchouaméni', pos: 'MED', nat: 'FRA' },
      { num: 15, name: 'Arda Güler', pos: 'MED', nat: 'TUR' }, { num: 20, name: 'Bernardo Silva', pos: 'MED', nat: 'POR' },
      { num: 27, name: 'Thiago Pitarch', pos: 'MED', nat: 'ESP' },
      { num: 7, name: 'Vinícius Jr', pos: 'DEL', nat: 'BRA' }, { num: 9, name: 'Endrick', pos: 'DEL', nat: 'BRA' },
      { num: 10, name: 'Mbappé', pos: 'DEL', nat: 'FRA' }, { num: 11, name: 'Rodrygo', pos: 'DEL', nat: 'BRA' },
      { num: 19, name: 'Carlos Espí', pos: 'DEL', nat: 'ESP' }, { num: 21, name: 'Brahim', pos: 'DEL', nat: 'MAR' },
      { num: 25, name: 'Yan Diomande', pos: 'DEL', nat: 'CIV' }
    ],
    honoursNote: 'Según el prototipo original',
    honours: [
      { key: 'ucl', label: 'Champions League', count: 15 },
      { key: 'liga', label: 'Ligas', count: 36 },
      { key: 'copa', label: 'Copas del Rey', count: 20 },
      { key: 'supercopa', label: 'Supercopas de España', count: 13 },
      { key: 'supercopa_europa', label: 'Supercopas de Europa', count: 6 },
      { key: 'mundial', label: 'Mundiales / Intercont.', count: 9 }
    ],
    historyCategories: [['all', 'Todo'], ['palmares', '🏆 Palmarés'], ['europa', '⭐ Champions'], ['cr7', '7️⃣ Cristiano'],
                        ['record', '📈 Récords'], ['clasico', '⚔️ Clásicos'], ['goleada', '💥 Goleadas']],
    history: [
      { id: 'palm', cats: ['palmares'], colorway: 'primary', badge: '15', kicker: 'Palmarés · Fundado en 1902', title: 'El club más laureado',
        subtitle: 'Más Copas de Europa que nadie. Nombrado Mejor Club del Siglo XX por la FIFA.', grid: 'honours' },
      { id: 'cinco', cats: ['europa'], colorway: 'primary', badge: '5', kicker: 'Copa de Europa · 1956–1960', title: 'Cinco Copas de Europa seguidas',
        subtitle: 'El Madrid de Di Stéfano, Puskás y Gento conquistó las cinco primeras ediciones del torneo.',
        score: { home: 'Real Madrid', hs: 7, as: 3, away: 'Eintracht', caption: 'Final de 1960 · Hampden Park, Glasgow' },
        bullets: ['Campeón en <b>1956, 1957, 1958, 1959 y 1960</b>', 'En la final de 1960, <b>Puskás marcó 4</b> y <b>Di Stéfano 3</b>', 'Gento llegó a <b>6 Copas de Europa</b>, récord en solitario hasta 2024'],
        fact: 'Nadie ha vuelto a ganar cinco Copas de Europa consecutivas.' },
      { id: 'septima', cats: ['europa'], colorway: 'primary', badge: 'VII', kicker: 'Copa de Europa · 1998', title: 'La Séptima',
        subtitle: '32 años después, el Madrid volvió a reinar en Europa.',
        score: { home: 'Real Madrid', hs: 1, as: 0, away: 'Juventus', caption: '20 de mayo de 1998 · Ámsterdam' },
        bullets: ['Gol de <b>Predrag Mijatović</b> en la segunda parte', 'Entrenador: <b>Jupp Heynckes</b>', 'Fin de la sequía europea que duraba desde <b>1966</b>'],
        fact: 'Primera Copa de Europa del club en la era de la Champions League.' },
      { id: 'decima', cats: ['europa'], colorway: 'primary', badge: 'X', kicker: 'Champions League · 2014', title: 'La Décima',
        subtitle: 'La noche de Lisboa: del borde de la derrota a la gloria en el minuto 93.',
        score: { home: 'Real Madrid', hs: 4, as: 1, away: 'Atlético', caption: '24 de mayo de 2014 · Lisboa (prórroga)' },
        bullets: ['<b>Sergio Ramos</b> empató de cabeza en el 90+3', 'En la prórroga marcaron <b>Bale, Marcelo y Cristiano</b>', 'Entrenador: <b>Carlo Ancelotti</b>'],
        fact: 'El cabezazo de Ramos llegó en el 92:48, una hora que el madridismo recuerda cada año.' },
      { id: 'tres', cats: ['europa'], colorway: 'primary', badge: '3', kicker: 'Champions League · 2016–2018', title: 'Tres Champions seguidas',
        subtitle: 'El Madrid de Zidane hizo lo que nadie había logrado en la era Champions.',
        bullets: ['<b>2016</b> · Milán: 1-1 y penaltis ante el Atlético', '<b>2017</b> · Cardiff: 4-1 a la Juventus', '<b>2018</b> · Kiev: 3-1 al Liverpool, con la chilena de Bale'],
        fact: 'Primer club en defender el título desde que la Copa de Europa pasó a llamarse Champions League (1992).' },
      { id: 'remontadas', cats: ['europa'], colorway: 'primary', badge: '14', kicker: 'Champions League · 2022', title: 'La Champions de las remontadas',
        subtitle: 'PSG, Chelsea, City y Liverpool. Nadie creyó, salvo el Bernabéu.',
        score: { home: 'Real Madrid', hs: 1, as: 0, away: 'Liverpool', caption: '28 de mayo de 2022 · París' },
        bullets: ['Octavos: <b>hat-trick de Benzema</b> al PSG en 17 minutos', 'Semifinal: <b>Rodrygo</b> marcó dos goles en el 90 y 90+1 ante el City', 'Final: gol de <b>Vinícius</b> y un <b>Courtois</b> imparable'],
        fact: 'Benzema cerró aquel año con el Balón de Oro.' },
      { id: 'quince', cats: ['europa'], colorway: 'primary', badge: '15', kicker: 'Champions League · 2024', title: 'La 15ª en Wembley',
        subtitle: 'Otra final, otra copa. El Madrid amplió su leyenda en Londres.',
        score: { home: 'Dortmund', hs: 0, as: 2, away: 'Real Madrid', caption: '1 de junio de 2024 · Wembley' },
        bullets: ['<b>Carvajal</b> abrió el marcador de cabeza (74\') tras un córner de <b>Kroos</b>', '<b>Vinícius</b> sentenció en el 83\'', 'Fue el <b>último partido de Kroos</b> con el Madrid'],
        fact: 'Carvajal, Modrić, Kroos y Nacho igualaron a Gento con 6 Copas de Europa.', fixtureId: 'rm-2324-final' },
      { id: 'cr450', cats: ['cr7'], colorway: 'dark', badge: '450', kicker: 'Cristiano Ronaldo · 2009–2018', title: '450 goles de leyenda',
        subtitle: 'El máximo goleador de la historia del Real Madrid.',
        bullets: ['<b>450 goles en 438 partidos</b> oficiales', '<b>4 Champions</b> y <b>2 Ligas</b> con el Madrid', '<b>4 Balones de Oro</b> como madridista'],
        fact: 'Más de un gol por partido de media durante nueve temporadas.' },
      { id: 'chilena', cats: ['cr7'], colorway: 'dark', badge: 'CR7', kicker: 'Cristiano Ronaldo · 2018', title: 'La chilena de Turín',
        subtitle: 'Un gol tan perfecto que el estadio rival se puso en pie para aplaudirlo.',
        score: { home: 'Juventus', hs: 0, as: 3, away: 'Real Madrid', caption: '3 de abril de 2018 · Cuartos de Champions (ida)' },
        bullets: ['Cristiano marcó <b>dos goles</b> esa noche', 'La afición de la Juventus <b>le aplaudió</b>', 'Elegido <b>Gol de la Temporada</b> de la UEFA'],
        fact: 'Meses después, Cristiano fichó precisamente por la Juventus.' },
      { id: 'mestalla', cats: ['cr7', 'clasico'], colorway: 'dark', badge: '103\'', kicker: 'Cristiano Ronaldo · 2011', title: 'El cabezazo de Mestalla',
        subtitle: 'Final de Copa ante el Barça, en la prórroga y en el aire.',
        score: { home: 'Real Madrid', hs: 1, as: 0, away: 'Barcelona', caption: '20 de abril de 2011 · Final de Copa del Rey (prórroga)' },
        bullets: ['Cabezazo de <b>Cristiano</b> en el minuto 103', 'Centro de <b>Di María</b> desde la izquierda', 'Primer título del Madrid de <b>Mourinho</b>'],
        fact: 'En la celebración, a Sergio Ramos se le cayó la copa desde el autobús.' },
      { id: 'granada', cats: ['cr7', 'goleada'], colorway: 'dark', badge: '5', kicker: 'Cristiano Ronaldo · 2015', title: 'Cinco goles en un partido',
        subtitle: 'Una tarde en la que Cristiano jugó a otro deporte.',
        score: { home: 'Real Madrid', hs: 9, as: 1, away: 'Granada', caption: '5 de abril de 2015 · LaLiga' },
        bullets: ['<b>Cristiano marcó 5 goles</b>', '<b>9 goles</b> del Madrid en un solo partido', 'Esa temporada Cristiano llegó a <b>48 goles en Liga</b>'] },
      { id: 'inv40', cats: ['record'], colorway: 'accent', badge: '40', kicker: 'Récord · 2016–17', title: '40 partidos sin perder',
        subtitle: 'El Madrid de Zidane fijó el récord del fútbol español.',
        bullets: ['<b>31 victorias y 9 empates</b> entre Liga, Copa, Champions y Mundial de Clubes', 'Superó los <b>39 partidos</b> del Barcelona de 2015-16', 'El récord llegó con un gol de <b>Benzema en el 93\'</b> en Sevilla'],
        fact: 'La racha terminó el 15 de enero de 2017, con un 2-1 en el Sánchez-Pizjuán.' },
      { id: 'inv121', cats: ['record'], colorway: 'accent', badge: '121', kicker: 'Récord · 1957–1965', title: '121 partidos invicto en casa',
        subtitle: 'Ocho años sin perder un partido de Liga en casa.',
        bullets: ['<b>112 victorias y 9 empates</b>', 'Empezó en febrero de 1957 con un <b>1-0 al Deportivo</b>', 'Lo cortó el <b>Atlético</b> en 1965'],
        fact: 'Sigue siendo el récord de LaLiga de partidos seguidos sin perder en casa.' },
      { id: 'once', cats: ['clasico', 'goleada'], colorway: 'dark', badge: '11-1', kicker: 'El Clásico · 1943', title: 'El 11-1',
        subtitle: 'La mayor goleada en la historia del Clásico.',
        score: { home: 'Real Madrid', hs: 11, as: 1, away: 'Barcelona', caption: 'Junio de 1943 · Copa, semifinal (vuelta)' },
        bullets: ['Se jugó en el viejo <b>Chamartín</b>', 'El Barça había ganado la ida <b>3-0</b>', 'El Madrid remontó la eliminatoria y pasó a la final'] },
      { id: 'cien', cats: ['clasico'], colorway: 'dark', badge: '100', kicker: 'El Clásico · 2012', title: 'La Liga de los 100 puntos',
        subtitle: 'Victoria en el Camp Nou que dejó la Liga sentenciada.',
        score: { home: 'Barcelona', hs: 1, as: 2, away: 'Real Madrid', caption: '21 de abril de 2012 · Camp Nou' },
        bullets: ['Goles de <b>Khedira</b> y <b>Cristiano</b>', 'El famoso <b>"calma, calma"</b> de Cristiano', 'Aquel Madrid de <b>Mourinho</b> sumó 100 puntos y 121 goles'],
        fact: 'Primer equipo en llegar a 100 puntos en una temporada de LaLiga.' },
      { id: 'super17', cats: ['clasico'], colorway: 'dark', badge: '5-1', kicker: 'El Clásico · 2017', title: 'Supercopa de España 2017',
        subtitle: 'Doble Clásico y doble exhibición: 5-1 en el global.',
        score: { home: 'Barcelona', hs: 1, as: 3, away: 'Real Madrid', caption: 'Ida · 13 de agosto de 2017 · Camp Nou' },
        bullets: ['Vuelta en el Bernabéu: <b>2-0</b>, goles de <b>Asensio y Benzema</b>', 'Golazo de <b>Asensio</b> también en el Camp Nou', '<b>Cristiano</b> marcó en la ida'],
        fact: 'Segundo título del curso, días después de ganar la Supercopa de Europa.' },
      { id: 'super24', cats: ['clasico'], colorway: 'dark', badge: '4-1', kicker: 'El Clásico · 2024', title: 'El hat-trick de Vinícius',
        subtitle: 'Una final ante el Barça resuelta antes del descanso.',
        score: { home: 'Real Madrid', hs: 4, as: 1, away: 'Barcelona', caption: '14 de enero de 2024 · Final de la Supercopa, Riad' },
        bullets: ['<b>Vinícius marcó 3 goles</b> en la primera parte', '<b>Rodrygo</b> cerró la goleada', 'Supercopa de España número <b>13</b>'] },
      { id: 'belli', cats: ['clasico'], colorway: 'dark', badge: '91\'', kicker: 'El Clásico · 2024', title: 'Bellingham en el 91',
        subtitle: 'Remontada en el Bernabéu con un final de película.',
        score: { home: 'Real Madrid', hs: 3, as: 2, away: 'Barcelona', caption: '21 de abril de 2024 · Santiago Bernabéu' },
        bullets: ['Gol de la victoria de <b>Bellingham</b> en el minuto 91', 'El Madrid fue <b>dos veces por detrás</b> en el marcador', 'Dejó encarrilada la <b>Liga número 36</b>'] },
      { id: 'rayo', cats: ['goleada'], colorway: 'accent', badge: '10', kicker: 'Goleada · 2015', title: '10-2 al Rayo Vallecano',
        subtitle: 'Doce goles en una tarde de locura en el Bernabéu.',
        score: { home: 'Real Madrid', hs: 10, as: 2, away: 'Rayo', caption: '20 de diciembre de 2015 · LaLiga' },
        bullets: ['<b>Bale</b> firmó cuatro goles', '<b>Doble dígito</b> en un partido de Liga'] },
      { id: 'malmo', cats: ['goleada', 'cr7'], colorway: 'accent', badge: '8-0', kicker: 'Champions · 2015', title: '8-0 al Malmö',
        subtitle: 'Exhibición en la fase de grupos de la Champions.',
        score: { home: 'Real Madrid', hs: 8, as: 0, away: 'Malmö', caption: '8 de diciembre de 2015 · Fase de grupos' },
        bullets: ['<b>Cristiano marcó 4 goles</b>', 'Cerró la fase de grupos con <b>11 goles</b>, récord en esa fase'],
        fact: 'Una de las mayores goleadas del club en la historia de la Champions.' },
      { id: 'riazor', cats: ['goleada'], colorway: 'accent', badge: '2-8', kicker: 'Goleada · 2014', title: '2-8 en Riazor',
        subtitle: 'Ocho goles lejos de casa, meses después de La Décima.',
        score: { home: 'Deportivo', hs: 2, as: 8, away: 'Real Madrid', caption: '20 de septiembre de 2014 · LaLiga' },
        bullets: ['<b>Ocho goles</b> como visitante en Liga', 'El campeón de Europa, a pleno rendimiento'] }
    ]
  };

  /* ==================================================================
     FC BARCELONA — temporada 2026/27 DEMO · historia real
     ================================================================== */
  var fcb = {
    id: 'fcb', name: 'FC Barcelona', short: 'Barcelona', code: 'FCB', monogram: 'FCB',
    motto: 'Més que un club', founded: 1899, league: 'LaLiga', leagueComp: 'LIG', country: 'España',
    stadium: { name: 'Spotify Camp Nou', city: 'Barcelona', capacity: 105000, capacityNote: 'Aforo previsto al terminar la remodelación (aprox.)' },
    coach: 'Hansi Flick', coachNote: 'Orientativo (demo): no verificado para 2026/27',
    colors: { primary: '#004d98', primaryDark: '#00305f', accent: '#a50044', accentDark: '#73002f',
              onPrimary: '#ffffff', onAccent: '#ffffff', bgTint: '#eef3fb', gold: '#edbb00', onGold: '#111111',
              text: '#0d1b2a', textMuted: '#5a6b7d' },
    kit: { bg: stripes('#a50044', '#004d98'), fg: '#ffffff', ring: '#edbb00' },
    shopLabel: 'Tienda oficial',
    hashtag: '#ForçaBarça',
    nextMatch: { fixtureId: 'fcb-u1' },
    news: [
      { icon: '⚽', tag: 'LaLiga', title: 'Barcelona 3-1 Atlético',
        body: 'El equipo de Flick suma 33 puntos en 12 jornadas y es líder, tres por delante del Real Madrid.',
        date: '2026-11-07', dateLabel: '7 Nov' },
      { icon: '🏆', tag: 'Champions League', title: 'La Juventus visita el Camp Nou el miércoles 25',
        body: 'Dos victorias y dos empates en la fase liga: Benfica, Bayern, Brujas y Nápoles.',
        date: null, dateLabel: 'Próximo' },
      { icon: '⚔️', tag: 'LaLiga', title: 'Única derrota en Liga, en el Clásico',
        body: 'El 1-2 ante el Real Madrid del 25 de octubre sigue siendo el único tropiezo liguero del curso.',
        date: '2026-10-25', dateLabel: '25 Oct' }
    ],
    newsNote: 'Noticias de demostración.',
    season: {
      label: '2026/27', isDemo: true, leaguePos: 1, leaderNote: '¡Líder! Real Madrid, 2º con 30',
      source: 'Temporada de demostración: resultados no verificables. El Clásico (1-2, 25 de octubre) coincide con los datos del Real Madrid.',
      competitions: [
        { icon: '🇪🇸', name: 'LaLiga', status: '1º · 33 pts', state: 'run' },
        { icon: '⭐', name: 'Champions League', status: '2V 2E en 4 partidos', state: 'run' },
        { icon: '👑', name: 'Copa del Rey', status: 'Debuta en dieciseisavos', state: 'up' },
        { icon: '🛡️', name: 'Supercopa de España', status: 'Semifinal en enero', state: 'up' }
      ]
    },
    fixtures: [
      F('fcb-j1',  '2026-08-22', '19:30', 'LIG', 'Jornada 1',  'MLL', 'FCB', 'ft', 0, 3),
      F('fcb-j2',  '2026-08-26', '21:30', 'LIG', 'Jornada 2',  'FCB', 'GET', 'ft', 3, 0),
      F('fcb-j3',  '2026-08-30', '21:30', 'LIG', 'Jornada 3',  'OSA', 'FCB', 'ft', 1, 2),
      F('fcb-j4',  '2026-09-04', '21:00', 'LIG', 'Jornada 4',  'FCB', 'GIR', 'ft', 4, 1),
      F('fcb-c1',  '2026-09-09', '21:00', 'UCL', 'Fase liga · J1', 'FCB', 'BEN', 'ft', 3, 1),
      F('fcb-j5',  '2026-09-12', '18:30', 'LIG', 'Jornada 5',  'CEL', 'FCB', 'ft', 1, 3),
      F('fcb-j6',  '2026-09-15', '21:30', 'LIG', 'Jornada 6',  'FCB', 'ATH', 'ft', 2, 0),
      F('fcb-j7',  '2026-09-20', '21:00', 'LIG', 'Jornada 7',  'FCB', 'VAL', 'ft', 3, 1),
      F('fcb-j8',  '2026-10-10', '16:15', 'LIG', 'Jornada 8',  'BET', 'FCB', 'ft', 1, 2),
      F('fcb-c2',  '2026-10-15', '21:00', 'UCL', 'Fase liga · J2', 'BAY', 'FCB', 'ft', 2, 2),
      F('fcb-j9',  '2026-10-18', '18:30', 'LIG', 'Jornada 9',  'FCB', 'ESP', 'ft', 2, 0, { label: 'Derbi barcelonés' }),
      F('fcb-c3',  '2026-10-22', '21:00', 'UCL', 'Fase liga · J3', 'FCB', 'BRU', 'ft', 4, 0),
      F('fcb-j10', '2026-10-25', '16:15', 'LIG', 'Jornada 10', 'FCB', 'RM', 'ft', 1, 2, { label: 'El Clásico' }),
      F('fcb-j11', '2026-11-01', '14:00', 'LIG', 'Jornada 11', 'ALA', 'FCB', 'ft', 0, 2),
      F('fcb-c4',  '2026-11-05', '18:45', 'UCL', 'Fase liga · J4', 'NAP', 'FCB', 'ft', 1, 1),
      F('fcb-j12', '2026-11-07', '21:00', 'LIG', 'Jornada 12', 'FCB', 'ATM', 'ft', 3, 1, { featured: true }),
      F('fcb-u1',  '2026-11-22', '18:30', 'LIG', 'Jornada 13', 'VIL', 'FCB', 'up'),
      F('fcb-u2',  '2026-11-25', '21:00', 'UCL', 'Fase liga · J5', 'FCB', 'JUV', 'up'),
      F('fcb-u3',  '2026-11-29', '21:00', 'LIG', 'Jornada 14', 'FCB', 'RSO', 'up'),
      F('fcb-u4',  '2026-12-02', '21:30', 'LIG', 'Jornada 15', 'RAY', 'FCB', 'up'),
      F('fcb-u5',  '2026-12-06', '18:30', 'LIG', 'Jornada 16', 'FCB', 'SEV', 'up'),
      F('fcb-u6',  '2026-12-09', '21:00', 'UCL', 'Fase liga · J6', 'BVB', 'FCB', 'up')
    ],
    featuredMatch: match({
      fixtureId: 'fcb-j12',
      note: 'Partido de demostración: alineaciones, eventos, ratings y estadísticas inventados.',
      home: lineup('4-3-3', 'Hansi Flick', [
        [13, 'Joan García', 7.2],
        [3, 'Balde', 7.0], [5, 'Cubarsí', 7.4], [4, 'Araujo', 6.9], [23, 'Koundé', 7.1],
        [8, 'Pedri', 8.2], [21, 'De Jong', 7.3], [20, 'Dani Olmo', 7.0],
        [11, 'Raphinha', 7.9], [7, 'Ferran Torres', 6.8], [10, 'Lamine Yamal', 8.6]
      ], [
        [25, 'Szczęsny', null, 'GK'], [24, 'Eric García', null, 'DEF'], [18, 'Gerard Martín', null, 'DEF'],
        [17, 'Casadó', null, 'MID'], [22, 'Bernal', null, 'MID'], [16, 'Fermín', 7.8, 'MID'],
        [6, 'Gavi', 6.7, 'MID'], [28, 'Bardghji', 6.5, 'FWD']
      ]),
      away: lineup('4-4-2', 'Diego Simeone', [
        [null, 'Oblak', 6.9],
        [null, 'Hancko', 6.4], [null, 'Le Normand', 6.3], [null, 'Giménez', 6.5], [null, 'Llorente', 6.6],
        [null, 'Baena', 6.7], [null, 'Koke', 6.2], [null, 'Barrios', 6.5], [null, 'Giuliano Simeone', 6.8],
        [null, 'Julián Álvarez', 7.3], [null, 'Sørloth', 6.4]
      ], [
        [null, 'Musso', null, 'GK'], [null, 'Nahuel Molina', 6.3, 'DEF'], [null, 'Thiago Almada', 6.4, 'MID']
      ]),
      events: [
        { min: '18', type: 'goal', side: 'home', player: 'Lamine Yamal', assist: 'Pedri' },
        { min: '34', type: 'goal', side: 'away', player: 'Julián Álvarez', assist: 'Giuliano Simeone' },
        { min: '41', type: 'yellow', side: 'away', player: 'Koke' },
        { min: '52', type: 'goal', side: 'home', player: 'Raphinha', assist: 'Lamine Yamal' },
        { min: '60', type: 'sub', side: 'away', player: 'Thiago Almada', playerOut: 'Koke' },
        { min: '66', type: 'sub', side: 'home', player: 'Fermín', playerOut: 'Dani Olmo' },
        { min: '70', type: 'sub', side: 'away', player: 'Nahuel Molina', playerOut: 'Llorente' },
        { min: '73', type: 'var', side: 'home', player: 'Lamine Yamal', detail: 'El VAR anula un penalti tras revisión' },
        { min: '78', type: 'goal', side: 'home', player: 'Fermín', assist: 'Raphinha' },
        { min: '80', type: 'sub', side: 'home', player: 'Gavi', playerOut: 'Pedri' },
        { min: '85', type: 'sub', side: 'home', player: 'Bardghji', playerOut: 'Ferran Torres' },
        { min: '88', type: 'yellow', side: 'home', player: 'Araujo' }
      ],
      stats: [['Posesión', 61, 39], ['Remates', 17, 8], ['A puerta', 8, 3], ['xG', 2.6, 0.8], ['Pases', 655, 398], ['Córners', 7, 3], ['Faltas', 9, 15]],
      playerHeat: {
        'Lamine Yamal': heat(0.74, 0.84, 0.4, 0.2, 30, 5),
        'Pedri': heat(0.56, 0.4, 0.45, 0.45, 32, 17),
        'Raphinha': heat(0.72, 0.18, 0.4, 0.25, 26, 29)
      }
    }),
    liveDemo: {
      home: 'FCB', away: 'SEV', comp: 'DEMO', label: 'Partido de demostración',
      startMinute: 52, startScore: [1, 0],
      events: [{ min: '31', type: 'goal', side: 'home', player: 'Raphinha', detail: 'Asist. Pedri' }],
      script: [
        { min: '58', type: 'yellow', side: 'home', player: 'De Jong', detail: 'Tarjeta amarilla' },
        { min: '63', type: 'goal', side: 'home', player: 'Lamine Yamal', detail: 'Asist. Pedri' },
        { min: '70', type: 'sub', side: 'home', player: 'Fermín', playerOut: 'Dani Olmo', detail: 'Entra por Dani Olmo' },
        { min: '81', type: 'goal', side: 'away', player: null, detail: 'Gol del rival' },
        { min: '86', type: 'sub', side: 'home', player: 'Gavi', playerOut: 'Pedri', detail: 'Entra por Pedri' }
      ],
      stats: [['Posesión', 64, 36], ['Remates', 10, 4], ['A puerta', 4, 1], ['Córners', 5, 1], ['Faltas', 6, 9], ['Pases', 410, 230]]
    },
    squadNote: 'Plantilla orientativa (demo): jugadores de la plantilla 2025/26',
    squad: [
      { num: 13, name: 'Joan García', pos: 'POR', nat: 'ESP' }, { num: 1, name: 'Ter Stegen', pos: 'POR', nat: 'GER' },
      { num: 25, name: 'Szczęsny', pos: 'POR', nat: 'POL' },
      { num: 3, name: 'Balde', pos: 'DEF', nat: 'ESP' }, { num: 4, name: 'Araujo', pos: 'DEF', nat: 'URU' },
      { num: 5, name: 'Cubarsí', pos: 'DEF', nat: 'ESP' }, { num: 15, name: 'Christensen', pos: 'DEF', nat: 'DEN' },
      { num: 18, name: 'Gerard Martín', pos: 'DEF', nat: 'ESP' }, { num: 23, name: 'Koundé', pos: 'DEF', nat: 'FRA' },
      { num: 24, name: 'Eric García', pos: 'DEF', nat: 'ESP' },
      { num: 6, name: 'Gavi', pos: 'MED', nat: 'ESP' }, { num: 8, name: 'Pedri', pos: 'MED', nat: 'ESP' },
      { num: 16, name: 'Fermín', pos: 'MED', nat: 'ESP' }, { num: 17, name: 'Casadó', pos: 'MED', nat: 'ESP' },
      { num: 20, name: 'Dani Olmo', pos: 'MED', nat: 'ESP' }, { num: 21, name: 'De Jong', pos: 'MED', nat: 'NED' },
      { num: 22, name: 'Bernal', pos: 'MED', nat: 'ESP' },
      { num: 7, name: 'Ferran Torres', pos: 'DEL', nat: 'ESP' }, { num: 10, name: 'Lamine Yamal', pos: 'DEL', nat: 'ESP' },
      { num: 11, name: 'Raphinha', pos: 'DEL', nat: 'BRA' }, { num: 28, name: 'Bardghji', pos: 'DEL', nat: 'SWE' }
    ],
    honoursNote: 'Recuentos a fecha de 2024/25',
    honours: [
      { key: 'ucl', label: 'Champions League', count: 5 },
      { key: 'liga', label: 'Ligas', count: 28 },
      { key: 'copa', label: 'Copas del Rey', count: 32 },
      { key: 'supercopa', label: 'Supercopas de España', count: 15 },
      { key: 'supercopa_europa', label: 'Supercopas de Europa', count: 5 },
      { key: 'mundial', label: 'Mundiales de Clubes', count: 3 },
      { key: 'recopa', label: 'Recopas de Europa', count: 4 }
    ],
    historyCategories: [['all', 'Todo'], ['palmares', '🏆 Palmarés'], ['europa', '⭐ Champions'], ['leyendas', '🌟 Leyendas'],
                        ['clasico', '⚔️ Clásicos'], ['record', '📈 Récords']],
    history: [
      { id: 'palm', cats: ['palmares'], colorway: 'primary', badge: '5', kicker: 'Palmarés · Fundado en 1899', title: 'Més que un club',
        subtitle: 'Fundado por Joan Gamper el 29 de noviembre de 1899.', grid: 'honours',
        fact: 'Recuentos de títulos a fecha de la temporada 2024/25.' },
      { id: 'wembley92', cats: ['europa', 'leyendas'], colorway: 'primary', badge: 'I', kicker: 'Copa de Europa · 1992', title: 'Wembley 1992: la primera',
        subtitle: 'El Dream Team de Cruyff conquistó por fin Europa.',
        score: { home: 'Barcelona', hs: 1, as: 0, away: 'Sampdoria', caption: '20 de mayo de 1992 · Wembley, Londres (prórroga)' },
        bullets: ['Gol de falta de <b>Ronald Koeman</b> en el minuto 111', 'Entrenador: <b>Johan Cruyff</b>', 'Primera Copa de Europa de la historia del club'],
        fact: 'Fue la última final antes de que la Copa de Europa pasara a llamarse Champions League.' },
      { id: 'paris06', cats: ['europa'], colorway: 'primary', badge: 'II', kicker: 'Champions League · 2006', title: 'París 2006',
        subtitle: 'Remontada en el Stade de France ante el Arsenal.',
        score: { home: 'Barcelona', hs: 2, as: 1, away: 'Arsenal', caption: '17 de mayo de 2006 · Stade de France, Saint-Denis' },
        bullets: ['El Arsenal se adelantó con un cabezazo de <b>Sol Campbell</b>', '<b>Eto\'o</b> empató en el 76\' y <b>Belletti</b> marcó el 2-1 en el 80\'', 'Entrenador: <b>Frank Rijkaard</b>'],
        fact: 'El portero del Arsenal, Jens Lehmann, fue expulsado en el minuto 18.' },
      { id: 'roma09', cats: ['europa'], colorway: 'primary', badge: 'III', kicker: 'Champions League · 2009', title: 'Roma 2009',
        subtitle: 'El primer año de Guardiola terminó con la Champions en el Olímpico.',
        score: { home: 'Barcelona', hs: 2, as: 0, away: 'Manchester United', caption: '27 de mayo de 2009 · Estadio Olímpico, Roma' },
        bullets: ['<b>Eto\'o</b> abrió el marcador en el minuto 10', '<b>Messi</b> sentenció de cabeza en el 70\'', 'Cerró el primer triplete del club: Liga, Copa y Champions'],
        fact: 'El Manchester United llegaba como vigente campeón de Europa.' },
      { id: 'sextete', cats: ['palmares', 'record'], colorway: 'accent', badge: '6', kicker: 'Palmarés · 2009', title: 'El sextete',
        subtitle: 'Seis títulos de seis posibles en un mismo año natural.',
        bullets: ['<b>Liga, Copa del Rey y Champions League</b>', '<b>Supercopa de España</b> y <b>Supercopa de Europa</b>', '<b>Mundial de Clubes</b> en Abu Dabi, con gol de <b>Messi</b> en la prórroga ante Estudiantes'],
        fact: 'Ningún club lo había conseguido antes.' },
      { id: 'wembley11', cats: ['europa'], colorway: 'primary', badge: 'IV', kicker: 'Champions League · 2011', title: 'Wembley 2011',
        subtitle: 'Exhibición en Londres ante el Manchester United de Ferguson.',
        score: { home: 'Barcelona', hs: 3, as: 1, away: 'Manchester United', caption: '28 de mayo de 2011 · Wembley, Londres' },
        bullets: ['Goles de <b>Pedro</b>, <b>Messi</b> y <b>Villa</b>', '<b>Rooney</b> logró el empate momentáneo para el United', 'Segunda final ganada al United en tres años'],
        fact: 'Puyol cedió el brazalete a Abidal para levantar la copa, meses después de su operación de un tumor en el hígado.' },
      { id: 'berlin15', cats: ['europa'], colorway: 'primary', badge: 'V', kicker: 'Champions League · 2015', title: 'Berlín y la MSN',
        subtitle: 'Messi, Suárez y Neymar cerraron el segundo triplete del club.',
        score: { home: 'Barcelona', hs: 3, as: 1, away: 'Juventus', caption: '6 de junio de 2015 · Olympiastadion, Berlín' },
        bullets: ['<b>Rakitić</b> marcó en el minuto 4', 'Tras el empate de <b>Morata</b>, <b>Suárez</b> hizo el 2-1', '<b>Neymar</b> sentenció en el descuento'],
        fact: 'Messi, Suárez y Neymar sumaron 122 goles entre los tres aquella temporada. Entrenador: Luis Enrique.' },
      { id: 'cruyff', cats: ['leyendas'], colorway: 'dark', badge: '14', kicker: 'Leyenda · Johan Cruyff', title: 'Cruyff, el arquitecto',
        subtitle: 'Como jugador cambió al Barça; como entrenador, lo hizo campeón de Europa.',
        bullets: ['Llegó del <b>Ajax</b> en 1973 y ganó la Liga 1973/74', 'Como entrenador (1988–1996) ganó <b>4 Ligas seguidas</b> (1991–1994)', 'Ganó la primera <b>Copa de Europa</b> del club en 1992'],
        fact: 'Con Cruyff en el campo, el Barça ganó 0-5 en el Bernabéu en febrero de 1974.' },
      { id: 'messi', cats: ['leyendas', 'record'], colorway: 'dark', badge: '672', kicker: 'Leyenda · Lionel Messi · 2004–2021', title: 'Messi: 672 goles',
        subtitle: 'El máximo goleador de la historia del club.',
        bullets: ['<b>672 goles</b> en <b>778 partidos</b> oficiales', '<b>474 goles</b> en LaLiga, récord de la competición', '<b>6 Balones de Oro</b> como azulgrana'],
        fact: 'En 2012 marcó 91 goles en un año natural, récord reconocido por Guinness.' },
      { id: 'dosseis', cats: ['clasico'], colorway: 'accent', badge: '2-6', kicker: 'El Clásico · 2009', title: 'El 2-6 del Bernabéu',
        subtitle: 'Exhibición en Madrid camino del triplete.',
        score: { home: 'Real Madrid', hs: 2, as: 6, away: 'Barcelona', caption: '2 de mayo de 2009 · Santiago Bernabéu' },
        bullets: ['Dobletes de <b>Henry</b> y <b>Messi</b>', 'También marcaron <b>Puyol</b> y <b>Piqué</b>', 'Dejó prácticamente decidida la Liga 2008/09'] },
      { id: 'manita', cats: ['clasico'], colorway: 'accent', badge: '5-0', kicker: 'El Clásico · 2010', title: 'La manita',
        subtitle: 'El Barça de Guardiola arrolló al Madrid en el Camp Nou.',
        score: { home: 'Barcelona', hs: 5, as: 0, away: 'Real Madrid', caption: '29 de noviembre de 2010 · Camp Nou' },
        bullets: ['Goles de <b>Xavi</b>, <b>Pedro</b>, <b>Villa</b> (2) y <b>Jeffrén</b>', 'Primer Clásico de <b>Mourinho</b> como entrenador del Madrid', 'Exhibición del Barça de <b>Guardiola</b>'] },
      { id: 'remontada', cats: ['europa', 'record'], colorway: 'accent', badge: '6-1', kicker: 'Champions League · 2017', title: 'La Remontada',
        subtitle: 'Tras perder 4-0 en París, el Barça remontó en el Camp Nou.',
        score: { home: 'Barcelona', hs: 6, as: 1, away: 'PSG', caption: '8 de marzo de 2017 · Octavos de final (vuelta)' },
        bullets: ['<b>Neymar</b> marcó dos goles en los últimos minutos', '<b>Sergi Roberto</b> hizo el 6-1 en el descuento', 'Primera remontada de un 4-0 en la historia de la Champions'] }
    ]
  };

  /* ==================================================================
     MANCHESTER UNITED — temporada 2026/27 DEMO · historia real
     ================================================================== */
  var mu = {
    id: 'mu', name: 'Manchester United', short: 'Man. United', code: 'MU', monogram: 'MU',
    motto: 'Glory Glory Man United', founded: 1878, league: 'Premier League', leagueComp: 'PL', country: 'Inglaterra',
    stadium: { name: 'Old Trafford', city: 'Mánchester', capacity: 74000, capacityNote: 'Aforo aproximado' },
    coach: 'Michael Carrick', coachNote: 'Orientativo (demo): no verificado para 2026/27',
    colors: { primary: '#da291c', primaryDark: '#a3190f', accent: '#fbe122', accentDark: '#c9a800',
              onPrimary: '#ffffff', onAccent: '#111111', bgTint: '#fdf0ef', black: '#000000',
              text: '#14100f', textMuted: '#5f5654' },
    kit: { bg: '#da291c', fg: '#ffffff', ring: '#fbe122' },
    shopLabel: 'Tienda oficial',
    hashtag: '#MUFC',
    nextMatch: { fixtureId: 'mu-u1' },
    news: [
      { icon: '⚽', tag: 'Premier League', title: 'Manchester United 2-0 Newcastle',
        body: 'El United suma 21 puntos en 11 jornadas y es quinto antes del parón de noviembre.',
        date: '2026-11-07', dateLabel: '7 Nov' },
      { icon: '🔥', tag: 'Premier League', title: 'Victoria en el Emirates',
        body: 'Mbeumo y Šeško firmaron el 1-2 ante el Arsenal, líder de la Premier.',
        date: '2026-10-31', dateLabel: '31 Oct' },
      { icon: '🟠', tag: 'Europa League', title: 'El Celtic visita Old Trafford el jueves 26',
        body: 'Dos victorias y dos empates en la fase liga: Oporto, Lazio, Fenerbahçe y Lyon.',
        date: null, dateLabel: 'Próximo' }
    ],
    newsNote: 'Noticias de demostración.',
    season: {
      label: '2026/27', isDemo: true, leaguePos: 5, leaderNote: 'Arsenal, líder con 26',
      source: 'Temporada de demostración: resultados no verificables.',
      competitions: [
        { icon: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', name: 'Premier League', status: '5º · 21 pts', state: 'run' },
        { icon: '🟠', name: 'Europa League', status: '2V 2E en 4 partidos', state: 'run' },
        { icon: '🥤', name: 'Carabao Cup', status: 'Cuartos de final en diciembre', state: 'run' },
        { icon: '🏆', name: 'FA Cup', status: 'Entra en la tercera ronda (enero)', state: 'up' }
      ]
    },
    fixtures: [
      F('mu-p1',  '2026-08-15', '18:30', 'PL',  'Jornada 1',  'MU', 'FUL', 'ft', 2, 1),
      F('mu-p2',  '2026-08-22', '16:00', 'PL',  'Jornada 2',  'BHA', 'MU', 'ft', 1, 1),
      F('mu-p3',  '2026-08-29', '18:30', 'PL',  'Jornada 3',  'MU', 'CRY', 'ft', 3, 0),
      F('mu-p4',  '2026-09-12', '13:30', 'PL',  'Jornada 4',  'MCI', 'MU', 'ft', 2, 1, { label: 'Derbi de Mánchester' }),
      F('mu-e1',  '2026-09-16', '20:45', 'EFL', 'Tercera ronda', 'MU', 'LEI', 'ft', 3, 1),
      F('mu-p5',  '2026-09-19', '18:30', 'PL',  'Jornada 5',  'MU', 'CHE', 'ft', 1, 2),
      F('mu-l1',  '2026-09-24', '21:00', 'UEL', 'Fase liga · J1', 'MU', 'FCP', 'ft', 2, 1),
      F('mu-p6',  '2026-09-26', '16:00', 'PL',  'Jornada 6',  'BRE', 'MU', 'ft', 2, 2),
      F('mu-l2',  '2026-10-01', '18:45', 'UEL', 'Fase liga · J2', 'LAZ', 'MU', 'ft', 1, 1),
      F('mu-p7',  '2026-10-03', '16:00', 'PL',  'Jornada 7',  'MU', 'EVE', 'ft', 1, 0),
      F('mu-p8',  '2026-10-17', '18:30', 'PL',  'Jornada 8',  'LIV', 'MU', 'ft', 1, 1),
      F('mu-l3',  '2026-10-22', '21:00', 'UEL', 'Fase liga · J3', 'MU', 'FEN', 'ft', 3, 0),
      F('mu-p9',  '2026-10-24', '16:00', 'PL',  'Jornada 9',  'MU', 'NFO', 'ft', 3, 1),
      F('mu-e2',  '2026-10-28', '20:45', 'EFL', 'Cuarta ronda', 'SOU', 'MU', 'ft', 1, 2),
      F('mu-p10', '2026-10-31', '18:30', 'PL',  'Jornada 10', 'ARS', 'MU', 'ft', 1, 2, { featured: true }),
      F('mu-l4',  '2026-11-05', '18:45', 'UEL', 'Fase liga · J4', 'LYO', 'MU', 'ft', 2, 2),
      F('mu-p11', '2026-11-07', '16:00', 'PL',  'Jornada 11', 'MU', 'NEW', 'ft', 2, 0),
      F('mu-u1',  '2026-11-21', '18:30', 'PL',  'Jornada 12', 'AVL', 'MU', 'up'),
      F('mu-u2',  '2026-11-26', '21:00', 'UEL', 'Fase liga · J5', 'MU', 'CLT', 'up'),
      F('mu-u3',  '2026-11-29', '17:30', 'PL',  'Jornada 13', 'MU', 'BOU', 'up'),
      F('mu-u4',  '2026-12-10', '21:00', 'UEL', 'Fase liga · J6', 'AJX', 'MU', 'up')
    ],
    featuredMatch: match({
      fixtureId: 'mu-p10',
      note: 'Partido de demostración: alineaciones, eventos, ratings y estadísticas inventados.',
      home: lineup('4-3-3', 'Mikel Arteta', [
        [null, 'Raya', 6.6],
        [null, 'Calafiori', 6.5], [null, 'Gabriel', 6.8], [null, 'Saliba', 6.9], [null, 'Timber', 6.6],
        [null, 'Rice', 6.9], [null, 'Zubimendi', 6.7], [null, 'Ødegaard', 7.1],
        [null, 'Martinelli', 6.3], [null, 'Gyökeres', 6.5], [null, 'Saka', 7.6]
      ], [
        [null, 'Kepa', null, 'GK'], [null, 'Ben White', null, 'DEF'], [null, 'Merino', 6.4, 'MID'],
        [null, 'Eze', 6.6, 'MID'], [null, 'Trossard', null, 'FWD'], [null, 'Madueke', null, 'FWD']
      ]),
      away: lineup('4-2-3-1', 'Michael Carrick', [
        [31, 'Lammens', 7.8],
        [23, 'Shaw', 6.9], [6, 'Lisandro Martínez', 7.3], [4, 'De Ligt', 7.4], [2, 'Dalot', 6.8],
        [37, 'Mainoo', 7.2], [25, 'Ugarte', 6.9],
        [10, 'Matheus Cunha', 7.0], [8, 'Bruno Fernandes', 7.9], [19, 'Mbeumo', 8.1],
        [30, 'Šeško', 7.6]
      ], [
        [1, 'Bayındır', null, 'GK'], [5, 'Maguire', 6.6, 'DEF'], [15, 'Yoro', null, 'DEF'], [13, 'Dorgu', null, 'DEF'],
        [7, 'Mount', 6.7, 'MID'], [16, 'Amad', 7.4, 'FWD'], [11, 'Zirkzee', null, 'FWD']
      ]),
      events: [
        { min: '12', type: 'goal', side: 'away', player: 'Mbeumo', assist: 'Bruno Fernandes' },
        { min: '38', type: 'yellow', side: 'away', player: 'Ugarte' },
        { min: '55', type: 'goal', side: 'home', player: 'Saka', assist: 'Ødegaard' },
        { min: '62', type: 'sub', side: 'home', player: 'Eze', playerOut: 'Martinelli' },
        { min: '64', type: 'sub', side: 'away', player: 'Amad', playerOut: 'Matheus Cunha' },
        { min: '70', type: 'sub', side: 'home', player: 'Merino', playerOut: 'Zubimendi' },
        { min: '76', type: 'sub', side: 'away', player: 'Mount', playerOut: 'Mainoo' },
        { min: '81', type: 'goal', side: 'away', player: 'Šeško', assist: 'Amad' },
        { min: '86', type: 'var', side: 'home', player: 'Gyökeres', detail: 'Gol anulado por fuera de juego' },
        { min: '88', type: 'sub', side: 'away', player: 'Maguire', playerOut: 'Mbeumo' },
        { min: '90+3', type: 'yellow', side: 'home', player: 'Rice' }
      ],
      stats: [['Posesión', 63, 37], ['Remates', 18, 9], ['A puerta', 5, 5], ['xG', 1.7, 1.4], ['Pases', 598, 352], ['Córners', 9, 2], ['Faltas', 8, 13]],
      playerHeat: {
        'Mbeumo': heat(0.7, 0.82, 0.45, 0.22, 28, 3),
        'Bruno Fernandes': heat(0.62, 0.5, 0.45, 0.5, 32, 19),
        'Lammens': heat(0.07, 0.5, 0.08, 0.3, 18, 41)
      }
    }),
    liveDemo: {
      home: 'MU', away: 'EVE', comp: 'DEMO', label: 'Partido de demostración',
      startMinute: 52, startScore: [1, 0],
      events: [{ min: '27', type: 'goal', side: 'home', player: 'Bruno Fernandes', detail: 'Penalti' }],
      script: [
        { min: '59', type: 'yellow', side: 'home', player: 'Ugarte', detail: 'Tarjeta amarilla' },
        { min: '66', type: 'sub', side: 'home', player: 'Amad', playerOut: 'Matheus Cunha', detail: 'Entra por Matheus Cunha' },
        { min: '74', type: 'goal', side: 'home', player: 'Šeško', detail: 'Asist. Mbeumo' },
        { min: '83', type: 'goal', side: 'away', player: null, detail: 'Gol del rival' },
        { min: '88', type: 'sub', side: 'home', player: 'Maguire', playerOut: 'Mbeumo', detail: 'Entra por Mbeumo' }
      ],
      stats: [['Posesión', 55, 45], ['Remates', 9, 6], ['A puerta', 4, 2], ['Córners', 4, 3], ['Faltas', 8, 10], ['Pases', 350, 290]]
    },
    squadNote: 'Plantilla orientativa (demo): jugadores de la plantilla 2025/26',
    squad: [
      { num: 31, name: 'Lammens', pos: 'POR', nat: 'BEL' }, { num: 1, name: 'Bayındır', pos: 'POR', nat: 'TUR' },
      { num: 2, name: 'Dalot', pos: 'DEF', nat: 'POR' }, { num: 3, name: 'Mazraoui', pos: 'DEF', nat: 'MAR' },
      { num: 4, name: 'De Ligt', pos: 'DEF', nat: 'NED' }, { num: 5, name: 'Maguire', pos: 'DEF', nat: 'ENG' },
      { num: 6, name: 'Lisandro Martínez', pos: 'DEF', nat: 'ARG' }, { num: 13, name: 'Dorgu', pos: 'DEF', nat: 'DEN' },
      { num: 15, name: 'Yoro', pos: 'DEF', nat: 'FRA' }, { num: 23, name: 'Shaw', pos: 'DEF', nat: 'ENG' },
      { num: 26, name: 'Heaven', pos: 'DEF', nat: 'ENG' },
      { num: 7, name: 'Mount', pos: 'MED', nat: 'ENG' }, { num: 8, name: 'Bruno Fernandes', pos: 'MED', nat: 'POR' },
      { num: 25, name: 'Ugarte', pos: 'MED', nat: 'URU' }, { num: 37, name: 'Mainoo', pos: 'MED', nat: 'ENG' },
      { num: 10, name: 'Matheus Cunha', pos: 'DEL', nat: 'BRA' }, { num: 11, name: 'Zirkzee', pos: 'DEL', nat: 'NED' },
      { num: 16, name: 'Amad', pos: 'DEL', nat: 'CIV' }, { num: 19, name: 'Mbeumo', pos: 'DEL', nat: 'CMR' },
      { num: 30, name: 'Šeško', pos: 'DEL', nat: 'SVN' }
    ],
    honoursNote: 'Recuentos a fecha de 2024/25',
    honours: [
      { key: 'liga', label: 'Ligas', count: 20 },
      { key: 'ucl', label: 'Copas de Europa / Champions', count: 3 },
      { key: 'facup', label: 'FA Cups', count: 13 },
      { key: 'leaguecup', label: 'Copas de la Liga', count: 6 },
      { key: 'uel', label: 'Europa League', count: 1 },
      { key: 'recopa', label: 'Recopa de Europa', count: 1 },
      { key: 'mundial', label: 'Intercontinental / Mundial de Clubes', count: 2 }
    ],
    historyCategories: [['all', 'Todo'], ['palmares', '🏆 Palmarés'], ['europa', '⭐ Europa'], ['busby', '🕯️ Era Busby'],
                        ['fergie', '👔 Era Ferguson'], ['leyendas', '🌟 Leyendas'], ['record', '📈 Récords']],
    history: [
      { id: 'palm', cats: ['palmares'], colorway: 'primary', badge: '20', kicker: 'Palmarés · Fundado en 1878', title: 'Los Diablos Rojos',
        subtitle: 'Nacido como Newton Heath, el club adoptó el nombre de Manchester United en 1902.', grid: 'honours',
        fact: 'Recuentos de títulos a fecha de la temporada 2024/25.' },
      { id: 'munich', cats: ['busby'], colorway: 'dark', badge: '1958', kicker: 'Múnich · 6 de febrero de 1958', title: 'Los Busby Babes',
        subtitle: 'El accidente aéreo de Múnich se llevó a una generación irrepetible.',
        bullets: ['El equipo volvía de jugar la Copa de Europa en <b>Belgrado</b>', 'Murieron <b>23 personas</b>, entre ellas <b>8 jugadores</b>', '<b>Matt Busby</b> y <b>Bobby Charlton</b> sobrevivieron'],
        fact: 'Duncan Edwards murió 15 días después del accidente, con 21 años.' },
      { id: 'wembley68', cats: ['europa', 'busby'], colorway: 'primary', badge: '1968', kicker: 'Copa de Europa · 1968', title: 'Wembley 1968',
        subtitle: 'Diez años después de Múnich, Busby levantó la Copa de Europa.',
        score: { home: 'Manchester United', hs: 4, as: 1, away: 'Benfica', caption: '29 de mayo de 1968 · Wembley, Londres (prórroga)' },
        bullets: ['<b>Bobby Charlton</b> marcó dos goles', 'También marcaron <b>George Best</b> y <b>Brian Kidd</b>', 'Primer club inglés campeón de Europa'],
        fact: 'Brian Kidd marcó el día en que cumplía 19 años.' },
      { id: 'trinity', cats: ['leyendas', 'busby'], colorway: 'dark', badge: '3', kicker: 'Leyendas · Best, Law y Charlton', title: 'La Santísima Trinidad',
        subtitle: 'Tres Balones de Oro en el mismo equipo de los años 60.',
        bullets: ['<b>Denis Law</b>, Balón de Oro 1964', '<b>Bobby Charlton</b>, Balón de Oro 1966', '<b>George Best</b>, Balón de Oro 1968'],
        fact: 'Una estatua de los tres preside la explanada de Old Trafford.' },
      { id: 'fergie', cats: ['fergie', 'palmares'], colorway: 'primary', badge: '13', kicker: 'Sir Alex Ferguson · 1986–2013', title: 'La era Ferguson',
        subtitle: 'Veintiséis años y medio en el banquillo y 38 títulos.',
        bullets: ['<b>13 Ligas</b> inglesas', '<b>2 Champions League</b> (1999 y 2008)', '<b>5 FA Cups</b> y <b>4 Copas de la Liga</b>'],
        fact: 'Llegó en noviembre de 1986 procedente del Aberdeen.' },
      { id: 'class92', cats: ['fergie', 'leyendas'], colorway: 'accent', badge: '92', kicker: 'Cantera · Clase del 92', title: 'La Clase del 92',
        subtitle: 'Una generación de canteranos que sostuvo dos décadas de éxitos.',
        bullets: ['<b>Beckham, Giggs, Scholes, Butt</b> y los hermanos <b>Neville</b>', 'Ganaron la <b>FA Youth Cup</b> en 1992', 'Fueron la base del triplete de 1999'],
        fact: '"No se gana nada con niños", dijo Alan Hansen en 1995. Aquel equipo ganó el doblete esa misma temporada.' },
      { id: 'treble99', cats: ['europa', 'fergie'], colorway: 'primary', badge: '99', kicker: 'Champions League · 1999', title: 'El triplete del Camp Nou',
        subtitle: 'Dos goles en el descuento para la noche más loca.',
        score: { home: 'Manchester United', hs: 2, as: 1, away: 'Bayern', caption: '26 de mayo de 1999 · Camp Nou, Barcelona' },
        bullets: ['<b>Basler</b> adelantó al Bayern en el minuto 6', '<b>Sheringham</b> empató en el 90+1 y <b>Solskjær</b> marcó en el 90+3', 'Triplete: <b>Premier League, FA Cup y Champions</b>'],
        fact: 'Semanas después, Ferguson fue nombrado sir.' },
      { id: 'moscow08', cats: ['europa', 'fergie'], colorway: 'primary', badge: '3', kicker: 'Champions League · 2008', title: 'Moscú bajo la lluvia',
        subtitle: 'La tercera Copa de Europa llegó desde los once metros.',
        score: { home: 'Manchester United', hs: 1, as: 1, away: 'Chelsea', caption: '21 de mayo de 2008 · Luzhniki, Moscú · 6-5 en penaltis' },
        bullets: ['<b>Cristiano Ronaldo</b> marcó de cabeza; empató <b>Lampard</b>', '<b>Terry</b> resbaló en el penalti que podía dar el título al Chelsea', '<b>Van der Sar</b> paró el penalti decisivo a <b>Anelka</b>'],
        fact: 'Ese mismo año Cristiano Ronaldo ganó su primer Balón de Oro.' },
      { id: 'twenty', cats: ['record', 'fergie'], colorway: 'accent', badge: '20', kicker: 'Récord · 2012/13', title: 'La Liga número 20',
        subtitle: 'El último título de Ferguson.',
        bullets: ['En 2011, la <b>19ª Liga</b> superó las 18 del Liverpool', 'La <b>20ª</b> llegó en 2012/13, la última temporada de Ferguson', '<b>Robin van Persie</b> fue el máximo goleador de la Premier con 26 goles'],
        fact: 'El Liverpool igualó esa cifra al ganar la Premier League 2024/25.' },
      { id: 'cole', cats: ['record'], colorway: 'accent', badge: '9-0', kicker: 'Récord · 1995', title: '9-0 al Ipswich',
        subtitle: 'La mayor goleada de la historia de la Premier League, igualada después pero nunca superada.',
        score: { home: 'Manchester United', hs: 9, as: 0, away: 'Ipswich Town', caption: '4 de marzo de 1995 · Old Trafford · Premier League' },
        bullets: ['<b>Andy Cole</b> marcó 5 goles', 'Primer jugador con 5 goles en un partido de la Premier League'] },
      { id: 'giggs', cats: ['leyendas', 'record'], colorway: 'dark', badge: '963', kicker: 'Récord · Ryan Giggs', title: '963 partidos',
        subtitle: 'Nadie ha jugado más con el United.',
        bullets: ['<b>Ryan Giggs</b>: 963 partidos oficiales (1991–2014)', '<b>Wayne Rooney</b>: máximo goleador histórico con <b>253 goles</b>', '<b>Bobby Charlton</b>: 249 goles, récord durante más de 40 años'],
        fact: 'Giggs ganó 13 Ligas, más que ningún otro jugador en Inglaterra.' },
      { id: 'uel17', cats: ['europa'], colorway: 'primary', badge: '2017', kicker: 'Europa League · 2017', title: 'Estocolmo 2017',
        subtitle: 'La única Europa League del club.',
        score: { home: 'Manchester United', hs: 2, as: 0, away: 'Ajax', caption: '24 de mayo de 2017 · Friends Arena, Estocolmo' },
        bullets: ['Goles de <b>Pogba</b> y <b>Mkhitaryan</b>', 'Entrenador: <b>José Mourinho</b>'],
        fact: 'Se jugó dos días después del atentado del Manchester Arena; el equipo dedicó el título a las víctimas.' }
    ]
  };

  /* ------------------------------------------------------------------
     Normalización: campos derivados de los fixtures (una sola fuente)
     ------------------------------------------------------------------ */
  function resultOf(f, code) {
    if (f.status !== 'ft') return null;
    var gf = f.home === code ? f.hs : f.as, ga = f.home === code ? f.as : f.hs;
    return gf > ga ? 'W' : gf < ga ? 'L' : 'D';
  }
  function tally(list, code) {
    var t = { played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
    list.forEach(function (f) {
      if (f.status !== 'ft') return;
      var home = f.home === code;
      t.played++; t.gf += home ? f.hs : f.as; t.ga += home ? f.as : f.hs;
      var r = resultOf(f, code);
      if (r === 'W') t.w++; else if (r === 'D') t.d++; else t.l++;
    });
    return t;
  }

  var teams = { rm: rm, fcb: fcb, mu: mu };

  Object.keys(teams).forEach(function (id) {
    var t = teams[id];
    [].concat(t.fixtures, t.archive || []).forEach(function (f) {
      if (f.home !== t.code && f.away !== t.code) WARN.push(id + ': fixture ' + f.id + ' sin el equipo');
      if (!f.venue) f.venue = f.home === t.code ? 'H' : 'A';
      if (!f.stadium && f.venue === 'H') f.stadium = t.stadium.name;
      f.result = resultOf(f, t.code);
      if (!comps[f.comp]) WARN.push(id + ': competición desconocida ' + f.comp);
    });
    t.fixtures.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });

    var lg = tally(t.fixtures.filter(function (f) { return f.comp === t.leagueComp; }), t.code);
    var all = tally(t.fixtures, t.code);
    var S = t.season;
    S.played = lg.played; S.w = lg.w; S.d = lg.d; S.l = lg.l; S.gf = lg.gf; S.ga = lg.ga;
    S.points = lg.w * 3 + lg.d;
    S.allComps = all;
    S.form = t.fixtures.filter(function (f) { return f.status === 'ft'; }).slice(-5).map(function (f) { return f.result; });

    t.history.forEach(function (h) {
      h.cat = h.cats[0];
      h.kicker = h.kicker.toUpperCase();
      if (h.grid === 'honours') h.grid = t.honours.slice(0, 6).map(function (x) { return { value: x.count, label: x.label }; });
      if (!h.bullets) h.bullets = [];
    });

    // Comprobaciones de coherencia de los partidos con detalle
    [t.featuredMatch].concat(t.extraMatches || []).forEach(function (m) {
      var f = null;
      [].concat(t.fixtures, t.archive || []).forEach(function (x) { if (x.id === m.fixtureId) f = x; });
      if (!f) { WARN.push(id + ': featured sin fixture ' + m.fixtureId); return; }
      var g = { home: 0, away: 0 };
      m.events.forEach(function (e) { if (e.type === 'goal') g[e.side]++; });
      if (g.home !== f.hs || g.away !== f.as) WARN.push(id + ': goles de ' + f.id + ' no cuadran con el marcador');
    });
  });

  /* ------------------------------------------------------------------
     API pública
     ------------------------------------------------------------------ */
  var GENERIC_KIT = { bg: '#e7ebf1', fg: '#0d1b2a', ring: '#9aa7b5' };

  var V = {
    version: 1,
    today: '2026-11-19',
    timezone: 'Europe/Madrid',
    defaultTeam: 'rm',
    order: ['rm', 'fcb', 'mu'],
    opponents: opponents,
    teams: teams,
    comps: comps,
    genericKit: GENERIC_KIT,
    _warnings: WARN,

    getTeam: function (id) {
      return teams[id] || teams[V.defaultTeam];
    },
    fixture: function (team, id) {
      var t = typeof team === 'string' ? V.getTeam(team) : team, list, i;
      if (!t) return null;
      list = [].concat(t.fixtures || [], t.archive || []);
      for (i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    },
    // Equipación para un código: el propio equipo, un rival conocido,
    // otro equipo de VICFUT o, si no, una genérica.
    kit: function (code, team) {
      var t = typeof team === 'string' ? V.getTeam(team) : team, k;
      if (t && code === t.code) return t.kit;
      if (opponents[code]) return opponents[code].kit;
      for (k in teams) if (teams.hasOwnProperty(k) && teams[k].code === code) return teams[k].kit;
      return GENERIC_KIT;
    },
    // Nombre corto para un código (propio equipo, rival u otro equipo de VICFUT).
    teamName: function (code, team) {
      var t = typeof team === 'string' ? V.getTeam(team) : team, k;
      if (t && code === t.code) return t.short;
      if (opponents[code]) return opponents[code].name;
      for (k in teams) if (teams.hasOwnProperty(k) && teams[k].code === code) return teams[k].short;
      return code;
    },
    // Detalle (alineaciones/eventos/estadísticas) de un partido, si existe.
    matchDetail: function (team, fixtureId) {
      var t = typeof team === 'string' ? V.getTeam(team) : team, list, i;
      if (!t) return null;
      list = [t.featuredMatch].concat(t.extraMatches || []);
      for (i = 0; i < list.length; i++) if (list[i] && list[i].fixtureId === fixtureId) return list[i];
      return null;
    }
  };

  root.VICFUT = V;
})(typeof window !== 'undefined' ? window : this);
