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

export function matchCard(m, { kicker, crest, teamLabel }) {
  if (!m) {
    return `<article class="mcard mcard--empty"><p class="mcard-k">${esc(kicker)}</p><p class="mcard-none">Zápas zatiaľ nie je v rozpise.</p></article>`;
  }
  const [h, a] = sides(m, crest);
  const s = scoreFor(m);
  const mid = s
    ? `<span class="mscore" aria-label="výsledok ${s.a} : ${s.b}"><b>${s.a}</b><i>:</i><b>${s.b}</b></span>`
    : m.date && kicker === 'Posledný zápas'
      ? '<span class="mscore mscore--na" aria-label="výsledok nie je zapísaný"><b>–</b><i>:</i><b>–</b></span>'
      : `<span class="mtime">${esc(fmtTime(m.time) || '–')}</span>`;
  return `<article class="mcard${s ? ' mcard--res mcard--' + s.res : ''}">
  <p class="mcard-k">${esc(kicker)}${teamLabel ? `<span class="mcard-team">${esc(teamLabel)}</span>` : ''}</p>
  <p class="mcard-date"><time datetime="${esc(m.date)}${m.time ? 'T' + esc(fmtTime(m.time)) : ''}">${fmtDay(m.date)} ${fmtDate(m.date)}${m.time ? ' · ' + esc(fmtTime(m.time)) : ''}</time></p>
  <div class="mcard-row">${h}${mid}${a}</div>
  <p class="mcard-meta"><span class="ha ${m.home ? 'ha--h' : 'ha--a'}">${m.home ? 'Doma' : 'Vonku'}</span>${m.league ? `<span>${esc(m.league)}</span>` : ''}</p>
</article>`;
}

export function matchCentre(list, today, crest) {
  const { past, next } = splitMatches(list, today);
  return [
    matchCard(past[past.length - 1], { kicker: 'Posledný zápas', crest }),
    matchCard(next[0], { kicker: 'Najbližší zápas', crest }),
    matchCard(next[1], { kicker: 'Ďalší zápas', crest }),
  ].join('');
}

export function matchRow(m, { crest, teamLabel, today }) {
  const s = scoreFor(m);
  const [h, a] = sides(m, crest);
  const mid = s
    ? `<span class="mscore mscore--sm"><b>${s.a}</b><i>:</i><b>${s.b}</b></span>`
    : isPast(m, today) ? '<span class="mscore mscore--sm mscore--na"><b>–</b><i>:</i><b>–</b></span>' : `<span class="mtime mtime--sm">${esc(fmtTime(m.time) || '–')}</span>`;
  return `<li class="mrow${s ? ' mrow--' + s.res : ''}" data-team="${esc(m.team)}">
  <p class="mrow-date"><b>${fmtDay(m.date)}</b> ${fmtDate(m.date)}${teamLabel ? `<span class="mrow-team">${esc(teamLabel)}</span>` : ''}</p>
  <div class="mrow-main">${h}${mid}${a}</div>
  <p class="mrow-meta">${m.league ? esc(m.league) : ''}${m.note ? `<span class="mrow-note">${esc(m.note)}</span>` : ''}</p>
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
