// Správanie webu OK Častkovce (bez knižníc).
import { matchCentre, matchList, splitMatches, todayISO } from './shared.mjs';

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

// ---- filter zápasov podľa kategórie ----
const filter = $('[data-match-filter]');
if (filter) {
  const chips = $$('.chip', filter);
  const apply = (team) => {
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.filter === team)));
    $$('.mlist-wrap').forEach((wrap) => {
      $$('.mrow', wrap).forEach((r) => { r.hidden = !!team && r.dataset.team !== team; });
      $$('.mlist', wrap).forEach((ol) => {
        const any = $$('.mrow', ol).some((r) => !r.hidden);
        ol.hidden = !any;
        const h = ol.previousElementSibling;
        if (h && h.classList.contains('mlist-month')) h.hidden = !any;
      });
    });
    const u = new URL(location.href);
    if (team) u.searchParams.set('kategoria', team); else u.searchParams.delete('kategoria');
    history.replaceState(null, '', u);
  };
  chips.forEach((c) => c.addEventListener('click', () => apply(c.dataset.filter)));
  const start = new URL(location.href).searchParams.get('kategoria');
  if (start && chips.some((c) => c.dataset.filter === start)) apply(start);
}

// ---- fotky na celú obrazovku ----
$$('[data-lightbox]').forEach((grid) => {
  const dlg = $('#lb');
  if (!dlg || !dlg.showModal) return;
  const links = $$('a', grid);
  const img = $('.lb-img', dlg);
  const cap = $('.lb-c', dlg);
  let i = 0;
  const show = (n) => {
    i = (n + links.length) % links.length;
    img.src = links[i].href;
    img.alt = $('img', links[i]).alt;
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

// ---- video (YouTube sa načíta až po kliknutí) ----
const vdlg = $('#vdlg');
if (vdlg && vdlg.showModal) {
  const frame = $('.vdlg-frame', vdlg);
  $$('.vplay').forEach((b) => b.addEventListener('click', () => {
    frame.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(b.dataset.yt)}?autoplay=1&rel=0" title="${b.dataset.title.replace(/"/g, '&quot;')}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    $('.vdlg-t', vdlg).textContent = b.dataset.title;
    vdlg.showModal();
  }));
  const stop = () => { frame.innerHTML = ''; };
  vdlg.addEventListener('close', stop);
  $('[data-close]', vdlg).addEventListener('click', () => vdlg.close());
  vdlg.addEventListener('click', (e) => { if (e.target === vdlg) vdlg.close(); });
}

// ---- čerstvé zápasy zo Supabase (ak je nastavená) ----
async function refreshMatches() {
  const db = window.OKC_DB;
  if (!db || !db.url || !db.key || new URLSearchParams(location.search).has('nodb')) return;
  const grids = $$('.mc-grid[data-team]');
  const lists = $$('.mlist-wrap[data-list]');
  if (!grids.length && !lists.length) return;
  try {
    const r = await fetch(`${db.url}/rest/v1/zapasy?select=id,tim,datum,cas,super,doma,liga,skore,poznamka&order=datum.asc,cas.asc`, { headers: { apikey: db.key, Authorization: `Bearer ${db.key}` } });
    if (!r.ok) return;
    const rows = await r.json();
    const all = rows.map((m) => ({ id: m.id, team: m.tim, date: m.datum, time: m.cas, opponent: m.super, home: m.doma, league: m.liga, score: m.skore, note: m.poznamka }));
    const today = todayISO();
    const labels = Object.fromEntries($$('.chip[data-filter]').filter((c) => c.dataset.filter).map((c) => [c.dataset.filter, c.textContent.trim()]));
    grids.forEach((g) => { g.innerHTML = matchCentre(all.filter((m) => m.team === g.dataset.team), today, db.crest); });
    lists.forEach((w) => {
      const own = w.dataset.team ? all.filter((m) => m.team === w.dataset.team) : all;
      const { past, next } = splitMatches(own, today);
      w.innerHTML = matchList(w.dataset.list === 'next' ? next : [...past].reverse(), { crest: db.crest, labels: w.dataset.team ? null : labels, today });
    });
    const active = $('.chip[aria-pressed="true"]');
    if (active && active.dataset.filter) active.click();
  } catch { /* zostanú dáta z buildu */ }
}
refreshMatches();
