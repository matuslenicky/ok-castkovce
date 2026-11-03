// Spoločné funkcie pre build (Node) aj prehliadač: formátovanie a vykreslenie zápasov.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const DNI = ['ne', 'po', 'ut', 'st', 'št', 'pi', 'so'];
const MESIACE = ['január', 'február', 'marec', 'apríl', 'máj', 'jún', 'júl', 'august', 'september', 'október', 'november', 'december'];
const d = (iso) => new Date(String(iso).slice(0, 10) + 'T12:00:00');
export const fmtDate = (iso) => { const x = d(iso); return `${x.getDate()}. ${x.getMonth() + 1}. ${x.getFullYear()}`; };
export const fmtDay = (iso) => DNI[d(iso).getDay()];
export const fmtMonth = (iso) => { const x = d(iso); return `${MESIACE[x.getMonth()]} ${x.getFullYear()}`; };
export const fmtTime = (t) => (t ? String(t).slice(0, 5) : '');

export const CLUB = 'OK Častkovce';

// Zápas je „odohraný“, keď má výsledok alebo už prešiel jeho deň.
export const isPast = (m, today) => !!m.score || m.date < today;
export const todayISO = (now = new Date()) => {
  const z = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};

export function splitMatches(list, today) {
  const sorted = [...list].sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  const past = sorted.filter((m) => isPast(m, today));
  const next = sorted.filter((m) => !isPast(m, today));
  return { past, next };
}

const SHIELD = '<svg class="opp" viewBox="0 0 40 46" aria-hidden="true"><path d="M20 2 4 8v14c0 11 7 18 16 22 9-4 16-11 16-22V8L20 2Z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg>';

export function sides(m, crest) {
  const us = `<span class="tm tm--us"><img src="${crest}" alt="" width="40" height="40"><span class="tm-n">${CLUB}</span></span>`;
  // „Horné Saliby/Tomášikovo“: zalomiť radšej za lomkou ako uprostred slova
  const them = `<span class="tm">${SHIELD}<span class="tm-n">${esc(m.opponent).replace(/\//g, '/<wbr>')}</span></span>`;
  return m.home ? [us, them] : [them, us];
}

export function scoreFor(m) {
  if (!m.score) return null;
  const [a, b] = m.score.split(':').map(Number);
  // skóre je zapísané z pohľadu domáceho tímu
  const ours = m.home ? a : b, theirs = m.home ? b : a;
  return { a, b, res: ours > theirs ? 'V' : ours < theirs ? 'P' : 'R' };
}

// ---- odvodené údaje (nič nové, len prepočet z rozpisu a výsledkov) ----
// skóre z pohľadu OK Častkovce: „2:0“ = my 2, súper 0
export function ourScore(m) {
  const s = scoreFor(m);
  if (!s) return null;
  return { ours: m.home ? s.a : s.b, theirs: m.home ? s.b : s.a, res: s.res };
}
const RES_WORD = { V: 'výhra', R: 'remíza', P: 'prehra' };

// sezóna začína 1. júla: 3. 11. 2026 -> 2026/27
export function seasonOf(today) {
  const y = Number(today.slice(0, 4)), mo = Number(today.slice(5, 7));
  const start = mo >= 7 ? y : y - 1;
  return { start: `${start}-07-01`, label: `${start}/${String(start + 1).slice(2)}` };
}

// bilancia sezóny a forma (posledných 5 odohraných zápasov s výsledkom)
export function teamStats(list, today) {
  const { past } = splitMatches(list, today);
  const played = past.filter((m) => m.score);
  const season = seasonOf(today);
  const rec = { z: 0, v: 0, r: 0, p: 0, gf: 0, ga: 0 };
  for (const m of played.filter((x) => x.date >= season.start)) {
    const o = ourScore(m);
    rec.z++; rec[o.res.toLowerCase()]++; rec.gf += o.ours; rec.ga += o.theirs;
  }
  return { season: season.label, rec, form: played.slice(-5) };
}

