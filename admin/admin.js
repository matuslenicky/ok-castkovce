// Administrácia OK Častkovce – klikateľná ukážka. Upravuje sa všetok OBSAH webu (texty, fotky, ľudia, produkty, partneri,
// kontakty), nie kostra a vzhľad. Dáta: demo.json (výsledky zo Sportnetu + obsah webu), zmeny len v tomto prehliadači
// (localStorage). Ostrá verzia: prihlásenie a ukladanie cez Supabase (Auth + tabuľky s RLS), web sa po zverejnení prestavia.
const app = document.getElementById('app');
const toastEl = document.getElementById('toast');
const KEY = 'okc-admin-demo-v2';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clone = (o) => JSON.parse(JSON.stringify(o));
// skutočná výška žltého pásu (úzky telefón, väčšie písmo) → lepiaca hlavička, lišta editora a scroll-padding sa posunú pod neho
const demoBar = document.querySelector('.demo-bar');
if (demoBar && 'ResizeObserver' in window) new ResizeObserver(() => document.documentElement.style.setProperty('--demo-h', demoBar.offsetHeight + 'px')).observe(demoBar);

// ---- ikony (Lucide, ISC) ----
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="m12 7 4 3-1.5 4.5h-5L8 10z"/><path d="M12 3v4M21 10.5l-5-.5M18 19l-3-4.5M6 19l3-4.5M3 10.5 8 10"/>',
  news: '<path d="M4 4h13v16H6a2 2 0 0 1-2-2z"/><path d="M17 8h3v10a2 2 0 0 1-2 2"/><path d="M8 8h5M8 12h5M8 16h3"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/>',
  shirt: '<path d="M8 3 3 6l2 5 3-1v11h8V10l3 1 2-5-5-3a4 4 0 0 1-8 0z"/>',
  ext: '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14.5 4.5L20 16"/><path d="M20 21v-5h-5"/>',
  check: '<path d="m5 12 5 5 9-10"/>', chev: '<path d="m9 6 6 6-6 6"/>', left: '<path d="m15 6-6 6 6 6"/>',
  up: '<path d="m6 15 6-6 6 6"/>', down: '<path d="m6 9 6 6 6-6"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  images: '<rect x="3" y="5" width="14" height="12" rx="2"/><path d="M7 21h12a2 2 0 0 0 2-2V9"/><path d="m3 14 4-4 4 4 2-2 4 4"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  out: '<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  layout: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/>',
  bag: '<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  handshake: '<path d="m11 17 2 2a1.5 1.5 0 0 0 2-2"/><path d="m14 14 2.5 2.5a1.5 1.5 0 0 0 2-2l-3.5-3.5-2 1a2 2 0 0 1-2.5-3l3-3 5 5"/><path d="M3 11l4-4 5 5"/><path d="m6 14 3 3a1.5 1.5 0 0 0 2-2"/>',
  people: '<circle cx="8" cy="7" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 20a6 6 0 0 1 12 0M14 20a4.5 4.5 0 0 1 8 0"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12"/><circle cx="12" cy="12" r="3"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
};
const ic = (n, cls = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${cls ? ` class="${cls}"` : ''}>${P[n]}</svg>`;
const BALL = '<svg class="ball" viewBox="0 0 24 24" role="img" aria-label="gól"><circle cx="12" cy="12" r="10" fill="#fff" stroke="#121317" stroke-width="1.6"/><path d="m12 6.2 5 3.6-1.9 5.9H8.9L7 9.8z" fill="#121317"/><path d="M12 6.2V2.5M17 9.8l3.5-1.2M15.1 15.7l2.2 3.1M8.9 15.7l-2.2 3.1M7 9.8 3.5 8.6" stroke="#121317" stroke-width="1.4"/></svg>';

// ---- stav ukážky ----
let D = null;
let DRAFT = {}; // rozpracované zmeny obrazovky (súpiska, tréneri, partneri), kým sa neuložia
let focusNext = null; // čo zamerať po prekreslení (selektor); inak ten istý prvok, inak nadpis – nikdy nie začiatok stránky
const EMPTY = { logged: false, role: 'admin', roleTeam: 'u15-starsi-ziaci', edits: {}, news: [], players: {}, users: null, c: {}, log: [] };
const S = load();
function load() {
  try { return { ...clone(EMPTY), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return clone(EMPTY); }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); return true; } catch { toast('Pamäť ukážky v prehliadači je plná (veľa fotiek) – zmena platí len do obnovenia stránky', true); return false; }
}
let toastT, warnUntil = 0;
// varovanie (warn) neprepíše bežné „uložené“, ktoré hneď nasleduje
function toast(msg, warn = false) {
  if (!warn && Date.now() < warnUntil) return;
  if (warn) warnUntil = Date.now() + 5000;
  toastEl.textContent = msg; toastEl.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { toastEl.hidden = true; }, warn ? 5000 : 3400);
}
// obsah: prepísané hodnoty sú v S.c, inak pôvodné z demo.json
const get = (key, def) => (key in S.c ? clone(S.c[key]) : clone(def));
function put(key, val, what, url) {
  S.c[key] = val;
  S.log.unshift({ t: Date.now(), what, url: url || '', who: roleName() });
  S.log = S.log.slice(0, 40);
  save();
}

// ---- pomocné ----
const MES = ['jan', 'feb', 'mar', 'apr', 'máj', 'jún', 'júl', 'aug', 'sep', 'okt', 'nov', 'dec'];
const DNI = ['ne', 'po', 'ut', 'st', 'št', 'pi', 'so'];
const dt = (iso) => new Date((iso || '2000-01-01') + 'T12:00:00');
const fmtD = (iso) => { const d = dt(iso); return `${DNI[d.getDay()]} ${d.getDate()}. ${d.getMonth() + 1}.`; };
const fmtDY = (iso) => (iso ? `${dt(iso).getDate()}. ${dt(iso).getMonth() + 1}. ${dt(iso).getFullYear()}` : '');
const todayISO = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Bratislava' });
const addDays = (iso, n) => { const d = dt(iso); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE'); };
const team = (slug) => D.allTeams.find((t) => t.slug === slug) || { short: slug || '—', sub: '' };
const our = (m) => { if (!m.score) return null; const [h, a] = m.score.split(':').map(Number); const o = m.home ? h : a, t = m.home ? a : h; return { o, t, r: o > t ? 'w' : o < t ? 'l' : 'd' }; };
const scoreBadge = (m) => { const s = our(m); return s ? `<span class="score score--${s.r}" aria-label="Skóre ${s.o}:${s.t}">${s.o}:${s.t}</span>` : m.played ? '<span class="time">–</span>' : `<span class="time">${esc(m.time)}</span>`; };
const edit = (id) => S.edits[id] || {};
const photosOf = (m) => (m.gallery?.count || 0) + (edit(m.id).photos?.length || 0);
const hasVideo = (m) => !!(m.video || edit(m.id).video);
const missing = (m) => { if (!m.played || !our(m)) return []; const e = edit(m.id), out = []; if (!e.comment) out.push('bez komentára'); if (!photosOf(m)) out.push('bez fotiek'); return out; };
const ytId = (u) => { const m = String(u || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/); return m ? m[1] : (/^[\w-]{11}$/.test(u || '') ? u : null); };
const ago = (t) => { const min = Math.max(1, Math.round((Date.now() - (typeof t === 'number' ? t : Date.parse(t))) / 6e4)); return min < 60 ? `pred ${min} min` : min < 1440 ? `pred ${Math.round(min / 60)} h` : `pred ${Math.round(min / 1440)} d`; };
const initials = (n) => String(n).split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const q = () => new URLSearchParams(location.hash.split('?')[1] || '');
const pw = (n, a, b, c) => (n === 1 ? a : n >= 2 && n <= 4 ? b : c); // len tvar slova
const plural = (n, a, b, c) => `${n} ${pw(n, a, b, c)}`;
const slugify = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'polozka';
const webLink = (url, t = 'Zobraziť na webe') => `<a class="link" href="../${esc(url)}" target="_blank" rel="noopener">${t}</a>`;
const validUrl = (u) => !u || /^https:\/\/[^\s]+\.[^\s]+$/.test(u);
const validMail = (u) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u);

// ---- roly (ukážka: „pozrieť očami“ trénera, fotografa, redaktora) ----
const ROLES = { admin: ['Správca', 'všetko vrátane používateľov'], redaktor: ['Redaktor', 'správy, zápasy, galérie, videá, stránky a úvod'], trener: ['Tréner', 'zápasy, fotky, videá a súpiska svojho tímu'], foto: ['Fotograf', 'fotky k zápasom a galérie'] };
const ACCESS = {
  admin: null,
  redaktor: ['home', 'zapasy', 'spravy', 'galerie', 'videa', 'stranky', 'uvod', 'zmeny'],
  trener: ['home', 'zapasy', 'galerie', 'videa', 'timy', 'zmeny'],
  foto: ['home', 'zapasy', 'galerie', 'zmeny'],
};
if (!ROLES[S.role]) S.role = 'admin'; // stará alebo neznáma rola v localStorage
const can = (sec) => !ACCESS[S.role] || ACCESS[S.role].includes(sec);
const scopeTeam = () => (S.role === 'trener' ? S.roleTeam : '');
const roleName = () => (S.role === 'admin' ? 'Správca webu' : `${ROLES[S.role][0]}${S.role === 'trener' ? ' ' + team(S.roleTeam).short : ''}`);

// ---- rozloženie ----
const GROUPS = [
  [null, [['#/', 'Prehľad', 'home', 'home']]],
  ['Obsah', [['#/zapasy', 'Zápasy', 'ball', 'zapasy'], ['#/spravy', 'Správy', 'news', 'spravy'], ['#/galerie', 'Galérie', 'images', 'galerie'], ['#/videa', 'Videá', 'video', 'videa']]],
  ['Klub', [['#/timy', 'Tímy a súpisky', 'shirt', 'timy'], ['#/ludia', 'Tréneri a vedenie', 'people', 'ludia'], ['#/stranky', 'Stránky klubu', 'file', 'stranky'], ['#/kontakty', 'Kontakty a údaje', 'phone', 'kontakty']]],
  ['Web', [['#/uvod', 'Úvodná stránka', 'layout', 'uvod'], ['#/fanzona', 'Fanzóna', 'bag', 'fanzona'], ['#/partneri', 'Partneri', 'handshake', 'partneri']]],
  ['Správa', [['#/pouzivatelia', 'Používatelia', 'users', 'pouzivatelia'], ['#/zmeny', 'História zmien', 'history', 'zmeny']]],
];
const BOTTOM = [['#/', 'Prehľad', 'home', 'home'], ['#/zapasy', 'Zápasy', 'ball', 'zapasy'], ['#/spravy', 'Správy', 'news', 'spravy']];
function shell(active, body) {
  const cur = (sec) => (active === sec ? ' aria-current="page"' : '');
  const side = GROUPS.map(([g, items]) => { const vis = items.filter(([, , , s]) => can(s)); return vis.length ? `${g ? `<p class="side-g">${g}</p>` : ''}${vis.map(([h, t, i, s]) => `<a href="${h}"${cur(s)}>${ic(i)}${t}</a>`).join('')}` : ''; }).join('');
  const bottom = BOTTOM.filter(([, , , s]) => can(s)).concat(can('spravy') ? [] : [['#/galerie', 'Galérie', 'images', 'galerie']]);
  const moreActive = !bottom.some(([, , , s]) => s === active);
  return `<div class="shell">
  <header class="top${S.role !== 'admin' ? ' top--role' : ''}"><a class="top-brand" href="#/"><img src="../img/logo.svg" alt=""><b>OK Častkovce</b><span>Admin</span></a>
    <div class="top-user">${S.role !== 'admin' ? `<button class="role-pill" type="button" id="role-back">${ic('eye')}${esc(roleName())} · späť</button>` : '<span class="who">Správca webu</span>'}<span class="ava" aria-hidden="true">${esc(initials(roleName()))}</span></div></header>
  <nav class="side" aria-label="Administrácia">${side}<div class="sep"></div><a href="../" target="_blank" rel="noopener">${ic('globe')}Zobraziť web</a><a href="#/odhlasit">${ic('out')}Odhlásiť</a></nav>
  <main class="main" id="main">${body}</main>
  <nav class="nav" aria-label="Administrácia">${bottom.map(([h, t, i, s]) => `<a href="${h}"${cur(s)}>${ic(i)}${t}</a>`).join('')}<a href="#/viac"${moreActive ? ' aria-current="page"' : ''}>${ic('menu')}Viac</a></nav>
</div>`;
}
const head = (title, sub, action = '') => `<div class="page-h"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${action}</div>`;
const back = (href, t) => `<a class="back" href="${href}">${ic('left')}${t}</a>`;
const savebar = (state, buttons) => `<div class="savebar"><span class="state" id="state">${state}</span>${buttons}</div>`;
const denied = () => shell('', `${head('Bez prístupu', 'Táto časť nie je pre vašu rolu. Požiadajte správcu webu.')}`);

// ---- editor textu (bez HTML: tlačidlá formátovania; uložené HTML sa čistí na povolené značky) ----
const ALLOWED = { P: [], H2: [], H3: [], H4: [], B: [], STRONG: [], I: [], EM: [], U: [], UL: [], OL: [], LI: [], BR: [], BLOCKQUOTE: [], A: ['href'], IMG: ['src', 'alt'], TABLE: [], THEAD: [], TBODY: [], TR: [], TD: ['colspan', 'rowspan'], TH: ['colspan', 'rowspan'] };
function sanitize(html) {
  const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
  const walk = (node) => {
    for (const el of [...node.children]) {
      walk(el);
      if (!(el.tagName in ALLOWED)) {
        if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'SVG', 'MATH', 'TEMPLATE'].includes(el.tagName)) { el.remove(); continue; }
        const p = el.tagName === 'DIV' ? doc.createElement('p') : null;
        if (p) { p.append(...el.childNodes); el.replaceWith(p); } else el.replaceWith(...el.childNodes);
        continue;
      }
      for (const a of [...el.attributes]) if (!ALLOWED[el.tagName].includes(a.name)) el.removeAttribute(a.name);
      if (el.tagName === 'A' && !/^(https?:|mailto:|tel:|\.\.\/|#)/i.test(el.getAttribute('href') || '')) el.removeAttribute('href');
      if (el.tagName === 'IMG' && !/^(data:image\/(png|jpe?g|webp|gif);|\.\.\/|https:\/\/)/i.test(el.getAttribute('src') || '')) el.remove();
    }
  };
  walk(doc.body.firstChild);
  return doc.body.firstChild.innerHTML.replace(/&nbsp;/g, ' ').trim();
}
const rte = (name, html, label) => `<div class="rte" data-rte="${name}">
  <div class="rte-bar" role="toolbar" aria-label="Formátovanie: ${esc(label)}">
    <button type="button" data-cmd="h3">Nadpis</button><button type="button" data-cmd="p">Odsek</button>
    <button type="button" data-cmd="bold" aria-label="Tučné"><b>B</b></button><button type="button" data-cmd="italic" aria-label="Kurzíva"><i>I</i></button>
    <button type="button" data-cmd="ul" aria-label="Zoznam s odrážkami">• Zoznam</button><button type="button" data-cmd="link">Odkaz</button>
    <button type="button" data-cmd="img">Obrázok</button><button type="button" data-cmd="clear" title="Zrušiť formátovanie">Bez formátu</button>
  </div>
  <div class="rte-area prose" contenteditable="true" role="textbox" aria-multiline="true" aria-label="${esc(label)}">${sanitize(html).replace(/<(\/?)h3>/g, '<$1h2>')}</div>
  <div class="rte-link" hidden><input class="input" type="url" placeholder="https://… alebo mailto:…" aria-label="Adresa odkazu"><button class="btn btn--sm" type="button">Vložiť odkaz</button><button class="btn btn--ghost btn--sm" type="button" data-cancel>Zrušiť</button></div>
  <input type="file" accept="image/*" hidden tabindex="-1" aria-hidden="true">
</div>`;
function bindRte(onChange) {
  document.querySelectorAll('.rte').forEach((box) => {
    const area = box.querySelector('.rte-area'), linkBox = box.querySelector('.rte-link'), linkIn = linkBox.querySelector('input'), file = box.querySelector('input[type=file]');
    let range = null;
    const keep = () => { const s = getSelection(); if (s.rangeCount && area.contains(s.anchorNode)) range = s.getRangeAt(0).cloneRange(); };
    const restore = () => { area.focus(); if (range) { const s = getSelection(); s.removeAllRanges(); s.addRange(range); } };
    area.addEventListener('keyup', keep); area.addEventListener('mouseup', keep); area.addEventListener('input', () => { keep(); onChange?.(); });
    box.querySelector('.rte-bar').addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
    box.querySelector('.rte-bar').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-cmd]'); if (!b) return;
      const c = b.dataset.cmd; restore();
      // nadpis v texte = h2 (stránka má h1, staré texty s h3 sa pri otvorení zmenia na h2, aby nechýbala úroveň)
      if (c === 'h3' || c === 'p') document.execCommand('formatBlock', false, c === 'h3' ? '<h2>' : '<p>');
      else if (c === 'ul') document.execCommand('insertUnorderedList');
      else if (c === 'clear') { document.execCommand('removeFormat'); document.execCommand('formatBlock', false, '<p>'); }
      else if (c === 'link') { keep(); linkBox.hidden = false; linkIn.value = ''; linkIn.focus(); return; }
      else if (c === 'img') { keep(); file.click(); return; }
      else document.execCommand(c);
      onChange?.();
    });
    linkBox.querySelector('.btn:not([data-cancel])').addEventListener('click', () => {
      const u = linkIn.value.trim();
      if (!/^(https?:\/\/\S+|mailto:\S+@\S+|tel:\+?[\d ]+)$/i.test(u)) { toast('Zadajte celú adresu, napr. https://… alebo mailto:…'); linkIn.focus(); return; }
      linkBox.hidden = true; restore(); document.execCommand('createLink', false, u); onChange?.();
    });
    linkBox.querySelector('[data-cancel]').addEventListener('click', () => { linkBox.hidden = true; restore(); });
    // Enter vloží odkaz (inak by odoslal celý formulár a uložil stránku), Escape pole zavrie
    linkBox.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target === linkIn) { e.preventDefault(); linkBox.querySelector('.btn:not([data-cancel])').click(); }
      else if (e.key === 'Escape') { e.preventDefault(); linkBox.querySelector('[data-cancel]').click(); }
    });
    file.addEventListener('change', async () => { const f = file.files[0]; if (!f) return; const src = await thumb(f, 900).catch(() => null); file.value = ''; if (!src) return toast('Obrázok sa nepodarilo načítať'); restore(); document.execCommand('insertImage', false, src); onChange?.(); });
  });
}
const rteValue = (name) => sanitize(document.querySelector(`[data-rte="${name}"] .rte-area`)?.innerHTML || '');

// náhľad fotky: zmenšený JPEG, aby sa ukážka zmestila do prehliadača (ostrá verzia nahrá originál a zmenší ho na serveri)
function thumb(file, max = 480) {
  return new Promise((ok, bad) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', .74)); };
    img.onerror = () => { URL.revokeObjectURL(url); bad(new Error('obrázok')); };
    img.src = url;
  });
}
// mriežka fotiek s nahrávaním, odstránením a výberom titulnej (prvá = titulná)
const photoGrid = (id, photos, label = 'fotky') => `<label class="drop">${ic('camera')}<b>Pridať ${label} z telefónu alebo počítača</b><span>Aj viac naraz. Zmenšia sa automaticky.</span><input type="file" accept="image/*" multiple data-grid="${id}"></label>
  <div class="thumbs" id="${id}">${photos.map((u, i) => `<div class="thumb${String(u).startsWith('data:') ? ' thumb--new' : ''}"><img src="${esc(u)}" alt="Fotka ${i + 1}" loading="lazy">${i === 0 ? '<span class="star">titulná</span>' : `<button class="mk" type="button" data-cover="${i}" aria-label="Nastaviť fotku ${i + 1} ako titulnú" title="Nastaviť ako titulnú">${ic('star')}</button>`}<button class="x" type="button" data-rm="${i}" aria-label="Odstrániť fotku ${i + 1}">${ic('x')}</button></div>`).join('')}</div>`;
function bindGrid(id, photos, rerender) {
  document.querySelector(`[data-grid="${id}"]`)?.addEventListener('change', async (ev) => {
    const files = [...ev.target.files].slice(0, 24); if (!files.length) return;
    toast(`Spracúvam ${plural(files.length, 'fotku', 'fotky', 'fotiek')}…`);
    for (const f of files) { try { photos.push(await thumb(f)); } catch { /* nečitateľný súbor */ } }
    rerender(); gridFocus(id); toast('Fotky pridané – nezabudnite uložiť');
  });
  document.getElementById(id)?.addEventListener('click', (ev) => {
    const rm = ev.target.closest('[data-rm]'), cv = ev.target.closest('[data-cover]');
    if (rm) { const i = +rm.dataset.rm; photos.splice(i, 1); rerender(); gridFocus(id, photos.length ? `[data-rm="${Math.min(i, photos.length - 1)}"]` : ''); }
    if (cv) { const [p] = photos.splice(+cv.dataset.cover, 1); photos.unshift(p); rerender(); gridFocus(id, '.thumb:first-child .x'); toast('Titulná fotka zmenená'); }
  });
}
const gridFocus = (id, sel = '') => (document.querySelector(sel ? `#${id} ${sel}` : '#_') || document.querySelector(`[data-grid="${id}"]`))?.focus();
// zoznam ľudí / položiek s poradím (hore/dole), pridaním a odstránením
const rowsEditor = (id, rows, fields, addLabel) => `<ol class="rows" id="${id}">${rows.map((r, i) => `<li class="erow">
  <div class="erow-f">${fields.map(([k, l, ph, t]) => `<label class="field field--in"><span>${l}</span><input class="input" ${t ? `type="${t}"` : ''} data-k="${k}" value="${esc(r[k] || '')}" placeholder="${esc(ph || '')}"></label>`).join('')}</div>
  <div class="erow-a">${((n) => `<button class="ibtn" type="button" data-up="${i}" aria-label="Posunúť ${n} vyššie"${i === 0 ? ' disabled' : ''}>${ic('up')}</button><button class="ibtn" type="button" data-down="${i}" aria-label="Posunúť ${n} nižšie"${i === rows.length - 1 ? ' disabled' : ''}>${ic('down')}</button><button class="ibtn ibtn--x" type="button" data-del="${i}" aria-label="Odstrániť ${n}">${ic('x')}</button>`)(r.name ? esc(r.name) : `riadok ${i + 1}`)}</div></li>`).join('')}</ol>
  <button class="btn btn--ghost btn--sm" type="button" data-add="${id}">${ic('plus')}${addLabel}</button>`;
function readRows(id) { return [...document.querySelectorAll(`#${id} > .erow`)].map((li) => Object.fromEntries([...li.querySelectorAll('[data-k]')].map((i) => [i.dataset.k, i.value.trim()]))); }
function bindRows(id, getRows, setRows, rerender, blank) {
  const ol = document.getElementById(id);
  ol?.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const rows = readRows(id);
    if (b.dataset.up || b.dataset.down) focusNext = moveFocus(id, rows.length, b.dataset.up ? +b.dataset.up - 1 : +b.dataset.down + 1, b.dataset.up ? 'up' : 'down');
    if (b.dataset.up) { const i = +b.dataset.up; [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]]; }
    else if (b.dataset.down) { const i = +b.dataset.down; [rows[i + 1], rows[i]] = [rows[i], rows[i + 1]]; }
    else if (b.dataset.del) { const i = +b.dataset.del; rows.splice(i, 1); focusNext = rows.length ? `#${id} > .erow:nth-child(${Math.min(i, rows.length - 1) + 1}) input` : `[data-add="${id}"]`; }
    else return;
    setRows(rows); rerender();
  });
  document.querySelector(`[data-add="${id}"]`)?.addEventListener('click', () => { const rows = readRows(id); rows.push({ ...blank }); setRows(rows); focusNext = `#${id} > .erow:last-child input`; rerender(); });
}
// po posune ostane fokus na tom istom riadku na novom mieste (na krajoch na druhej šípke, ktorá nie je vypnutá)
const moveFocus = (id, n, j, dir) => `#${id} [data-${dir === 'up' ? (j === 0 ? 'down' : 'up') : (j === n - 1 ? 'up' : 'down')}="${j}"]`;
const dirtyState = () => { const s = document.getElementById('state'); if (s) s.innerHTML = '<b>Neuložené zmeny</b>nezabudnite uložiť'; };

