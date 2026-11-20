# shared/teams.js — esquema de datos

Load it with `<script src="../../shared/teams.js"></script>` (no modules, so it works from `file://` and GitHub Pages). It sets `window.VICFUT`. The UI text is Spanish for every team. Kickoff times use Spain's mainland time (`VICFUT.timezone = 'Europe/Madrid'`). The demo date is `VICFUT.today = '2026-11-19'`.

## Top level
| field | notes |
|---|---|
| `version`, `defaultTeam`, `order` | `order` is the team-picker order: `['rm','fcb','mu']` |
| `teams[id]` | one entry per club. To add a club, add one entry and its id to `order` |
| `opponents[CODE]` | `{ name, kit }` for every rival code used in fixtures |
| `comps[CODE]` | `{ name, short, color, bg, icon }`. Codes: LIG UCL UEL CDR SUP SUE MUN PL FAC EFL DEMO |
| `genericKit` | fallback kit |
| `_warnings` | data self-check messages; should be `[]` |

## Helpers
- `VICFUT.getTeam(id)` returns the team, or the default team for an unknown id.
- `VICFUT.fixture(team, id)` takes a team object or id and searches `fixtures`, then `archive`.
- `VICFUT.kit(code, team)` returns the team's own kit, else `opponents[code].kit`, else another VICFUT team's kit, else `genericKit`.
- `VICFUT.teamName(code, team)` returns a short display name for any code. *(added)*
- `VICFUT.matchDetail(team, fixtureId)` returns the `featuredMatch` / `extraMatches` entry, or `null`. *(added)*

## Team
- **Identity:** `id, name, short, code, monogram, motto, founded, league, leagueComp, country, hashtag`.
- **Stadium and coach:** `stadium{name, city, capacity, capacityNote}` and `coach` (with `coachNote` when unverified).
- **`colors`:** `primary, primaryDark, accent, accentDark, onPrimary, onAccent, bgTint, text, textMuted`, plus optional `gold`/`black`. `onPrimary`/`onAccent` pass WCAG AA (≥ 4.5:1).
- **`kit`:** `{bg, fg, ring}`. `bg` is a CSS `background` value and may be a striped gradient.
- **Shop and next match:** `shopLabel` and `nextMatch.fixtureId`.
- **`news[]`:** `{icon, tag, title, body, date (ISO|null), dateLabel}`, plus `newsNote`.
- **`season`:** `{label, isDemo, source, leaguePos, leaderNote, competitions[{icon,name,status,state:'run'|'up'}]}`. These fields are **computed from fixtures**: `played, w, d, l, gf, ga, points` (league only), `allComps{played,w,d,l,gf,ga}`, and `form` (the last 5 finished matches in any competition, oldest first, `'W'|'D'|'L'`).
- **`fixtures[]`:** sorted by date ascending. Each is `{id, date:'YYYY-MM-DD', time:'HH:MM'|null, comp, round, home, away, status:'ft'|'up'|'live', hs?, as?, label?, featured?}` plus computed fields: `venue:'H'|'A'|'N'` (relative to the team), `stadium` (home games), and `result:'W'|'D'|'L'|null`. `home`/`away` are codes such as `'RM'` or `'CEL'`.
- **`archive[]`:** *(added)* fixtures from earlier seasons with an extra `season` field. Only RM uses it.
- **`featuredMatch` / `extraMatches[]`:** `extraMatches` is *(added)* and only RM has entries.
  - `{fixtureId, ratingsDemo:true, note?, lineups{home,away}, events[], stats[[label,home,away]], playerHeat{name:[[x,y,i]]}}`
  - Each lineup side is `{formation, coach, players[11], bench[]}`.
  - Player: `{num|null, name, pos:'GK'|'DEF'|'MID'|'FWD', x, row, rating, minutes, goals, assists, yellow, red}`.
    - `row` 0 is the goalkeeper. Rows count up toward attack, and `x` runs 0..1 across the pitch, left to right from the team's own view.
    - Starters who were replaced have `subOut:'64'`. Bench players who came on have `sub:true` and `subIn:'64'`. Unused bench players have `minutes:0`.
  - Event: `{min:'23'|'90+3', type, side:'home'|'away', player, assist?, playerOut?, detail}`.
    - `type` is `goal | yellow | red | sub | var`, or the added `pen_save`.
    - For a `sub`, `player` comes on and `playerOut` goes off. `detail` is always a string.
  - `playerHeat` coordinates: x runs from 0 (own goal) to 1 (rival goal); y runs from 0 (left touchline) to 1 (right touchline); `i` is intensity 0..1. All heat data is DEMO.
- **`liveDemo`:** `{home, away, comp:'DEMO', label, startMinute, startScore:[h,a], events[] (already happened), script[] (events to play after startMinute), stats, lineups?}`. A UI ticks the minute and pops `script` events. RM's liveDemo includes lineups.
- **Squad:** `squad[]` is `{num, name, pos:'POR'|'DEF'|'MED'|'DEL', nat (ISO-3 / FIFA code)}`, plus `squadNote`.
- **Honours:** `honours[]` is `{key, label, count}`, plus `honoursNote`.
- **`historyCategories`:** `[[key, label]]`. The first entry is always `['all','Todo']`. A "saved" filter is a UI feature, not data.
- **`history[]`:**
  - `{id, cat, cats[], badge, kicker (UPPERCASE), title, subtitle, score?{home,hs,as,away,caption}, bullets[], fact?, colorway:'primary'|'accent'|'dark', grid?[{value,label}], fixtureId?}`.
  - `bullets` may contain `<b>` tags and nothing else.
  - The palmarés card's `grid` is filled from `honours`.

## Reliability
- **rm:** taken from the original mockup. Its 2026/27 results are marked as real (`isDemo:false`), as the mockup marks them. Ratings and heat maps are DEMO.
- **fcb / mu:** the 2026/27 season, news, featured match and liveDemo are DEMO (`season.isDemo:true`). Cross-team data matches: Barça is top with 33 pts after 12 rounds, and Barça 1-2 Real Madrid on 25 Oct appears in both teams' fixtures.
- **History and honours** for fcb/mu are real historical facts. Title counts are as of 2024/25.
- **No crests or official logos:** clubs appear only as a monogram and colours.