export function formHTML(list, today) {
  const { season, rec, form } = teamStats(list, today);
  if (!form.length) return '';
  const chips = form.map((m) => {
    const o = ourScore(m);
    const label = `${RES_WORD[o.res]} ${o.ours}:${o.theirs}, ${m.home ? 'doma' : 'vonku'} s ${m.opponent}, ${fmtDate(m.date)}`;
    return `<li class="fc fc--${o.res}" title="${esc(label)}"><span aria-hidden="true">${o.res}</span><span class="sr">${esc(label)}</span></li>`;
  }).join('');
  const stat = (n, t) => `<div><dt>${t}</dt><dd>${n}</dd></div>`;
  return `<div class="form">
  <div class="form-last"><p class="form-h" id="fh-${list[0]?.team || 'x'}">Forma</p><ol class="fchips" aria-labelledby="fh-${list[0]?.team || 'x'}">${chips}</ol><p class="form-note">posledných ${form.length}, najnovší vpravo</p></div>
  ${rec.z ? `<div class="form-rec"><p class="form-h">Sezóna ${season}</p><dl class="rec">${stat(rec.z, 'Zápasy')}${stat(rec.v, 'Výhry')}${stat(rec.r, 'Remízy')}${stat(rec.p, 'Prehry')}${stat(`${rec.gf}:${rec.ga}`, 'Skóre')}</dl></div>` : ''}
</div>`;
}

// posledný vzájomný zápas so súperom (pred daným zápasom, s výsledkom)
export function lastMeeting(m, list) {
  const prev = list.filter((x) => x.opponent === m.opponent && x.score && x.date < m.date).sort((a, b) => a.date.localeCompare(b.date));
  return prev[prev.length - 1] || null;
}

// fotky a video pri zápase (m.gal = cesta ku galérii, m.yt = YouTube id; páruje build)
export function mediaHTML(m, root = '') {
  const out = [];
  if (m.gal) out.push(`<a class="mmedia" href="${esc(root + m.gal)}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="9" r="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" fill="none" stroke="currentColor" stroke-width="2"/></svg>Fotky<span class="sr">: ${esc(m.opponent)}, ${fmtDate(m.date)}</span></a>`);
  if (m.yt) out.push(`<button type="button" class="mmedia vplay" data-yt="${esc(m.yt)}" data-title="${esc(m.ytTitle || m.opponent)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor"/></svg>Video<span class="sr">: ${esc(m.opponent)}, ${fmtDate(m.date)}</span></button>`);
  return out.length ? `<span class="mmedia-row">${out.join('')}</span>` : '';
}

// najbližší zápas s presným časom výkopu (rozpis je v slovenskom čase)
export function kickoff(m) {
  if (!m || !m.date) return null;
  const t = fmtTime(m.time) || '00:00';
  const probe = new Date(`${m.date}T12:00:00Z`);
  const off = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Bratislava', timeZoneName: 'shortOffset' }).formatToParts(probe).find((p) => p.type === 'timeZoneName')?.value || 'GMT+1';
  const h = Number((off.match(/([+-]\d+)/) || [0, 1])[1]);
  return new Date(`${m.date}T${t}:00${h >= 0 ? '+' : '-'}${String(Math.abs(h)).padStart(2, '0')}:00`);
}