// ---- prihlásenie ----
function vLogin(sent) {
  app.innerHTML = `<main class="login"><div class="login-card">
  <img class="login-crest" src="../img/logo.svg" alt="">
  <h1>Administrácia webu</h1>
  ${sent ? `<div class="sent"><div class="sent-ic">${ic('mail')}</div><p class="lead">Na <b>${esc(sent)}</b> sme poslali prihlasovací odkaz. Otvorte ho v tomto telefóne alebo počítači.</p>
  <button class="btn btn--block" id="go" type="button">Otvoriť odkaz (ukážka)</button><p class="hint"><button class="link" id="again" type="button">Zadať iný e-mail</button></p></div>`
    : `<p class="lead">OK Častkovce · prihlásenie pre správcov, trénerov a fotografa</p>
  <form id="lf" novalidate><label class="field"><span>E-mail</span><input class="input" type="email" name="email" autocomplete="email" inputmode="email" placeholder="meno@okcastkovce.sk" required></label>
  <button class="btn btn--block" type="submit">${ic('mail')}Poslať prihlasovací odkaz</button></form>
  <p class="hint">Bez hesla: na e-mail príde jednorazový odkaz. Prístup pridáva správca webu.</p>`}
</div></main>`;
  if (sent) {
    document.getElementById('go').onclick = () => { S.logged = true; S.role = 'admin'; save(); location.hash = '#/'; route(); };
    document.getElementById('again').onclick = () => { vLogin(); document.querySelector('#lf input')?.focus(); };
    document.getElementById('go').focus();
  } else {
    document.getElementById('lf').onsubmit = (e) => { e.preventDefault(); vLogin(e.target.email.value.trim() || 'spravca@okcastkovce.sk'); };
  }
}

