// Zápasové fotky od fotografa ako nové galérie: media/foto-orig/zoznam.json (scripts/foto-drive.mjs)
//   -> media/galerie/<slug>/*.jpg (zmenšené cez Disk, dlhšia strana 1280 px) + data/galerie-foto.json
// node scripts/galerie-foto.mjs            potom: python -I scripts/images.py && node build.js
// Každý priečinok „vs Súper (dd.mm.rrrr)“ sa spáruje so zápasom tímu v data/zapasy.json (tím + dátum, inak súper),
// názov galérie je potom „Domáci - Hostia“ ako v rozpise; nespárované dostanú názov podľa priečinka fotografa.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIST = path.join(ROOT, 'media', 'foto-orig', 'zoznam.json');
const OUT = path.join(ROOT, 'media', 'galerie');
const SIZE = 1280;
if (!fs.existsSync(LIST)) { console.error('chýba media/foto-orig/zoznam.json – najprv node scripts/foto-drive.mjs <id>'); process.exit(1); }
const all = JSON.parse(fs.readFileSync(LIST, 'utf8'));
const matches = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'zapasy.json'), 'utf8'));

// priečinok fotografa -> tím na webe (U14 = U15 B, U12 = U13 B, U8 = U7, pozri scripts/photos.py)
const AGE = { U19: 'u19-starsi-dorast', U17: 'u17-mladsi-dorast', U15: 'u15-starsi-ziaci', U14: 'u15-starsi-ziaci-b', U13: 'u13-mladsi-ziaci', U12: 'u13-mladsi-ziaci-b', U11: 'u11-pripravka', U10: 'u10-pripravka', U9: 'u9-pripravka', U8: 'u7-pripravka' };
const LABEL = { 'a-muzstvo': 'A-mužstvo', 'u19-starsi-dorast': 'U19', 'u17-mladsi-dorast': 'U17', 'u15-starsi-ziaci': 'U15', 'u15-starsi-ziaci-b': 'U15 B', 'u13-mladsi-ziaci': 'U13', 'u13-mladsi-ziaci-b': 'U13 B', 'u11-pripravka': 'U11', 'u10-pripravka': 'U10', 'u9-pripravka': 'U9', 'u7-pripravka': 'U7' };
const CLUB = 'OK Častkovce';

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slugify = (s) => norm(s).replace(/ /g, '-').slice(0, 80);
const words = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 2 && !['fk', 'fc', 'msk', 'ofk', 'tj', 'sk', 'afc', 'pfk', 'fkm', 'kfc', 'psc'].includes(w)));
const similar = (a, b) => { const A = words(a), B = words(b); let n = 0; for (const w of A) if (B.has(w)) n++; return n / Math.max(1, Math.min(A.size, B.size)); };

const skip = /TÍMOVÉ FOTENIE|^DETAILS\/|^LOGO\/|^ŠTADIÓN\//;
const groups = new Map();
for (const f of all) {
  if (skip.test(f.path) || !/^image\/jpe?g$/.test(f.mime)) continue;
  const dir = f.path.split('/').slice(0, -1).join('/');
  if (!groups.has(dir)) groups.set(dir, []);
  groups.get(dir).push(f);
}

