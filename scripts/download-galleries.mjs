// Dotiahne chýbajúce fotky galérií zo starého webu do media/galerie/<slug>/ (už stiahnuté preskočí).
// node scripts/download-galleries.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const B = 'https://okcastkovce.sk';
const gals = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'galerie.json'), 'utf8'));
const MEDIA = path.join(ROOT, 'media', 'galerie');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchImg(url) {
  // starý server niekedy prvú požiadavku na zmenšeninu vráti 404, preto pár pokusov
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url);
    const type = r.headers.get('content-type') || '';
    if (r.ok && type.startsWith('image/')) return Buffer.from(await r.arrayBuffer());
    await sleep(800 * (i + 1));
  }
  throw new Error('nepodarilo sa');
}

let ok = 0, fail = 0;
for (const g of gals) {
  const dir = path.join(MEDIA, g.slug);
  fs.mkdirSync(dir, { recursive: true });
  // názov galérie alebo súboru zo starého webu nesmie viesť mimo media/galerie („..“)
  const missing = g.files.filter((f) => path.resolve(dir, f).startsWith(MEDIA + path.sep) && !fs.existsSync(path.join(dir, f)));
  if (!missing.length) continue;
  for (const f of missing) {
    try {
      fs.writeFileSync(path.join(dir, f), await fetchImg(encodeURI(`${B}/img${g.path}/${f}`) + '?size=lg'));
      ok++;
    } catch (e) { fail++; console.warn('chýba', g.slug, f, e.message); }
  }
  console.log('galéria', g.slug, 'hotová');
}
console.log(`HOTOVO stiahnuté ${ok}, chyby ${fail}`);