// ---- prehľad ----
function vHome() {
  const t = todayISO(), st = scopeTeam();
  const mine = D.matches.filter((m) => !st || m.team === st);
  const played = mine.filter((m) => m.played && our(m));
  const todo = played.filter((m) => m.date >= addDays(t, -21) && missing(m).length).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const next = mine.filter((m) => !m.played && m.date >= t).slice(0, 5);
  const shortcuts = [['#/spravy/nova', 'Napísať správu', 'pen', 'spravy'], ['#/galerie/nova', 'Nová galéria', 'images', 'galerie'], ['#/zapasy', 'Doplniť zápas', 'ball', 'zapasy'], ['#/timy', 'Upraviť súpisku', 'shirt', 'timy'], ['#/stranky', 'Upraviť stránku', 'file', 'stranky'], ['#/fanzona', 'Fanzóna', 'bag', 'fanzona']].filter(([, , , s]) => can(s)).slice(0, 4);
  return shell('home', `${head('Prehľad', S.role === 'admin' ? 'Výsledky sa dopĺňajú samé, vy upravujete všetok obsah webu: texty, fotky, ľudí, produkty a partnerov.' : `Prihlásený ako ${esc(roleName())}: ${esc(ROLES[S.role][1])}.`)}
  <section class="card" aria-labelledby="sync-h"><div class="sync"><span class="sync-ic" id="syncic">${ic('refresh')}</span>
    <div><b id="sync-h">Výsledky zo Sportnetu sú aktuálne</b><span>Naposledy ${esc(ago(D.updated))} · ${D.teams.length} tímov · automaticky každú hodinu</span></div>
    <button class="btn btn--ghost btn--sm" id="sync" type="button">Aktualizovať</button></div></section>
  <div class="stats">${((goals) => `<div class="stat"><b>${played.length}</b><span>${pw(played.length, 'odohraný zápas', 'odohrané zápasy', 'odohraných zápasov')} ${st ? esc(team(st).short) : 'v sezóne ' + esc(D.season)}</span></div>
    <div class="stat"><b>${goals}</b><span>${pw(goals, 'gól', 'góly', 'gólov')} zo zápisov</span></div>`)(played.reduce((n, m) => n + m.goals.filter((g) => g.side === 'our').length, 0))}
    <div class="stat"><b>${S.log.length}</b><span>${pw(S.log.length, 'zmena', 'zmeny', 'zmien')} v ukážke</span></div></div>
  <div class="qa">${shortcuts.map(([h, l, i]) => `<a href="${h}">${ic(i)}${l}</a>`).join('')}</div>
  <div class="grid2">
  <section class="card" aria-labelledby="todo-h"><div class="card-h"><h2 id="todo-h">Čaká na doplnenie</h2><span class="count">posledné 3 týždne</span></div>
    ${todo.length ? `<ul class="list">${todo.map((m) => matchRow(m, true)).join('')}</ul>` : '<p class="empty">Všetko je doplnené 👍</p>'}</section>
  <section class="card" aria-labelledby="next-h"><div class="card-h"><h2 id="next-h">Najbližšie zápasy</h2><a class="link" href="#/zapasy?tab=program">Celý program</a></div>
    ${next.length ? `<ul class="list">${next.map((m) => matchRow(m)).join('')}</ul>` : '<p class="empty">Žiadne zápasy v rozpise.</p>'}</section>
  </div>
  ${S.log.length ? `<section class="card"><div class="card-h"><h2>Posledné zmeny</h2><a class="link" href="#/zmeny">Všetky</a></div>${logList(S.log.slice(0, 5))}</section>` : ''}`);
}
const logList = (items) => `<ul class="list">${items.map((l) => `<li><div class="row"><span class="ava ava--s" aria-hidden="true">${esc(initials(l.who))}</span><span class="row-main"><span class="row-t">${esc(l.what)}</span><span class="row-s">${esc(l.who)} · ${esc(ago(l.t))}</span></span>${l.url ? webLink(l.url, 'Na webe') : ''}</div></li>`).join('')}</ul>`;
function matchRow(m, showMissing = false, hideTeam = false) {
  const tm = team(m.team), d = dt(m.date), e = edit(m.id);
  const tags = [];
  if (showMissing) missing(m).forEach((x) => tags.push(`<span class="tag tag--warn">${x}</span>`));
  else if (m.played && our(m)) {
    if (e.status === 'published') tags.push(`<span class="tag tag--ok">${ic('check')}doplnené</span>`);
    if (photosOf(m)) tags.push(`<span class="tag">${ic('camera')}${photosOf(m)}</span>`);
    if (hasVideo(m)) tags.push(`<span class="tag">${ic('video')}video</span>`);
  }
  return `<li><a class="row" href="#/zapas/${encodeURIComponent(m.id)}">
    <span class="date"><b>${d.getDate()}</b><span>${MES[d.getMonth()]}</span></span>
    <span class="row-main"><span class="row-t">${esc(m.opponent)}</span><span class="row-s">${hideTeam ? '' : esc(tm.short) + ' · '}${m.home ? 'doma' : 'vonku'} · ${esc(DNI[d.getDay()])}${m.time ? ' ' + esc(m.time) : ''}</span>${tags.length ? `<span class="tags">${tags.join('')}</span>` : ''}</span>
    <span class="row-end">${scoreBadge(m)}${ic('chev', 'chev')}</span></a></li>`;
}

