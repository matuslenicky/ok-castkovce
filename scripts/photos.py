# Fotky od fotografa pre web: media/foto-orig (stiahne scripts/foto-drive.mjs) -> media/foto-web + data/foto.json
#   python -I scripts/photos.py
# Kľúče, ktoré používa build.js: hero (úvod), tim-<slug> (hlavička tímu a dlaždica mládeže), stadion-*.
# Každá fotka v šírkach 480/800/1200/1600/2000 (len menšie než originál) ako webp aj jpg pre srcset.
import json
import sys
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'media' / 'foto-orig'
OUT = ROOT / 'media' / 'foto-web'
Image.MAX_IMAGE_PIXELS = 120_000_000

T = 'MLÁDEŽ/2026/2027/{}/TÍMOVÉ FOTENIE/{}.jpg'
# kľúč -> (cesta na Disku fotografa, object-position alebo None, popis)
# Kategórie na webe vs. priečinky fotografa: U15 B hrá III. ligu U15 = priečinok U14, U13 B hrá III. ligu U13 = U12,
# U7 = priečinok U8 (súbor na tlač sa v ňom volá U7_70x50cm.png).
MAP = {
    'tim-a-muzstvo': ('MUŽI/2026/2027/TÍMOVÉ FOTENIE/MUZI.jpg', None, 'A-mužstvo OK Častkovce, tímová fotka'),
    'tim-u19-starsi-dorast': (T.format('U19', 'U19'), None, 'U19 starší dorast OK Častkovce, tímová fotka'),
    'tim-u17-mladsi-dorast': (T.format('U17', 'U17'), None, 'U17 mladší dorast OK Častkovce, tímová fotka'),
    'tim-u15-starsi-ziaci': (T.format('U15', 'U15'), None, 'U15 starší žiaci OK Častkovce, tímová fotka'),
    'tim-u15-starsi-ziaci-b': (T.format('U14', 'U14'), None, 'U15 B starší žiaci OK Častkovce, tímová fotka'),
    'tim-u13-mladsi-ziaci': (T.format('U13', 'U13'), None, 'U13 mladší žiaci OK Častkovce, tímová fotka'),
    'tim-u13-mladsi-ziaci-b': (T.format('U12', 'U12'), None, 'U13 B mladší žiaci OK Častkovce, tímová fotka'),
    'tim-u11-pripravka': (T.format('U11', 'U11'), None, 'U11 prípravka OK Častkovce, tímová fotka'),
    'tim-u10-pripravka': (T.format('U10', 'U10'), None, 'U10 prípravka OK Častkovce, tímová fotka'),
    'tim-u9-pripravka': (T.format('U9', 'U9'), None, 'U9 prípravka OK Častkovce, tímová fotka'),
    'tim-u7-pripravka': (T.format('U8', 'U8'), None, 'U7 prípravka OK Častkovce, tímová fotka'),
}
# voliteľné doplnky z data/foto-vyber.json (hero, štadión…), aby sa výber dal meniť bez úpravy skriptu
extra = ROOT / 'data' / 'foto-vyber.json'
if extra.exists():
    for k, v in json.loads(extra.read_text(encoding='utf-8')).items():
        if not k.startswith('_'):
            MAP[k] = (v['subor'], v.get('pos'), v.get('alt', ''))

WIDTHS = [480, 800, 1200, 1600, 2000]
OUT.mkdir(parents=True, exist_ok=True)
fj = ROOT / 'data' / 'foto.json'
data = json.loads(fj.read_text(encoding='utf-8')) if fj.exists() else {}
obr = {}
made = 0
for key, (rel, pos, alt) in MAP.items():
    f = SRC / Path(*rel.split('/'))
    if not f.exists():
        print('chýba', rel, file=sys.stderr)
        continue
    im = None
    widths = []
    for w in WIDTHS:
        dst_w, dst_j = OUT / f'{key}-{w}.webp', OUT / f'{key}-{w}.jpg'
        if im is None:
            im = ImageOps.exif_transpose(Image.open(f)).convert('RGB')
        if w > im.width and widths:
            break
        ww = min(w, im.width)
        if not (dst_w.exists() and dst_w.stat().st_mtime >= f.stat().st_mtime and dst_j.exists()):
            r = im.resize((ww, round(im.height * ww / im.width)), Image.LANCZOS) if ww < im.width else im
            r.save(dst_w, 'WEBP', quality=76, method=5)
            r.save(dst_j, 'JPEG', quality=80, optimize=True, progressive=True)
            made += 1
        widths.append(w)
    big = widths[-1]
    hh = round(im.height * min(big, im.width) / im.width)
    obr[key] = {'widths': widths, 'w': min(big, im.width), 'h': hh, 'alt': alt, **({'pos': pos} if pos else {}), 'zdroj': rel}
    im.close()

# portréty hráčov (scripts/hraci-foto.mjs): media/foto-orig/hraci/<tím>/Meno_Priezvisko.jpg -> kľúč hrac-<tím>-<meno-priezvisko>
import re
import unicodedata
def _slug(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
for team_dir in sorted((SRC / 'hraci').glob('*')) if (SRC / 'hraci').exists() else []:
    for f in sorted(team_dir.glob('*.jp*g')):
        name = unicodedata.normalize('NFC', f.stem).replace('_', ' ')
        key = f'hrac-{team_dir.name}-{_slug(name)}'
        im = ImageOps.exif_transpose(Image.open(f)).convert('RGB')
        widths = []
        for w in (320, 640):
            ww = min(w, im.width)  # súbor aj srcset podľa skutočnej šírky (karty majú 600 px)
            w = ww
            dst_w, dst_j = OUT / f'{key}-{w}.webp', OUT / f'{key}-{w}.jpg'
            if not (dst_w.exists() and dst_w.stat().st_mtime >= f.stat().st_mtime and dst_j.exists()):
                r = im.resize((ww, round(im.height * ww / im.width)), Image.LANCZOS) if ww < im.width else im
                r.save(dst_w, 'WEBP', quality=80, method=5)
                r.save(dst_j, 'JPEG', quality=84, optimize=True, progressive=True)
                made += 1
            widths.append(w)
            if ww >= im.width:
                break
        obr[key] = {'widths': widths, 'w': min(widths[-1], im.width), 'h': round(im.height * min(widths[-1], im.width) / im.width), 'alt': name, 'zdroj': f'hraci/{team_dir.name}/{f.name}'}
        im.close()

fj.write_text(json.dumps({'_zdroj': 'fotky od fotografa (Disk Google klubu), spracúva scripts/photos.py', 'obrazky': obr}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
print('fotiek:', len(obr), '· nových súborov:', made)
