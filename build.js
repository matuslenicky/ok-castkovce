// Generátor statického webu OK Častkovce: data/*.json + src/ -> dist/
// node build.js            (dátum „dnes“ pre zápasy = dnešok; TODAY=2026-11-03 node build.js ho prepíše)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, fmtDate, fmtDay, todayISO, splitMatches, matchCentre, matchList, formHTML, weekHTML, nextHTML, todayMatches } from './src/js/shared.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'dist');
const rd = (f, def) => { const p = path.join(ROOT, 'data', f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : def; };
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));

const info = rd('klub-info.json');
info.sportnet = encodeURI(info.sportnet || ''); // medzera v adrese vyhľadávania nie je v href platná
const klub = rd('klub.json');
const fan = rd('fanzona.json');
const privacy = rd('ochrana-sukromia.json', { body: '' });
const doplnky = rd('doplnky.json', { timy: {} });
const foto = rd('foto.json', { obrazky: {} });
const matches = rd('zapasy.json', []);
const news = rd('spravy.json', []).sort((a, b) => b.date.localeCompare(a.date));
const videos = rd('videa.json', []).sort((a, b) => b.date.localeCompare(a.date));
const partneri = rd('partneri.json', { partneri: [] }).partneri;
// galérie zo starého webu + zápasové fotky od fotografa (scripts/galerie-foto.mjs; matchId = zápas v rozpise)
const gals = [...rd('galerie.json', []), ...rd('galerie-foto.json', [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
const TODAY = process.env.TODAY || todayISO();

// ---- tímy -----------------------------------------------------------------------------------
const META = {
  'a-muzstvo': { short: 'A-mužstvo', sub: 'Muži', order: 0 },
  'u19-starsi-dorast': { short: 'U19', sub: 'Starší dorast', order: 1 },
  'u17-mladsi-dorast': { short: 'U17', sub: 'Mladší dorast', order: 2 },
  'u15-starsi-ziaci': { short: 'U15', sub: 'Starší žiaci', order: 3 },
  'u15-starsi-ziaci-b': { short: 'U15 B', sub: 'Starší žiaci B', order: 4 },
  'u13-mladsi-ziaci': { short: 'U13', sub: 'Mladší žiaci', order: 5 },
  'u13-mladsi-ziaci-b': { short: 'U13 B', sub: 'Mladší žiaci B', order: 6 },
  'u11-pripravka': { short: 'U11', sub: 'Prípravka', order: 7 },
  'u10-pripravka': { short: 'U10', sub: 'Prípravka', order: 8 },
  'u9-pripravka': { short: 'U9', sub: 'Prípravka', order: 9 },
  'u7-pripravka': { short: 'U7', sub: 'Prípravka', order: 10 },
};
const ROLE = { HT: 'Hlavný tréner', AT: 'Asistent trénera' };
const teams = rd('timy.json', []).map((t) => {
  const d = doplnky.timy?.[t.slug] || {};
  const m = META[t.slug] || { short: t.name, sub: '', order: 99 };
  // súťaž tímu = posledná súťaž v jeho zápasoch; pohár (Slovnaft Cup) to nie je, ligové zápasy A-mužstva súťaž vyplnenú nemajú
  const league = /cup|pohár/i.test(t.league || '') ? null : t.league;
  return { ...t, ...m, league: d.liga || league, roster: d.roster || t.roster, rosterSource: d.zdroj || null, isA: t.slug === 'a-muzstvo', url: t.slug === 'a-muzstvo' ? 'a-muzstvo/' : `mladez/${t.slug}/` };
}).sort((a, b) => a.order - b.order);
const bySlug = Object.fromEntries(teams.map((t) => [t.slug, t]));
const youth = teams.filter((t) => !t.isA);
const labels = Object.fromEntries(teams.map((t) => [t.slug, t.short]));
const teamMatches = (slug) => matches.filter((m) => m.team === slug);

// ---- fotky a video k výsledkom ----------------------------------------------------------------
// galéria alebo video „OK Častkovce - FK Beluša“ patrí k odohranému zápasu s týmto súperom do 7 dní;
// keď hralo so súperom viac tímov, má prednosť A-mužstvo, inak sa pri nejednoznačnosti nepáruje
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const dayDiff = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / 864e5;
function pairMatch(title, date) {
  const t = norm(title);
  if (!t.includes('castkovce')) return null;
  const c = matches.filter((m) => m.score && norm(m.opponent).length > 3 && t.includes(norm(m.opponent)) && dayDiff(m.date, date) <= 7);
  const a = c.filter((m) => m.team === 'a-muzstvo');
  if (a.length) return a.sort((x, y) => dayDiff(x.date, date) - dayDiff(y.date, date))[0];
  return c.length === 1 ? c[0] : null;
}
for (const g of gals) {
  const m = g.matchId ? matches.find((x) => x.id === g.matchId) : g.date ? pairMatch(g.title, g.date) : null;
  if (m && !m.gal) m.gal = `fotogaleria/${g.slug}/`;
}
for (const v of videos) { const m = pairMatch(v.title, v.date); if (m && !m.yt) { m.yt = v.youtube; m.ytTitle = v.title; } }

// ---- kalendár (.ics, RFC 5545) ----------------------------------------------------------------
const icsEsc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsFold = (line) => { // riadky najviac 75 bajtov
  const out = []; let cur = '';
  for (const ch of line) { if (Buffer.byteLength(cur + ch) > 74) { out.push(cur); cur = ' ' + ch; } else cur += ch; }
  out.push(cur);
  return out.join('\r\n');
};
const VTZ = ['BEGIN:VTIMEZONE', 'TZID:Europe/Bratislava',
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
  'END:VTIMEZONE'];
function ics(list, calName) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const events = list.map((m) => {
    const [h, a] = m.home ? [info.nazov, m.opponent] : [m.opponent, info.nazov];
    const d = m.date.replace(/-/g, '');
    const t = (m.time || '').slice(0, 5);
    const when = t ? [`DTSTART;TZID=Europe/Bratislava:${d}T${t.replace(':', '')}00`, 'DURATION:PT2H'] : [`DTSTART;VALUE=DATE:${d}`];
    const desc = [m.league, m.home ? 'Domáci zápas' : 'Zápas vonku', m.note].filter(Boolean).join('\n');
    return ['BEGIN:VEVENT', `UID:zapas-${m.id}@okcastkovce.sk`, `DTSTAMP:${stamp}`, ...when,
      `SUMMARY:${icsEsc(`${labels[m.team] || ''}: ${h} – ${a}${m.score ? ` ${m.score}` : ''}`)}`,
      desc && `DESCRIPTION:${icsEsc(desc)}`, m.home && `LOCATION:${icsEsc(info.ihrisko.join(', '))}`, 'END:VEVENT'].filter(Boolean);
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//OK Castkovce//Zapasy//SK', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEsc(calName)}`, 'X-WR-TIMEZONE:Europe/Bratislava', ...VTZ, ...events.flat(), 'END:VCALENDAR'].map(icsFold).join('\r\n') + '\r\n';
}

// ---- obrázky ----------------------------------------------------------------------------------
// Fotky od fotografa: data/foto.json (vyrába scripts/photos.py) -> dist/foto/<kľúč>-<šírka>.webp/.jpg
// alt: neuvedený = popis z foto.json, '' = dekoratívna fotka (pozadie)
function pic(key, R, { sizes = '100vw', cls = '', alt, eager = false } = {}) {
  const f = foto.obrazky?.[key];
  if (!f) return '';
  const srcset = (ext) => f.widths.map((w) => `${R}foto/${key}-${w}.${ext} ${w}w`).join(', ');
  const largest = f.widths[f.widths.length - 1];
  return `<picture${cls ? ` class="${cls}"` : ''}><source type="image/webp" srcset="${srcset('webp')}" sizes="${sizes}"><img src="${R}foto/${key}-${largest}.jpg" srcset="${srcset('jpg')}" sizes="${sizes}" width="${f.w}" height="${f.h}" alt="${esc(alt === undefined ? f.alt || '' : alt)}"${eager ? ' fetchpriority="high"' : ' loading="lazy" decoding="async"'}${f.pos ? ` style="object-position:${f.pos}"` : ''}></picture>`;
}
const hasPic = (key) => !!foto.obrazky?.[key];
// sizes podľa skutočne vykreslenej šírky fotky 16:9 pri object-fit: cover (orez do užšieho rámu ju zväčší):
// hlavička podstránky na telefóne ~390×280–320 px -> fotka ~500–565 px; dlaždica 4:5 -> 2,2× šírka dlaždice;
// karta mládeže na telefóne má obrázok 112×112 -> fotka ~200 px
const PHERO_SIZES = '(max-width: 479.98px) 145vw, 100vw';
const G = config.galerie;
const galDir = (g) => g.path.split('/').pop();
// local = zmenšeniny z media/galerie-web (scripts/images.py) priamo na webe; storage = Supabase Storage; old-site = starý web
const galImg = (g, f, R, thumb = false) => {
  const webp = `${galDir(g)}/${thumb ? 't/' : ''}${encodeURIComponent(f.replace(/\.\w+$/, ''))}.webp`;
  if (G.mode === 'local') return `${R}galerie/${webp}`;
  if (G.mode === 'storage') return `${G.base}/${webp}`;
  return `${G.base}/${galDir(g)}/${encodeURIComponent(f)}?size=${thumb ? 'thumb' : 'lg'}`;
};
const galCover = (g, R) => fs.existsSync(path.join(SRC, 'img', 'galerie', galDir(g) + '.webp')) ? `${R}img/galerie/${galDir(g)}.webp` : galImg(g, g.cover, R, true);
// správa -> súvisiaca galéria (rovnaké podujatie na starom webe)
const NEWS_GAL = { 495: 496, 493: 494, 491: 485, 484: 486, 478: 480, 474: 472, 457: 459 };
const galById = Object.fromEntries(gals.map((g) => [g.id, g]));
const newsImage = (n, R) => {
  const g = galById[NEWS_GAL[n.id]];
  const generic = !n.image || /bnr-sprava-zakladna/.test(n.image);
  if (generic && g) return galCover(g, R);
  return n.image ? R + n.image.replace(/^\//, '') : null;
};
// <img> karty: zmenšeniny webp zo scripts/images.py (src/img/opt/…-640/-1280.webp) ako srcset, keď existujú.
// Prvý obrázok na stránke so zoznamom je LCP: bez lazy a s vysokou prioritou; ostatné lazy, aby mu na mobile nebrali pásmo.
const CARD_SIZES = '(min-width: 1240px) 380px, (min-width: 700px) 50vw, 100vw';
const dirCache = new Map();
const listDir = (d) => { if (!dirCache.has(d)) dirCache.set(d, fs.existsSync(d) ? fs.readdirSync(d) : []); return dirCache.get(d); };
function cardImg(url, R, { sizes = CARD_SIZES, eager = false, first = false, alt = '' } = {}) {
  let cands = [];
  if (url.startsWith(R + 'img/')) {
    // src/img/opt/<cesta>/<meno>-<šírka>.webp (640, 1280, prípadne plná šírka užšieho originálu)
    const rel = 'img/opt/' + url.slice(R.length + 4).replace(/\.\w+$/, '');
    const dir = path.dirname(rel), name = path.basename(rel);
    const re = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)\\.webp$`);
    cands = listDir(path.join(SRC, dir)).map((f) => f.match(re)).filter(Boolean)
      .map((m) => [`${R}${dir}/${m[0]}`, +m[1]]).sort((a, b) => a[1] - b[1]);
  } else {
    // obálka galérie: náhľad t/ (480) + stredná m/ (800) zo scripts/images.py
    const m = url.slice(R.length).match(/^galerie\/([^/]+)\/t\/([^/]+\.webp)$/);
    if (m && G.mode === 'local' && fs.existsSync(path.join(ROOT, 'media', 'galerie-web', m[1], 'm', decodeURIComponent(m[2])))) {
      cands = [[url, 480], [`${R}galerie/${m[1]}/m/${m[2]}`, 800]];
    }
  }
  const srcset = cands.length ? ` srcset="${cands.map(([u, w]) => `${u} ${w}w`).join(', ')}" sizes="${sizes}"` : '';
  const load = first ? ' fetchpriority="high"' : eager ? '' : ' loading="lazy"';
  return `<img src="${url}"${srcset} alt="${esc(alt)}"${load} decoding="async">`;
}

// ---- ikony -------------------------------------------------------------------------------------
const I = {
  fb: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6V21h3.1Z"/></svg>',
  ig: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17.3" cy="6.7" r="1.2" fill="currentColor"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="4.5" width="19" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m3 6 9 7 9-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="10" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor"/></svg>',
  photos: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="9" r="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M8 3v4m8-4v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  route: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 18-8-8 18-2-8-8-2Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="6" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="19" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
};

// ---- rozloženie -------------------------------------------------------------------------------
const NAV = [
  { t: 'Správy', u: 'spravy/' },
  { t: 'Zápasy', u: 'zapasy/' },
  { t: 'A-mužstvo', u: 'a-muzstvo/' },
  { t: 'Mládež', u: 'mladez/', sub: youth.map((t) => ({ t: `${t.short} – ${t.sub}`, u: t.url })) },
  { t: 'Klub', u: 'klub/', sub: [
    { t: 'Štadión', u: 'klub/stadion/' }, { t: 'História', u: 'klub/historia/' }, { t: 'Vedenie klubu', u: 'klub/vedenie-klubu/' },
    { t: 'Prenájom umelej trávy', u: 'klub/prenajom-umelej-travy/' }, { t: 'Kontakty', u: 'klub/kontakty/' }] },
  { t: 'Fotogaléria', u: 'fotogaleria/' },
  { t: 'Video', u: 'video/' },
  { t: 'Fanzóna', u: 'fanzona/' },
];
const tel = (n) => 'tel:' + n.replace(/^0/, '+421').replace(/\s+/g, '');

function layout({ route, title, desc, body, active }) {
  const depth = route.split('/').filter(Boolean).length;
  const R = depth ? '../'.repeat(depth) : './';
  const isActive = (u) => active && (active === u || active.startsWith(u)) ? ' aria-current="page"' : '';
  const navItems = NAV.map((n, i) => n.sub
    ? `<li class="has-sub"><a href="${R}${n.u}"${isActive(n.u)}>${n.t}</a><button class="sub-btn" type="button" aria-expanded="false" aria-controls="sub-${i}" aria-label="${n.t}: podstránky">${I.down}</button>
      <ul class="sub" id="sub-${i}">${n.sub.map((s) => `<li><a href="${R}${s.u}">${esc(s.t)}</a></li>`).join('')}</ul></li>`
    : `<li><a href="${R}${n.u}"${isActive(n.u)}>${n.t}</a></li>`).join('');
  // verejná ukážka: aj titulok a náhľad pri zdieľaní hovoria, že ide o návrh (úvod má od klubu „oficiálna stránka…“)
  const fullTitle = (config.ukazka ? 'Návrh webu · ' : '') + (route ? `${title} | ${info.nazov}` : `${info.nazov} – ${title}`);
  const canon = config.siteUrl ? `${config.siteUrl}${route}` : '';
  const ld = route ? '' : `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'SportsClub', name: info.nazov, legalName: info.pravnyNazov, sport: 'Futbal',
    email: info.email, telephone: info.telefon, address: { '@type': 'PostalAddress', streetAddress: info.adresa[0], postalCode: '916 27', addressLocality: 'Častkovce', addressCountry: 'SK' },
    sameAs: [info.facebook, info.instagram], logo: canon ? canon + 'img/logo.svg' : undefined,
  })}</script>`;
  return `<!doctype html>
<html lang="sk" data-root="${R}"${config.ukazka ? ' class="has-demo"' : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc || `${info.nazov} – futbalový klub z Častkoviec. Zápasy, výsledky, súpisky, mládež, správy a fotogaléria.`)}">
${config.noindex ? '<meta name="robots" content="noindex">\n' : ''}${canon ? `<link rel="canonical" href="${canon}">\n` : ''}<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="sk_SK">
<meta name="theme-color" content="#121317">
<link rel="icon" type="image/png" href="${R}img/favicon.png">
<link rel="preload" href="${R}fonts/barlow-condensed-800i.woff" as="font" type="font/woff" crossorigin>
<link rel="preload" href="${R}fonts/barlow-400.woff" as="font" type="font/woff" crossorigin>
<link rel="stylesheet" href="${R}css/site.css">
<script>(function(d){d.classList.add('js');if(/[?&](kategoria|kde)=/.test(location.search)){d.classList.add('js-filtering');setTimeout(function(){d.classList.remove('js-filtering')},3000)}})(document.documentElement)</script>
<script type="module" src="${R}js/site.mjs"></script>
${ld}</head>
<body>
<a class="skip" href="#obsah">Preskočiť na obsah</a>
<div class="topbar"><div class="wrap topbar-in">
  <span class="topbar-name">${esc(info.pravnyNazov)}</span>
  <nav class="topbar-links" aria-label="Rýchle odkazy"><a href="${R}fanzona/">Fanshop</a><a href="${R}klub/prenajom-umelej-travy/">Prenájom umelej trávy</a><a href="${R}klub/kontakty/">Kontakty</a></nav>
  <span class="social"><a href="${info.facebook}" rel="noopener" aria-label="Facebook">${I.fb}</a><a href="${info.instagram}" rel="noopener" aria-label="Instagram">${I.ig}</a></span>
</div></div>
<header class="hdr" id="hdr">${config.ukazka ? `
  <p class="demo"><span class="demo-s">Návrh webu, nie oficiálna stránka klubu</span><span class="demo-l">Návrh nového webu OK Častkovce, nie oficiálna stránka klubu. Oficiálny web:&nbsp;<a href="https://okcastkovce.sk/" rel="noopener">okcastkovce.sk</a></span></p>` : ''}
  <div class="wrap hdr-in">
    <a class="brand" href="${R}"${route ? '' : ' aria-current="page"'}><img src="${R}img/logo.svg" alt="" width="52" height="52"${route || hasPic('hero') ? '' : ' fetchpriority="high"'}><span>OK Častkovce</span></a>
    <button class="burger" type="button" aria-expanded="false" aria-controls="menu"><span class="burger-i" aria-hidden="true"></span><span class="burger-t">Menu</span></button>
    <nav class="nav" id="menu" aria-label="Hlavné menu"><ul class="nav-l">${navItems}</ul>
      <div class="nav-foot"><a href="${tel(info.telefon)}">${I.phone}${esc(info.telefon)}</a><a href="mailto:${info.email}">${I.mail}${esc(info.email)}</a><span class="social"><a href="${info.facebook}" rel="noopener" aria-label="Facebook">${I.fb}</a><a href="${info.instagram}" rel="noopener" aria-label="Instagram">${I.ig}</a></span></div>
    </nav>
  </div>
</header>
<main id="obsah">
${body}
</main>
${partneri.length ? `<section class="partners" aria-labelledby="partneri-h"><div class="wrap">
  <h2 class="partners-h" id="partneri-h">Partneri klubu</h2>
  <ul class="plogos">${partneri.map((p) => `<li${p.tmave ? ' class="plogo--dark"' : ''}><img src="${R}img/${fs.existsSync(path.join(SRC, 'img', 'opt', 'partneri', p.file)) ? 'opt' : 'archiv'}/partneri/${encodeURIComponent(p.file)}" alt="${esc(p.alt)}" loading="lazy" decoding="async"></li>`).join('')}</ul>
</div></section>` : ''}
<footer class="ftr">
  <div class="wrap ftr-grid">
    <div class="ftr-club">
      <img src="${R}img/logo.svg" alt="" width="88" height="88" loading="lazy">
      <div><p class="ftr-name">${esc(info.nazov)}</p><p>${esc(info.pravnyNazov)}</p>
      <span class="social social--lg"><a href="${info.facebook}" rel="noopener" aria-label="Facebook">${I.fb}</a><a href="${info.instagram}" rel="noopener" aria-label="Instagram">${I.ig}</a></span></div>
    </div>
    <div><h2 class="ftr-h">Štadión</h2><p>${info.ihrisko.map(esc).join('<br>')}</p><h2 class="ftr-h">Klub</h2><p>${info.adresa.map(esc).join('<br>')}</p></div>
    <div><h2 class="ftr-h">Kontakt</h2><p><a href="${tel(info.telefon)}">${esc(info.telefon)}</a><br><a href="${tel(info.telefonKlub)}">${esc(info.telefonKlub)}</a><br><a href="mailto:${info.email}">${esc(info.email)}</a></p>
      <p class="ftr-small">IČO: ${info.ico}<br>DIČ: ${info.dic}<br>Bankový účet: ${info.ucet}</p></div>
    <div><h2 class="ftr-h">Rýchle odkazy</h2><ul class="ftr-links">${[['zapasy/', 'Zápasy a výsledky'], ['a-muzstvo/', 'A-mužstvo'], ['mladez/', 'Mládež'], ['spravy/', 'Správy'], ['fotogaleria/', 'Fotogaléria'], ['klub/prenajom-umelej-travy/', 'Prenájom umelej trávy']].map(([u, t]) => `<li><a href="${R}${u}">${t}</a></li>`).join('')}</ul></div>
  </div>
  <div class="ftr-bar"><div class="wrap ftr-bar-in"><span>© ${new Date().getFullYear()} ${esc(info.nazov.toUpperCase())}</span><a href="${R}ochrana-sukromia/">Ochrana súkromia</a></div></div>
</footer>
${config.supabase?.url ? `<script>window.OKC_DB=${JSON.stringify({ url: config.supabase.url, key: config.supabase.key, crest: R + 'img/logo.svg' })}</script>` : ''}
</body>
</html>
`;
}

// ---- spoločné bloky ------------------------------------------------------------------------------
const crestUrl = (R) => `${R}img/logo.svg`;
const secHead = (h, id, more, R, dark = false) => `<div class="sec-head${dark ? ' sec-head--dark' : ''}"><h2 class="h2" id="${id}">${h}</h2>${more ? `<a class="more" href="${R}${more[0]}">${more[1]}${I.arrow}</a>` : ''}</div>`;
const railNav = (label) => `<div class="rail-nav" hidden><button type="button" class="rail-btn" data-dir="-1" aria-label="${label}: predchádzajúce">${I.left}</button><button type="button" class="rail-btn" data-dir="1" aria-label="${label}: ďalšie">${I.right}</button></div>`;

// karty v rail-e na úvode: 250 px na telefóne, 2,4 karty od 700 px, 4 karty od 1000 px (site.css .rail-track)
const RAIL_SIZES = '(min-width: 1240px) 295px, (min-width: 1000px) 25vw, (min-width: 700px) 40vw, 250px';
// h: na úvode sú karty pod nadpisom sekcie (h2 → h3), na stránkach so zoznamom priamo pod h1 (h2)
function newsCard(n, R, { big = false, h = 'h3', eager = false, first = false, sizes = CARD_SIZES } = {}) {
  const img = newsImage(n, R);
  return `<article class="card card--news${big ? ' card--big' : ''}">
  <a class="card-a" href="${R}spravy/${n.slug}/">
    <div class="card-img">${img ? cardImg(img, R, { eager, first, sizes: big ? '(min-width: 1240px) 780px, (min-width: 900px) 66vw, 100vw' : sizes }) : `<span class="ph-crest"></span>`}</div>
    <div class="card-body"><p class="card-k"><span class="tag">Správy</span><time datetime="${n.date}">${fmtDate(n.date)}</time></p><${h} class="card-t">${esc(n.title)}</${h}></div>
  </a>
</article>`;
}
function galCard(g, R, { h = 'h3', eager = false, first = false, sizes = CARD_SIZES } = {}) {
  return `<article class="card card--gal"><a class="card-a" href="${R}fotogaleria/${g.slug}/">
  <div class="card-img">${cardImg(galCover(g, R), R, { eager, first, sizes })}<span class="card-count">${I.photos}${g.files.length}</span></div>
  <div class="card-body"><p class="card-k">${g.date ? `<time datetime="${g.date}">${fmtDate(g.date)}</time>` : 'Sezóna 2026/27'}</p><${h} class="card-t">${esc(g.title)}</${h}></div></a></article>`;
}
function videoCard(v, R, { eager = false, first = false, sizes = CARD_SIZES } = {}) {
  return `<article class="card card--video"><button type="button" class="card-a vplay" data-yt="${esc(v.youtube)}" data-title="${esc(v.title)}">
  <span class="card-img">${cardImg(`${R}img/video/${v.youtube}.jpg`, R, { eager, first, sizes })}<span class="play">${I.play}</span></span>
  <span class="card-body"><span class="card-k"><time datetime="${v.date}">${fmtDate(v.date)}</time></span><span class="card-t">${esc(v.title)}</span></span></button></article>`;
}
const pageHero = ({ kicker, title, sub, R, crumbs = [], img = '' }) => `<section class="phero${img ? ' phero--img' : ''}">
  ${img}<div class="wrap phero-in">
    <nav class="crumbs" aria-label="Omrvinky"><a href="${R}">Úvod</a>${crumbs.map(([u, t]) => u ? `<a href="${R}${u}">${esc(t)}</a>` : `<span aria-current="page">${esc(t)}</span>`).join('')}</nav>
    ${kicker ? `<p class="kicker">${esc(kicker)}</p>` : ''}<h1 class="display display--page">${esc(title)}</h1>${sub ? `<p class="phero-sub">${esc(sub)}</p>` : ''}
  </div></section>`;

// kalendár zápasov: odber (webcal/Google doplní site.mjs podľa adresy webu) alebo stiahnutie .ics
const calBox = (file, R, id) => `<details class="cal" data-cal id="${id}">
  <summary class="cal-btn">${I.cal}<span>Kalendár zápasov</span></summary>
  <div class="cal-pop">
    <a class="cal-o" data-webcal href="${R}kalendar/${file}" hidden><b>Odoberať v telefóne</b><span>iPhone, Mac, Outlook – rozpis sa v kalendári sám aktualizuje</span></a>
    <a class="cal-o" data-gcal href="${R}kalendar/${file}" rel="noopener" hidden><b>Pridať do Google Kalendára</b><span>aj pre Android</span></a>
    <a class="cal-o" data-ics href="${R}kalendar/${file}" download><b>Stiahnuť súbor .ics</b><span>jednorazovo, bez aktualizácií</span></a>
  </div>
</details>`;
const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(info.ihrisko.join(', '))}`;
const navBtn = (cls = 'btn btn--light btn--sm') => `<a class="${cls}" href="${mapsUrl}" rel="noopener">${I.route}Navigovať na štadión</a>`;

function videoDialog() {
  return `<dialog class="vdlg" id="vdlg" aria-label="Video"><div class="vdlg-in"><button type="button" class="vdlg-x" data-close aria-label="Zavrieť video">✕</button><div class="vdlg-frame"></div><p class="vdlg-t"></p></div></dialog>`;
}

// ---- stránky -----------------------------------------------------------------------------------
const pages = [];
const add = (route, opts) => pages.push({ route, ...opts });

// ÚVOD
add('', {
  title: 'oficiálna stránka futbalového klubu', active: '',
  body: (R) => {
    const tabTeams = teams.filter((t) => teamMatches(t.slug).length);
    const hero = hasPic('hero') ? pic('hero', R, { cls: 'hero-img', eager: true, sizes: '(max-width: 699.98px) 134vw, 100vw' }) : '';
    const youthTiles = youth.map((t) => `<li class="ytile"><a href="${R}${t.url}">
      <span class="ytile-img">${hasPic('tim-' + t.slug) ? pic('tim-' + t.slug, R, { sizes: '(min-width: 1240px) 525px, (min-width: 1100px) 39vw, (min-width: 700px) 66vw, 86vw' }) : `<span class="ph-crest"></span>`}</span>
      <span class="ytile-t"><b>${esc(t.short)}</b><span>${esc(t.sub)}</span></span></a></li>`).join('');
    const dnes = todayMatches(matches, TODAY);
    const wkOpts = { labels, urls: Object.fromEntries(teams.map((t) => [t.slug, t.url])), root: R };
    const nextA = nextHTML(teamMatches('a-muzstvo'), TODAY, { label: 'A-mužstvo', root: R });
    const matchday = `<a class="matchday" href="#tyzden" data-matchday${dnes.length ? '' : ' hidden'}><span class="matchday-dot" aria-hidden="true"></span><span data-matchday-t>Dnes hráme${dnes.length > 1 ? ` · ${dnes.length} ${dnes.length >= 5 ? 'zápasov' : 'zápasy'}` : ''}</span></a>`;
    const heroText = `<p class="kicker kicker--light">Futbalový klub</p>
    <h1 class="display" id="hero-h">OK Častkovce</h1>
    <p class="hero-sub">${esc(info.ocenenie)}</p>
    <div class="hero-cta"><a class="btn btn--red" href="${R}zapasy/">Zápasy a výsledky${I.arrow}</a><a class="btn btn--light" href="${R}a-muzstvo/">A-mužstvo</a></div>`;
    const nextBox = `<aside class="hnext" data-next="a-muzstvo" data-label="A-mužstvo" aria-label="Najbližší zápas A-mužstva"${nextA ? '' : ' hidden'}>${nextA}</aside>`;
    // s fotkou celého klubu: fotka bez textu cez ľudí, názov a najbližší zápas v tmavom páse pod ňou
    return `${hero ? `
<section class="hero hero--photo" aria-labelledby="hero-h">
  <div class="hero-media">${hero}<div class="wrap hero-media-in">${matchday}</div></div>
  <div class="wrap hero-bar">
    <div class="hero-lead">${heroText}</div>
    ${nextBox}
  </div>
</section>` : `
<section class="hero hero--plain" aria-labelledby="hero-h">
  <img class="hero-crest" src="${R}img/logo.svg" alt="" width="560" height="560" aria-hidden="true" fetchpriority="high">
  <div class="wrap hero-in">
    ${matchday}
    ${heroText}
    ${nextBox}
  </div>
</section>`}

<section class="sec mc" aria-labelledby="mc-h">
  <div class="wrap">
    ${secHead('Zápasy', 'mc-h', ['zapasy/', 'Všetky zápasy'], R)}
    <div class="tabs" role="tablist" aria-label="Kategória">${tabTeams.map((t, i) => `<button type="button" role="tab" id="tab-${t.slug}" aria-controls="mc-${t.slug}" aria-selected="${i === 0}"${i ? ' tabindex="-1"' : ''}>${esc(t.short)}</button>`).join('')}</div>
    ${tabTeams.map((t, i) => `<div class="mc-panel" role="tabpanel" id="mc-${t.slug}" aria-labelledby="tab-${t.slug}"${i ? ' hidden' : ''}>
      <div class="mc-grid" role="region" tabindex="0" aria-label="Zápasy ${esc(t.short)}" data-team="${t.slug}">${matchCentre(teamMatches(t.slug), TODAY, crestUrl(R), R)}</div>
      <div class="team-bar"><div data-form="${t.slug}">${formHTML(teamMatches(t.slug), TODAY)}</div><a class="more" href="${R}${t.url}">${t.isA ? 'A-mužstvo' : esc(t.short)}${I.arrow}</a></div>
    </div>`).join('')}
  </div>
</section>

<section class="sec sec--tint" id="tyzden" aria-labelledby="wk-h">
  <div class="wrap">
    ${secHead('Tento týždeň hráme', 'wk-h', ['zapasy/', 'Celý program'], R)}
    <div data-week>${weekHTML(matches, TODAY, wkOpts)}</div>
  </div>
</section>

<section class="sec" aria-labelledby="news-h">
  <div class="wrap">
    ${secHead('Najnovšie správy', 'news-h', ['spravy/', 'Všetky správy'], R)}
    <div class="rail" data-rail>${railNav('Správy')}<div class="rail-track">${news.slice(0, 8).map((n) => newsCard(n, R, { sizes: RAIL_SIZES })).join('')}</div></div>
  </div>
</section>

<section class="sec band band--dark" aria-labelledby="vid-h">
  <div class="wrap">
    ${secHead('Video', 'vid-h', ['video/', 'Všetky videá'], R, true)}
    <div class="rail" data-rail>${railNav('Videá')}<div class="rail-track">${videos.map((v) => videoCard(v, R, { sizes: RAIL_SIZES })).join('')}</div></div>
  </div>
</section>

<section class="sec" aria-labelledby="ml-h">
  <div class="wrap">
    ${secHead('Mládež', 'ml-h', ['mladez/', 'Všetky kategórie'], R)}
    <ul class="ytiles">${youthTiles}</ul>
  </div>
</section>

<section class="sec sec--tint" aria-labelledby="gal-h">
  <div class="wrap">
    ${secHead('Fotogaléria', 'gal-h', ['fotogaleria/', 'Všetky galérie'], R)}
    <div class="rail" data-rail>${railNav('Galérie')}<div class="rail-track">${gals.slice(0, 10).map((g) => galCard(g, R, { sizes: RAIL_SIZES })).join('')}</div></div>
  </div>
</section>

<section class="sec" aria-labelledby="promo-h">
  <div class="wrap">
    <h2 class="sr" id="promo-h">Fanzóna a prenájom</h2>
    <div class="promos">
      <a class="promo promo--fan" href="${R}fanzona/">
        <span class="promo-img"><img src="${R}img/fan-mikina.jpg" alt="" width="442" height="668" loading="lazy" decoding="async"></span>
        <span class="promo-body"><span class="kicker">Fanzóna</span><span class="promo-t">„Obleč sa ako pravý fanúšik!“</span><span class="promo-p">Kúpou produktov podporuješ mladé talenty v našom klube.</span><span class="btn btn--red btn--sm">Oblečenie${I.arrow}</span></span>
      </a>
      <div class="promo promo--rent">
        <span class="promo-body"><span class="kicker kicker--light">Klub</span><span class="promo-t">Prenájom umelej trávy</span><span class="promo-p">V prípade záujmu o rezervácie a cenník umelej trávy kontaktujte:</span>
        <span class="promo-contacts"><a href="${tel(info.telefon)}">${I.phone}${esc(info.telefon)}</a><a href="mailto:${info.email}">${I.mail}${esc(info.email)}</a></span></span>
      </div>
    </div>
  </div>
</section>

<section class="sec band band--dark stad${hasPic('stadion-dron') ? ' stad--img' : ''}" aria-labelledby="st-h">${hasPic('stadion-dron') ? pic('stadion-dron', R, { cls: 'stad-img', alt: '' }) : ''}
  <div class="wrap stad-in">
    <div class="stad-text">
      <p class="kicker kicker--light">Štadión</p>
      <h2 class="h2 h2--light" id="st-h">Areál v Častkovciach</h2>
      <p>Areál futbalového štadióna v Častkovciach tvoria dve zatrávnené ihriská. Hlavná hracia trávnatá plocha, vedľajšia hracia trávnatá plocha a jedno multifunkčné ihrisko s umelým trávnikom a mantinelmi.</p>
      <div class="stad-cta"><a class="btn btn--light btn--sm" href="${R}klub/stadion/">O štadióne${I.arrow}</a>${navBtn('btn btn--line-light btn--sm')}</div>
    </div>
    <dl class="stats">
      <div><dt>Kapacita štadióna</dt><dd>${info.stadion.kapacita}</dd></div>
      <div><dt>Miest na sedenie</dt><dd>${info.stadion.sedenie}</dd></div>
      <div><dt>Hlavná hracia plocha</dt><dd class="dim">${info.stadion.hlavna.replace(' m', '').replace(' x ', '×')}<small>m</small></dd></div>
      <div><dt>Kompletná rekonštrukcia</dt><dd>${info.stadion.rekonstrukcia}</dd></div>
    </dl>
  </div>
</section>
${videoDialog()}`;
  },
});

// ZÁPASY
add('zapasy/', {
  title: 'Zápasy a výsledky', active: 'zapasy/', desc: 'Program zápasov a výsledky všetkých kategórií OK Častkovce.',
  body: (R) => {
    const { past, next } = splitMatches(matches, TODAY);
    const chips = teams.filter((t) => teamMatches(t.slug).length).map((t) => `<button type="button" class="chip" data-filter="${t.slug}" aria-pressed="false">${esc(t.short)}</button>`).join('');
    return `${pageHero({ kicker: 'Všetky kategórie', title: 'Zápasy', R, crumbs: [[null, 'Zápasy']] })}
<section class="sec sec--first"><div class="wrap">
  <div class="filter" data-match-filter>
    <div class="filter-g"><span class="filter-l" id="fl">Kategória</span><div class="chips" role="group" aria-labelledby="fl"><button type="button" class="chip" data-filter="" aria-pressed="true">Všetky</button>${chips}</div></div>
    <div class="filter-g"><span class="filter-l" id="fha">Kde</span><div class="chips" role="group" aria-labelledby="fha"><button type="button" class="chip" data-ha="" aria-pressed="true">Všade</button><button type="button" class="chip" data-ha="h" aria-pressed="false">Doma</button><button type="button" class="chip" data-ha="a" aria-pressed="false">Vonku</button></div></div>
    ${calBox('vsetky.ics', R, 'cal-zapasy')}
  </div>
  <div class="mcols">
    <section aria-labelledby="pr-h"><h2 class="h3" id="pr-h">Program</h2><div class="mlist-wrap" data-list="next">${matchList(next, { crest: crestUrl(R), labels, today: TODAY, root: R })}</div></section>
    <section aria-labelledby="vy-h"><h2 class="h3" id="vy-h">Výsledky</h2><div class="mlist-wrap" data-list="past">${matchList([...past].reverse(), { crest: crestUrl(R), labels, today: TODAY, root: R })}</div></section>
  </div>
  <p class="note">Výsledky si môžete pozrieť aj na <a href="${info.sportnet}" rel="noopener">sportnet.sme.sk</a>.</p>
</div></section>
${videoDialog()}`;
  },
});

// TÍMY
// tréneri zo stránky Vedenie klubu: uvedení len po skupinách (A muži, Dorast, Žiaci), nie po jednotlivých tímoch
const treneri = rd('treneri.json', { skupiny: [] }).skupiny;
const staffCard = (name) => {
  const parts = name.split(' ');
  const last = parts.pop();
  return `<li class="player"><div class="player-img"><span class="ph-player" aria-hidden="true"></span></div><p class="player-n"><span>${esc(parts.join(' '))}</span> <b>${esc(last)}</b></p></li>`;
};
function rosterHtml(t, R) {
  if (!t.roster || !t.roster.length) {
    const sk = treneri.find((s) => s.timy.includes(t.slug));
    return `<p class="empty">Súpiska ${t.isA ? 'A-mužstva' : 'tejto kategórie'} zatiaľ nie je zverejnená.</p>${sk ? `
  <h3 class="roster-h roster-h--gap">Tréneri · ${esc(sk.nazov)}</h3><ul class="roster roster--staff">${sk.mena.map(staffCard).join('')}</ul>` : ''}`;
  }
  return t.roster.map((g) => `<h3 class="roster-h">${esc(g.title)}</h3><ul class="roster${g.title === 'Vedenie' ? ' roster--staff' : ''}">${g.people.map((p) => {
    const parts = p.name.split(' ');
    const last = parts.pop();
    const key = p.foto || null;
    const photo = key && hasPic(key) ? pic(key, R, { sizes: '(min-width: 1100px) 240px, (min-width: 700px) 30vw, 46vw', alt: p.name })
      : p.photo ? `<img src="${R}${p.photo.replace(/^\//, '')}" alt="${esc(p.name)}" loading="lazy" decoding="async">`
        : `<span class="ph-player" aria-hidden="true"></span>`;
    const role = p.tag && ROLE[p.tag] ? ROLE[p.tag] : p.position || '';
    return `<li class="player"><div class="player-img">${photo}${p.number ? `<span class="player-no">${esc(p.number)}</span>` : ''}</div>
      <p class="player-n"><span>${esc(parts.join(' '))}</span> <b>${esc(last)}</b></p>${role ? `<p class="player-r">${esc(role)}</p>` : ''}</li>`;
  }).join('')}</ul>`).join('');
}
function teamPage(t) {
  add(t.url, {
    title: t.isA ? 'A-mužstvo' : `${t.short} – ${t.sub}`, active: t.isA ? 'a-muzstvo/' : 'mladez/',
    desc: `${t.isA ? 'A-mužstvo' : `${t.short} – ${t.sub}`} OK Častkovce: súpiska, program zápasov a výsledky.`,
    body: (R) => {
      const list = teamMatches(t.slug);
      const { past, next } = splitMatches(list, TODAY);
      const img = hasPic('tim-' + t.slug) ? pic('tim-' + t.slug, R, { cls: 'phero-img', eager: true, sizes: PHERO_SIZES }) : '';
      // fotky tohto tímu (galérie od fotografa majú tím; zo starého webu len cez spárovaný zápas)
      const tg = gals.filter((g) => g.team === t.slug || (g.matchId == null && list.some((m) => m.gal === `fotogaleria/${g.slug}/`)));
      return `${pageHero({ kicker: t.isA ? 'Muži' : t.sub, title: t.isA ? 'A-mužstvo' : t.short, sub: t.league, R, img, crumbs: t.isA ? [[null, 'A-mužstvo']] : [['mladez/', 'Mládež'], [null, t.short]] })}
<nav class="subnav" aria-label="Sekcie"><div class="wrap"><a href="#supiska">Súpiska</a><a href="#program">Program</a><a href="#vysledky">Výsledky</a>${tg.length ? '<a href="#fotky">Fotky</a>' : ''}</div></nav>
<section class="sec sec--first" aria-labelledby="mc-h"><div class="wrap">
  <h2 class="sr" id="mc-h">Prehľad zápasov</h2>
  <div class="mc-grid" role="region" tabindex="0" aria-labelledby="mc-h" data-team="${t.slug}">${matchCentre(list, TODAY, crestUrl(R), R)}</div>
  <div class="team-bar"><div data-form="${t.slug}">${formHTML(list, TODAY)}</div>${list.length ? calBox(`${t.slug}.ics`, R, 'cal-tim') : ''}</div>
</div></section>
<section class="sec" id="supiska" aria-labelledby="sup-h"><div class="wrap">
  ${secHead('Súpiska', 'sup-h', null, R)}
  ${rosterHtml(t, R)}
</div></section>
<section class="sec sec--tint" aria-labelledby="pr-h"><div class="wrap mcols">
  <section id="program" aria-labelledby="pr-h"><h2 class="h3" id="pr-h">Program</h2><div class="mlist-wrap" data-list="next" data-team="${t.slug}">${matchList(next, { crest: crestUrl(R), today: TODAY, root: R })}</div></section>
  <section id="vysledky" aria-labelledby="vy-h"><h2 class="h3" id="vy-h">Výsledky</h2><div class="mlist-wrap" data-list="past" data-team="${t.slug}">${matchList([...past].reverse(), { crest: crestUrl(R), today: TODAY, root: R })}</div></section>
</div><div class="wrap"><p class="note">Výsledky si môžete pozrieť aj na <a href="${info.sportnet}" rel="noopener">sportnet.sme.sk</a>.</p></div></section>
${tg.length ? `<section class="sec" id="fotky" aria-labelledby="tf-h"><div class="wrap">
  ${secHead('Fotogaléria', 'tf-h', null, R)}
  <div class="rail" data-rail>${railNav('Galérie')}<div class="rail-track">${tg.slice(0, 12).map((g) => galCard(g, R, { sizes: RAIL_SIZES })).join('')}</div></div>
</div></section>` : ''}
${videoDialog()}`;
    },
  });
}
teams.forEach(teamPage);

add('mladez/', {
  title: 'Mládež', active: 'mladez/', desc: 'Mládežnícke kategórie OK Častkovce od U7 po U19.',
  body: (R) => `${pageHero({ kicker: 'OK Častkovce', title: 'Mládež', R, crumbs: [[null, 'Mládež']] })}
<section class="sec sec--first"><div class="wrap">
  <ul class="tlist">${youth.map((t) => {
    const { next } = splitMatches(teamMatches(t.slug), TODAY);
    const players = (t.roster || []).find((g) => g.title === 'Hráči');
    return `<li class="tcard"><a href="${R}${t.url}">
      <span class="tcard-img">${hasPic('tim-' + t.slug) ? pic('tim-' + t.slug, R, { sizes: '(min-width: 1240px) 405px, (min-width: 1100px) 30vw, (min-width: 700px) 45vw, 200px' }) : `<span class="ph-crest"></span>`}<span class="tcard-u">${esc(t.short)}</span></span>
      <span class="tcard-b"><span class="tcard-t">${esc(t.sub)}</span>${t.league ? `<span class="tcard-l">${esc(t.league)}</span>` : ''}
      <span class="tcard-m">${players ? `<span>Hráčov na súpiske: <b>${players.people.length}</b></span>` : ''}${next[0] ? `<span>Najbližší zápas: <b>${fmtDay(next[0].date)} ${fmtDate(next[0].date)}</b></span>` : ''}</span></span></a></li>`;
  }).join('')}</ul>
</div></section>`,
});

// SPRÁVY
add('spravy/', {
  title: 'Správy', active: 'spravy/', desc: 'Správy z diania v OK Častkovce.',
  body: (R) => `${pageHero({ kicker: 'OK Častkovce', title: 'Správy', R, crumbs: [[null, 'Správy']] })}
<section class="sec sec--first"><div class="wrap"><div class="grid grid--news">${news.map((n, i) => newsCard(n, R, { big: i === 0, h: 'h2', first: i === 0 })).join('')}</div></div></section>`,
});
news.forEach((n, i) => {
  add(`spravy/${n.slug}/`, {
    title: n.title, active: 'spravy/', desc: n.excerpt || n.title,
    body: (R) => {
      const g = galById[NEWS_GAL[n.id]];
      const fixBody = n.body.replace(/src="\/img\//g, `src="${R}img/`).replace(/href="https?:\/\/(www\.)?okcastkovce\.sk\/fotogaleria\/\d+\/([^"]+)"/g, `href="${R}fotogaleria/$2/"`);
      const prev = news[i + 1], next = news[i - 1];
      return `<article class="art">
  ${pageHero({ kicker: fmtDate(n.date), title: n.title, R, crumbs: [['spravy/', 'Správy'], [null, n.title.length > 40 ? n.title.slice(0, 38) + '…' : n.title]] })}
  <div class="wrap art-in">
    <div class="prose">${fixBody}</div>
    <p class="art-share" data-share hidden><button type="button" class="btn btn--line-dark btn--sm">${I.share}Zdieľať správu</button><span class="share-msg" role="status"></span></p>
    ${g ? `<a class="art-gal" href="${R}fotogaleria/${g.slug}/"><img src="${galCover(g, R)}" alt="" loading="lazy"><span><span class="kicker">Fotogaléria</span><b>${esc(g.title)}</b><span>${g.files.length} fotiek</span></span>${I.arrow}</a>` : ''}
    <nav class="art-nav" aria-label="Ďalšie správy">${prev ? `<a href="${R}spravy/${prev.slug}/"><span>Staršia správa</span><b>${esc(prev.title)}</b></a>` : '<span></span>'}${next ? `<a class="art-nav-next" href="${R}spravy/${next.slug}/"><span>Novšia správa</span><b>${esc(next.title)}</b></a>` : ''}</nav>
  </div>
</article>`;
    },
  });
});

// FOTOGALÉRIA
add('fotogaleria/', {
  title: 'Fotogaléria', active: 'fotogaleria/', desc: 'Fotogalérie zo zápasov a podujatí OK Častkovce.',
  body: (R) => `${pageHero({ kicker: 'OK Častkovce', title: 'Fotogaléria', R, crumbs: [[null, 'Fotogaléria']] })}
<section class="sec sec--first"><div class="wrap"><div class="grid grid--gal" data-paged="12" data-more="Zobraziť ďalšie galérie">${gals.map((g, i) => galCard(g, R, { h: 'h2', first: i === 0 })).join('')}</div></div></section>`,
});
gals.forEach((g) => add(`fotogaleria/${g.slug}/`, {
  title: g.title, active: 'fotogaleria/', desc: `Fotogaléria: ${g.title}`,
  body: (R) => `${pageHero({ kicker: `${g.date ? fmtDate(g.date) + ' · ' : ''}${g.files.length} fotiek`, title: g.title, R, crumbs: [['fotogaleria/', 'Fotogaléria'], [null, g.title]] })}
<section class="sec sec--first"><div class="wrap">
  <ul class="photos" data-lightbox>${g.files.map((f, i) => `<li><a href="${galImg(g, f, R)}" data-i="${i}"><img src="${galImg(g, f, R, true)}" alt="${esc(g.title)} – fotka ${i + 1}"${i === 0 ? ' fetchpriority="high"' : i < 6 ? '' : ' loading="lazy"'} decoding="async"></a></li>`).join('')}</ul>
</div></section>
<dialog class="lb" id="lb" aria-label="Fotka"><button type="button" class="lb-x" data-close aria-label="Zavrieť">✕</button><button type="button" class="lb-btn lb-prev" aria-label="Predchádzajúca fotka">${I.left}</button><img class="lb-img" alt=""><button type="button" class="lb-btn lb-next" aria-label="Ďalšia fotka">${I.right}</button><p class="lb-c" aria-live="polite"></p></dialog>`,
}));

// VIDEO
add('video/', {
  title: 'Video', active: 'video/', desc: 'Videá zo zápasov OK Častkovce.',
  body: (R) => `${pageHero({ kicker: 'OK Častkovce', title: 'Video', R, crumbs: [[null, 'Video']] })}
<section class="sec sec--first"><div class="wrap"><div class="grid grid--video">${videos.map((v, i) => videoCard(v, R, { first: i === 0 })).join('')}</div>
<p class="note">Video sa načíta z YouTube až po kliknutí.</p></div></section>${videoDialog()}`,
});

// KLUB
const KLUB = [
  ['stadion', 'Štadión'], ['historia', 'História'], ['vedenie-klubu', 'Vedenie klubu'], ['prenajom-umelej-travy', 'Prenájom umelej trávy'], ['kontakty', 'Kontakty'],
];
const klubNav = (R, cur) => `<nav class="subnav" aria-label="Klub"><div class="wrap">${KLUB.map(([s, t]) => `<a href="${R}klub/${s}/"${s === cur ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</div></nav>`;
add('klub/', {
  title: 'Klub', active: 'klub/', desc: 'OK Častkovce – štadión, história, vedenie klubu a kontakty.',
  body: (R) => `${pageHero({ kicker: info.pravnyNazov, title: 'Klub', R, crumbs: [[null, 'Klub']] })}${klubNav(R, '')}
<section class="sec sec--first"><div class="wrap"><ul class="kgrid">
  <li><a class="kcard" href="${R}klub/stadion/">${hasPic('stadion-tribuna') ? pic('stadion-tribuna', R, { sizes: '(min-width: 900px) 33vw, 100vw', eager: true, alt: '' }) : cardImg(`${R}img/archiv/ostatne/stadion/Tribuna.jpg`, R, { sizes: '(min-width: 900px) 33vw, 100vw', first: true })}<span><b>Štadión</b><span>Kapacita ${info.stadion.kapacita} osôb, ${info.stadion.sedenie} miest na sedenie</span></span></a></li>
  <li><a class="kcard" href="${R}klub/historia/">${cardImg(`${R}img/archiv/ostatne/historia/02.jpg`, R, { sizes: '(min-width: 900px) 33vw, 100vw', eager: true })}<span><b>História</b><span>Súťažne organizovaný futbal sa začal v r. 1962.</span></span></a></li>
  <li><a class="kcard kcard--text" href="${R}klub/vedenie-klubu/"><span><b>Vedenie klubu</b><span>Predseda klubu, tréneri a funkcionári</span></span></a></li>
  <li><a class="kcard kcard--text" href="${R}klub/prenajom-umelej-travy/"><span><b>Prenájom umelej trávy</b><span>${esc(info.telefon)}</span></span></a></li>
  <li><a class="kcard kcard--text" href="${R}klub/kontakty/"><span><b>Kontakty</b><span>${esc(info.email)}</span></span></a></li>
</ul></div></section>`,
});
for (const [slug, title] of KLUB) {
  add(`klub/${slug}/`, {
    title, active: 'klub/',
    body: (R) => {
      let html = klub.pages[slug].replace(/src="\/img\//g, `src="${R}img/`);
      // odkaz na telefón má sedieť so zobrazeným číslom
      html = html.replace(/<a href="tel:[^"]*">([^<]+)<\/a>/g, (_, n) => `<a href="${tel(n)}">${n}</a>`);
      if (slug === 'kontakty') html = html.replace(/E mail:&nbsp;okcastkovce@okcastkovce\.sk/, `E mail: <a href="mailto:${info.email}">${info.email}</a>`).replace(/Tel: (0949 373 648)/, (_, n) => `Tel: <a href="${tel(n)}">${n}</a>`);
      const cls = slug === 'vedenie-klubu' || slug === 'kontakty' ? ' prose--facts' : slug === 'historia' ? ' prose--history' : slug === 'prenajom-umelej-travy' ? ' prose--rent' : '';
      const map = slug === 'kontakty' ? `<p class="note"><a class="btn btn--line-dark btn--sm" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Častkovce 355, 916 27 Častkovce')}" rel="noopener">${I.pin}Otvoriť adresu v mapách</a></p>`
        : slug === 'stadion' ? `<p class="note">${navBtn('btn btn--line-dark btn--sm')}</p>` : '';
      const img = slug === 'stadion' && hasPic('stadion-dron') ? pic('stadion-dron', R, { cls: 'phero-img', eager: true, sizes: PHERO_SIZES }) : '';
      return `${pageHero({ kicker: 'Klub', title, R, img, crumbs: [['klub/', 'Klub'], [null, title]] })}${klubNav(R, slug)}
<section class="sec sec--first"><div class="wrap"><div class="prose${cls}">${html}</div>${map}</div></section>`;
    },
  });
}

// FANZÓNA
add('fanzona/', {
  title: 'Fanzóna', active: 'fanzona/', desc: 'Fanshop a klubové oblečenie OK Častkovce.',
  body: (R) => {
    // fan-1 je len pás s textom „Obleč sa ako pravý fanúšik…“, ten je na stránke ako text
    const imgs = [...fan.oblecenie.matchAll(/src="\/(img\/archiv\/fanshop\/[^"]+)"/g)].map((m) => m[1]).filter((s) => !/\/fan-1\.jpg$/.test(s));
    // popis letáku pre čítačky (názov a cena presne podľa letáku)
    const FLYER = { 'fan-10': 'Mikina, 40 Eur', 'fan-2': 'Dámske tričko, 25 Eur', 'fan-20': 'Streetwear mikina, 28 Eur', 'fan-3': 'Dámske šaty, 25 Eur', 'fan-30': 'Dáždnik, 15 Eur', 'fan-4': 'Pánske tričko, 25 Eur', 'fan-40': 'Detská šiltovka 9 Eur, tričko detské biele 15 Eur', 'fan-5': 'Pánske tričko, 25 Eur', 'fan-7': 'Šiltovka, 15 Eur' };
    const flyerAlt = (src) => { const k = src.split('/').pop().replace(/\.\w+$/, ''); return FLYER[k] ? `Leták: ${FLYER[k]}` : 'Klubové oblečenie OK Častkovce'; };
    const dni = ['pondelok', 'utorok', 'streda', 'štvrtok', 'piatok', 'sobota', 'nedeľa'];
    void imgs; void flyerAlt;
    // produkty ako karty e-shopu (názvy, ceny, farby a veľkosti z letákov, data/fanshop.json; fotky scripts/fanshop.py)
    const shop = rd('fanshop.json', { produkty: [] });
    const order = (p) => `mailto:${info.email}?subject=${encodeURIComponent(`Objednávka: ${p.nazov}`)}&body=${encodeURIComponent(`Dobrý deň,\nmám záujem o: ${p.nazov} (${p.cena} €)\nVeľkosť:\nFarba:\nMeno a telefón:\n`)}`;
    const prod = (p) => `<li class="prod">
    <div class="prod-img"><picture><source type="image/webp" srcset="${R}img/fanshop/${p.slug}.webp"><img src="${R}img/fanshop/${p.slug}.jpg" alt="${esc(p.nazov)} OK Častkovce" width="640" height="800" loading="lazy" decoding="async"></picture></div>
    <div class="prod-body">
      <h3 class="prod-t">${esc(p.nazov)}</h3>
      <dl class="prod-v">${p.farba ? `<div><dt>Varianta</dt><dd>${esc(p.farba)}</dd></div>` : ''}${p.velkost ? `<div><dt>Veľkosť</dt><dd>${esc(p.velkost)}</dd></div>` : ''}</dl>
      <p class="prod-p">${p.cena} €</p>
      <div class="prod-act"><a class="btn btn--red btn--sm prod-buy" href="${order(p)}">Objednať<span class="sr">: ${esc(p.nazov)}</span></a><a class="prod-flyer" href="${R}img/archiv/fanshop/${p.letak}" data-lb>Leták<span class="sr">: ${esc(p.nazov)}</span></a></div>
    </div>
  </li>`;
    return `${pageHero({ kicker: 'Fanzóna', title: 'Fanshop', R, crumbs: [[null, 'Fanzóna']] })}
<section class="sec sec--first" aria-labelledby="ob-h"><div class="wrap">
  <div class="shop-head">
    <h2 class="h2" id="ob-h">Oblečenie</h2>
    <p class="shop-lead">„Obleč sa ako pravý fanúšik!“ Kúpou produktov podporuješ mladé talenty v našom klube.</p>
  </div>
  <ul class="prods" data-lightbox>${shop.produkty.map(prod).join('')}</ul>
  ${shop.pozn ? `<p class="note">${esc(shop.pozn)}</p>` : ''}
</div></section>
<section class="sec sec--tint" aria-labelledby="kup-h"><div class="wrap fan">
  <div class="fan-text">
    <h2 class="h3" id="kup-h">Ako nakúpiť</h2>
    <p>Produkty si môžeš zakúpiť priamo v bufete na našom futbalovom štadióne alebo si svoju objednávku vybav vopred e-mailom na: <a href="mailto:${info.email}">${info.email}</a></p>
    <p>Počas zápasov prvého mužstva funguje predajňa suvenírov priamo na futbalovom štadióne.</p>
  </div>
  <div class="hours"><h2 class="h3">Otváracie hodiny nášho FANSHOP</h2><dl>${dni.map((d) => `<div><dt>${d}</dt><dd>12.00 – 20.00 h</dd></div>`).join('')}</dl>
    <h2 class="h3">Otváracie hodiny FANSHOP na štadióne</h2><p>v čase zápasov prvého mužstva</p></div>
</div></section>
<dialog class="lb" id="lb" aria-label="Fotka"><button type="button" class="lb-x" data-close aria-label="Zavrieť">✕</button><button type="button" class="lb-btn lb-prev" aria-label="Predchádzajúca fotka">${I.left}</button><img class="lb-img" alt=""><button type="button" class="lb-btn lb-next" aria-label="Ďalšia fotka">${I.right}</button><p class="lb-c" aria-live="polite"></p></dialog>`;
  },
});

add('ochrana-sukromia/', {
  title: 'Ochrana súkromia', active: '',
  body: (R) => `${pageHero({ kicker: info.pravnyNazov, title: 'Ochrana súkromia', R, crumbs: [[null, 'Ochrana súkromia']] })}
<section class="sec sec--first"><div class="wrap"><div class="prose">${privacy.body}</div></div></section>`,
});

add('404/', {
  title: 'Stránka sa nenašla', active: '',
  body: (R) => `${pageHero({ kicker: 'Chyba 404', title: 'Stránka sa nenašla', R, crumbs: [[null, '404']] })}
<section class="sec sec--first"><div class="wrap"><p><a class="btn btn--red" href="${R}">Späť na úvod${I.arrow}</a></p></div></section>`,
});

// ---- zápis -------------------------------------------------------------------------------------
fs.rmSync(OUT, { recursive: true, force: true });
const copy = (from, to) => { if (fs.existsSync(from)) fs.cpSync(from, to, { recursive: true }); };
copy(path.join(SRC, 'img'), path.join(OUT, 'img'));
copy(path.join(SRC, 'fonts'), path.join(OUT, 'fonts'));
copy(path.join(SRC, 'js'), path.join(OUT, 'js'));
copy(path.join(ROOT, 'media', 'foto-web'), path.join(OUT, 'foto'));
if (G.mode === 'local') copy(path.join(ROOT, 'media', 'galerie-web'), path.join(OUT, 'galerie'));
fs.rmSync(path.join(OUT, 'fonts', 'fonts.css'), { force: true });
fs.mkdirSync(path.join(OUT, 'css'), { recursive: true });
const fontsCss = fs.readFileSync(path.join(SRC, 'fonts', 'fonts.css'), 'utf8').replace(/url\(([^)]+)\)/g, 'url(../fonts/$1)');
fs.writeFileSync(path.join(OUT, 'css', 'site.css'), fontsCss + fs.readFileSync(path.join(SRC, 'css', 'site.css'), 'utf8'));

for (const p of pages) {
  const depth = p.route.split('/').filter(Boolean).length;
  const R = depth ? '../'.repeat(depth) : './';
  const html = layout({ ...p, body: p.body(R) });
  const file = path.join(OUT, p.route, 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}
// GitHub Pages: 404 v koreni (absolútne cesty, lebo sa zobrazuje na ľubovoľnej adrese)
const BASE = process.env.BASE_PATH || config.basePath || '/'; // nasadenie na GitHub Pages: BASE_PATH=/ok-castkovce/ (scripts/deploy.mjs)
const notFound = fs.readFileSync(path.join(OUT, '404', 'index.html'), 'utf8').replace(/(href|src)="(\.\.\/)+/g, `$1="${BASE}`);
fs.writeFileSync(path.join(OUT, '404.html'), notFound);
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

// rozpis pre prehliadač: web si „dnes“ prepočíta sám, aj keď sa dlho nezostavuje (site.mjs)
fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'data', 'zapasy.json'), JSON.stringify({
  teams: Object.fromEntries(teams.map((t) => [t.slug, { short: t.short, url: t.url }])),
  matches: matches.map(({ id, team, date, time, opponent, home, league, score, note, gal, yt, ytTitle }) => ({ id, team, date, time, opponent, home, league, score, note, gal, yt, ytTitle })),
}));

// kalendáre .ics: každý tím, všetky zápasy a jednotlivé budúce zápasy
fs.mkdirSync(path.join(OUT, 'kalendar'), { recursive: true });
for (const t of teams) {
  const list = teamMatches(t.slug);
  if (list.length) fs.writeFileSync(path.join(OUT, 'kalendar', `${t.slug}.ics`), ics(list, `${info.nazov} – ${t.isA ? 'A-mužstvo' : `${t.short} ${t.sub}`}`));
}
fs.writeFileSync(path.join(OUT, 'kalendar', 'vsetky.ics'), ics(matches, `${info.nazov} – všetky zápasy`));
for (const m of splitMatches(matches, TODAY).next) fs.writeFileSync(path.join(OUT, 'kalendar', `zapas-${m.id}.ics`), ics([m], `${info.nazov} – ${labels[m.team]}`));
console.log(`Hotovo: ${pages.length} stránok -> dist/ (dnes = ${TODAY})`);
