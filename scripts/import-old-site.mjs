// Prevezme obsah zo starého webu okcastkovce.sk do data/*.json (texty bez zmeny).
// node scripts/import-old-site.mjs            – stránky, súpisky, zápasy, správy, videá, zoznam galérií
// node scripts/import-old-site.mjs --galleries – navyše stiahne fotky galérií do media/galerie (veľké)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const ARCH = path.join(ROOT, 'src', 'img', 'archiv');
const B = 'https://okcastkovce.sk';
fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(ARCH, { recursive: true });

const get = async (u, type = 'text') => {
  const r = await fetch(u.startsWith('http') ? u : B + u, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
  if (!r.ok) throw new Error(`${r.status} ${u}`);
  return type === 'json' ? r.json() : type === 'buf' ? Buffer.from(await r.arrayBuffer()) : r.text();
};
const decode = (s) => s
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));
const clean = (s) => decode(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

// ---- obrázky zo starého webu -> src/img/archiv/<cesta> --------------------------------
const images = new Map();
async function localImg(src) {
  if (!src) return null;
  let p = decode(src).replace(/^https?:\/\/(www\.)?okcastkovce\.sk/, '').replace(/\?.*$/, '');
  if (!p.startsWith('/')) return src;
  const rel = p.replace(/^\/(img\/)?public\//, '').replace(/^\/theme\/img\//, 'theme/');
  if (images.has(p)) return images.get(p);
  const dest = path.join(ARCH, ...rel.split('/'));
  if (!path.resolve(dest).startsWith(ARCH + path.sep)) return src; // „..“ v ceste zo starého webu by zapísalo mimo src/img/archiv
  const url = `/img/archiv/${rel}`;
  images.set(p, url);
  if (!fs.existsSync(dest)) {
    try {
      const fetchPath = p.startsWith('/public/') ? '/img' + p : p;
      const buf = await get(encodeURI(fetchPath) + '?size=lg', 'buf').catch(() => get(encodeURI(p), 'buf'));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buf);
    } catch (e) { console.warn('  obrázok chýba:', p, e.message); images.set(p, null); return null; }
  }
  return url;
}

// ---- bezpečné HTML: len základné značky, odkazy a obrázky ----------------------------------
const ALLOWED = new Set(['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'blockquote']);
async function sanitize(html) {
  html = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|iframe|noscript)[\s\S]*?<\/\1>/gi, '');
  html = html.replace(/<div class="[^"]*block-header[^"]*">([\s\S]*?)<\/div>/g, (_, t) => `<h3>${clean(t)}</h3>`);
  const out = [];
  let last = 0;
  for (const m of html.matchAll(/<(\/?)([a-zA-Z0-9]+)([^>]*)>/g)) {
    out.push(html.slice(last, m.index));
    last = m.index + m[0].length;
    const [, close, tagRaw, attrs] = m;
    const tag = tagRaw.toLowerCase();
    if (!ALLOWED.has(tag)) continue;
    if (close) { if (tag !== 'br' && tag !== 'img') out.push(`</${tag}>`); continue; }
    if (tag === 'a') {
      const href = (attrs.match(/href="([^"]*)"/) || [])[1] || '';
      const h = decode(href);
      if (/^(https?:|mailto:|tel:|\/)/i.test(h)) out.push(`<a href="${h.replace(/"/g, '&quot;')}">`);
      else out.push('<a>');
    } else if (tag === 'img') {
      const src = (attrs.match(/src="([^"]*)"/) || [])[1];
      const alt = (attrs.match(/alt="([^"]*)"/) || [])[1] || '';
      const local = await localImg(src);
      if (local) out.push(`<img src="${local}" alt="${alt === 'image in page' || alt === 'image banner' ? '' : alt}">`);
    } else out.push(`<${tag}>`);
  }
  out.push(html.slice(last));
  return out.join('')
    .replace(/[ \t]*\n[ \t]*/g, '\n').replace(/\n{2,}/g, '\n')
    .replace(/<p>\s*<\/p>/g, '').trim();
}
const between = (s, a, b) => { const i = s.indexOf(a); if (i < 0) return ''; const j = s.indexOf(b, i + a.length); return s.slice(i + a.length, j < 0 ? undefined : j); };

// ---- súpiska ----------------------------------------------------------------------------
async function roster(html) {
  const main = between(html, 'page-content-main', '<div id="footer"');
  const groups = [];
  const parts = main.split(/<div class="text-uppercase fs-3 my-2 text-blue fw-bold ">/).slice(1);
  for (const part of parts) {
    const title = clean(part.slice(0, part.indexOf('</div>')));
    const people = [];
    for (const card of part.split('supiska-hrac').slice(1)) {
      const bg = (card.match(/background-image:\s*url\(([^)]+)\)/) || [])[1];
      const nameHtml = (card.match(/text-uppercase lh-1">([\s\S]*?)<div class="small/) || [])[1] || '';
      const name = clean(nameHtml.replace(/<br\s*\/?>/g, ' '));
      const nat = clean((card.match(/text-muted fs-6 fw-normal">([\s\S]*?)<\/div>/) || [])[1] || '');
      const tag = clean((card.match(/hrac-cislo">([\s\S]*?)<\/div>/) || [])[1] || '');
      const photo = bg && !bg.includes('/theme/img/hrac.png') ? await localImg(bg) : null;
      if (name) people.push({ name, nationality: nat || null, tag: tag || null, photo });
    }
    groups.push({ title, people });
  }
  return groups;
}

(async () => {
  const home = await get('/');
  const menu = JSON.parse(between(home, 'const menuItems = ', '; \n').trim().replace(/;$/, ''));
  fs.writeFileSync(path.join(DATA, 'menu-stary-web.json'), JSON.stringify(menu, null, 1));
  const footer = between(home, '<div id="footer_2"', '</div> </div> <div style');

  // Klub – podstránky
  const club = { source: B, pages: {} };
  for (const slug of ['stadion', 'historia', 'vedenie-klubu', 'prenajom-umelej-travy', 'kontakty']) {
    const html = await get(`/klub/${slug}`);
    const main = between(html, '<div class="page-content-main pcm-v1">', '<div id="footer"');
    club.pages[slug] = await sanitize(main);
    console.log('klub', slug);
  }
  club.footer = clean(footer.replace(/<br\s*\/?>/g, '\n'));
  fs.writeFileSync(path.join(DATA, 'klub.json'), JSON.stringify(club, null, 1));

  // Ochrana súkromia (právny text klubu, bez zmeny)
  {
    const html = await get('/ochrana-sukromia');
    const main = between(html, '<div class="page-content-main pcm-v1">', '<div id="footer"');
    fs.writeFileSync(path.join(DATA, 'ochrana-sukromia.json'), JSON.stringify({ body: await sanitize(main) }, null, 1));
  }

  // Fanzóna
  const fan = {};
  for (const slug of ['fanshop', 'oblecenie']) {
    const html = await get(`/fanzona/${slug}`);
    fan[slug] = await sanitize(between(html, '<div class="page-content-main pcm-v1">', '<div id="footer"'));
  }
  fs.writeFileSync(path.join(DATA, 'fanzona.json'), JSON.stringify(fan, null, 1));

  // Tímy: A-mužstvo + mládež z menu
  const teamItems = [];
  for (const top of menu.flat()) {
    if (top.u === '/a-muzstvo') teamItems.push({ slug: 'a-muzstvo', name: top.t, base: '/a-muzstvo' });
    if (top.u === '/mladez') for (const s of top.s) teamItems.push({ slug: s.u.split('/').pop(), name: s.t, base: s.u });
  }
  const teams = [];
  for (const t of teamItems) {
    const sup = await get(`${t.base}/supiska`).catch(() => '');
    const rozpis = await get(`${t.base}/rozpis-zapasov`).catch(() => '');
    const ids = [...rozpis.matchAll(/VypisZapasy\('#zapasy-app',\s*["']zapasy["'],\s*["'](\d+)["']\)/g)].map((m) => +m[1]);
    const groups = await roster(sup);
    teams.push({ slug: t.slug, name: t.name, oldTeamId: ids[0] || null, roster: groups });
    console.log('tím', t.slug, ids, groups.map((g) => `${g.title}:${g.people.length}`).join(' '));
  }

  // Zápasy podľa tímu
  const matches = [];
  for (const t of teams) {
    if (!t.oldTeamId) continue;
    for (const mode of ['zapasy', 'vysledky']) {
      for (let p = 1; p < 40; p++) {
        const d = await get(`/api/matchlist/${mode}/?team=${t.oldTeamId}&page=${p}&pagesize=100`, 'json');
        for (const m of d.results || []) matches.push({ id: m.match_id, team: t.slug, date: m.datum, time: m.cas, opponent: m.proti.trim(), home: !!m.doma, league: (m.liga || '').trim() || null, score: m.vysledok && m.vysledok !== '-:-' ? m.vysledok : null, note: (m.text || '').trim() || null });
        if (!d.pagination || p >= d.pagination.pages) break;
      }
    }
  }
  const uniq = [...new Map(matches.map((m) => [m.id, m])).values()].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  for (const t of teams) t.league = [...new Set(uniq.filter((m) => m.team === t.slug && m.league).map((m) => m.league))].pop() || null;
  fs.writeFileSync(path.join(DATA, 'timy.json'), JSON.stringify(teams, null, 1));
  fs.writeFileSync(path.join(DATA, 'zapasy.json'), JSON.stringify(uniq, null, 1));
  console.log('zápasy', uniq.length);

  // Správy
  const news = [];
  for (let p = 1; p < 50; p++) {
    const d = await get(`/api/news?page=${p}&pagesize=50`, 'json');
    news.push(...d.news);
    if (!d.pagination || p >= d.pagination.pages) break;
  }
  const outNews = [];
  for (const n of news) {
    const html = await get(encodeURI(n.url));
    const body = between(html, '<div class="py-3 pe-md-5">', '<div class="col-12 col-md-3">');
    const slug = n.url.split('/').slice(3).join('-').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    outNews.push({ id: n.id, slug: `${n.id}-${slug}`, title: n.title.trim(), date: n.dtm, image: n.img ? await localImg(n.img) : null, excerpt: n.txt ? n.txt.replace(/\s+/g, ' ').trim() : null, body: await sanitize(body.replace(/<\/div>\s*<\/div>\s*$/, '')), oldUrl: B + n.url });
    console.log('správa', n.id);
  }
  fs.writeFileSync(path.join(DATA, 'spravy.json'), JSON.stringify(outNews, null, 1));

  // Videá
  const videos = [];
  for (let p = 1; p < 50; p++) {
    const d = await get(`/api/video/${p}/50`, 'json');
    const list = d.videos || d.results || d.items || (Array.isArray(d) ? d : []);
    videos.push(...list);
    if (!d.pagination || p >= d.pagination.pages) break;
  }
  const outVideos = [...new Map(videos.map((v) => {
    const yt = (v.url.match(/embed\/([\w-]{6,})/) || [])[1];
    return [yt, { id: v.id, title: v.title.trim(), date: v.dtm.slice(0, 10), youtube: yt }];
  })).values()];
  fs.writeFileSync(path.join(DATA, 'videa.json'), JSON.stringify(outVideos, null, 1));
  // náhľady videí lokálne (stránka potom nenačítava nič z YouTube, kým video nikto nespustí)
  const VID = path.join(ROOT, 'src', 'img', 'video');
  fs.mkdirSync(VID, { recursive: true });
  for (const v of outVideos) {
    const dest = path.join(VID, v.youtube + '.jpg');
    if (fs.existsSync(dest)) continue;
    for (const q of ['maxresdefault', 'hqdefault']) {
      try { fs.writeFileSync(dest, await get(`https://i.ytimg.com/vi/${v.youtube}/${q}.jpg`, 'buf')); break; } catch {}
    }
  }

  // Galérie (zoznam súborov; fotky voliteľne)
  const gals = [];
  for (let p = 1; p < 50; p++) {
    const d = await get(`/api/gal?page=${p}&pagesize=50`, 'json');
    gals.push(...(d.gals || d.results || d.items || (Array.isArray(d) ? d : [])));
    if (!d.pagination || p >= d.pagination.pages) break;
  }
  const outGals = [];
  for (const g of gals) {
    const det = await get(`/api/gal/id/${g.id}`, 'json');
    const files = det.galFiles.map((f) => f.fn).sort((a, b) => a.localeCompare(b, 'sk', { numeric: true }));
    outGals.push({ id: g.id, slug: g.url, title: g.title.trim(), date: g.dtm.slice(0, 10), path: det.galPath, cover: g.img ? g.img.split('/').pop() : files[0], files });
  }
  fs.writeFileSync(path.join(DATA, 'galerie.json'), JSON.stringify(outGals, null, 1));
  console.log('galérie', outGals.length, 'fotiek', outGals.reduce((s, g) => s + g.files.length, 0));

  if (process.argv.includes('--galleries')) {
    const MEDIA = path.join(ROOT, 'media', 'galerie');
    for (const g of outGals) {
      const dir = path.join(MEDIA, g.slug);
      fs.mkdirSync(dir, { recursive: true });
      for (const f of g.files) {
        const dest = path.join(dir, f);
        if (!path.resolve(dest).startsWith(MEDIA + path.sep)) continue; // názov súboru zo starého webu mimo media/galerie
        if (fs.existsSync(dest)) continue;
        try { fs.writeFileSync(dest, await get(encodeURI(`/img${g.path}/${f}`) + '?size=lg', 'buf')); }
        catch (e) { console.warn('  chýba', g.slug, f, e.message); }
      }
      console.log('galéria stiahnutá', g.slug);
    }
  }
  console.log('HOTOVO, obrázkov v archíve:', [...images.values()].filter(Boolean).length);
})().catch((e) => { console.error(e); process.exit(1); });
