# OK Častkovce – návrh nového webu

Návrh redizajnu webu futbalového klubu OK Častkovce. **Nie je to oficiálna stránka klubu**, tá je na [okcastkovce.sk](https://okcastkovce.sk/). Ukážka má v hlavičke žltý pás s týmto upozornením a vyhľadávače ju neindexujú (`noindex`).

Ukážka: https://matuslenicky.github.io/ok-castkovce/

## Obsah a zdroje

- Texty, zápasy, súpisky, správy, videá a galérie sú prevzaté zo starého webu okcastkovce.sk bez zmeny (`scripts/import-old-site.mjs` → `data/*.json`). Tréneri v `data/treneri.json` sú doslovne zo stránky Vedenie klubu.
- Erb, fotografie a texty patria klubu OK Častkovce.
- Písmo Barlow a Barlow Condensed, licencia SIL Open Font License 1.1.

## Zostavenie

Statický generátor bez závislostí (Node 20+, Python 3 s Pillow na obrázky):

```
node scripts/import-old-site.mjs        # obsah zo starého webu do data/
node scripts/download-galleries.mjs     # originály galérií do media/galerie (nie sú v repozitári)
python -I scripts/images.py             # webp zmenšeniny: media/galerie-web, src/img/opt, src/img/video
node build.js                           # data/ + src/ -> dist/ (TODAY=2026-11-03 prepíše dnešný dátum)
node scripts/serve.mjs dist 5260        # náhľad na http://127.0.0.1:5260/
node scripts/deploy.mjs                 # nasadenie dist/ na vetvu gh-pages (GitHub Pages)
```

`config.json`: `ukazka` zapína pás „Návrh webu“, `noindex` zakazuje indexovanie, `galerie.mode` určuje, odkiaľ sa berú fotky galérií.
