// Správanie webu OK Častkovce (bez knižníc).
import { matchCentre, matchList, splitMatches, todayISO, formHTML, weekHTML, nextHTML, todayMatches, countdownParts, countdownText } from './shared.mjs';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// ---- menu ----
const burger = $('.burger');
const nav = $('#menu');
if (burger && nav) {
  const setOpen = (open) => {
    burger.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('open', open);
    document.body.classList.toggle('menu-open', open);
    // stránka pod otvoreným menu nesmie dostať fokus (Tab by inak odišiel za prekrytie)
    [$('main'), $('.ftr'), $('.topbar'), $('.skip')].forEach((el) => { if (el) el.inert = open; });
  };
  burger.addEventListener('click', () => setOpen(burger.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('open')) { setOpen(false); burger.focus(); } });
  matchMedia('(min-width: 1100px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });
}
const subBtns = $$('.sub-btn');
const wide = matchMedia('(min-width: 1100px)');
const setSub = (b, open) => {
  b.setAttribute('aria-expanded', String(open));
  document.getElementById(b.getAttribute('aria-controls')).classList.toggle('open', open);
};
subBtns.forEach((b) => {
  const li = b.closest('.has-sub');
  b.addEventListener('click', () => {
    const open = b.getAttribute('aria-expanded') !== 'true';
    if (wide.matches) subBtns.forEach((o) => { if (o !== b) setSub(o, false); });
    li.classList.remove('sub-off');
    setSub(b, open);
  });
  // desktop: Escape skryje podmenu aj otvorené prejdením myšou/fokusom (WCAG 1.4.13), fokus ostane na šípke
  li.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !wide.matches) return; // mobil: Escape zavrie celé menu (vyššie)
    e.stopPropagation();
    setSub(b, false);
    li.classList.add('sub-off');
    b.focus();
  });
  li.addEventListener('mouseleave', () => li.classList.remove('sub-off'));
  li.addEventListener('focusout', (e) => {
    if (!wide.matches || li.contains(e.relatedTarget)) return;
    setSub(b, false);
    li.classList.remove('sub-off');
  });
});
document.addEventListener('click', (e) => {
  if (wide.matches) subBtns.forEach((b) => { if (!b.closest('.has-sub').contains(e.target)) setSub(b, false); });
});

// ---- podnavigácia: aktuálna položka má byť na úzkom displeji vidieť ----
const subCur = $('.subnav a[aria-current]');
if (subCur) {
  const w = subCur.parentElement;
  if (w.scrollWidth > w.clientWidth) w.scrollLeft += subCur.getBoundingClientRect().left - w.getBoundingClientRect().left - (w.clientWidth - subCur.offsetWidth) / 2;
}

// ---- záložky (zápasy na úvode) ----
$$('[role="tablist"]').forEach((list) => {
  const tabs = $$('[role="tab"]', list);
  const select = (tab, focus) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
    tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (k) { e.preventDefault(); select(tabs[(i + k + tabs.length) % tabs.length], true); }
      if (e.key === 'Home') { e.preventDefault(); select(tabs[0], true); }
      if (e.key === 'End') { e.preventDefault(); select(tabs[tabs.length - 1], true); }
    });
  });
});