// ---- zápasy ----
function vMatches() {
  const p = q(), st = scopeTeam(), tm = st || p.get('tim') || '', tab = p.get('tab') === 'program' ? 'program' : 'vysledky';
  const t = todayISO();
  let list = D.matches.filter((m) => (!tm || m.team === tm));
  list = tab === 'program' ? list.filter((m) => !m.played && m.date >= t) : list.filter((m) => m.played).reverse();
  const link = (o) => { const n = new URLSearchParams({ ...(tm && !st ? { tim: tm } : {}), ...(tab === 'program' ? { tab } : {}), ...o }); for (const [k, v] of [...n]) if (!v) n.delete(k); return `#/zapasy${n.toString() ? '?' + n : ''}`; };
  return shell('zapasy', `${head('Zápasy', 'Skóre, strelci a karty prichádzajú zo Sportnetu. Doplňte komentár, fotky a video.')}
  <div class="seg" role="group" aria-label="Zobraziť"><a href="${link({ tab: '' })}" aria-current="${tab === 'vysledky'}">Výsledky</a><a href="${link({ tab: 'program' })}" aria-current="${tab === 'program'}">Program</a></div>
  ${st ? '' : `<div class="chips" role="group" aria-label="Tím"><a class="chip" href="${link({ tim: '' })}" aria-current="${!tm}">Všetky tímy</a>${D.teams.map((x) => `<a class="chip" href="${link({ tim: x.slug })}" aria-current="${tm === x.slug}">${esc(x.short)}</a>`).join('')}</div>`}
  <section class="card">${list.length ? `<ul class="list">${list.slice(0, 60).map((m) => matchRow(m, false, !!tm)).join('')}</ul>` : `<p class="empty">${tab === 'program' ? 'Žiadne naplánované zápasy.' : 'Zatiaľ žiadne výsledky.'}</p>`}</section>`);
}
function vMatch(id) {
  const m = D.matches.find((x) => x.id === id);
  if (!m || (scopeTeam() && m.team !== scopeTeam())) return shell('zapasy', '<p class="empty">Zápas sa nenašiel.</p>');
  const tm = team(m.team), s = our(m), e = { photos: [], ...edit(m.id) };
  const [hName, aName] = m.home ? ['OK Častkovce', m.opponent] : [m.opponent, 'OK Častkovce'];
  const roster = D.rosters[m.team] || [];
  const ev = [...m.goals.map((g) => ({ ...g, t: 'g' })), ...m.cards.map((c) => ({ ...c, t: 'c' }))].sort((a, b) => (parseInt(a.min) || 0) - (parseInt(b.min) || 0));
  const vid = e.video ? ytId(e.video) : m.video?.id;
  const onlyPhotos = S.role === 'foto';
  const sportnet = m.played ? `<section class="card" aria-labelledby="sn-h"><div class="card-h"><h2 id="sn-h">Priebeh zápasu</h2>${m.url ? `<a class="link" href="${esc(m.url)}" target="_blank" rel="noopener">Sportnet ↗</a>` : ''}</div>
    <p class="src">${ic('lock')}<span>Zo zápisu o stretnutí na Sportnete, dopĺňa sa automaticky. Chybu opraví klub v systéme ISSF.</span></p>
    ${ev.length ? `<ul class="ev">${ev.map((x) => `<li class="${x.side}"><span class="min">${esc(x.min)}'</span>${x.t === 'g' ? BALL : `<span class="cardi${x.kind !== 'yellow' ? ' cardi--' + x.kind : ''}" role="img" aria-label="${x.kind === 'red' ? 'červená' : x.kind === 'yellow' ? 'žltá' : 'druhá žltá'} karta"></span>`}<span class="who">${esc(x.player || 'neznámy hráč')}${x.side === 'opp' ? ' <small>(súper)</small>' : ''}${x.kind === 'penalty' ? ' <small>(z penalty)</small>' : ''}${x.kind === 'own' ? ' <small>(vlastný gól)</small>' : ''}</span></li>`).join('')}</ul>`
      : `<p class="empty">${s ? 'V zápise nie sú žiadne góly ani karty.' : 'V tejto kategórii sa výsledky nezapisujú (prípravky).'}</p>`}</section>` : '';
  const photos = [...(m.gallery?.thumbs || []), ...e.photos];
  return shell('zapasy', `${back('#/zapasy', 'Zápasy')}
  <section class="mhead"><h1 class="sr">${esc(hName)} – ${esc(aName)}</h1><div class="mhead-meta">${esc(m.competition)}${m.part && !m.part.toLowerCase().startsWith(m.competition.toLowerCase().slice(0, 8)) ? ' · ' + esc(m.part) : ''}${m.round ? ` · ${esc(m.round)}. kolo` : ''}</div>
    <div class="mhead-teams"><span class="mhead-team${m.home ? ' is-us' : ''}">${esc(hName)}</span>
      <span class="mhead-score">${m.score ? esc(m.score.replace(':', ' : ')) : esc(m.time || '–')}<small>${m.played ? (s ? 'koniec' : 'odohrané') : fmtD(m.date)}</small></span>
      <span class="mhead-team${m.home ? '' : ' is-us'}">${esc(aName)}</span></div>
    <div class="mhead-meta">${fmtD(m.date)} ${esc(m.time)}${m.venue ? ' · ' + esc(m.venue) : ''}</div>
    <div class="tags"><span class="tag">${esc(tm.short)}</span>${s ? `<span class="tag">${s.r === 'w' ? 'výhra' : s.r === 'l' ? 'prehra' : 'remíza'}</span>` : ''}${e.status === 'published' ? `<span class="tag">${ic('check')}zverejnené</span>` : ''}</div></section>
  ${sportnet}
  <form id="mf" novalidate>
  ${onlyPhotos ? '' : `<section class="card" aria-labelledby="c-h"><div class="card-h"><h2 id="c-h">Komentár k zápasu</h2></div>
    <label class="field"><span class="sr">Komentár</span><textarea class="textarea" name="comment" maxlength="3000" placeholder="${m.played ? 'Ako sa zápas hral, hodnotenie trénera, poďakovanie fanúšikom…' : 'Pozvánka na zápas, doprava, vstupné…'}">${esc(e.comment || '')}</textarea><small>Zobrazí sa na webe pri výsledku a v detaile tímu.</small></label>
    ${m.played ? `<label class="field"><span>Hráč zápasu</span><select class="select" name="motm"><option value="">— nevybraný —</option>${roster.map((p) => `<option${e.motm === p.name ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}${roster.length ? '' : '<option disabled>súpiska tímu nie je na webe</option>'}</select></label>` : ''}
  </section>`}
  <section class="card" aria-labelledby="p-h"><div class="card-h"><h2 id="p-h">Fotky</h2><span class="count">${plural(photosOf(m), 'fotka', 'fotky', 'fotiek')}</span></div>
    <label class="drop">${ic('camera')}<b>Pridať fotky z telefónu alebo počítača</b><span>JPG alebo HEIC, aj viac naraz. Zmenšia sa automaticky.</span><input type="file" id="files" accept="image/*" multiple></label>
    <div class="thumbs" id="thumbs">${photos.map((u, i) => `<div class="thumb${i >= (m.gallery?.thumbs || []).length ? ' thumb--new' : ''}"><img src="${esc(u)}" alt="Fotka ${i + 1}" loading="lazy">${i === 0 ? '<span class="star">titulná</span>' : ''}${i >= (m.gallery?.thumbs || []).length ? `<button class="x" type="button" data-rm="${i - (m.gallery?.thumbs || []).length}" aria-label="Odstrániť fotku ${i + 1}">${ic('x')}</button>` : ''}</div>`).join('')}</div>
    ${m.gallery ? `<p class="help">Galéria od fotografa: ${m.gallery.count} fotiek · <a class="link" href="#/galerie/${esc(m.gallery.url.split('/')[1])}">upraviť galériu</a></p>` : ''}
  </section>
  ${onlyPhotos ? '' : `<section class="card" aria-labelledby="v-h"><div class="card-h"><h2 id="v-h">Video</h2></div>
    <label class="field"><span class="sr">Odkaz na YouTube</span><input class="input" name="video" inputmode="url" placeholder="Odkaz na YouTube (zostrih, celý zápas…)" value="${esc(e.video || '')}"><small>Stačí skopírovať odkaz z aplikácie YouTube.</small></label>
    <div id="ytp">${vid ? ytCard(vid, e.video ? 'Nové video' : m.video?.title) : ''}</div>
  </section>`}
  ${savebar(e.status === 'published' ? `<b>Zverejnené</b>${esc(e.when || '')}` : e.status === 'draft' ? '<b>Koncept</b>uložený, na webe zatiaľ nie je' : '<b>Bez zmien</b>na webe je len výsledok zo Sportnetu', '<button class="btn btn--ghost btn--sm" type="button" id="draft">Uložiť koncept</button><button class="btn btn--sm" type="submit">Zverejniť</button>')}
  </form>`);
}
const ytCard = (id, title) => `<div class="yt"><img src="https://i.ytimg.com/vi/${encodeURIComponent(id)}/mqdefault.jpg" alt=""><span><b>${esc(title || 'Video z YouTube')}</b><span>Na webe sa prehrá cez YouTube bez cookies.</span></span></div>`;
function bindMatch(id) {
  const f = document.getElementById('mf');
  if (!f) return;
  const m = D.matches.find((x) => x.id === id);
  const cur = () => (S.edits[id] = { photos: [], ...S.edits[id] });
  f.addEventListener('input', dirtyState);
  f.video?.addEventListener('input', () => { const v = ytId(f.video.value); document.getElementById('ytp').innerHTML = v ? ytCard(v, 'Nové video') : (f.video.value ? '<p class="help">Toto nevyzerá ako odkaz na YouTube.</p>' : ''); });
  document.getElementById('files').addEventListener('change', async (ev) => {
    const files = [...ev.target.files].slice(0, 30); if (!files.length) return;
    toast(`Spracúvam ${plural(files.length, 'fotku', 'fotky', 'fotiek')}…`);
    const e = cur();
    for (const file of files) { try { e.photos.push(await thumb(file)); } catch { /* nečitateľný súbor */ } }
    save(); focusNext = '#files'; route(); toast('Fotky pridané – nezabudnite zverejniť');
  });
  document.getElementById('thumbs').addEventListener('click', (ev) => { const b = ev.target.closest('[data-rm]'); if (!b) return; const ph = cur().photos, i = +b.dataset.rm; ph.splice(i, 1); save(); focusNext = ph.length ? `#thumbs [data-rm="${Math.min(i, ph.length - 1)}"]` : '#files'; route(); });
  const store = (status) => {
    const e = cur();
    if (f.comment) e.comment = f.comment.value.trim();
    if (f.video) e.video = f.video.value.trim();
    if (f.motm) e.motm = f.motm.value;
    e.status = status; e.when = status === 'published' ? `${new Date().toLocaleString('sk-SK', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })} · na webe do 1 minúty` : '';
    if (status === 'published') { S.log.unshift({ t: Date.now(), what: `Zápas ${team(m.team).short} – ${m.opponent}: doplnený`, url: '', who: roleName() }); S.log = S.log.slice(0, 40); }
    save(); route();
  };
  document.getElementById('draft').onclick = () => { store('draft'); toast('Koncept uložený'); };
  f.onsubmit = (ev) => { ev.preventDefault(); store('published'); toast(`Zverejnené: ${m.opponent} – na webe do 1 minúty`); };
}

// ---- správy ----
const allNews = () => [...S.news, ...D.news.map((n) => ({ ...n, ...get('news:' + n.id, {}) }))].filter((n) => !n.deleted);
function vNews() {
  const all = allNews();
  return shell('spravy', `${head('Správy', plural(all.length, 'správa', 'správy', 'správ') + ' na webe', `<a class="btn btn--sm" href="#/spravy/nova">${ic('plus')}Nová</a>`)}
  <section class="card">${all.length ? '' : '<p class="empty">Zatiaľ žiadne správy. Napíšte prvú.</p>'}<ul class="list">${all.map((n) => `<li><a class="row" href="#/spravy/${encodeURIComponent(n.id)}">${n.img ? `<img class="nimg" src="${esc(n.img)}" alt="" loading="lazy">` : '<span class="nimg"></span>'}<span class="row-main"><span class="row-t">${esc(n.title)}</span><span class="row-s">${esc(fmtDY(n.date))}${String(n.id).startsWith('n') ? ' · nová' : ''}</span></span>${ic('chev', 'chev')}</a></li>`).join('')}</ul></section>`);
}
function vNewsEdit(id) {
  const isNew = id === 'nova';
  const n = isNew ? { title: '', date: todayISO(), body: '', img: null } : allNews().find((x) => String(x.id) === id);
  if (!n) return shell('spravy', '<p class="empty">Správa sa nenašla.</p>');
  const recent = D.matches.filter((m) => m.played && our(m)).slice(-12).reverse();
  return shell('spravy', `${back('#/spravy', 'Správy')}${head(isNew ? 'Nová správa' : 'Upraviť správu', '')}
  <form id="nf" novalidate><section class="card">
    <label class="field"><span>Titulok</span><input class="input" name="title" required maxlength="140" value="${esc(n.title)}" placeholder="Napr. Dorastenci zdolali Myjavu"></label>
    <label class="field"><span>Dátum</span><input class="input" type="date" name="date" value="${esc(n.date)}"></label>
    <div class="field"><span class="label">Úvodná fotka</span><div id="nimg">${n.img ? `<img class="cover" src="${esc(n.img)}" alt="">` : ''}</div><label class="drop drop--s">${ic('camera')}<b>${n.img ? 'Vymeniť fotku' : 'Vybrať fotku'}</b><input type="file" name="img" accept="image/*"></label></div>
    <div class="field"><span class="label">Text</span>${rte('body', n.body, 'Text správy')}</div>
    <label class="field"><span>Súvisiaci zápas <small>(nepovinné)</small></span><select class="select" name="match"><option value="">— žiadny —</option>${recent.map((m) => `<option value="${esc(m.id)}"${n.match === m.id ? ' selected' : ''}>${esc(fmtD(m.date))} · ${esc(team(m.team).short)} – ${esc(m.opponent)} ${esc(m.score || '')}</option>`).join('')}</select><small>Správa sa zobrazí aj pri výsledku zápasu.</small></label>
  </section>
  ${isNew ? '' : '<p><button class="link link--danger" type="button" id="ndel">Odstrániť správu z webu</button></p>'}
  ${savebar(isNew ? '<b>Nová správa</b>po zverejnení sa objaví na úvode webu' : '<b>Zverejnená</b>zmeny sa na webe prejavia do 1 minúty', `<button class="btn btn--sm" type="submit">${isNew ? 'Zverejniť' : 'Uložiť'}</button>`)}</form>`);
}
function bindNews(id) {
  const f = document.getElementById('nf');
  if (!f) return;
  const isNew = id === 'nova';
  let img = null;
  bindRte(dirtyState);
  f.addEventListener('input', dirtyState);
  f.img.addEventListener('change', async () => { if (!f.img.files[0]) return; img = await thumb(f.img.files[0], 900).catch(() => null); if (img) document.getElementById('nimg').innerHTML = `<img class="cover" src="${img}" alt="">`; toast(img ? 'Fotka pripravená' : 'Fotku sa nepodarilo načítať'); });
  document.getElementById('ndel')?.addEventListener('click', () => {
    if (String(id).startsWith('n')) S.news = S.news.filter((x) => x.id !== id); else put('news:' + id, { ...get('news:' + id, {}), deleted: true }, 'Správa odstránená');
    save(); location.hash = '#/spravy'; toast('Správa odstránená (ukážka)');
  });
  f.onsubmit = (ev) => {
    ev.preventDefault();
    const title = f.title.value.trim();
    if (!title) { f.title.focus(); toast('Doplňte titulok'); return; }
    const data = { title, date: f.date.value || todayISO(), body: rteValue('body'), match: f.match.value, ...(img ? { img } : {}) };
    if (isNew) { S.news.unshift({ id: 'n' + Date.now(), ...data }); S.log.unshift({ t: Date.now(), what: `Nová správa: ${title}`, url: 'spravy/', who: roleName() }); save(); }
    else if (String(id).startsWith('n')) { const i = S.news.findIndex((x) => x.id === id); S.news[i] = { ...S.news[i], ...data }; save(); }
    else put('news:' + id, { ...get('news:' + id, {}), ...data }, `Správa upravená: ${title}`, 'spravy/');
    location.hash = '#/spravy'; toast(isNew ? 'Správa zverejnená (ukážka)' : 'Správa uložená (ukážka)');
  };
}

// ---- galérie ----
const allGals = () => [...get('gal:new', []), ...D.galleries.map((g) => ({ ...g, ...get('gal:' + g.slug, {}) }))].filter((g) => !g.deleted && (!scopeTeam() || g.team === scopeTeam()));
function vGalleries() {
  const all = allGals();
  return shell('galerie', `${head('Galérie', plural(all.length, 'galéria', 'galérie', 'galérií'), `<a class="btn btn--sm" href="#/galerie/nova">${ic('plus')}Nová</a>`)}
  <div class="gcards">${all.slice(0, 48).map((g) => `<a class="gcard" href="#/galerie/${encodeURIComponent(g.slug)}"><img src="${esc(g.photos?.[0] || g.cover)}" alt="" loading="lazy"><span><b>${esc(g.title)}</b><span>${esc(fmtDY(g.date))}${g.team ? ' · ' + esc(team(g.team).short) : ''} · ${plural(g.photos ? g.photos.length : g.count, 'fotka', 'fotky', 'fotiek')}</span></span></a>`).join('')}</div>
  ${all.length ? '' : '<section class="card"><p class="empty">Zatiaľ žiadne galérie.</p></section>'}${all.length > 48 ? `<p class="help">Zobrazených 48 najnovších z ${all.length}.</p>` : ''}`);
}
function vGallery(slug) {
  const isNew = slug === 'nova';
  const g = isNew ? { slug: '', title: '', date: todayISO(), team: scopeTeam(), photos: [] } : allGals().find((x) => x.slug === slug);
  if (!g) return shell('galerie', '<p class="empty">Galéria sa nenašla.</p>');
  if (!g.photos) g.photos = [...g.thumbs];
  return shell('galerie', `${back('#/galerie', 'Galérie')}${head(isNew ? 'Nová galéria' : 'Upraviť galériu', isNew ? '' : webLink(g.url))}
  <form id="gf" novalidate><section class="card">
    <label class="field"><span>Názov</span><input class="input" name="title" required value="${esc(g.title)}" placeholder="Napr. U15: OK Častkovce vs. FK Beluša"></label>
    <div class="grid2 grid2--tight"><label class="field"><span>Dátum</span><input class="input" type="date" name="date" value="${esc(g.date)}"></label>
    <label class="field"><span>Tím</span><select class="select" name="team"${scopeTeam() ? ' disabled' : ''}><option value="">— klub / iné podujatie —</option>${D.allTeams.map((t) => `<option value="${t.slug}"${g.team === t.slug ? ' selected' : ''}>${esc(t.short)}</option>`).join('')}</select></label></div>
  </section>
  <section class="card"><div class="card-h"><h2>Fotky</h2><span class="count" id="gcount">${plural(g.photos.length, 'fotka', 'fotky', 'fotiek')}</span></div>
    <div id="gphotos">${photoGrid('gp', g.photos)}</div>
    ${!isNew && g.count > g.thumbs.length ? `<p class="help">V ukážke je ${g.thumbs.length} z ${g.count} fotiek galérie.</p>` : ''}</section>
  ${isNew ? '' : '<p><button class="link link--danger" type="button" id="gdel">Odstrániť galériu z webu</button></p>'}
  ${savebar(isNew ? '<b>Nová galéria</b>po zverejnení sa objaví vo Fotogalérii a pri zápase' : '<b>Zverejnená</b>', `<button class="btn btn--sm" type="submit">${isNew ? 'Zverejniť' : 'Uložiť'}</button>`)}</form>`);
}
function bindGallery(slug) {
  const f = document.getElementById('gf'); if (!f) return;
  const isNew = slug === 'nova';
  const base = isNew ? { photos: [] } : allGals().find((x) => x.slug === slug);
  const photos = base.photos ? [...base.photos] : [...base.thumbs];
  const rer = () => { document.getElementById('gphotos').innerHTML = photoGrid('gp', photos); document.getElementById('gcount').textContent = plural(photos.length, 'fotka', 'fotky', 'fotiek'); bindGrid('gp', photos, rer); dirtyState(); };
  bindGrid('gp', photos, rer);
  f.addEventListener('input', dirtyState);
  document.getElementById('gdel')?.addEventListener('click', () => { put('gal:' + slug, { ...get('gal:' + slug, {}), deleted: true }, `Galéria odstránená: ${base.title}`); location.hash = '#/galerie'; toast('Galéria odstránená (ukážka)'); });
  f.onsubmit = (ev) => {
    ev.preventDefault();
    const title = f.title.value.trim(); if (!title) { f.title.focus(); return toast('Doplňte názov galérie'); }
    if (!photos.length) return toast('Pridajte aspoň jednu fotku');
    const data = { title, date: f.date.value, team: scopeTeam() || f.team.value, photos, count: photos.length };
    if (isNew) { const list = get('gal:new', []); const s = `${data.date}-${slugify(title)}`; list.unshift({ slug: s, url: `fotogaleria/${s}/`, cover: photos[0], thumbs: [], ...data }); put('gal:new', list, `Nová galéria: ${title}`, 'fotogaleria/'); }
    else if (D.galleries.some((x) => x.slug === slug)) put('gal:' + slug, data, `Galéria upravená: ${title}`, base.url);
    else { const list = get('gal:new', []); const i = list.findIndex((x) => x.slug === slug); list[i] = { ...list[i], ...data }; put('gal:new', list, `Galéria upravená: ${title}`); }
    location.hash = '#/galerie'; toast('Galéria uložená (ukážka)');
  };
}

// ---- videá ----
function vVideos() {
  const list = get('videos', D.videos);
  return shell('videa', `${head('Videá', 'Videá z YouTube na stránke Video a pri zápasoch.')}
  <section class="card"><form id="vf" novalidate><div class="card-h"><h2>Pridať video</h2></div>
    <label class="field"><span>Odkaz na YouTube</span><input class="input" name="url" inputmode="url" placeholder="https://youtu.be/…"></label>
    <div id="vprev"></div>
    <label class="field"><span>Názov</span><input class="input" name="title" placeholder="Napr. OK Častkovce – FK Beluša (zostrih)"></label>
    <label class="field"><span>Dátum</span><input class="input" type="date" name="date" value="${todayISO()}"></label>
    <button class="btn btn--block" type="submit">${ic('plus')}Pridať video</button></form></section>
  <section class="card"><div class="card-h"><h2>Na webe</h2><span class="count">${plural(list.length, 'video', 'videá', 'videí')}</span></div>
  ${list.length ? '' : '<p class="empty">Zatiaľ žiadne videá.</p>'}<ul class="list">${list.map((v, i) => `<li><div class="row"><img class="nimg" src="https://i.ytimg.com/vi/${encodeURIComponent(v.youtube)}/mqdefault.jpg" alt="" loading="lazy"><span class="row-main"><span class="row-t">${esc(v.title)}</span><span class="row-s">${esc(fmtDY(v.date))}</span></span><button class="ibtn ibtn--x" type="button" data-vdel="${i}" aria-label="Odstrániť video ${esc(v.title)}">${ic('x')}</button></div></li>`).join('')}</ul></section>`);
}
function bindVideos() {
  const f = document.getElementById('vf'); if (!f) return;
  f.url.addEventListener('input', () => { const v = ytId(f.url.value); document.getElementById('vprev').innerHTML = v ? ytCard(v, f.title.value || 'Nové video') : ''; });
  f.onsubmit = (ev) => {
    ev.preventDefault();
    const id = ytId(f.url.value); if (!id) { f.url.focus(); return toast('Vložte odkaz na video z YouTube'); }
    const title = f.title.value.trim(); if (!title) { f.title.focus(); return toast('Doplňte názov videa'); }
    const list = get('videos', D.videos); list.unshift({ id: 'v' + Date.now(), title, date: f.date.value || todayISO(), youtube: id });
    put('videos', list, `Nové video: ${title}`, 'video/'); route(); toast('Video pridané (ukážka)');
  };
  document.querySelectorAll('[data-vdel]').forEach((b) => { b.onclick = () => { const list = get('videos', D.videos), i = +b.dataset.vdel; const [v] = list.splice(i, 1); put('videos', list, `Video odstránené: ${v.title}`, 'video/'); focusNext = list.length ? `[data-vdel="${Math.min(i, list.length - 1)}"]` : '#vf [name="url"]'; route(); toast('Video odstránené'); }; });
}

// ---- tímy a súpisky ----
const teamData = (slug) => { const t = D.allTeams.find((x) => x.slug === slug); return t && { ...t, ...get('team:' + slug, {}) }; };
function vTeams() {
  const list = D.allTeams.filter((t) => !scopeTeam() || t.slug === scopeTeam()).map((t) => teamData(t.slug));
  return shell('timy', `${head('Tímy a súpisky', 'Tímová fotka, súpiska, čísla a vedenie tímu. Súťaž a výsledky idú zo Sportnetu.')}
  <div class="gcards">${list.map((t) => `<a class="gcard" href="#/tim/${t.slug}">${t.photo ? `<img src="${esc(t.photo)}" alt="" loading="lazy">` : '<span class="gcard-ph"></span>'}<span><b>${esc(t.short)} <small>${esc(t.sub)}</small></b><span>${t.groups.length ? t.groups.map((g) => `${esc(g.title)} ${g.people.length}`).join(' · ') : 'súpiska zatiaľ nie je'}</span></span></a>`).join('')}</div>`);
}
const TEAM_F = (g) => (g.title === 'Hráči' ? [['name', 'Meno a priezvisko', ''], ['number', 'Číslo', 'napr. 10']] : [['name', 'Meno a priezvisko', ''], ['role', 'Funkcia', 'napr. tréner']]);
function teamDraft(slug) {
  if (DRAFT.team?.slug !== slug) { const t = teamData(slug); DRAFT.team = { slug, photo: t.photo, groups: clone(t.groups.length ? t.groups : [{ title: 'Hráči', people: [] }, { title: 'Vedenie', people: [] }]) }; }
  return DRAFT.team;
}
function vTeam(slug) {
  const t = teamData(slug);
  if (!t || (scopeTeam() && slug !== scopeTeam())) return shell('timy', '<p class="empty">Tím sa nenašiel.</p>');
  const d = teamDraft(slug);
  return shell('timy', `${back('#/timy', 'Tímy')}${head(esc(t.short), `${esc(t.sub)}${t.league ? ' · ' + esc(t.league) : ''} · ${webLink(t.url)}`)}
  <form id="tf" novalidate>
  <section class="card"><div class="card-h"><h2>Tímová fotka</h2></div><div id="tphoto">${d.photo ? `<img class="cover" src="${esc(d.photo)}" alt="Tímová fotka ${esc(t.short)}">` : '<p class="empty">Bez fotky</p>'}</div>
    <label class="drop drop--s">${ic('camera')}<b>${d.photo ? 'Vymeniť tímovú fotku' : 'Nahrať tímovú fotku'}</b><input type="file" id="tfile" accept="image/*"></label></section>
  ${d.groups.map((g, gi) => `<section class="card"><div class="card-h"><h2>${esc(g.title)}</h2><span class="count">${g.people.length}</span></div>
    ${rowsEditor('g' + gi, g.people, TEAM_F(g), g.title === 'Hráči' ? 'Pridať hráča' : 'Pridať osobu')}
    ${g.title === 'Hráči' && g.people.length ? `<p class="help">Profil hráča (narodenie, záľuby…): <a class="link" href="#/hraci?tim=${slug}">upraviť profily</a></p>` : ''}</section>`).join('')}
  ${savebar(DRAFT.dirty ? '<b>Neuložené zmeny</b>nezabudnite uložiť' : '<b>Súpiska</b>po uložení sa zmení na stránke tímu', '<button class="btn btn--sm" type="submit">Uložiť</button>')}</form>`);
}
function bindTeam(slug) {
  const f = document.getElementById('tf'); if (!f) return;
  const t = teamData(slug), d = teamDraft(slug);
  const pull = () => d.groups.forEach((g, gi) => { const rows = readRows('g' + gi); g.people = rows.map((r, i) => ({ ...(g.people[i] || {}), ...r })); });
  d.groups.forEach((g, gi) => bindRows('g' + gi, () => g.people, (rows) => { const old = g.people; g.people = rows.map((r) => ({ ...(old.find((x) => x.name && x.name === r.name) || {}), ...r })); d.groups.forEach((o, oi) => { if (oi !== gi) { const rr = readRows('g' + oi); o.people = rr.map((r, i) => ({ ...(o.people[i] || {}), ...r })); } }); }, () => { DRAFT.dirty = true; route(); }, { name: '', number: '', role: '' }));
  f.addEventListener('input', dirtyState);
  document.getElementById('tfile').addEventListener('change', async (ev) => { const file = ev.target.files[0]; if (!file) return; pull(); d.photo = await thumb(file, 1000).catch(() => d.photo); DRAFT.dirty = true; route(); });
  f.onsubmit = (ev) => { ev.preventDefault(); pull(); d.groups.forEach((g) => { g.people = g.people.filter((x) => x.name); }); put('team:' + slug, { photo: d.photo, groups: d.groups }, `Tím ${t.short}: súpiska a fotka`, t.url); DRAFT = {}; route(); toast('Tím uložený (ukážka)'); };
}

// ---- profily hráčov ----
const PF = [['narodenie', 'Dátum narodenia', 'date'], ['bydlisko', 'Bydlisko (obec)', 'text'], ['volnyCas', 'Voľný čas, záľuby', 'text'], ['klub', 'Obľúbený klub', 'text']];
function vPlayers() {
  const p = q(), st = scopeTeam(), tm = st || p.get('tim') || D.allTeams.find((t) => (D.rosters[t.slug] || []).length)?.slug;
  const list = (teamData(tm)?.groups || []).filter((g) => /hráči/i.test(g.title)).flatMap((g) => g.people);
  const done = (n) => { const x = S.players[n] || {}; return PF.filter(([k]) => x[k]).length / PF.length; };
  const open = p.get('hrac');
  const pl = open && list.find((x) => x.name === open);
  return shell('timy', `${back('#/tim/' + tm, 'Tím ' + esc(team(tm).short))}${head('Profily hráčov', 'Údaje sa na webe ukážu len vyplnené a so súhlasom rodiča.')}
  ${st ? '' : `<div class="chips" role="group" aria-label="Tím">${D.allTeams.filter((t) => (teamData(t.slug).groups || []).some((g) => /hráči/i.test(g.title) && g.people.length)).map((x) => `<a class="chip" href="#/hraci?tim=${x.slug}" aria-current="${tm === x.slug}">${esc(x.short)}</a>`).join('')}</div>`}
  ${pl ? playerForm(pl, tm) : ''}
  <section class="card"><div class="card-h"><h2>${esc(team(tm).short)}</h2><span class="count">${plural(list.length, 'hráč', 'hráči', 'hráčov')}</span></div>
  ${list.length ? `<ul class="list">${list.map((x) => `<li><a class="row" href="#/hraci?tim=${tm}&hrac=${encodeURIComponent(x.name)}">${x.photo ? `<img class="pava" src="${esc(x.photo)}" alt="" loading="lazy">` : `<span class="pava pava--txt">${esc(initials(x.name))}</span>`}<span class="row-main"><span class="row-t">${esc(x.name)}</span><span class="row-s">${x.number ? '#' + esc(x.number) + ' · ' : ''}profil ${Math.round(done(x.name) * 100)} %</span></span><span class="meter" aria-hidden="true"><i style="width:${Math.round(done(x.name) * 100)}%"></i></span>${ic('chev', 'chev')}</a></li>`).join('')}</ul>` : '<p class="empty">Súpiska tímu na webe zatiaľ nie je – doplňte ju v časti Tímy.</p>'}</section>`);
}
function playerForm(pl, tm) {
  const x = S.players[pl.name] || {};
  return `<section class="card" aria-labelledby="pf-h"><div class="card-h"><h2 id="pf-h" tabindex="-1">${esc(pl.name)}</h2><a class="link" href="#/hraci?tim=${tm}">Zavrieť</a></div>
  <p class="sheet-note">Pri hráčoch mladších ako 18 rokov zverejnite údaje a fotku len so súhlasom rodiča alebo zákonného zástupcu.</p>
  <form id="pf" novalidate>${PF.map(([k, l, t]) => `<label class="field"><span>${l}</span><input class="input" type="${t}" name="${k}" value="${esc(x[k] || '')}"></label>`).join('')}
  <label class="check"><input type="checkbox" name="suhlas"${x.suhlas ? ' checked' : ''}><span>Mám súhlas rodiča alebo zákonného zástupcu so zverejnením týchto údajov a fotky.</span></label>
  <div class="mt"><button class="btn btn--block" type="submit" id="pfs"${x.suhlas ? '' : ' disabled'}>Uložiť profil</button></div></form></section>`;
}
function bindPlayers() {
  // otvorenie profilu → fokus na formulár nad zoznamom; zatvorenie/uloženie → späť na riadok hráča
  const prevHrac = prevHash.startsWith('#/hraci') ? new URLSearchParams(prevHash.split('?')[1] || '').get('hrac') : null, hrac = q().get('hrac');
  if (hrac && hrac !== prevHrac) focusNext = '#pf-h';
  else if (!hrac && prevHrac) focusNext = `#main a.row[href$="hrac=${encodeURIComponent(prevHrac)}"]`;
  const f = document.getElementById('pf'); if (!f) return;
  const name = hrac;
  f.suhlas.addEventListener('change', () => { document.getElementById('pfs').disabled = !f.suhlas.checked; });
  f.onsubmit = (ev) => { ev.preventDefault(); if (!f.suhlas.checked) return; S.players[name] = Object.fromEntries([...PF.map(([k]) => [k, f[k].value.trim()]), ['suhlas', true]]); S.log.unshift({ t: Date.now(), what: `Profil hráča: ${name}`, url: '', who: roleName() }); save(); toast('Profil uložený (ukážka)'); location.hash = `#/hraci?tim=${q().get('tim')}`; };
}

// ---- tréneri a vedenie ----
function vPeople() {
  const groups = (DRAFT.coaches ||= get('coaches', D.coaches));
  return shell('ludia', `${head('Tréneri a vedenie', 'Tréneri skupín sa zobrazujú pri tímoch bez súpisky a na stránke Vedenie klubu.')}
  <form id="cf" novalidate>${groups.map((g, gi) => `<section class="card"><div class="card-h"><h2>Tréneri · ${esc(g.nazov)}</h2><span class="count">${g.timy.map((s) => esc(team(s).short)).join(', ')}</span></div>
    ${rowsEditor('c' + gi, g.mena.map((m) => ({ name: m })), [['name', 'Meno a titul', 'napr. Mgr. Ján Novák']], 'Pridať trénera')}</section>`).join('')}
  <section class="card"><div class="card-h"><h2>Vedenie klubu</h2>${webLink('klub/vedenie-klubu/')}</div><p class="help">Predseda, manažér a ďalší ľudia s kontaktmi sú textová stránka.</p><a class="btn btn--ghost btn--sm" href="#/stranka/vedenie-klubu">${ic('pen')}Upraviť stránku Vedenie klubu</a></section>
  ${savebar(DRAFT.dirty ? '<b>Neuložené zmeny</b>nezabudnite uložiť' : '<b>Tréneri</b>', '<button class="btn btn--sm" type="submit">Uložiť</button>')}</form>`);
}
function bindPeople() {
  const f = document.getElementById('cf'); if (!f) return;
  const groups = DRAFT.coaches;
  const pull = () => groups.forEach((g, gi) => { g.mena = readRows('c' + gi).map((r) => r.name); });
  groups.forEach((g, gi) => bindRows('c' + gi, () => g.mena, (rows) => { groups.forEach((o, oi) => { if (oi !== gi) o.mena = readRows('c' + oi).map((r) => r.name); }); g.mena = rows.map((r) => r.name); }, () => { DRAFT.dirty = true; route(); }, { name: '' }));
  f.addEventListener('input', dirtyState);
  f.onsubmit = (ev) => { ev.preventDefault(); pull(); groups.forEach((g) => { g.mena = g.mena.filter(Boolean); }); put('coaches', groups, 'Tréneri upravení', 'klub/vedenie-klubu/'); DRAFT = {}; route(); toast('Tréneri uložení (ukážka)'); };
}

// ---- stránky klubu (text s formátovaním) ----
function vPages() {
  return shell('stranky', `${head('Stránky klubu', 'Textové stránky webu. Upravujete text a obrázky, nie rozloženie.')}
  <section class="card"><ul class="list">${Object.entries(D.pages).map(([k, p]) => `<li><a class="row" href="#/stranka/${k}"><span class="pava pava--txt">${ic('file')}</span><span class="row-main"><span class="row-t">${esc(p.title)}</span><span class="row-s">${'page:' + k in S.c ? 'upravené v ukážke' : 'text zo starého webu'}</span></span>${ic('chev', 'chev')}</a></li>`).join('')}</ul></section>`);
}
function vPage(key) {
  const p = D.pages[key]; if (!p) return shell('stranky', '<p class="empty">Stránka sa nenašla.</p>');
  const html = get('page:' + key, p.html);
  return shell('stranky', `${back('#/stranky', 'Stránky')}${head(esc(p.title), webLink(p.url))}
  <form id="sf" novalidate><section class="card">${rte('page', html, p.title)}</section>
  ${savebar('<b>Zverejnená</b>zmeny sa na webe prejavia do 1 minúty', `${'page:' + key in S.c ? '<button class="btn btn--ghost btn--sm" type="button" id="prev">Vrátiť pôvodný</button>' : ''}<button class="btn btn--sm" type="submit">Uložiť</button>`)}</form>`);
}
function bindPage(key) {
  const f = document.getElementById('sf'); if (!f) return;
  bindRte(dirtyState);
  document.getElementById('prev')?.addEventListener('click', () => { delete S.c['page:' + key]; save(); route(); toast('Vrátený pôvodný text'); });
  f.onsubmit = (ev) => { ev.preventDefault(); put('page:' + key, rteValue('page'), `Stránka upravená: ${D.pages[key].title}`, D.pages[key].url); route(); toast('Stránka uložená (ukážka)'); };
}

// ---- kontakty a údaje klubu ----
const INFO_F = [
  ['Klub', [['nazov', 'Názov klubu'], ['pravnyNazov', 'Právny názov'], ['adresa', 'Adresa (každý riadok zvlášť)', 'lines'], ['ihrisko', 'Ihrisko (každý riadok zvlášť)', 'lines']]],
  ['Kontakt', [['telefon', 'Telefón (hlavný)', 'tel'], ['telefonKlub', 'Telefón klubu', 'tel'], ['email', 'E-mail', 'email'], ['facebook', 'Facebook (odkaz)', 'url'], ['instagram', 'Instagram (odkaz)', 'url']]],
  ['Fakturačné údaje', [['ico', 'IČO'], ['dic', 'DIČ'], ['ucet', 'Číslo účtu']]],
];
const STAD_F = [['kapacita', 'Kapacita (osôb)'], ['sedenie', 'Miest na sedenie'], ['hlavna', 'Hlavná hracia plocha'], ['vedlajsia', 'Vedľajšia plocha'], ['umela', 'Umelá tráva'], ['rekonstrukcia', 'Rok rekonštrukcie']];
function vContacts() {
  const i = get('info', D.info);
  const fld = (k, l, t) => t === 'lines' ? `<label class="field"><span>${l}</span><textarea class="textarea textarea--s" name="${k}" rows="3">${esc((i[k] || []).join('\n'))}</textarea></label>` : `<label class="field"><span>${l}</span><input class="input" name="${k}" ${t ? `type="${t}"` : ''} value="${esc(i[k] || '')}"></label>`;
  return shell('kontakty', `${head('Kontakty a údaje', 'Zobrazujú sa v pätičke na každej stránke, v Kontaktoch, pri prenájme a na úvode.')}
  <form id="kf" novalidate>${INFO_F.map(([g, fs]) => `<section class="card"><div class="card-h"><h2>${g}</h2></div>${fs.map(([k, l, t]) => fld(k, l, t)).join('')}</section>`).join('')}
  <section class="card"><div class="card-h"><h2>Štadión v číslach</h2></div><div class="grid2 grid2--tight">${STAD_F.map(([k, l]) => `<label class="field"><span>${l}</span><input class="input" name="st_${k}" value="${esc(i.stadion?.[k] || '')}"></label>`).join('')}</div></section>
  ${savebar('<b>Údaje klubu</b>', '<button class="btn btn--sm" type="submit">Uložiť</button>')}</form>`);
}
function bindContacts() {
  const f = document.getElementById('kf'); if (!f) return;
  f.addEventListener('input', dirtyState);
  f.onsubmit = (ev) => {
    ev.preventDefault();
    const i = get('info', D.info);
    for (const [, fs] of INFO_F) for (const [k, , t] of fs) i[k] = t === 'lines' ? f[k].value.split('\n').map((s) => s.trim()).filter(Boolean) : f[k].value.trim();
    if (!validMail(i.email)) { f.email.focus(); return toast('E-mail nie je platný'); }
    if (!validUrl(i.facebook) || !validUrl(i.instagram)) return toast('Odkazy na sociálne siete musia začínať https://');
    i.stadion = { ...(i.stadion || {}), ...Object.fromEntries(STAD_F.map(([k]) => [k, f['st_' + k].value.trim()])) };
    put('info', i, 'Kontakty a údaje klubu upravené', 'klub/kontakty/'); route(); toast('Údaje uložené (ukážka)');
  };
}

// ---- úvodná stránka ----
function vHomeEdit() {
  const h = get('home', D.home);
  return shell('uvod', `${head('Úvodná stránka', `Texty a fotky na úvode. Zápasy, týždeň, správy, mládež a galérie sa skladajú samé. ${webLink('')}`)}
  <form id="hf" novalidate>
  <section class="card"><div class="card-h"><h2>Hlavná fotka a podnadpis</h2></div>
    <div id="hhero">${h.hero ? `<img class="cover" src="${esc(h.hero)}" alt="Hlavná fotka úvodu">` : ''}</div>
    <p class="label mt">Vybrať z galérií</p><div class="pick">${D.home.heroChoices.map((u, i) => `<button type="button" class="pick-b" data-hero="${i}" aria-label="Použiť fotku ${i + 1} z galérií"><img src="${esc(u)}" alt="" loading="lazy"></button>`).join('')}</div>
    <label class="drop drop--s">${ic('camera')}<b>Alebo nahrať vlastnú</b><input type="file" id="hfile" accept="image/*"></label>
    <label class="field mt"><span>Podnadpis pod názvom klubu</span><input class="input" name="ocenenie" value="${esc(h.ocenenie)}"></label></section>
  <section class="card"><div class="card-h"><h2>Blok Fanzóna</h2></div>
    <label class="field"><span>Nadpis</span><input class="input" name="fan_title" value="${esc(h.promoFan.title)}"></label>
    <label class="field"><span>Text</span><input class="input" name="fan_text" value="${esc(h.promoFan.text)}"></label>
    <div id="hfan"><img class="cover cover--s" src="${esc(h.promoFan.img)}" alt=""></div><label class="drop drop--s">${ic('camera')}<b>Vymeniť fotku</b><input type="file" id="ffile" accept="image/*"></label></section>
  <section class="card"><div class="card-h"><h2>Blok Prenájom</h2></div>
    <label class="field"><span>Nadpis</span><input class="input" name="rent_title" value="${esc(h.promoRent.title)}"></label>
    <label class="field"><span>Text</span><textarea class="textarea textarea--s" name="rent_text">${esc(h.promoRent.text)}</textarea><small>Telefón a e-mail sa berú z Kontaktov.</small></label></section>
  <section class="card"><div class="card-h"><h2>Blok Štadión</h2></div>
    <label class="field"><span>Nadpis</span><input class="input" name="st_title" value="${esc(h.stadion.title)}"></label>
    <label class="field"><span>Text</span><textarea class="textarea textarea--s" name="st_text">${esc(h.stadion.text)}</textarea><small>Čísla (kapacita, plochy) sa berú z Kontaktov a údajov.</small></label></section>
  ${savebar('<b>Úvodná stránka</b>', '<button class="btn btn--sm" type="submit">Uložiť</button>')}</form>`);
}
function bindHomeEdit() {
  const f = document.getElementById('hf'); if (!f) return;
  const h = get('home', D.home);
  f.addEventListener('input', dirtyState);
  document.querySelectorAll('[data-hero]').forEach((b) => { b.onclick = () => { h.hero = D.home.heroChoices[+b.dataset.hero]; document.getElementById('hhero').innerHTML = `<img class="cover" src="${esc(h.hero)}" alt="">`; dirtyState(); }; });
  document.getElementById('hfile').addEventListener('change', async (e) => { const x = e.target.files[0]; if (x) { h.hero = await thumb(x, 1200).catch(() => h.hero); document.getElementById('hhero').innerHTML = `<img class="cover" src="${esc(h.hero)}" alt="">`; dirtyState(); } });
  document.getElementById('ffile').addEventListener('change', async (e) => { const x = e.target.files[0]; if (x) { h.promoFan.img = await thumb(x, 700).catch(() => h.promoFan.img); document.getElementById('hfan').innerHTML = `<img class="cover cover--s" src="${esc(h.promoFan.img)}" alt="">`; dirtyState(); } });
  f.onsubmit = (ev) => {
    ev.preventDefault();
    Object.assign(h, { ocenenie: f.ocenenie.value.trim() });
    Object.assign(h.promoFan, { title: f.fan_title.value.trim(), text: f.fan_text.value.trim() });
    Object.assign(h.promoRent, { title: f.rent_title.value.trim(), text: f.rent_text.value.trim() });
    Object.assign(h.stadion, { title: f.st_title.value.trim(), text: f.st_text.value.trim() });
    put('home', h, 'Úvodná stránka upravená', ''); route(); toast('Úvod uložený (ukážka)');
  };
}

// ---- fanzóna ----
const shopData = () => get('shop', D.fanshop);
function vShop() {
  const s = shopData();
  return shell('fanzona', `${head('Fanzóna', 'Produkty, ceny a fotky. Objednávky chodia e-mailom.', `<a class="btn btn--sm" href="#/produkt/novy">${ic('plus')}Nový</a>`)}
  <section class="card">${s.produkty.length ? '' : '<p class="empty">Zatiaľ žiadne produkty.</p>'}<ul class="list">${s.produkty.map((p) => `<li><a class="row" href="#/produkt/${encodeURIComponent(p.slug)}">${p.photos[0] ? `<img class="nimg nimg--sq" src="${esc(p.photos[0])}" alt="" loading="lazy">` : '<span class="nimg nimg--sq"></span>'}<span class="row-main"><span class="row-t">${esc(p.nazov)}</span><span class="row-s">${esc(p.cena)} € · ${esc(p.velkost || 'bez veľkostí')}</span>${p.vypredane ? '<span class="tags"><span class="tag tag--red">vypredané</span></span>' : ''}</span>${ic('chev', 'chev')}</a></li>`).join('')}</ul></section>
  <section class="card"><form id="sof" novalidate><div class="card-h"><h2>Objednávky a poznámka</h2></div>
    <label class="field"><span>E-mail na objednávky</span><input class="input" type="email" name="email" value="${esc(s.email)}"></label>
    <label class="field"><span>Poznámka pod produktmi</span><input class="input" name="pozn" value="${esc(s.pozn)}"></label>
    <button class="btn btn--ghost btn--sm" type="submit">Uložiť</button></form></section>
  <section class="card"><div class="card-h"><h2>Predajňa na štadióne</h2></div><p class="help">Otváracie hodiny a text o predajni.</p><a class="btn btn--ghost btn--sm" href="#/stranka/predajna">${ic('pen')}Upraviť text predajne</a></section>`);
}
function bindShop() {
  const f = document.getElementById('sof'); if (!f) return;
  f.onsubmit = (ev) => { ev.preventDefault(); const s = shopData(); if (!validMail(f.email.value.trim())) return toast('E-mail nie je platný'); s.email = f.email.value.trim(); s.pozn = f.pozn.value.trim(); put('shop', s, 'Fanzóna: objednávky a poznámka', 'fanzona/'); toast('Uložené (ukážka)'); };
}
function vProduct(slug) {
  const s = shopData(), isNew = slug === 'novy';
  const p = isNew ? { slug: '', nazov: '', cena: '', farba: '', velkost: '', photos: [] } : s.produkty.find((x) => x.slug === slug);
  if (!p) return shell('fanzona', '<p class="empty">Produkt sa nenašiel.</p>');
  return shell('fanzona', `${back('#/fanzona', 'Fanzóna')}${head(isNew ? 'Nový produkt' : esc(p.nazov), isNew ? '' : webLink('fanzona/'))}
  <form id="prf" novalidate><section class="card">
    <label class="field"><span>Názov</span><input class="input" name="nazov" required value="${esc(p.nazov)}" placeholder="Napr. Šál OK Častkovce"></label>
    <div class="grid2 grid2--tight"><label class="field"><span>Cena (€)</span><input class="input" name="cena" type="number" min="0" step="0.5" inputmode="decimal" value="${esc(p.cena)}"></label>
    <label class="field"><span>Farba</span><input class="input" name="farba" value="${esc(p.farba)}"></label></div>
    <label class="field"><span>Veľkosti</span><input class="input" name="velkost" value="${esc(p.velkost)}" placeholder="napr. S, M, L, XL"></label>
    <label class="check"><input type="checkbox" name="vypredane"${p.vypredane ? ' checked' : ''}><span>Vypredané (na webe sa zobrazí štítok a objednávka sa vypne)</span></label>
  </section>
  <section class="card"><div class="card-h"><h2>Fotky</h2><span class="count" id="pcount">${plural(p.photos.length, 'fotka', 'fotky', 'fotiek')}</span></div><div id="pphotos">${photoGrid('pp', p.photos)}</div></section>
  ${isNew ? '' : '<p><button class="link link--danger" type="button" id="pdel">Odstrániť produkt z webu</button></p>'}
  ${savebar(isNew ? '<b>Nový produkt</b>' : '<b>Na webe</b>', `<button class="btn btn--sm" type="submit">${isNew ? 'Pridať' : 'Uložiť'}</button>`)}</form>`);
}
function bindProduct(slug) {
  const f = document.getElementById('prf'); if (!f) return;
  const s = shopData(), isNew = slug === 'novy';
  const base = isNew ? { photos: [] } : s.produkty.find((x) => x.slug === slug);
  const photos = [...base.photos];
  const rer = () => { document.getElementById('pphotos').innerHTML = photoGrid('pp', photos); document.getElementById('pcount').textContent = plural(photos.length, 'fotka', 'fotky', 'fotiek'); bindGrid('pp', photos, rer); dirtyState(); };
  bindGrid('pp', photos, rer);
  f.addEventListener('input', dirtyState);
  document.getElementById('pdel')?.addEventListener('click', () => { s.produkty = s.produkty.filter((x) => x.slug !== slug); put('shop', s, `Produkt odstránený: ${base.nazov}`, 'fanzona/'); location.hash = '#/fanzona'; toast('Produkt odstránený (ukážka)'); });
  f.onsubmit = (ev) => {
    ev.preventDefault();
    const nazov = f.nazov.value.trim(); if (!nazov) { f.nazov.focus(); return toast('Doplňte názov produktu'); }
    const cena = Number(String(f.cena.value).replace(',', '.')); if (!(cena >= 0) || f.cena.value === '') { f.cena.focus(); return toast('Doplňte cenu'); }
    const data = { nazov, cena, farba: f.farba.value.trim(), velkost: f.velkost.value.trim(), vypredane: f.vypredane.checked, photos };
    if (isNew) s.produkty.push({ slug: slugify(nazov) + '-' + Date.now().toString(36), ...data }); else Object.assign(s.produkty.find((x) => x.slug === slug), data);
    put('shop', s, `${isNew ? 'Nový produkt' : 'Produkt upravený'}: ${nazov}`, 'fanzona/'); location.hash = '#/fanzona'; toast('Produkt uložený (ukážka)');
  };
}

// ---- partneri ----
function vPartners() {
  const list = (DRAFT.partners ||= get('partners', D.partners));
  return shell('partneri', `${head('Partneri', 'Logá v pätičke každej stránky, v poradí ako tu.')}
  <section class="card">${list.length ? '' : '<p class="empty">Zatiaľ žiadni partneri.</p>'}<ol class="rows" id="plist">${list.map((p, i) => `<li class="erow erow--logo"><span class="plogo${p.dark ? ' plogo--dark' : ''}"><img src="${esc(p.logo)}" alt=""></span>
    <div class="erow-f"><label class="field field--in"><span>Názov</span><input class="input" data-k="alt" value="${esc(p.alt)}"></label><label class="field field--in"><span>Odkaz na web partnera</span><input class="input" data-k="url" type="url" value="${esc(p.url)}" placeholder="https://…"></label>
    <label class="check check--s"><input type="checkbox" data-k="dark"${p.dark ? ' checked' : ''}><span>Svetlé logo (tmavé pozadie)</span></label></div>
    <div class="erow-a"><button class="ibtn" type="button" data-up="${i}" aria-label="Posunúť ${esc(p.alt)} vyššie"${i === 0 ? ' disabled' : ''}>${ic('up')}</button><button class="ibtn" type="button" data-down="${i}" aria-label="Posunúť ${esc(p.alt)} nižšie"${i === list.length - 1 ? ' disabled' : ''}>${ic('down')}</button><button class="ibtn ibtn--x" type="button" data-del="${i}" aria-label="Odstrániť ${esc(p.alt)}">${ic('x')}</button></div></li>`).join('')}</ol></section>
  <section class="card"><form id="paf" novalidate><div class="card-h"><h2>Pridať partnera</h2></div>
    <label class="field"><span>Názov</span><input class="input" name="alt" placeholder="Napr. Stavebniny Novák"></label>
    <label class="field"><span>Odkaz <small>(nepovinné)</small></span><input class="input" name="url" type="url" placeholder="https://…"></label>
    <label class="drop drop--s">${ic('camera')}<b>Logo (PNG s priehľadným pozadím)</b><input type="file" name="logo" accept="image/png,image/svg+xml,image/webp,image/jpeg"></label>
    <button class="btn btn--block mt" type="submit">${ic('plus')}Pridať partnera</button></form></section>
  ${savebar(DRAFT.dirty ? '<b>Neuložené zmeny</b>poradie a zmeny uložte' : `<b>${plural(list.length, 'partner', 'partneri', 'partnerov')}</b>v pätičke webu`, '<button class="btn btn--sm" type="button" id="psave">Uložiť</button>')}`);
}
function bindPartners() {
  const ol = document.getElementById('plist'); if (!ol) return;
  const list = DRAFT.partners;
  const pull = () => [...ol.children].forEach((li, i) => { li.querySelectorAll('[data-k]').forEach((inp) => { list[i][inp.dataset.k] = inp.type === 'checkbox' ? inp.checked : inp.value.trim(); }); });
  ol.addEventListener('input', dirtyState);
  ol.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    pull();
    if (b.dataset.up || b.dataset.down) focusNext = moveFocus('plist', list.length, b.dataset.up ? +b.dataset.up - 1 : +b.dataset.down + 1, b.dataset.up ? 'up' : 'down');
    if (b.dataset.up) { const i = +b.dataset.up; [list[i - 1], list[i]] = [list[i], list[i - 1]]; }
    else if (b.dataset.down) { const i = +b.dataset.down; [list[i + 1], list[i]] = [list[i], list[i + 1]]; }
    else if (b.dataset.del) { const i = +b.dataset.del; list.splice(i, 1); focusNext = list.length ? `#plist > .erow:nth-child(${Math.min(i, list.length - 1) + 1}) input` : '#paf [name="alt"]'; }
    else return;
    DRAFT.dirty = true; route();
  });
  document.getElementById('psave').onclick = () => { pull(); if (list.some((p) => !validUrl(p.url))) return toast('Odkazy musia začínať https://'); put('partners', list, 'Partneri upravení', ''); DRAFT = {}; route(); toast('Partneri uložení (ukážka)'); };
  const f = document.getElementById('paf');
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const alt = f.alt.value.trim(); if (!alt) { f.alt.focus(); return toast('Doplňte názov partnera'); }
    if (!validUrl(f.url.value.trim())) { f.url.focus(); return toast('Odkaz musí začínať https://'); }
    const file = f.logo.files[0]; if (!file) return toast('Vyberte logo');
    const logo = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(file); });
    if (logo.length > 400000) return toast('Logo je príliš veľké (max. ~300 KB)');
    pull(); list.push({ file: '', alt, url: f.url.value.trim(), dark: false, logo });
    DRAFT.dirty = true; focusNext = '#plist > .erow:last-child input'; route(); toast('Partner pridaný – nezabudnite uložiť');
  };
}

