// Portréty hráčov od fotografa (verejný priečinok Disku, súbory „Meno_Priezvisko.jpg“) -> media/foto-orig/hraci/<tím>/
// node scripts/hraci-foto.mjs <idPriečinka> <slug-tímu>        potom: python -I scripts/photos.py && node build.js
// Mená sa berú z názvov súborov; súpisku a funkcie (tréner) určuje data/doplnky.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [folder, team] = process.argv.slice(2);
if (!folder || !team) { console.error('použitie: node scripts/hraci-foto.mjs <idPriečinka> <slug-tímu>'); process.exit(1); }
const OUT = path.join(ROOT, 'media', 'foto-orig', 'hraci', team);
fs.mkdirSync(OUT, { recursive: true });

const decode = (s) => s.replace(/\\x([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\\//g, '/').replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
const html = await (await fetch(`https://drive.google.com/drive/folders/${folder}`)).text();
const m = html.match(/_DRIVE_ivd'\] = '([^']*)'/);
if (!m) { console.error('priečinok nie je verejný alebo sa nedá prečítať'); process.exit(1); }
const items = JSON.parse(decode(m[1]).replace(/\\([^"\\/bfnrtu])/g, '$1'))[0].map((x) => ({ id: x[0], name: x[2], mime: x[3] }));
// len portréty: jpg s menom „Meno_Priezvisko“ (tímová fotka a súbor na tlač sa preskočia)
const people = items.filter((f) => f.mime === 'image/jpeg' && /^[^_\s]+(_[^_\s]+)+\.jpe?g$/i.test(f.name));
const safe = (n) => n.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
for (const f of people) {
  const dest = path.join(OUT, safe(f.name));
  if (fs.existsSync(dest)) continue;
  const r = await fetch(`https://drive.usercontent.google.com/download?id=${encodeURIComponent(f.id)}&export=download&confirm=t`);
  if (!r.ok || (r.headers.get('content-type') || '').startsWith('text/html')) { console.warn('nepodarilo sa', f.name); continue; }
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
}
const names = people.map((f) => f.name.replace(/\.\w+$/, '').normalize('NFC').split('_').join(' '));
console.log(`portrétov ${people.length}: ${names.join(', ')}`);
