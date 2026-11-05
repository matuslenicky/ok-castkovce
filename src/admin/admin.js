// Administrácia OK Častkovce – klikateľná ukážka. Dáta: demo.json (výsledky zo Sportnetu + obsah webu), zmeny len v tomto
// prehliadači (localStorage). Ostrá verzia: prihlásenie a ukladanie cez Supabase (Auth + tabuľky s RLS), web sa po zverejnení
// sám prestavia.
const app = document.getElementById('app');
const toastEl = document.getElementById('toast');
const KEY = 'okc-admin-demo-v1';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

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
  check: '<path d="m5 12 5 5 9-10"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  left: '<path d="m15 6-6 6 6 6"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  out: '<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
};
const ic = (n, cls = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${cls ? ` class="${cls}"` : ''}>${P[n]}</svg>`;
const BALL = '<svg class="ball" viewBox="0 0 24 24" role="img" aria-label="gól"><circle cx="12" cy="12" r="10" fill="#fff" stroke="#121317" stroke-width="1.6"/><path d="m12 6.2 5 3.6-1.9 5.9H8.9L7 9.8z" fill="#121317"/><path d="M12 6.2V2.5M17 9.8l3.5-1.2M15.1 15.7l2.2 3.1M8.9 15.7l-2.2 3.1M7 9.8 3.5 8.6" stroke="#121317" stroke-width="1.4"/></svg>';

// ---- stav ukážky ----
let D = null;
const S = load();
function load() {
  try { return { logged: false, edits: {}, news: [], players: {}, users: null, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { logged: false, edits: {}, news: [], players: {}, users: null }; }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { toast('Prehliadač nedovolil uložiť ukážku (súkromné okno?)'); } }
let toastT;
function toast(msg) { toastEl.textContent = msg; toastEl.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { toastEl.hidden = true; }, 3200); }

// ---- pomocné ----
const MES = ['jan', 'feb', 'mar', 'apr', 'máj', 'jún', 'júl', 'aug', 'sep', 'okt', 'nov', 'dec'];
const DNI = ['ne', 'po', 'ut', 'st', 'št', 'pi', 'so'];
const dt = (iso) => new Date(iso + 'T12:00:00');
const fmtD = (iso) => { const d = dt(iso); return `${DNI[d.getDay()]} ${d.getDate()}. ${d.getMonth() + 1}.`; };
const todayISO = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Bratislava' });
const team = (slug) => D.teams.find((t) => t.slug === slug) || { short: slug, sub: '' };
const our = (m) => { if (!m.score) return null; const [h, a] = m.score.split(':').map(Number); const o = m.home ? h : a, t = m.home ? a : h; return { o, t, r: o > t ? 'w' : o < t ? 'l' : 'd' }; };
const scoreBadge = (m) => { const s = our(m); return s ? `<span class="score score--${s.r}" aria-label="Skóre ${s.o}:${s.t}">${s.o}:${s.t}</span>` : m.played ? '<span class="time">–</span>' : `<span class="time">${esc(m.time)}</span>`; };
const edit = (id) => S.edits[id] || {};
const photosOf = (m) => (m.gallery?.count || 0) + (edit(m.id).photos?.length || 0);
const hasVideo = (m) => !!(m.video || edit(m.id).video);
const missing = (m) => {
  if (!m.played || !our(m)) return [];
  const e = edit(m.id), out = [];
  if (!e.comment) out.push('bez komentára');
  if (!photosOf(m)) out.push('bez fotiek');
  return out;
};
const ytId = (u) => { const m = String(u || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/); return m ? m[1] : (/^[\w-]{11}$/.test(u || '') ? u : null); };
const ago = (iso) => { const min = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 6e4)); return min < 60 ? `pred ${min} min` : min < 1440 ? `pred ${Math.round(min / 60)} h` : `pred ${Math.round(min / 1440)} dňami`; };
const initials = (n) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const q = () => new URLSearchParams(location.hash.split('?')[1] || '');

// ---- rozloženie ----
const NAV = [['#/', 'Prehľad', 'home'], ['#/zapasy', 'Zápasy', 'ball'], ['#/spravy', 'Správy', 'news']];
function shell(active, body) {
  const cur = (h) => (active === h ? ' aria-current="page"' : '');
  return `<div class="shell">
  <header class="top"><a class="top-brand" href="#/"><img src="../img/logo.svg" alt=""><b>OK Častkovce</b><span>Admin</span></a>
    <div class="top-user"><span class="who">Správca webu</span><span class="ava" aria-hidden="true">SW</span></div></header>
  <nav class="side" aria-label="Administrácia">${NAV.map(([h, t, i]) => `<a href="${h}"${cur(h)}>${ic(i)}${t}</a>`).join('')}
    <a href="#/hraci"${cur('#/hraci')}>${ic('shirt')}Hráči</a><a href="#/pouzivatelia"${cur('#/pouzivatelia')}>${ic('users')}Používatelia</a>
    <div class="sep"></div><a href="../" target="_blank" rel="noopener">${ic('globe')}Zobraziť web</a><a href="#/odhlasit">${ic('out')}Odhlásiť</a></nav>
  <main class="main" id="main">${body}</main>
  <nav class="nav" aria-label="Administrácia">${NAV.map(([h, t, i]) => `<a href="${h}"${cur(h)}>${ic(i)}${t}</a>`).join('')}<a href="#/viac"${['#/viac', '#/hraci', '#/pouzivatelia'].includes(active) ? ' aria-current="page"' : ''}>${ic('menu')}Viac</a></nav>
</div>`;
}

// ---- prihlásenie ----
function vLogin(sent) {
  app.innerHTML = `<div class="login"><div class="login-card">
  <img class="login-crest" src="../img/logo.svg" alt="">
  <h1>Administrácia webu</h1>
  ${sent ? `<div class="sent"><div class="sent-ic">${ic('mail')}</div><p class="lead">Na <b>${esc(sent)}</b> sme poslali prihlasovací odkaz. Otvorte ho v tomto telefóne alebo počítači.</p>
  <button class="btn btn--block" id="go" type="button">Otvoriť odkaz (ukážka)</button><p class="hint"><button class="link" id="again" type="button">Zadať iný e-mail</button></p></div>`
    : `<p class="lead">OK Častkovce · prihlásenie pre správcov, trénerov a fotografa</p>
  <form id="lf" novalidate><label class="field"><span>E-mail</span><input class="input" type="email" name="email" autocomplete="email" inputmode="email" placeholder="meno@okcastkovce.sk" required></label>
  <button class="btn btn--block" type="submit">${ic('mail')}Poslať prihlasovací odkaz</button></form>
  <p class="hint">Bez hesla: na e-mail príde jednorazový odkaz. Prístup pridáva správca webu.</p>`}
</div></div>`;
  if (sent) {
    document.getElementById('go').onclick = () => { S.logged = true; save(); location.hash = '#/'; route(); };
    document.getElementById('again').onclick = () => vLogin();
  } else {
    document.getElementById('lf').onsubmit = (e) => { e.preventDefault(); const v = e.target.email.value.trim() || 'spravca@okcastkovce.sk'; vLogin(v); };
  }
}

// ---- prehľad ----
function vHome() {
  const t = todayISO();
  const played = D.matches.filter((m) => m.played && our(m));
  const todo = played.filter((m) => m.date >= addDays(t, -21) && missing(m).length).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const next = D.matches.filter((m) => !m.played && m.date >= t).slice(0, 5);
  const published = Object.values(S.edits).filter((e) => e.status === 'published').length;
  return shell('#/', `<div class="page-h"><div><h1>Prehľad</h1><p>Dobrý deň! Výsledky sa dopĺňajú samé, vy pridávate komentáre, fotky a správy.</p></div></div>
  <section class="card" aria-labelledby="sync-h"><div class="sync"><span class="sync-ic" id="syncic">${ic('refresh')}</span>
    <div><b id="sync-h">Výsledky zo Sportnetu sú aktuálne</b><span>Naposledy ${esc(ago(D.updated))} · ${D.teams.length} tímov · automaticky každú hodinu</span></div>
    <button class="btn btn--ghost btn--sm" id="sync" type="button">Aktualizovať</button></div></section>
  <div class="stats"><div class="stat"><b>${played.length}</b><span>odohraných zápasov v sezóne ${esc(D.season)}</span></div>
    <div class="stat"><b>${played.reduce((n, m) => n + m.goals.filter((g) => g.side === 'our').length, 0)}</b><span>gólov klubu zo zápisov</span></div>
    <div class="stat"><b>${published}</b><span>zápasov doplnených v ukážke</span></div></div>
  <div class="grid2">
  <section class="card" aria-labelledby="todo-h"><div class="card-h"><h2 id="todo-h">Čaká na doplnenie</h2><span class="count">posledné 3 týždne</span></div>
    ${todo.length ? `<ul class="list">${todo.map((m) => matchRow(m, true)).join('')}</ul>` : '<p class="empty">Všetko je doplnené 👍</p>'}</section>
  <section class="card" aria-labelledby="next-h"><div class="card-h"><h2 id="next-h">Najbližšie zápasy</h2><a class="link" href="#/zapasy?tab=program">Celý program</a></div>
    ${next.length ? `<ul class="list">${next.map((m) => matchRow(m)).join('')}</ul>` : '<p class="empty">Žiadne zápasy v rozpise.</p>'}</section>
  </div>
  <div class="qa"><a href="#/spravy/nova">${ic('pen')}Napísať správu</a><a href="#/zapasy">${ic('camera')}Pridať fotky k zápasu</a></div>`);
}
function addDays(iso, n) { const d = dt(iso); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE'); }
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
  const p = q(), tm = p.get('tim') || '', tab = p.get('tab') === 'program' ? 'program' : 'vysledky';
  const t = todayISO();
  let list = D.matches.filter((m) => (!tm || m.team === tm));
  list = tab === 'program' ? list.filter((m) => !m.played && m.date >= t) : list.filter((m) => m.played).reverse();
  const link = (o) => { const n = new URLSearchParams({ ...(tm ? { tim: tm } : {}), ...(tab === 'program' ? { tab } : {}), ...o }); for (const [k, v] of [...n]) if (!v) n.delete(k); return `#/zapasy${n.toString() ? '?' + n : ''}`; };
  return shell('#/zapasy', `<div class="page-h"><div><h1>Zápasy</h1><p>Skóre, strelci a karty prichádzajú zo Sportnetu. Doplňte komentár, fotky a video.</p></div></div>
  <div class="seg" role="group" aria-label="Zobraziť"><a href="${link({ tab: '' })}" aria-current="${tab === 'vysledky'}">Výsledky</a><a href="${link({ tab: 'program' })}" aria-current="${tab === 'program'}">Program</a></div>
  <div class="chips" role="group" aria-label="Tím"><a class="chip" href="${link({ tim: '' })}" aria-current="${!tm}">Všetky tímy</a>${D.teams.map((x) => `<a class="chip" href="${link({ tim: x.slug })}" aria-current="${tm === x.slug}">${esc(x.short)}</a>`).join('')}</div>
  <section class="card">${list.length ? `<ul class="list">${list.slice(0, 60).map((m) => matchRow(m, false, !!tm)).join('')}</ul>` : `<p class="empty">${tab === 'program' ? 'Žiadne naplánované zápasy.' : 'Zatiaľ žiadne výsledky.'}</p>`}</section>`);
}

