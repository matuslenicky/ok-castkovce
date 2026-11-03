# Výber najlepších fotiek do galérií od fotografa (data/galerie-foto.json):
#   python -I scripts/vyber-foto.py [počet=15]
# Z každého zápasu nechá N fotiek: ostré, primerane exponované, bez takmer rovnakých záberov,
# rozložené po celom zápase (súbory sú v poradí fotenia). Obálka = najlepšia fotka na šírku.
# Nevybrané sa presunú do media/galerie-vyradene/<slug>/ (nič sa nemaže) a ich webp z media/galerie-web sa zmažú.
import json
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
N = int(sys.argv[1]) if len(sys.argv) > 1 else 15
sys.stdout.reconfigure(encoding='utf-8', errors='replace')  # konzola Windows (cp1250) nevie všetky znaky z mien súborov
GAL = ROOT / 'media' / 'galerie'
OUT = ROOT / 'media' / 'galerie-vyradene'
WEB = ROOT / 'media' / 'galerie-web'
DATA = ROOT / 'data' / 'galerie-foto.json'


def stats(path):
    im = ImageOps.exif_transpose(Image.open(path))
    landscape = im.width >= im.height
    g = im.convert('L')
    g.thumbnail((640, 640))
    a = np.asarray(g, dtype=np.float32)
    # ostrosť = rozptyl Laplaciánu (rozmazané fotky majú málo hrán)
    lap = a[1:-1, 1:-1] * 4 - a[:-2, 1:-1] - a[2:, 1:-1] - a[1:-1, :-2] - a[1:-1, 2:]
    sharp = float(lap.var())
    mean = float(a.mean())
    # dHash 8×8 na odhalenie takmer rovnakých záberov
    h = np.asarray(g.resize((9, 8), Image.LANCZOS), dtype=np.int16)
    bits = (h[:, 1:] > h[:, :-1]).flatten()
    return {'sharp': sharp, 'mean': mean, 'land': landscape, 'hash': bits}


def ham(a, b):
    return int(np.count_nonzero(a != b))


gals = json.loads(DATA.read_text(encoding='utf-8'))
total_before = total_after = 0
for g in gals:
    d = GAL / g['slug']
    # pri opakovanom spustení vyberať zo všetkých (aj predtým vyradených)
    back = OUT / g['slug']
    if back.exists():
        for f in back.iterdir():
            shutil.move(str(f), str(d / f.name))
    files = sorted([f.name for f in d.iterdir() if f.suffix.lower() in ('.jpg', '.jpeg')], key=lambda n: [int(t) if t.isdigit() else t for t in __import__('re').split(r'(\d+)', n)])
    total_before += len(files)
    if len(files) <= N:
        chosen = files
    else:
        s = {f: stats(d / f) for f in files}
        sharp_med = float(np.median([v['sharp'] for v in s.values()]))
        def score(f):
            v = s[f]
            expo = 1 - min(abs(v['mean'] - 120) / 120, 1)  # príliš tmavé / svetlé dole
            return (v['sharp'] / (sharp_med or 1)) * (0.6 + 0.4 * expo)
        ok = [f for f in files if s[f]['sharp'] >= 0.35 * sharp_med and 35 < s[f]['mean'] < 225] or files
        chosen = []
        # N úsekov podľa poradia fotenia, z každého najlepšia fotka, ktorá nie je kópiou už vybranej
        buckets = np.array_split(np.array(ok, dtype=object), N)
        for b in buckets:
            for f in sorted(b.tolist(), key=score, reverse=True):
                if all(ham(s[f]['hash'], s[c]['hash']) > 10 for c in chosen):
                    chosen.append(f)
                    break
        # doplniť, ak niektoré úseky nič nedali
        for f in sorted(ok, key=score, reverse=True):
            if len(chosen) >= N:
                break
            if f not in chosen and all(ham(s[f]['hash'], s[c]['hash']) > 10 for c in chosen):
                chosen.append(f)
        chosen = [f for f in files if f in chosen]  # pôvodné poradie
        land = [f for f in chosen if s[f]['land']]
        g['cover'] = max(land or chosen, key=score)
    rest = [f for f in files if f not in chosen]
    if rest:
        back.mkdir(parents=True, exist_ok=True)
        for f in rest:
            shutil.move(str(d / f), str(back / f))
            stem = f.rsplit('.', 1)[0]
            for w in (WEB / g['slug'] / f'{stem}.webp', WEB / g['slug'] / 't' / f'{stem}.webp'):
                w.unlink(missing_ok=True)
    g['files'] = chosen
    if g.get('cover') not in chosen:
        g['cover'] = chosen[0]
    # stredná obálka (m/) len pre aktuálnu obálku; novú vyrobí images.py
    mdir = WEB / g['slug'] / 'm'
    if mdir.exists():
        for m in mdir.iterdir():
            if m.stem != g['cover'].rsplit('.', 1)[0]:
                m.unlink()
    total_after += len(chosen)
    print(f"{g['slug']}: {len(files)} -> {len(chosen)}, obálka {g['cover']}")

DATA.write_text(json.dumps(gals, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
print(f'spolu {total_before} -> {total_after} fotiek v {len(gals)} galériách')