// ---- používatelia a roly ----
const defUsers = () => [{ email: 'spravca@okcastkovce.sk', role: 'admin', team: '', me: true }, { email: 'trener.u15@example.sk', role: 'trener', team: 'u15-starsi-ziaci' }, { email: 'fotograf@example.sk', role: 'foto', team: '' }, { email: 'redaktor@example.sk', role: 'redaktor', team: '' }];
function vUsers() {
  const users = S.users || defUsers();
  return shell('pouzivatelia', `${head('Používatelia', 'Kto môže web upravovať. Každý vidí len to, čo mu rola dovolí.')}
  <section class="card"><ul class="list">${users.map((u, i) => `<li><div class="row urow"><span class="ava" aria-hidden="true">${esc(initials(u.email.replace(/@.*/, '').replace(/[._]/g, ' ')))}</span><span class="row-main"><span class="row-t">${esc(u.email)}${u.me ? ' (vy)' : ''}</span><span class="row-s">${esc(ROLES[u.role][0])}${u.team ? ' · ' + esc(team(u.team).short) : ''} – ${esc(ROLES[u.role][1])}</span></span>${u.me ? '' : `<span class="row-end"><button class="btn btn--ghost btn--sm" type="button" data-as="${i}" aria-label="Pozrieť administráciu ako ${esc(u.email)}">${ic('eye')}Pozrieť</button><button class="ibtn ibtn--x" type="button" data-del="${i}" aria-label="Odobrať ${esc(u.email)}">${ic('x')}</button></span>`}</div></li>`).join('')}</ul>
  <p class="help">„Pozrieť“ ukáže administráciu očami danej roly (len v ukážke).</p></section>
  <section class="card" aria-labelledby="inv-h"><div class="card-h"><h2 id="inv-h">Pozvať človeka</h2></div><form id="uf" novalidate>
    <label class="field"><span>E-mail</span><input class="input" type="email" name="email" required placeholder="meno@example.sk"></label>
    <label class="field"><span>Rola</span><select class="select" name="role">${Object.entries(ROLES).map(([k, [n, d]]) => `<option value="${k}"${k === 'trener' ? ' selected' : ''}>${n} – ${d}</option>`).join('')}</select></label>
    <label class="field"><span>Tím <small>(pre trénera)</small></span><select class="select" name="team"><option value="">— vyberte —</option>${D.allTeams.map((t) => `<option value="${t.slug}">${esc(t.short)}</option>`).join('')}</select></label>
    <button class="btn btn--block" type="submit">${ic('mail')}Poslať pozvánku</button></form></section>`);
}
function bindUsers() {
  const f = document.getElementById('uf'); if (!f) return;
  const users = S.users || defUsers();
  f.onsubmit = (ev) => {
    ev.preventDefault(); const email = f.email.value.trim();
    if (!validMail(email)) { f.email.focus(); return toast('Zadajte platný e-mail'); }
    if (f.role.value === 'trener' && !f.team.value) { f.team.focus(); return toast('Vyberte tím trénera'); }
    users.push({ email, role: f.role.value, team: f.role.value === 'trener' ? f.team.value : '' }); S.users = users; S.log.unshift({ t: Date.now(), what: `Pozvánka: ${email} (${ROLES[f.role.value][0]})`, url: '', who: roleName() }); save(); route(); toast(`Pozvánka pre ${email} (ukážka – neodoslaná)`);
  };
  document.querySelectorAll('[data-del]').forEach((b) => { b.onclick = () => { const i = +b.dataset.del; users.splice(i, 1); S.users = users; save(); focusNext = users.length > 1 ? `[data-del="${Math.max(1, Math.min(i, users.length - 1))}"]` : '#uf [name="email"]'; route(); toast('Používateľ odobraný'); }; });
  document.querySelectorAll('[data-as]').forEach((b) => { b.onclick = () => { const u = users[+b.dataset.as]; S.role = u.role; S.roleTeam = u.team || S.roleTeam; save(); location.hash = '#/'; toast(`Teraz vidíte administráciu ako ${roleName()}`); }; });
}