function vMatch(id) {
  const m = D.matches.find((x) => x.id === id);
  if (!m) return shell('#/zapasy', '<p class="empty">Zápas sa nenašiel.</p>');
  const tm = team(m.team), s = our(m), e = { photos: [], ...edit(m.id) };
  const [hName, aName] = m.home ? ['OK Častkovce', m.opponent] : [m.opponent, 'OK Častkovce'];
  const roster = D.rosters[m.team] || [];
  const ev = [...m.goals.map((g) => ({ ...g, t: 'g' })), ...m.cards.map((c) => ({ ...c, t: 'c' }))].sort((a, b) => (parseInt(a.min) || 0) - (parseInt(b.min) || 0));
  const vid = e.video ? ytId(e.video) : m.video?.id;
  const sportnet = m.played ? `<section class="card" aria-labelledby="sn-h"><div class="card-h"><h2 id="sn-h">Priebeh zápasu</h2>${m.url ? `<a class="link" href="${esc(m.url)}" target="_blank" rel="noopener">Sportnet ${ic('ext').replace('<svg', '<svg style="width:14px;height:14px;display:inline;vertical-align:-2px"')}</a>` : ''}</div>
    <p class="src">${ic('lock')}<span>Zo zápisu o stretnutí na Sportnete, dopĺňa sa automaticky. Chybu opraví klub v systéme ISSF.</span></p>
    ${ev.length ? `<ul class="ev">${ev.map((x) => `<li class="${x.side}"><span class="min">${esc(x.min)}'</span>${x.t === 'g' ? BALL : `<span class="cardi${x.kind !== 'yellow' ? ' cardi--' + x.kind : ''}" role="img" aria-label="${x.kind === 'red' ? 'červená' : x.kind === 'yellow' ? 'žltá' : 'druhá žltá'} karta"></span>`}<span class="who">${esc(x.player || 'neznámy hráč')}${x.side === 'opp' ? ' <small>(súper)</small>' : ''}${x.kind === 'penalty' ? ' <small>(z penalty)</small>' : ''}${x.kind === 'own' ? ' <small>(vlastný gól)</small>' : ''}</span></li>`).join('')}</ul>`
      : `<p class="empty">${s ? 'V zápise nie sú žiadne góly ani karty.' : 'V tejto kategórii sa výsledky nezapisujú (prípravky).'}</p>`}</section>` : '';
  return shell('#/zapasy', `<a class="back" href="#/zapasy">${ic('left')}Zápasy</a>
  <section class="mhead"><div class="mhead-meta">${esc(m.competition)}${m.part && !m.part.toLowerCase().startsWith(m.competition.toLowerCase().slice(0, 8)) ? ' · ' + esc(m.part) : ''}${m.round ? ` · ${esc(m.round)}. kolo` : ''}</div>
    <div class="mhead-teams"><span class="mhead-team${m.home ? ' is-us' : ''}">${esc(hName)}</span>
      <span class="mhead-score">${m.score ? esc(m.score.replace(':', ' : ')) : esc(m.time || '–')}<small>${m.played ? (s ? 'koniec' : 'odohrané') : fmtD(m.date)}</small></span>
      <span class="mhead-team${m.home ? '' : ' is-us'}">${esc(aName)}</span></div>
    <div class="mhead-meta">${fmtD(m.date)} ${esc(m.time)}${m.venue ? ' · ' + esc(m.venue) : ''}</div>
    <div class="tags"><span class="tag">${esc(tm.short)}</span>${s ? `<span class="tag">${s.r === 'w' ? 'výhra' : s.r === 'l' ? 'prehra' : 'remíza'}</span>` : ''}${e.status === 'published' ? `<span class="tag">${ic('check')}zverejnené</span>` : ''}</div></section>
  ${sportnet}
  <form id="mf" novalidate>
  <section class="card" aria-labelledby="c-h"><div class="card-h"><h2 id="c-h">Komentár k zápasu</h2></div>
    <label class="field"><span class="sr">Komentár</span><textarea class="textarea" name="comment" maxlength="3000" placeholder="${m.played ? 'Ako sa zápas hral, hodnotenie trénera, poďakovanie fanúšikom…' : 'Pozvánka na zápas, doprava, vstupné…'}">${esc(e.comment || '')}</textarea><small>Zobrazí sa na webe pri výsledku a v detaile tímu.</small></label>
    ${m.played ? `<label class="field"><span>Hráč zápasu</span><select class="select" name="motm"><option value="">— nevybraný —</option>${roster.map((p) => `<option${e.motm === p.name ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}${roster.length ? '' : '<option disabled>súpiska tímu nie je na webe</option>'}</select></label>` : ''}
  </section>
  <section class="card" aria-labelledby="p-h"><div class="card-h"><h2 id="p-h">Fotky</h2><span class="count">${photosOf(m)} ${photosOf(m) === 1 ? 'fotka' : photosOf(m) >= 2 && photosOf(m) <= 4 ? 'fotky' : 'fotiek'}</span></div>
    <label class="drop">${ic('camera')}<b>Pridať fotky z telefónu alebo počítača</b><span>JPG alebo HEIC, aj viac naraz. Zmenšia sa automaticky.</span><input type="file" id="files" accept="image/*" multiple></label>
    <div class="thumbs" id="thumbs">${(m.gallery?.thumbs || []).map((u, i) => `<div class="thumb"><img src="${esc(u)}" alt="" loading="lazy">${i === 0 ? '<span class="star">titulná</span>' : ''}</div>`).join('')}${e.photos.map((ph, i) => `<div class="thumb thumb--new"><img src="${esc(ph)}" alt="Nová fotka ${i + 1}"><button class="x" type="button" data-rm="${i}" aria-label="Odstrániť fotku ${i + 1}">${ic('x')}</button></div>`).join('')}</div>
    ${m.gallery ? `<p class="help">Galéria od fotografa: ${m.gallery.count} fotiek · <a class="link" href="../${esc(m.gallery.url)}" target="_blank" rel="noopener">otvoriť na webe</a></p>` : ''}
  </section>
  <section class="card" aria-labelledby="v-h"><div class="card-h"><h2 id="v-h">Video</h2></div>
    <label class="field"><span class="sr">Odkaz na YouTube</span><input class="input" name="video" inputmode="url" placeholder="Odkaz na YouTube (zostrih, celý zápas…)" value="${esc(e.video || '')}"><small>Stačí skopírovať odkaz z aplikácie YouTube.</small></label>
    <div id="ytp">${vid ? ytCard(vid, e.video ? 'Nové video' : m.video?.title) : ''}</div>
  </section>
  <div class="savebar"><span class="state" id="state">${e.status === 'published' ? `<b>Zverejnené</b>${esc(e.when || '')}` : e.status === 'draft' ? '<b>Koncept</b>uložený, na webe zatiaľ nie je' : '<b>Bez zmien</b>na webe je len výsledok zo Sportnetu'}</span>
    <button class="btn btn--ghost btn--sm" type="button" id="draft">Uložiť koncept</button><button class="btn btn--sm" type="submit">Zverejniť</button></div>
  </form>`);
}
const ytCard = (id, title) => `<div class="yt"><img src="https://i.ytimg.com/vi/${encodeURIComponent(id)}/mqdefault.jpg" alt=""><span><b>${esc(title || 'Video z YouTube')}</b><span>Na webe sa prehrá cez YouTube bez cookies.</span></span></div>`;
function bindMatch(id) {
  const f = document.getElementById('mf');
  if (!f) return;
  const m = D.matches.find((x) => x.id === id);
  const cur = () => (S.edits[id] = { photos: [], ...S.edits[id] });
  const dirty = () => { document.getElementById('state').innerHTML = '<b>Neuložené zmeny</b>uložte koncept alebo zverejnite'; };
  f.addEventListener('input', dirty);
  f.video.addEventListener('input', () => { const v = ytId(f.video.value); document.getElementById('ytp').innerHTML = v ? ytCard(v, 'Nové video') : (f.video.value ? '<p class="help">Toto nevyzerá ako odkaz na YouTube.</p>' : ''); });
  document.getElementById('files').addEventListener('change', async (ev) => {
    const files = [...ev.target.files].slice(0, 30);
    if (!files.length) return;
    toast(`Spracúvam ${files.length} ${files.length === 1 ? 'fotku' : files.length < 5 ? 'fotky' : 'fotiek'}…`);
    const e = cur();
    for (const file of files) { try { e.photos.push(await thumb(file)); } catch { /* nečitateľný súbor */ } }
    save(); route(); toast('Fotky pridané – nezabudnite zverejniť');
  });
  document.getElementById('thumbs').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-rm]');
    if (!b) return;
    cur().photos.splice(+b.dataset.rm, 1); save(); route();
  });
  const store = (status) => {
    const e = cur();
    e.comment = f.comment.value.trim(); e.video = f.video.value.trim(); if (f.motm) e.motm = f.motm.value;
    e.status = status; e.when = status === 'published' ? `${new Date().toLocaleString('sk-SK', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })} · na webe do 1 minúty` : '';
    save(); route();
  };
  document.getElementById('draft').onclick = () => { store('draft'); toast('Koncept uložený'); };
  f.onsubmit = (ev) => { ev.preventDefault(); store('published'); toast(`Zverejnené: ${m.opponent} – na webe do 1 minúty`); };
}
// náhľad fotky: zmenšený JPEG (dlhšia strana 480 px), aby sa ukážka zmestila do localStorage
function thumb(file) {
  return new Promise((ok, bad) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { const k = Math.min(1, 480 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', .72)); };
    img.onerror = () => { URL.revokeObjectURL(url); bad(new Error('obrázok')); };
    img.src = url;
  });
}

// ---- správy ----
function vNews() {
  const all = [...S.news.map((n) => ({ ...n, mine: true })), ...D.news];
  return shell('#/spravy', `<div class="page-h"><div><h1>Správy</h1><p>${all.length} správ na webe</p></div><a class="btn btn--sm" href="#/spravy/nova">${ic('plus')}Nová</a></div>
  <section class="card"><ul class="list">${all.map((n) => `<li><a class="row" href="#/spravy/${encodeURIComponent(n.id)}">${n.img ? `<img class="nimg" src="${esc(n.img)}" alt="" loading="lazy">` : '<span class="nimg"></span>'}<span class="row-main"><span class="row-t">${esc(n.title)}</span><span class="row-s">${esc(fmtD(n.date))} ${dt(n.date).getFullYear()}${n.mine ? ' · pridané v ukážke' : ''}</span></span>${ic('chev', 'chev')}</a></li>`).join('')}</ul></section>`);
}
function vNewsEdit(id) {
  const n = id === 'nova' ? null : [...S.news, ...D.news].find((x) => String(x.id) === id);
  if (id !== 'nova' && !n) return shell('#/spravy', '<p class="empty">Správa sa nenašla.</p>');
  const recent = D.matches.filter((m) => m.played && our(m)).slice(-12).reverse();
  return shell('#/spravy', `<a class="back" href="#/spravy">${ic('left')}Správy</a>
  <div class="page-h"><div><h1>${n ? 'Upraviť správu' : 'Nová správa'}</h1></div></div>
  <form id="nf" novalidate><section class="card">
    <label class="field"><span>Titulok</span><input class="input" name="title" required maxlength="140" value="${esc(n?.title || '')}" placeholder="Napr. Dorastenci zdolali Myjavu"></label>
    <label class="field"><span>Dátum</span><input class="input" type="date" name="date" value="${esc(n?.date || todayISO())}"></label>
    <label class="field"><span>Úvodná fotka</span>${n?.img ? `<img class="nimg" style="width:100%;height:auto;aspect-ratio:16/9" src="${esc(n.img)}" alt="">` : ''}<span class="drop" style="min-height:90px">${ic('camera')}<b>Vybrať fotku</b><input type="file" name="img" accept="image/*"></span></label>
    <label class="field"><span>Text</span><textarea class="textarea" name="body" style="min-height:220px" placeholder="Odseky oddeľte prázdnym riadkom.">${esc(n?.text || '')}</textarea>${n && !n.mine ? '<small>Text tejto správy je zo starého webu, v ostrej verzii sa tu dá upraviť.</small>' : ''}</label>
    <label class="field"><span>Súvisiaci zápas <small>(nepovinné)</small></span><select class="select" name="match"><option value="">— žiadny —</option>${recent.map((m) => `<option value="${esc(m.id)}">${esc(fmtD(m.date))} · ${esc(team(m.team).short)} – ${esc(m.opponent)} ${esc(m.score || '')}</option>`).join('')}</select><small>Správa sa zobrazí aj pri výsledku zápasu.</small></label>
  </section>
  <div class="savebar"><span class="state"><b>${n ? 'Zverejnená' : 'Nová správa'}</b>${n ? 'zmeny sa na webe prejavia do 1 minúty' : 'po zverejnení sa objaví na úvode webu'}</span><button class="btn btn--sm" type="submit">${n ? 'Uložiť' : 'Zverejniť'}</button></div></form>`);
}
function bindNews(id) {
  const f = document.getElementById('nf');
  if (!f) return;
  let img = null;
  f.img.addEventListener('change', async () => { if (f.img.files[0]) { img = await thumb(f.img.files[0]).catch(() => null); toast(img ? 'Fotka pripravená' : 'Fotku sa nepodarilo načítať'); } });
  f.onsubmit = (ev) => {
    ev.preventDefault();
    if (!f.title.value.trim()) { f.title.focus(); toast('Doplňte titulok'); return; }
    if (id === 'nova') { S.news.unshift({ id: 'n' + Date.now(), title: f.title.value.trim(), date: f.date.value || todayISO(), img, text: f.body.value }); save(); location.hash = '#/spravy'; toast('Správa zverejnená (ukážka)'); }
    else { toast('Uložené (ukážka)'); location.hash = '#/spravy'; }
  };
}

// ---- hráči ----
const PF = [['narodenie', 'Dátum narodenia', 'date'], ['bydlisko', 'Bydlisko (obec)', 'text'], ['volnyCas', 'Voľný čas, záľuby', 'text'], ['klub', 'Obľúbený klub', 'text']];
function vPlayers() {
  const p = q(), tm = p.get('tim') || D.teams.find((t) => (D.rosters[t.slug] || []).length)?.slug;
  const list = D.rosters[tm] || [];
  const done = (n) => { const x = S.players[n] || {}; return PF.filter(([k]) => x[k]).length / PF.length; };
  const open = p.get('hrac');
  const pl = open && list.find((x) => x.name === open);
  return shell('#/hraci', `<div class="page-h"><div><h1>Hráči</h1><p>Profily hráčov: údaje sa na webe ukážu len vyplnené a so súhlasom rodiča.</p></div></div>
  <div class="chips" role="group" aria-label="Tím">${D.teams.filter((t) => (D.rosters[t.slug] || []).length).map((x) => `<a class="chip" href="#/hraci?tim=${x.slug}" aria-current="${tm === x.slug}">${esc(x.short)}</a>`).join('')}</div>
  ${pl ? playerForm(pl, tm) : ''}
  <section class="card"><div class="card-h"><h2>${esc(team(tm).short)}</h2><span class="count">${list.length} hráčov</span></div>
  ${list.length ? `<ul class="list">${list.map((x) => `<li><a class="row" href="#/hraci?tim=${tm}&hrac=${encodeURIComponent(x.name)}">${x.photo ? `<img class="pava" src="${esc(x.photo)}" alt="" loading="lazy">` : `<span class="pava pava--txt">${esc(initials(x.name))}</span>`}<span class="row-main"><span class="row-t">${esc(x.name)}</span><span class="row-s">${x.number ? '#' + esc(x.number) + ' · ' : ''}profil ${Math.round(done(x.name) * 100)} %</span></span><span class="meter" aria-hidden="true"><i style="width:${Math.round(done(x.name) * 100)}%"></i></span>${ic('chev', 'chev')}</a></li>`).join('')}</ul>` : '<p class="empty">Súpiska tímu na webe zatiaľ nie je.</p>'}</section>`);
}
function playerForm(pl, tm) {
  const x = S.players[pl.name] || {};
  return `<section class="card" aria-labelledby="pf-h"><div class="card-h"><h2 id="pf-h">${esc(pl.name)}</h2><a class="link" href="#/hraci?tim=${tm}">Zavrieť</a></div>
  <p class="sheet-note">Pri hráčoch mladších ako 18 rokov zverejnite údaje a fotku len so súhlasom rodiča alebo zákonného zástupcu.</p>
  <form id="pf" novalidate>${PF.map(([k, l, t]) => `<label class="field"><span>${l}</span><input class="input" type="${t}" name="${k}" value="${esc(x[k] || '')}"></label>`).join('')}
  <label class="check"><input type="checkbox" name="suhlas"${x.suhlas ? ' checked' : ''}><span>Mám súhlas rodiča alebo zákonného zástupcu so zverejnením týchto údajov a fotky.</span></label>
  <div style="margin-top:14px"><button class="btn btn--block" type="submit" id="pfs"${x.suhlas ? '' : ' disabled'}>Uložiť profil</button></div></form></section>`;
}
function bindPlayers() {
  const f = document.getElementById('pf');
  if (!f) return;
  const name = q().get('hrac');
  f.suhlas.addEventListener('change', () => { document.getElementById('pfs').disabled = !f.suhlas.checked; });
  f.onsubmit = (ev) => { ev.preventDefault(); if (!f.suhlas.checked) return; S.players[name] = Object.fromEntries([...PF.map(([k]) => [k, f[k].value.trim()]), ['suhlas', true]]); save(); toast('Profil uložený (ukážka)'); location.hash = `#/hraci?tim=${q().get('tim')}`; };
}

// ---- používatelia ----
const ROLES = { admin: ['Správca', 'všetko vrátane používateľov'], trener: ['Tréner', 'zápasy, fotky a hráči svojho tímu'], foto: ['Fotograf', 'len fotky k zápasom'], redaktor: ['Redaktor', 'správy a komentáre'] };
const defUsers = () => [{ email: 'spravca@okcastkovce.sk', role: 'admin', team: '', me: true }, { email: 'trener.u15@example.sk', role: 'trener', team: 'u15-starsi-ziaci' }, { email: 'fotograf@example.sk', role: 'foto', team: '' }];
function vUsers() {
  const users = S.users || defUsers();
  return shell('#/pouzivatelia', `<div class="page-h"><div><h1>Používatelia</h1><p>Kto môže web upravovať. Každý vidí len to, čo mu rola dovolí.</p></div></div>
  <section class="card"><ul class="list">${users.map((u, i) => `<li><div class="row"><span class="ava" aria-hidden="true">${esc(initials(u.email.replace(/@.*/, '').replace(/[._]/g, ' ')))}</span><span class="row-main"><span class="row-t">${esc(u.email)}${u.me ? ' (vy)' : ''}</span><span class="row-s">${esc(ROLES[u.role][0])}${u.team ? ' · ' + esc(team(u.team).short) : ''} – ${esc(ROLES[u.role][1])}</span></span>${u.me ? '' : `<button class="btn btn--ghost btn--sm" type="button" data-del="${i}">Odobrať</button>`}</div></li>`).join('')}</ul></section>
  <section class="card" aria-labelledby="inv-h"><div class="card-h"><h2 id="inv-h">Pozvať človeka</h2></div><form id="uf" novalidate>
    <label class="field"><span>E-mail</span><input class="input" type="email" name="email" required placeholder="meno@example.sk"></label>
    <label class="field"><span>Rola</span><select class="select" name="role">${Object.entries(ROLES).map(([k, [n, d]]) => `<option value="${k}"${k === 'trener' ? ' selected' : ''}>${n} – ${d}</option>`).join('')}</select></label>
    <label class="field"><span>Tím <small>(pre trénera)</small></span><select class="select" name="team"><option value="">— všetky —</option>${D.teams.map((t) => `<option value="${t.slug}">${esc(t.short)}</option>`).join('')}</select></label>
    <button class="btn btn--block" type="submit">${ic('mail')}Poslať pozvánku</button></form></section>`);
}
function bindUsers() {
  const f = document.getElementById('uf');
  if (!f) return;
  const users = S.users || defUsers();
  f.onsubmit = (ev) => { ev.preventDefault(); const email = f.email.value.trim(); if (!/^\S+@\S+\.\S+$/.test(email)) { f.email.focus(); toast('Zadajte platný e-mail'); return; } users.push({ email, role: f.role.value, team: f.role.value === 'trener' ? f.team.value : '' }); S.users = users; save(); route(); toast(`Pozvánka pre ${email} (ukážka – neodoslaná)`); };
  document.querySelectorAll('[data-del]').forEach((b) => { b.onclick = () => { users.splice(+b.dataset.del, 1); S.users = users; save(); route(); toast('Používateľ odobraný'); }; });
}

// ---- viac (mobil) ----
const vMore = () => shell('#/viac', `<div class="page-h"><div><h1>Viac</h1></div></div><div class="more">
  <a href="#/hraci">${ic('shirt')}Hráči a profily</a><a href="#/pouzivatelia">${ic('users')}Používatelia a roly</a>
  <a href="../" target="_blank" rel="noopener">${ic('globe')}Zobraziť web</a><button type="button" id="reset">${ic('undo')}Obnoviť ukážku (zmazať zmeny)</button><a href="#/odhlasit">${ic('out')}Odhlásiť</a></div>`);

// ---- smerovanie ----
function route() {
  if (!D) return;
  const h = location.hash || '#/';
  if (h === '#/odhlasit') { S.logged = false; save(); history.replaceState(null, '', '#/'); return vLogin(); }
  if (!S.logged) return vLogin();
  const path = h.split('?')[0];
  let m;
  if (path === '#/' || path === '#') app.innerHTML = vHome();
  else if (path === '#/zapasy') app.innerHTML = vMatches();
  else if ((m = path.match(/^#\/zapas\/(.+)$/))) { app.innerHTML = vMatch(decodeURIComponent(m[1])); bindMatch(decodeURIComponent(m[1])); }
  else if (path === '#/spravy') app.innerHTML = vNews();
  else if ((m = path.match(/^#\/spravy\/(.+)$/))) { app.innerHTML = vNewsEdit(decodeURIComponent(m[1])); bindNews(decodeURIComponent(m[1])); }
  else if (path === '#/hraci') { app.innerHTML = vPlayers(); bindPlayers(); }
  else if (path === '#/pouzivatelia') { app.innerHTML = vUsers(); bindUsers(); }
  else if (path === '#/viac') { app.innerHTML = vMore(); document.getElementById('reset').onclick = () => { try { localStorage.removeItem(KEY); } catch { /* nič */ } location.hash = '#/'; location.reload(); }; }
  else app.innerHTML = vHome();
  const sync = document.getElementById('sync');
  if (sync) sync.onclick = () => { const i = document.getElementById('syncic'); i.classList.add('is-spin'); sync.disabled = true; setTimeout(() => { i.classList.remove('is-spin'); sync.disabled = false; toast('Sportnet: všetko aktuálne, žiadne nové výsledky'); }, 1400); };
}
let lastPath = '';
window.addEventListener('hashchange', () => { const p = location.hash.split('?')[0]; route(); if (p !== lastPath) { window.scrollTo(0, 0); lastPath = p; } });

fetch('demo.json').then((r) => r.json()).then((d) => { D = d; lastPath = location.hash.split('?')[0]; route(); })
  .catch(() => { app.innerHTML = '<p class="boot">Ukážku sa nepodarilo načítať.</p>'; });
