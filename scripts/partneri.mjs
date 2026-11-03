// Logá partnerov zo starého webu (pätička okcastkovce.sk, /api/partneri) -> src/img/archiv/partneri/ + data/partneri.json
// node scripts/partneri.mjs
// Mená partnerov starý web neuvádza; popis (alt) sa berie len z názvu súboru, inak „Partner klubu“.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src', 'img', 'archiv', 'partneri');
const B = 'https://okcastkovce.sk';
fs.mkdirSync(OUT, { recursive: true });

const r = await fetch(`${B}/api/partneri`, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
if (!r.ok) throw new Error(`${r.status} /api/partneri`);
const { partneri } = await r.json();

const nameFrom = (f) => {
  const s = f.replace(/\.\w+$/, '').replace(/^\d+[-.]?/, '').replace(/^logo[-_]?/i, '').replace(/[-_]?logo$/i, '');
  if (!s) return null;
  return s.split(/[-_]/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
};

const list = [];
for (const f of partneri) {
  if (!/^[\w.-]+\.(png|jpe?g|svg|webp)$/i.test(f)) { console.warn('preskakujem podozrivý názov', f); continue; }
  const dest = path.join(OUT, f);
  if (!fs.existsSync(dest)) {
    let buf = null;
    for (const u of [`${B}/public/partneri-footer/${f}`, `${B}/img/public/partneri-footer/${f}`]) {
      const res = await fetch(u).catch(() => null);
      const type = res?.headers.get('content-type') || '';
      if (res?.ok && type.startsWith('image/')) { buf = Buffer.from(await res.arrayBuffer()); break; }
    }
    if (!buf) { console.warn('nepodarilo sa stiahnuť', f); continue; }
    fs.writeFileSync(dest, buf);
  }
  list.push({ file: f, alt: nameFrom(f) || 'Partner klubu' });
}
// ručne doplnené popisy (prepis textu z loga) a príznak tmave z existujúceho súboru zachovať
const jf = path.join(ROOT, 'data', 'partneri.json');
const old = fs.existsSync(jf) ? JSON.parse(fs.readFileSync(jf, 'utf8')) : { partneri: [] };
const known = Object.fromEntries(old.partneri.map((p) => [p.file, p]));
const merged = list.map((p) => known[p.file] || p);
fs.writeFileSync(jf, JSON.stringify({ ...old, partneri: merged }, null, 2) + '\n');
console.log('partneri:', merged.length, 'nových:', merged.filter((p) => !known[p.file]).length);
