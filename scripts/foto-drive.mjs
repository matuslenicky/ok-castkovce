// Fotky od fotografa z verejného priečinka Disku Google -> media/foto-orig/<cesta na Disku>
// node scripts/foto-drive.mjs <idPriečinka> [regex na cestu]   (napr. "TÍMOVÉ FOTENIE/.*\.jpg$|^ŠTADIÓN/.*\.jpe?g$")
// Zoznam celého priečinka sa uloží do media/foto-orig/zoznam.json. Stiahnuté súbory sú nedôveryhodné:
// spracúva ich len scripts/photos.py spúšťaný cez python -I.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'media', 'foto-orig');
const [folder, pattern] = process.argv.slice(2);
if (!folder) { console.error('chýba id priečinka'); process.exit(1); }
const want = pattern ? new RegExp(pattern, 'i') : null;

const decode = (s) => s.replace(/\\x([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\\//g, '/').replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
async function list(id) {
  const html = await (await fetch(`https://drive.google.com/drive/folders/${id}`)).text();
  const m = html.match(/_DRIVE_ivd'\] = '([^']*)'/);
  if (!m) return [];
  // Google escapuje aj znaky, ktoré JSON nepozná (napr. „\=“) – tie odstrániť
  const data = JSON.parse(decode(m[1]).replace(/\\([^"\\/bfnrtu])/g, '$1'));
  return (data[0] || []).map((x) => ({ id: x[0], name: x[2], mime: x[3], size: Number(x[13]) || null }));
}
const all = [];
async function walk(id, parts) {
  for (const it of await list(id)) {
    const p = [...parts, it.name];
    if (it.mime === 'application/vnd.google-apps.folder') await walk(it.id, p);
    else all.push({ ...it, path: p.join('/') });
  }
}
await walk(folder, []);
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'zoznam.json'), JSON.stringify(all, null, 1));
console.log('súborov na Disku:', all.length, '·', Math.round(all.reduce((a, x) => a + (x.size || 0), 0) / 1e6), 'MB');

// bezpečná lokálna cesta: žiadne „..“, absolútne cesty ani zvláštne znaky v mene
const safe = (p) => p.split('/').map((s) => s.replace(/[<>:"\\|?*\x00-\x1f]/g, '_').replace(/^\.+$/, '_')).join(path.sep);
const todo = all.filter((f) => (!want || want.test(f.path)) && /^image\/|^application\/pdf$/.test(f.mime));
let done = 0, skipped = 0;
async function get(f) {
  const dest = path.join(OUT, safe(f.path));
  if (!dest.startsWith(OUT + path.sep)) throw new Error('cesta mimo priečinka: ' + f.path);
  if (fs.existsSync(dest) && (!f.size || fs.statSync(dest).size === f.size)) { skipped++; return; }
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`https://drive.usercontent.google.com/download?id=${encodeURIComponent(f.id)}&export=download&confirm=t`).catch(() => null);
    const type = r?.headers.get('content-type') || '';
    if (r?.ok && !type.startsWith('text/html')) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
      done++;
      return;
    }
  }
  console.warn('nepodarilo sa stiahnuť', f.path);
}
const queue = [...todo];
await Promise.all(Array.from({ length: 4 }, async () => { while (queue.length) await get(queue.shift()); }));
console.log(`stiahnuté ${done}, už boli ${skipped}, vybraných ${todo.length}`);