// ---- vodorovné pásy kariet ----
$$('[data-rail]').forEach((rail) => {
  const track = $('.rail-track', rail);
  const navEl = $('.rail-nav', rail);
  const [prev, next] = $$('.rail-btn', rail);
  const update = () => {
    const max = track.scrollWidth - track.clientWidth;
    navEl.hidden = max < 8;
    prev.disabled = track.scrollLeft < 8;
    next.disabled = track.scrollLeft > max - 8;
  };
  $$('.rail-btn', rail).forEach((b) => b.addEventListener('click', () => {
    track.scrollBy({ left: Number(b.dataset.dir) * track.clientWidth * 0.9, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }));
  track.addEventListener('scroll', update, { passive: true });
  new ResizeObserver(update).observe(track);
  update();
});

// ---- kalendár zápasov: odber cez webcal a Google Kalendár (potrebujú úplnú adresu .ics) ----
const setCal = (box, file) => {
  const ics = $('[data-ics]', box);
  if (file) ics.href = ics.href.replace(/[^/]+\.ics$/, file);
  const abs = new URL(ics.getAttribute('href'), location.href);
  if (!/^https?:$/.test(abs.protocol)) return;
  const webcal = abs.href.replace(/^https?:/, 'webcal:');
  const w = $('[data-webcal]', box), g = $('[data-gcal]', box);
  w.href = webcal; w.hidden = false;
  g.href = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`; g.hidden = false;
};
$$('[data-cal]').forEach((box) => setCal(box));
document.addEventListener('click', (e) => { $$('[data-cal][open]').forEach((d) => { if (!d.contains(e.target)) d.open = false; }); });
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  $$('[data-cal][open]').forEach((d) => { d.open = false; $('summary', d).focus(); });
});

// ---- filter zápasov: kategória a doma/vonku ----
const filter = $('[data-match-filter]');
const state = { team: '', ha: '' };
// zoznamy zápasov po častiach: prvých 8, potom po 12 (na mobile by inak stránka mala desiatky tisíc pixelov)
const FIRST = 8, STEP = 12;
const limits = new WeakMap();
function layoutList(wrap) {
  const rows = $$('.mrow', wrap);
  const fits = rows.filter((r) => (!state.team || r.dataset.team === state.team) && (!state.ha || r.dataset.ha === state.ha));
  const limit = limits.get(wrap) || FIRST;
  rows.forEach((r) => { r.hidden = true; });
  fits.slice(0, limit).forEach((r) => { r.hidden = false; });
  $$('.mlist', wrap).forEach((ol) => {
    const any = $$('.mrow', ol).some((r) => !r.hidden);
    ol.hidden = !any;
    const h = ol.previousElementSibling;
    if (h && h.classList.contains('mlist-month')) h.hidden = !any;
  });
  let none = $('.mlist-none', wrap);
  const empty = rows.length && !fits.length;
  if (empty && !none) { none = document.createElement('p'); none.className = 'empty mlist-none'; none.textContent = 'Pre tento výber tu nie je žiadny zápas.'; wrap.append(none); }
  if (none) none.hidden = !empty;
  let more = wrap.nextElementSibling?.classList.contains('mlist-more') ? wrap.nextElementSibling : null;
  const rest = fits.length - Math.min(limit, fits.length);
  if (rest > 0 && !more) {
    more = document.createElement('button');
    more.type = 'button';
    more.className = 'btn btn--line-dark btn--sm mlist-more';
    more.addEventListener('click', () => {
      const before = new Set($$('.mrow:not([hidden])', wrap));
      limits.set(wrap, (limits.get(wrap) || FIRST) + STEP);
      layoutList(wrap);
      // posledné načítanie tlačidlo skryje: fokus by spadol na <body>, presunie sa na prvý pridaný zápas
      if (more.hidden) {
        const first = $$('.mrow:not([hidden])', wrap).find((r) => !before.has(r));
        if (first) { first.tabIndex = -1; first.focus({ preventScroll: true }); }
      }
    });
    wrap.after(more);
  }
  if (more) {
    more.hidden = rest <= 0;
    more.textContent = rest === 1 ? 'Zobraziť ďalší zápas' : `Zobraziť ďalšie zápasy (${rest})`;
  }
}
const layoutLists = (reset) => $$('.mlist-wrap').forEach((w) => { if (reset) limits.delete(w); layoutList(w); });
// HTML zoznamov z buildu pred skrátením: layoutList mení atribúty hidden, takže innerHTML sa už s novým výpočtom
// nedá porovnať a refreshMatches by zoznamy zbytočne prekreslil (na /zapasy/ stovky riadkov, drobný posun obsahu)
const rendered = new WeakMap();
$$('.mlist-wrap').forEach((w) => rendered.set(w, w.innerHTML));
layoutLists();
const applyFilter = () => {
  if (!filter) return;
  $$('.chip[data-filter]', filter).forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.filter === state.team)));
  $$('.chip[data-ha]', filter).forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.ha === state.ha)));
  layoutLists(true);
  const box = $('[data-cal]', filter);
  if (box) setCal(box, state.team ? `${state.team}.ics` : 'vsetky.ics');
  const u = new URL(location.href);
  if (state.team) u.searchParams.set('kategoria', state.team); else u.searchParams.delete('kategoria');
  if (state.ha) u.searchParams.set('kde', state.ha === 'h' ? 'doma' : 'vonku'); else u.searchParams.delete('kde');
  history.replaceState(null, '', u);
};
if (filter) {
  $$('.chip[data-filter]', filter).forEach((c) => c.addEventListener('click', () => { state.team = c.dataset.filter; applyFilter(); }));
  $$('.chip[data-ha]', filter).forEach((c) => c.addEventListener('click', () => { state.ha = c.dataset.ha; applyFilter(); }));
  const q = new URL(location.href).searchParams;
  if ($$('.chip[data-filter]', filter).some((c) => c.dataset.filter === q.get('kategoria'))) state.team = q.get('kategoria');
  state.ha = { doma: 'h', vonku: 'a' }[q.get('kde')] || '';
  if (state.team || state.ha) applyFilter();
  // odkaz s ?kategoria=: zvolená kategória má byť vidieť aj v posúvateľnom riadku na mobile (bez posunu stránky)
  const on = $('.chip[data-filter][aria-pressed="true"]', filter);
  const row = on && on.parentElement;
  if (state.team && row.scrollWidth > row.clientWidth) row.scrollLeft += on.getBoundingClientRect().left - row.getBoundingClientRect().left - (row.clientWidth - on.offsetWidth) / 2;
}
// odkaz s filtrom: zoznamy boli do prefiltrovania skryté (inline skript v <head>), aby neposkočili (CLS)
document.documentElement.classList.remove('js-filtering');

// ---- fotky produktu vo fanshope: posúvanie ako príspevok na IG (bodky, počítadlo, šípky na počítači) ----
$$('[data-gal]').forEach((gal) => {
  const track = $('.prod-track', gal);
  const n = track.children.length;
  const dots = $$('.prod-dots i', gal), count = $('.prod-count', gal);
  const prev = $('.prod-prev', gal), next = $('.prod-next', gal);
  let cur = 0;
  const set = () => {
    const i = Math.round(track.scrollLeft / track.clientWidth);
    if (i === cur && count.textContent) return;
    cur = Math.max(0, Math.min(n - 1, i));
    dots.forEach((d, k) => d.classList.toggle('on', k === cur));
    count.textContent = `${cur + 1}/${n}`;
    prev.disabled = cur === 0;
    next.disabled = cur === n - 1;
  };
  const go = (d) => track.scrollTo({ left: (cur + d) * track.clientWidth, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  track.addEventListener('scroll', () => requestAnimationFrame(set), { passive: true });
  track.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { e.preventDefault(); go(1); } if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); } });
});

// ---- dlhé mriežky (galérie) po častiach: data-paged="12" ----
$$('[data-paged]').forEach((grid) => {
  const step = Number(grid.dataset.paged) || 12;
  const items = [...grid.children];
  if (items.length <= step) return;
  let shown = step;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn--line-dark btn--sm mlist-more grid-more';
  const show = () => {
    items.forEach((el, i) => { el.hidden = i >= shown; });
    const rest = items.length - shown;
    btn.hidden = rest <= 0;
    btn.textContent = `${grid.dataset.more || 'Zobraziť ďalšie'} (${rest})`;
  };
  btn.addEventListener('click', () => {
    const first = items[shown];
    shown += step;
    show();
    // fokus na prvú pridanú položku (inak by po skrytí tlačidla padol na <body>)
    const link = first && first.querySelector('a, button');
    if (link) link.focus({ preventScroll: true });
  });
  grid.after(btn);
  show();
});

// ---- zdieľanie správy ----
$$('[data-share]').forEach((p) => {
  const btn = $('button', p), msg = $('.share-msg', p);
  p.hidden = false;
  btn.addEventListener('click', async () => {
    const data = { title: document.title, url: location.href.split('#')[0] };
    if (navigator.share) { try { await navigator.share(data); } catch { /* zrušené */ } return; }
    try { await navigator.clipboard.writeText(data.url); msg.textContent = 'Odkaz je skopírovaný.'; } catch { msg.textContent = data.url; }
  });
});

// ---- odpočet do výkopu (každých 30 s, bez animácie) ----
const tick = () => {
  $$('.cd[data-kickoff]').forEach((el) => {
    const p = countdownParts(new Date(el.dataset.kickoff).getTime() - Date.now());
    const b = $$('b', el);
    if (b.length === 3) { b[0].textContent = p.d; b[0].nextSibling.textContent = p.d === 1 ? 'deň' : p.d >= 2 && p.d <= 4 ? 'dni' : 'dní'; b[1].textContent = String(p.h).padStart(2, '0'); b[2].textContent = String(p.m).padStart(2, '0'); }
    el.setAttribute('aria-label', `Do výkopu ${countdownText(p)}`);
  });
};
if ($('.cd[data-kickoff]')) setInterval(tick, 30000);

// ---- fotky na celú obrazovku ----
$$('[data-lightbox]').forEach((grid) => {
  const dlg = $('#lb');
  if (!dlg || !dlg.showModal) return;
  // vo fanshope otvára fotku len odkaz „Leták“ (data-lb), nie „Objednať“
  const links = $$('a[data-lb]', grid).length ? $$('a[data-lb]', grid) : $$('a', grid);
  const img = $('.lb-img', dlg);
  const cap = $('.lb-c', dlg);
  let i = 0;
  const show = (n) => {
    i = (n + links.length) % links.length;
    img.src = links[i].href;
    img.alt = $('img', links[i])?.alt || `Leták: ${links[i].textContent.replace(/^Leták:?\s*/, '').trim()}`;
    cap.textContent = `${i + 1} / ${links.length}`;
  };
  links.forEach((a, n) => a.addEventListener('click', (e) => { e.preventDefault(); show(n); dlg.showModal(); }));
  $('.lb-prev', dlg).addEventListener('click', () => show(i - 1));
  $('.lb-next', dlg).addEventListener('click', () => show(i + 1));
  $('[data-close]', dlg).addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') show(i - 1); if (e.key === 'ArrowRight') show(i + 1); });
  let x0 = null;
  dlg.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  dlg.addEventListener('touchend', (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1)); x0 = null; });
});

// ---- video (YouTube sa načíta až po kliknutí; delegované, lebo riadky zápasov sa prekresľujú) ----
const vdlg = $('#vdlg');
if (vdlg && vdlg.showModal) {
  const frame = $('.vdlg-frame', vdlg);
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.vplay');
    if (!b) return;
    frame.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(b.dataset.yt)}?autoplay=1&rel=0" title="${b.dataset.title.replace(/"/g, '&quot;')}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    $('.vdlg-t', vdlg).textContent = b.dataset.title;
    vdlg.showModal();
  });
  const stop = () => { frame.innerHTML = ''; };
  vdlg.addEventListener('close', stop);
  $('[data-close]', vdlg).addEventListener('click', () => vdlg.close());
  vdlg.addEventListener('click', (e) => { if (e.target === vdlg) vdlg.close(); });
}

// ---- zápasy podľa dnešného dátumu ----
// Stránky sú zostavené k dátumu buildu; prehliadač si rozpis načíta (Supabase, ak je nastavená, inak data/zapasy.json)
// a „najbližší zápas“, „tento týždeň“, formu a zoznamy prepočíta k dnešku. Keď sa nič nezmenilo, nič neprekresľuje.
const ROOT = document.documentElement.dataset.root || './';
const CREST = `${ROOT}img/logo.svg`;
async function loadMatches() {
  const db = window.OKC_DB;
  if (db && db.url && db.key && !new URLSearchParams(location.search).has('nodb')) {
    const r = await fetch(`${db.url}/rest/v1/zapasy?select=id,tim,datum,cas,super,doma,liga,skore,poznamka&order=datum.asc,cas.asc`, { headers: { apikey: db.key, Authorization: `Bearer ${db.key}` } });
    if (r.ok) return { matches: (await r.json()).map((m) => ({ id: m.id, team: m.tim, date: m.datum, time: m.cas, opponent: m.super, home: m.doma, league: m.liga, score: m.skore, note: m.poznamka })) };
  }
  const r = await fetch(`${ROOT}data/zapasy.json`);
  return r.ok ? r.json() : null;
}
// porovnáva sa serializované HTML (prehliadač zapisuje <path …/> ako <path …></path>, surový reťazec by sa nezhodol nikdy)
const tpl = document.createElement('template');
const setHTML = (el, html) => {
  tpl.innerHTML = html;
  const next = tpl.innerHTML;
  const prev = rendered.has(el) ? rendered.get(el) : el.innerHTML;
  rendered.set(el, next);
  if (prev !== next) el.innerHTML = html;
};
async function refreshMatches() {
  const targets = $$('.mc-grid[data-team], .mlist-wrap[data-list], [data-form], [data-week], [data-next], [data-matchday]');
  if (!targets.length) return;
  let data;
  try { data = await loadMatches(); } catch { return; } // zostanú dáta z buildu
  if (!data || !data.matches) return;
  const all = data.matches;
  const today = todayISO();
  const teams = data.teams || {};
  const labels = Object.fromEntries(Object.entries(teams).map(([k, t]) => [k, t.short]));
  const own = (slug) => all.filter((m) => m.team === slug);
  $$('.mc-grid[data-team]').forEach((g) => setHTML(g, matchCentre(own(g.dataset.team), today, CREST, ROOT)));
  $$('[data-form]').forEach((el) => setHTML(el, formHTML(own(el.dataset.form), today)));
  $$('.mlist-wrap[data-list]').forEach((w) => {
    const { past, next } = splitMatches(w.dataset.team ? own(w.dataset.team) : all, today);
    setHTML(w, matchList(w.dataset.list === 'next' ? next : [...past].reverse(), { crest: CREST, labels: w.dataset.team ? null : labels, today, root: ROOT }));
  });
  $$('[data-week]').forEach((el) => setHTML(el, weekHTML(all, today, { labels, urls: Object.fromEntries(Object.entries(teams).map(([k, t]) => [k, t.url])), root: ROOT })));
  $$('[data-next]').forEach((el) => { const html = nextHTML(own(el.dataset.next), today, { label: el.dataset.label, root: ROOT }); setHTML(el, html); el.hidden = !html; });
  $$('[data-matchday]').forEach((el) => {
    const n = todayMatches(all, today).length;
    el.hidden = !n;
    $('[data-matchday-t]', el).textContent = `Dnes hráme${n > 1 ? ` · ${n} ${n >= 5 ? 'zápasov' : 'zápasy'}` : ''}`;
  });
  if (filter && (state.team || state.ha)) applyFilter(); else layoutLists();
  tick();
}
refreshMatches();
