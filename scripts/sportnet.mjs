// Výsledky, strelci a karty zo Sportnetu (Futbalnet, verejné API súťaží) -> data/sportnet.json
//   node scripts/sportnet.mjs            – aktuálna sezóna, detail (góly, karty) len pre zápasy, ktoré ho ešte nemajú
//   FULL=1 node scripts/sportnet.mjs     – stiahne znova aj detaily už uložených zápasov
// Zdroj: https://sutaze.api.sportnet.online/api/v2 (bez kľúča, rovnaké údaje ako sportnet.sme.sk/futbalnet/k/ok-castkovce/).
// Prípravky U9–U11 výsledky nemajú (najmenším sa skóre nezapisuje), U7 na Sportnete nie je.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'sportnet.json');
const API = 'https://sutaze.api.sportnet.online/api/v2';
const SPACE = 'ok-castkovce.futbalnet.sk';
// názov tímu na Sportnete -> slug tímu na webe (data/timy.json)
const TEAMS = {
  'Dospelí (A)': 'a-muzstvo',
  'U19 - Starší dorast': 'u19-starsi-dorast',
  'U17 - Mladší dorast': 'u17-mladsi-dorast',
  'U15 - Starší žiaci': 'u15-starsi-ziaci',
  'U15 - Starší žiaci (B)': 'u15-starsi-ziaci-b',
  'U13 - Mladší žiaci': 'u13-mladsi-ziaci',
  'U13 - Mladší žiaci (B)': 'u13-mladsi-ziaci-b',
  'U11 - Prípravka': 'u11-pripravka',
  'U10 - Prípravka': 'u10-pripravka',
  'U09 - Prípravka': 'u9-pripravka',
};
const FULL = !!process.env.FULL;

async function get(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(API + url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(25000) });
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return await r.json();
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise((ok) => setTimeout(ok, 1500 * i));
    }
  }
}

// dátum a čas výkopu v slovenskom čase (Sportnet dáva UTC)
const local = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Bratislava', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const toLocal = (iso) => { const [d, t] = local.format(new Date(iso)).split(' '); return { date: d, time: t }; };
const minute = (t) => (t ? String(t).replace(/:00$/, '').replace(/^0(?=\d)/, '') : '');
const CARD = { yellow_card: 'yellow', red_card: 'red', second_yellow_card: 'yellow-red', yellow_red_card: 'yellow-red' };

const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { matches: [] };
const prevById = new Map(prev.matches.map((m) => [m.id, m]));
const today = new Date();

const { teams } = await get(`/public/${SPACE}/teams?limit=200`);
const season = teams.map((t) => t.season).find((s) => new Date(s.dateFrom) <= today && today <= new Date(s.dateTo));
if (!season) throw new Error('Sportnet: nenašla sa aktuálna sezóna');
// mládež hrá súťaže krajského/oblastného zväzu: sezóna má iné _id, ale rovnaký názov (2026/2027)
const current = teams.filter((t) => t.season.name === season.name);
const unknown = current.filter((t) => !TEAMS[t.displayName]).map((t) => t.displayName);
if (unknown.length) console.warn('Sportnet: neznámy tím (doplň do TEAMS):', unknown.join(', '));

const matches = [];
let details = 0;
for (const t of current) {
  const slug = TEAMS[t.displayName];
  if (!slug) continue;
  const list = (await get(`/futbalnet/matches?teamIds=${t._id}&limit=300`)).matches || [];
  for (const m of list) {
    const home = m.homeTeam?._id === t._id;
    const opp = home ? m.awayTeam : m.homeTeam;
    const { date, time } = toLocal(m.startDate);
    const played = m.matchState === 'ODOHRATY';
    const old = prevById.get(m._id);
    const row = {
      id: m._id, team: slug, date, time, home, opponent: opp?.name || '', competition: m.competition?.name || '',
      part: m.competitionPart?.name || '', round: m.round?.name || '', played,
      score: null, goals: [], cards: [], venue: old?.venue || '', url: old?.url || null, // url = zápas na sportnet.sme.sk (z detailu)
    };
    if (played && typeof m.homeTeam?.score === 'number' && typeof m.awayTeam?.score === 'number') row.score = `${m.homeTeam.score}:${m.awayTeam.score}`;
    // detail (zápis o stretnutí): góly a karty; stiahne sa raz, potom sa berie z uloženého súboru
    if (played && (FULL || !old?.detail)) {
      const d = await get(`/matches/${m._id}`);
      details++;
      const ev = d.protocol?.events || [];
      const side = (teamId) => (teamId === t._id ? 'our' : 'opp');
      row.goals = ev.filter((e) => e.eventType === 'goal').map((e) => ({ min: minute(e.eventTime), player: e.player?.name || '', side: side(e.team), kind: e.type === 'goal_own' ? 'own' : e.type === 'goal_penalty' ? 'penalty' : 'goal' }));
      row.cards = ev.filter((e) => CARD[e.eventType]).map((e) => ({ min: minute(e.eventTime), player: e.player?.name || '', side: side(e.team), kind: CARD[e.eventType] }));
      if (Array.isArray(d.score) && d.score.length === 2) row.score = `${d.score[0]}:${d.score[1]}`;
      row.venue = d.sportGround?.name || '';
      row.url = /^https:\/\/sportnet\.sme\.sk\//.test(d.detailUrl || '') ? d.detailUrl : null;
      row.detail = true;
      await new Promise((ok) => setTimeout(ok, 150)); // šetrne k API
    } else if (old?.detail) {
      Object.assign(row, { goals: old.goals, cards: old.cards, venue: old.venue, url: old.url, detail: true });
    }
    matches.push(row);
  }
}
matches.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time) || a.team.localeCompare(b.team));
const out = { source: 'Sportnet / Futbalnet', season: season.name, updated: new Date().toISOString(), teams: Object.fromEntries(current.filter((t) => TEAMS[t.displayName]).map((t) => [TEAMS[t.displayName], t._id])), matches };
const changed = JSON.stringify({ ...prev, updated: 0 }) !== JSON.stringify({ ...out, updated: 0 });
if (changed) fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(`Sportnet ${season.name}: ${matches.length} zápasov (${matches.filter((m) => m.played).length} odohraných), nových detailov ${details}${changed ? ', uložené' : ', bez zmeny'}`);