// ---- história zmien a viac (mobil) ----
const vLog = () => shell('zmeny', `${head('História zmien', 'Kto čo zmenil (v ostrej verzii aj s možnosťou vrátiť zmenu).')}<section class="card">${S.log.length ? logList(S.log) : '<p class="empty">Zatiaľ žiadne zmeny. Skúste niečo upraviť.</p>'}</section>`);
const vMore = () => shell('viac', `${head('Viac', '')}${GROUPS.slice(1).map(([g, items]) => { const vis = items.filter(([, , , s]) => can(s)); return vis.length ? `<p class="side-g side-g--m">${g}</p><div class="more">${vis.map(([h, t, i]) => `<a href="${h}">${ic(i)}${t}</a>`).join('')}</div>` : ''; }).join('')}
  <p class="side-g side-g--m">Ukážka</p><div class="more"><a href="../" target="_blank" rel="noopener">${ic('globe')}Zobraziť web</a><button type="button" id="reset">${ic('undo')}Obnoviť ukážku (zmazať zmeny)</button><a href="#/odhlasit">${ic('out')}Odhlásiť</a></div>`);

// ---- smerovanie ----
const ROUTES = [
  [/^#\/?$/, 'home', () => vHome()],
  [/^#\/zapasy$/, 'zapasy', () => vMatches()],
  [/^#\/zapas\/(.+)$/, 'zapasy', (id) => vMatch(id), bindMatch],
  [/^#\/spravy$/, 'spravy', () => vNews()],
  [/^#\/spravy\/(.+)$/, 'spravy', (id) => vNewsEdit(id), bindNews],
  [/^#\/galerie$/, 'galerie', () => vGalleries()],
  [/^#\/galerie\/(.+)$/, 'galerie', (id) => vGallery(id), bindGallery],
  [/^#\/videa$/, 'videa', () => vVideos(), bindVideos],
  [/^#\/timy$/, 'timy', () => vTeams()],
  [/^#\/tim\/(.+)$/, 'timy', (id) => vTeam(id), bindTeam],
  [/^#\/hraci$/, 'timy', () => vPlayers(), bindPlayers],
  [/^#\/ludia$/, 'ludia', () => vPeople(), bindPeople],
  [/^#\/stranky$/, 'stranky', () => vPages()],
  [/^#\/stranka\/(.+)$/, 'stranky', (id) => vPage(id), bindPage],
  [/^#\/kontakty$/, 'kontakty', () => vContacts(), bindContacts],
  [/^#\/uvod$/, 'uvod', () => vHomeEdit(), bindHomeEdit],
  [/^#\/fanzona$/, 'fanzona', () => vShop(), bindShop],
  [/^#\/produkt\/(.+)$/, 'fanzona', (id) => vProduct(id), bindProduct],
  [/^#\/partneri$/, 'partneri', () => vPartners(), bindPartners],
  [/^#\/pouzivatelia$/, 'pouzivatelia', () => vUsers(), bindUsers],
  [/^#\/zmeny$/, 'zmeny', () => vLog()],
  [/^#\/viac$/, 'home', () => vMore()],
];
let prevHash = '', renderedPath = null;
// cesta k prvku v #app: pri prekreslení tej istej obrazovky má rovnakú štruktúru, takže fokus sa vráti na to isté miesto
function domPath(el) {
  if (!el || el === document.body || !app.contains(el)) return null;
  const parts = [];
  for (let n = el; n && n !== app; n = n.parentElement) {
    if (n.id) { parts.unshift('#' + CSS.escape(n.id)); return parts.join(' > '); }
    parts.unshift(`${n.tagName.toLowerCase()}:nth-child(${[...n.parentElement.children].indexOf(n) + 1})`);
  }
  return '#app > ' + parts.join(' > ');
}
function route() {
  if (!D) return;
  const h = location.hash || '#/';
  if (h === '#/odhlasit') { S.logged = false; S.role = 'admin'; save(); history.replaceState(null, '', '#/'); renderedPath = null; return vLogin(); }
  if (!S.logged) { renderedPath = null; return vLogin(); }
  const path = h.split('?')[0];
  const keep = path === renderedPath ? domPath(document.activeElement) : null;
  const r = ROUTES.find(([re]) => re.test(path)) || ROUTES[0];
  const arg = decodeURIComponent((path.match(r[0]) || [])[1] || '');
  if (!can(r[1])) app.innerHTML = denied();
  else { app.innerHTML = r[2](arg); r[3]?.(arg); }
  document.getElementById('reset')?.addEventListener('click', () => { try { localStorage.removeItem(KEY); } catch { /* nič */ } location.hash = '#/'; location.reload(); });
  document.getElementById('role-back')?.addEventListener('click', () => { S.role = 'admin'; save(); location.hash = '#/pouzivatelia'; toast('Späť v role správcu'); });
  const sync = document.getElementById('sync');
  if (sync) sync.onclick = () => { const i = document.getElementById('syncic'); i.classList.add('is-spin'); sync.disabled = true; setTimeout(() => { i.classList.remove('is-spin'); sync.disabled = false; toast('Sportnet: všetko aktuálne, žiadne nové výsledky'); }, 1400); };
  // fokus: určený cieľ › ten istý prvok › nadpis obrazovky (nová obrazovka = nadpis, čítačka ho prečíta)
  const want = focusNext || keep; focusNext = null;
  const el = want && document.querySelector(want), h1 = app.querySelector('h1');
  if (el && !el.disabled && el.getClientRects().length) el.focus();
  else if (h1) { h1.tabIndex = -1; h1.focus({ preventScroll: true }); }
  if (h1) document.title = `${h1.textContent.trim()} · Administrácia OK Častkovce`;
  renderedPath = path; prevHash = h;
}
let lastPath = '';
window.addEventListener('hashchange', () => { const p = location.hash.split('?')[0]; if (p !== lastPath) DRAFT = {}; route(); if (p !== lastPath) { window.scrollTo(0, 0); lastPath = p; } });
// neuložené zmeny: upozornenie pri zatvorení karty
window.addEventListener('beforeunload', (e) => { if (document.getElementById('state')?.textContent.startsWith('Neuložené')) { e.preventDefault(); e.returnValue = ''; } });

fetch('demo.json').then((r) => r.json()).then((d) => { D = d; lastPath = location.hash.split('?')[0]; route(); })
  .catch(() => { app.innerHTML = '<p class="boot">Ukážku sa nepodarilo načítať.</p>'; });
