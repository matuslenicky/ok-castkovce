// Nasadí dist/ na GitHub Pages (vetva gh-pages) a potom zostaví web znova pre lokálny náhľad.
// node scripts/deploy.mjs            (repozitár musí mať remote origin)
// Zdrojáky sú na vetve main; gh-pages obsahuje len hotový web vrátane galérií z media/galerie-web.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = path.join(ROOT, '.pages'); // pracovný strom vetvy gh-pages (v .gitignore)
const BASE = process.env.BASE_PATH || '/ok-castkovce/';
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit', ...opts });
const out = (cmd, args, cwd = ROOT) => execFileSync(cmd, args, { cwd, encoding: 'utf8' }).trim();

// 0. čerstvé výsledky zo Sportnetu: ručné nasadenie nesmie prepísať novšie výsledky z automatickej hodinovej aktualizácie
//    (.github/workflows/sportnet.yml ich stiahne sám a spúšťa nasadenie so SKIP_SPORTNET=1)
if (!process.env.SKIP_SPORTNET) {
  try { run(process.execPath, ['scripts/sportnet.mjs']); } catch { console.warn('Sportnet nie je dostupný – nasadzujem s uloženými výsledkami'); }
}

// 1. zostavenie s cestou projektu na github.io (týka sa 404.html)
run(process.execPath, ['build.js'], { env: { ...process.env, BASE_PATH: BASE } });

// 2. pracovný strom gh-pages
if (!fs.existsSync(path.join(PAGES, '.git'))) {
  const remote = out('git', ['ls-remote', '--heads', 'origin', 'gh-pages']);
  if (remote) {
    run('git', ['fetch', 'origin', 'gh-pages:gh-pages']);
    run('git', ['worktree', 'add', PAGES, 'gh-pages']);
  } else {
    run('git', ['worktree', 'add', '--orphan', '-b', 'gh-pages', PAGES]);
  }
}

// gh-pages sa mohla medzitým zmeniť (automatická aktualizácia výsledkov): začať od jej stavu na GitHube, inak push zlyhá
run('git', ['fetch', '-q', ...(process.env.CI ? ['--depth', '1'] : []), 'origin', 'gh-pages'], { cwd: PAGES });
run('git', ['reset', '-q', '--hard', 'FETCH_HEAD'], { cwd: PAGES });

// 3. obsah = presne dist/
for (const f of fs.readdirSync(PAGES)) if (f !== '.git') fs.rmSync(path.join(PAGES, f), { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'dist'), PAGES, { recursive: true });
fs.writeFileSync(path.join(PAGES, '.nojekyll'), '');

// 4. commit a push (len keď sa niečo zmenilo)
const src = out('git', ['rev-parse', '--short', 'HEAD']);
run('git', ['add', '-A'], { cwd: PAGES });
if (out('git', ['status', '--porcelain'], PAGES)) {
  run('git', ['commit', '-q', '-m', process.env.DEPLOY_MSG || `Nasadenie webu zo zdroja ${src}`], { cwd: PAGES });
  run('git', ['push', '-u', 'origin', 'gh-pages'], { cwd: PAGES });
} else {
  console.log('gh-pages je aktuálna, nič na nasadenie');
}

// 5. lokálny náhľad zase s koreňovou cestou (na GitHub Actions netreba)
if (!process.env.CI) run(process.execPath, ['build.js'], { env: { ...process.env, BASE_PATH: '' } });