const gals = [];
for (const [dir, files] of groups) {
  const parts = dir.split('/');
  // pozor: priečinok sezóny sa volá „2026/2027“, lomka v názve posúva časti cesty – vek hľadať podľa tvaru
  const age = parts.find((p) => /^U\d+$/.test(p)) || null;
  const team = parts[0] === 'MUŽI' ? 'a-muzstvo' : AGE[age] || null;
  const folder = parts[parts.length - 1];
  const prep = /PRÍPRAVNÉ/i.test(dir);
  const dm = folder.match(/\((\d{2})\.(\d{2})\.(\d{4})\)\s*$/);
  const date = dm ? `${dm[3]}-${dm[2]}-${dm[1]}` : null;
  const vs = folder.match(/^vs\s+(.+?)(?:\s*\(\d{2}\.\d{2}\.\d{4}\))?\s*$/i);
  const opp = vs ? vs[1] : null;
  // zápas v rozpise: rovnaký tím a dátum; bez dátumu podľa súpera (sezóna 2026/27)
  const own = matches.filter((m) => m.team === team);
  let m = null;
  if (date) m = own.find((x) => x.date === date && (!opp || similar(x.opponent, opp) > 0)) || own.find((x) => x.date === date) || null;
  if (!m && opp && !prep) {
    // najlepšia zhoda mena súpera, musí byť jednoznačná („Bratislava“ je v mene viacerých súperov)
    const c = own.filter((x) => x.date >= '2026-07-01').map((x) => [similar(x.opponent, opp), x]).filter(([s]) => s >= 0.5).sort((a, b) => b[0] - a[0]);
    if (c.length && (c.length === 1 || c[0][0] > c[1][0])) m = c[0][1];
  }
  const label = team ? LABEL[team] : age || parts[0];
  // pri nespárovaných udalostiach (výber, turnaj) nechať vekovú kategóriu z priečinka fotografa
  const shownLabel = m ? label : age || label;
  const prefix = team === 'a-muzstvo' && m ? '' : `${shownLabel}: `;
  const title = m
    ? `${prefix}${m.home ? CLUB : m.opponent} - ${m.home ? m.opponent : CLUB}`
    // bez zápasu v rozpise nevieme, kto bol domáci: „OK Častkovce vs. Súper“
    : opp ? `${prefix}${CLUB} vs. ${opp}${prep ? ' (prípravný zápas)' : ''}` : `${prefix}${folder.replace(/\s*\(\d{2}\.\d{2}\.\d{4}\)\s*$/, '')}`;
  const gdate = (m && m.date) || date;
  const slug = slugify(`${gdate || ''} ${shownLabel} ${opp || folder}`);
  const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
  gals.push({
    id: 'f' + crypto.createHash('sha1').update(dir).digest('hex').slice(0, 8),
    slug, title, date: gdate, team, matchId: m ? m.id : null,
    path: `/foto/${slug}`, cover: sorted[0].name, files: sorted.map((f) => f.name),
    zdroj: dir, _ids: sorted.map((f) => f.id),
  });
}

if (process.env.DRY) { // DRY=1: len ukáž párovanie a názvy, nič nesťahuj
  for (const g of gals.sort((a, b) => (b.date || '').localeCompare(a.date || ''))) console.log(`${g.date || '????-??-??'}  ${g.matchId ? '✓' : '·'}  ${g.title}  (${g.files.length})  ← ${g.zdroj.split('/').slice(-1)[0]}`);
  process.exit(0);
}
// stiahnutie zmenšenín (Disk: dlhšia strana SIZE px), len chýbajúce
const safe = (n) => n.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
const jobs = [];
for (const g of gals) g.files.forEach((name, i) => jobs.push({ dir: path.join(OUT, g.slug), name: safe(name), id: g._ids[i] }));
let done = 0, have = 0, fail = 0;
async function get(j) {
  const dest = path.join(j.dir, j.name);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 10000) { have++; return; }
  // vyradené pri výbere (scripts/vyber-foto.py) znova nesťahovať; po tomto skripte spusti výber znova
  if (fs.existsSync(path.join(ROOT, 'media', 'galerie-vyradene', path.basename(j.dir), j.name))) { have++; return; }
  for (let i = 0; i < 4; i++) {
    const r = await fetch(`https://drive.google.com/thumbnail?id=${encodeURIComponent(j.id)}&sz=s${SIZE}`).catch(() => null);
    if (r?.ok && (r.headers.get('content-type') || '').startsWith('image/')) {
      fs.mkdirSync(j.dir, { recursive: true });
      fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
      done++;
      if (done % 100 === 0) console.log(`… ${done} stiahnutých`);
      return;
    }
    await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
  }
  fail++;
  console.warn('nepodarilo sa', j.dir.split(path.sep).pop(), j.name);
}
const q = [...jobs];
await Promise.all(Array.from({ length: 6 }, async () => { while (q.length) await get(q.shift()); }));

// do dát len súbory, ktoré sa naozaj stiahli
for (const g of gals) {
  g.files = g.files.filter((n) => fs.existsSync(path.join(OUT, g.slug, safe(n))));
  g.files = g.files.map(safe);
  g.cover = g.files[0];
  delete g._ids;
}
const ok = gals.filter((g) => g.files.length).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
fs.writeFileSync(path.join(ROOT, 'data', 'galerie-foto.json'), JSON.stringify(ok, null, 1) + '\n');
console.log(`galérií ${ok.length} (spárovaných so zápasom ${ok.filter((g) => g.matchId).length}), fotiek stiahnutých ${done}, už bolo ${have}, chýb ${fail}`);
for (const g of ok) console.log(`${g.date || '????-??-??'}  ${g.matchId ? '✓' : '·'}  ${g.title}  (${g.files.length})`);
