# Fotky produktov fanshopu z letákov: data/fanshop.json + src/img/archiv/fanshop-hq (letáky v najlepšej kvalite zo starého webu)
#   -> src/img/fanshop/<slug>-<n>.webp/.jpg + data/fanshop-foto.json (rozmery pre build)
#   python -I scripts/fanshop.py
# Fotky v letáku sa nájdu samy: všetko, čo sa farbou líši od modrého pozadia letáku a je dosť veľké a plné.
# Hlavná (najväčšia) fotka letáku ide prvá, ostatné v poradí čítania. Nezväčšuje sa (letáky majú len 1680 px).
import json
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'src' / 'img' / 'archiv' / 'fanshop-hq'
if not SRC.exists():
    SRC = ROOT / 'src' / 'img' / 'archiv' / 'fanshop'
OUT = ROOT / 'src' / 'img' / 'fanshop'
OUT.mkdir(parents=True, exist_ok=True)
STEP = 4  # hľadanie na zmenšenine


def photos(path):
    im = Image.open(path).convert('RGB')
    a = np.asarray(im, dtype=np.int16)
    H, W, _ = a.shape
    bg = np.median(a[int(H * .2):int(H * .7), int(W * .005):int(W * .025)].reshape(-1, 3), axis=0)
    mask = np.sqrt(((a - bg) ** 2).sum(axis=2)) > 42
    # len plocha s fotkami: bez červenej hlavičky, bielej pätičky a zvislého nápisu „OK ČASTKOVCE“ vpravo
    mask[:int(H * .093)] = False
    mask[int(H * .81):] = False
    mask[:, int(W * .885):] = False
    small = mask[::STEP, ::STEP].copy()
    # erózia: tenké tvary (písmo citátu medzi fotkami) zmiznú, fotky sa tak nespoja do jedného celku
    ER = 3
    for _ in range(ER):
        e = small.copy()
        e[1:, :] &= small[:-1, :]; e[:-1, :] &= small[1:, :]; e[:, 1:] &= small[:, :-1]; e[:, :-1] &= small[:, 1:]
        small = e
    h, w = small.shape
    seen = np.zeros_like(small, dtype=bool)
    boxes = []
    for y in range(h):
        for x in range(w):
            if small[y, x] and not seen[y, x]:
                q = deque([(y, x)]); seen[y, x] = True
                y0 = y1 = y; x0 = x1 = x; n = 0
                while q:
                    cy, cx = q.popleft(); n += 1
                    y0, y1, x0, x1 = min(y0, cy), max(y1, cy), min(x0, cx), max(x1, cx)
                    for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                        if 0 <= ny < h and 0 <= nx < w and small[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True; q.append((ny, nx))
                # späť o eróziu
                x0, y0, x1, y1 = max(0, x0 - ER), max(0, y0 - ER), min(w - 1, x1 + ER), min(h - 1, y1 + ER)
                bw, bh = (x1 - x0 + 1) * STEP, (y1 - y0 + 1) * STEP
                fill = n / max(1, (x1 - x0 + 1 - 2 * ER) * (y1 - y0 + 1 - 2 * ER))
                if bw > W * .06 and bh > H * .15 and fill > .55:
                    # presný okraj fotky podľa plnej masky (na zmenšenine je ± STEP), potom kúsok dnu
                    sub = mask[y0 * STEP:(y1 + 1) * STEP, x0 * STEP:(x1 + 1) * STEP]
                    cols = np.where(sub.mean(axis=0) > .5)[0]; rows = np.where(sub.mean(axis=1) > .5)[0]
                    if len(cols) and len(rows):
                        pad = 3
                        boxes.append((x0 * STEP + cols[0] + pad, y0 * STEP + rows[0] + pad, x0 * STEP + cols[-1] + 1 - pad, y0 * STEP + rows[-1] + 1 - pad))
    return im, boxes


data = json.loads((ROOT / 'data' / 'fanshop.json').read_text(encoding='utf-8'))
cache = {}
meta = {}
for p in data['produkty']:
    out = []
    for spec in p['fotky']:
        flyer = spec['letak']
        if flyer not in cache:
            cache[flyer] = photos(SRC / flyer)
        im, boxes = cache[flyer]
        by_x = sorted(boxes, key=lambda b: b[0])
        if 'poradie' in spec:  # leták s viacerými produktmi: fotky podľa poradia zľava
            chosen = [by_x[i] for i in spec['poradie'] if i < len(by_x)]
        elif 'hlavna' in spec:  # hlavná fotka zadaná ručne (pozadie fotky splýva s modrou letáku)
            x0, y0, x1, y1 = spec['hlavna']
            big = (round(x0 * im.width), round(y0 * im.height), round(x1 * im.width), round(y1 * im.height))
            rest = [b for b in boxes if b[2] <= big[0] or b[0] >= big[2] or b[3] <= big[1] or b[1] >= big[3]]
            chosen = [big] + sorted(rest, key=lambda b: (round(b[1] / (im.height * .1)), b[0]))
        else:
            big = max(boxes, key=lambda b: (b[2] - b[0]) * (b[3] - b[1]))
            rest = sorted([b for b in boxes if b != big], key=lambda b: (round(b[1] / (im.height * .1)), b[0]))
            chosen = [big] + rest
        out += [(im, b) for b in chosen]
    files = []
    for i, (im, b) in enumerate(out, 1):
        crop = im.crop(b)
        name = f"{p['slug']}-{i}"
        crop.save(OUT / f'{name}.webp', 'WEBP', quality=90, method=6)
        crop.save(OUT / f'{name}.jpg', 'JPEG', quality=92, optimize=True, progressive=True)
        files.append({'subor': name, 'w': crop.width, 'h': crop.height})
    meta[p['slug']] = files
    print(p['slug'], len(files), 'fotiek', [f"{f['w']}x{f['h']}" for f in files])
# staré jednotlivé fotky (pred galériou) zmazať
for f in OUT.glob('*'):
    stem = f.stem
    if not any(stem == x['subor'] for v in meta.values() for x in v):
        f.unlink()
(ROOT / 'data' / 'fanshop-foto.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