// prehľad zápasov všetkých kategórií na najbližších 7 dní
const addDays = (iso, n) => { const x = new Date(`${iso}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
export function weekHTML(all, today, { labels = {}, urls = {}, root = '' } = {}) {
  const end = addDays(today, 6);
  const list = all.filter((m) => m.date >= today && m.date <= end).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  if (!list.length) return `<p class="empty">Na najbližších 7 dní nie je v rozpise žiadny zápas. <a href="${root}zapasy/">Celý program</a></p>`;
  let out = '', day = '';
  const tomorrow = addDays(today, 1);
  for (const m of list) {
    if (m.date !== day) {
      if (day) out += '</ul></li>';
      const name = m.date === today ? 'Dnes' : m.date === tomorrow ? 'Zajtra' : `${DNI[d(m.date).getDay()]} ${fmtDate(m.date).replace(/ \d{4}$/, '')}`;
      out += `<li class="wk-day${m.date === today ? ' wk-day--today' : ''}"><h3 class="wk-h"><time datetime="${m.date}">${name}</time></h3><ul class="wk-list">`;
      day = m.date;
    }
    const s = ourScore(m);
    const mid = s ? `<span class="wk-score">${s.ours}:${s.theirs}</span>` : `<span class="wk-time">${esc(fmtTime(m.time) || '–')}</span>`;
    const team = labels[m.team] || m.team;
    const tl = urls[m.team] ? `<a class="wk-team" href="${root}${urls[m.team]}">${esc(team)}</a>` : `<span class="wk-team">${esc(team)}</span>`;
    out += `<li class="wk-row">${mid}${tl}<span class="wk-opp">${m.home ? 'doma' : 'vonku'} · ${esc(m.opponent)}</span></li>`;
  }
  return `<ol class="wk">${out}</ul></li></ol>`;
}

// zápasy dnes (pre „Dnes hráme“)
export const todayMatches = (all, today) => all.filter((m) => m.date === today && !m.score);

// odpočet do výkopu: „4 dni 3 h 12 min“ (aj ako text pre čítačky)
export function countdownParts(ms) {
  const min = Math.max(0, Math.floor(ms / 60000));
  return { d: Math.floor(min / 1440), h: Math.floor((min % 1440) / 60), m: min % 60 };
}
const dni = (n) => (n === 1 ? 'deň' : n >= 2 && n <= 4 ? 'dni' : 'dní');
export const countdownText = ({ d, h, m }) => `${d ? `${d} ${dni(d)} ` : ''}${h} h ${m} min`;

// úvod: najbližší zápas tímu s odpočtom a odkazom do kalendára
export function nextHTML(list, today, { label, root = '', now = Date.now() } = {}) {
  const { next } = splitMatches(list, today);
  const m = next[0];
  if (!m) return '';
  const [h, a] = m.home ? [CLUB, m.opponent] : [m.opponent, CLUB];
  const ko = m.time ? kickoff(m) : null;
  const left = ko ? ko.getTime() - now : 0;
  const p = countdownParts(left);
  const cd = ko && left > 0
    ? `<div class="cd" role="timer" data-kickoff="${ko.toISOString()}" aria-label="Do výkopu ${countdownText(p)}"><span><b>${p.d}</b>${dni(p.d)}</span><span><b>${String(p.h).padStart(2, '0')}</b>hod</span><span><b>${String(p.m).padStart(2, '0')}</b>min</span></div>`
    : m.date === today ? '<p class="cd-today">Dnes hráme</p>' : '';
  return `<p class="hnext-k">Najbližší zápas · ${esc(label)}</p>
  <p class="hnext-t">${esc(h)} <span aria-hidden="true">–</span><span class="sr"> proti </span> ${esc(a)}</p>
  <p class="hnext-m"><time datetime="${esc(m.date)}${m.time ? 'T' + esc(fmtTime(m.time)) : ''}">${fmtDay(m.date)} ${fmtDate(m.date)}${m.time ? ' · ' + esc(fmtTime(m.time)) : ''}</time> · ${m.home ? 'doma' : 'vonku'}${m.league ? ` · ${esc(m.league)}` : ''}</p>
  ${cd}
  <a class="hnext-cal" href="${root}kalendar/zapas-${m.id}.ics" download><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M8 3v4m8-4v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Pridať do kalendára</a>`;
}

export function matchCard(m, { kicker, crest, teamLabel, list = null, root = '' }) {
  if (!m) {
    return `<article class="mcard mcard--empty"><p class="mcard-k">${esc(kicker)}</p><p class="mcard-none">Zápas zatiaľ nie je v rozpise.</p></article>`;
  }
  const [h, a] = sides(m, crest);
  const s = scoreFor(m);
  // pri najbližšom zápase: ako dopadol posledný vzájomný zápas
  const prev = !s && list ? lastMeeting(m, list) : null;
  const po = prev && ourScore(prev);
  const h2h = po ? `<p class="mcard-h2h">Naposledy: ${RES_WORD[po.res]} <b>${po.ours}:${po.theirs}</b> · ${fmtDate(prev.date)}</p>` : '';
  const media = s ? mediaHTML(m, root) : '';
  const mid = s
    ? `<span class="mscore" aria-label="výsledok ${s.a} : ${s.b}"><b>${s.a}</b><i>:</i><b>${s.b}</b></span>`
    : m.date && kicker === 'Posledný zápas'
      ? '<span class="mscore mscore--na" aria-label="výsledok nie je zapísaný"><b>–</b><i>:</i><b>–</b></span>'
      : `<span class="mtime">${esc(fmtTime(m.time) || '–')}</span>`;
  return `<article class="mcard${s ? ' mcard--res mcard--' + s.res : ''}">
  <p class="mcard-k">${esc(kicker)}${teamLabel ? `<span class="mcard-team">${esc(teamLabel)}</span>` : ''}</p>
  <p class="mcard-date"><time datetime="${esc(m.date)}${m.time ? 'T' + esc(fmtTime(m.time)) : ''}">${fmtDay(m.date)} ${fmtDate(m.date)}${m.time ? ' · ' + esc(fmtTime(m.time)) : ''}</time></p>
  <div class="mcard-row">${h}${mid}${a}</div>
  <p class="mcard-meta"><span class="ha ${m.home ? 'ha--h' : 'ha--a'}">${m.home ? 'Doma' : 'Vonku'}</span>${m.league ? `<span>${esc(m.league)}</span>` : ''}</p>${h2h}${media}
</article>`;
}

export function matchCentre(list, today, crest, root = '') {
  const { past, next } = splitMatches(list, today);
  return [
    matchCard(past[past.length - 1], { kicker: 'Posledný zápas', crest, root }),
    matchCard(next[0], { kicker: 'Najbližší zápas', crest, list, root }),
    matchCard(next[1], { kicker: 'Ďalší zápas', crest, list, root }),
  ].join('');
}

export function matchRow(m, { crest, teamLabel, today, root = '' }) {
  const s = scoreFor(m);
  const [h, a] = sides(m, crest);
  const mid = s
    ? `<span class="mscore mscore--sm"><b>${s.a}</b><i>:</i><b>${s.b}</b></span>`
    : isPast(m, today) ? '<span class="mscore mscore--sm mscore--na"><b>–</b><i>:</i><b>–</b></span>' : `<span class="mtime mtime--sm">${esc(fmtTime(m.time) || '–')}</span>`;
  const media = s ? mediaHTML(m, root) : '';
  return `<li class="mrow${s ? ' mrow--' + s.res : ''}" data-team="${esc(m.team)}" data-ha="${m.home ? 'h' : 'a'}">
  <p class="mrow-date"><b>${fmtDay(m.date)}</b> ${fmtDate(m.date)}${teamLabel ? `<span class="mrow-team">${esc(teamLabel)}</span>` : ''}</p>
  <div class="mrow-main">${h}${mid}${a}</div>
  <p class="mrow-meta"><span>${m.home ? 'Doma' : 'Vonku'}${m.league ? ` · ${esc(m.league)}` : ''}</span>${m.note ? `<span class="mrow-note">${esc(m.note)}</span>` : ''}${media}</p>
</li>`;
}

export function matchList(list, opts) {
  if (!list.length) return '<p class="empty">Zápasy zatiaľ nie sú zverejnené.</p>';
  let out = '', month = '';
  for (const m of list) {
    const mo = fmtMonth(m.date);
    if (mo !== month) { if (month) out += '</ol>'; out += `<h3 class="mlist-month">${mo}</h3><ol class="mlist">`; month = mo; }
    out += matchRow(m, { ...opts, teamLabel: opts.labels ? opts.labels[m.team] : null });
  }
  return out + '</ol>';
}
