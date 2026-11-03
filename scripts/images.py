# Pripraví obrázky pre web (len chýbajúce alebo novšie, opakované spustenie je rýchle):
#   media/galerie/<slug>/<foto>  -> media/galerie-web/<slug>/<foto>.webp (dlhšia strana 1600 px)
#                                   media/galerie-web/<slug>/t/<foto>.webp (náhľad 480 px na šírku)
#   media/video/<id>-max.jpg     -> src/img/video/<id>.jpg (800 x 450)
# python -I scripts/images.py
import sys
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
Image.MAX_IMAGE_PIXELS = 60_000_000


def fresh(src: Path, dst: Path) -> bool:
    return dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime


def load(src: Path) -> Image.Image:
    im = Image.open(src)
    im = ImageOps.exif_transpose(im)
    return im.convert('RGB')


def fit_long(im: Image.Image, long_edge: int) -> Image.Image:
    w, h = im.size
    s = long_edge / max(w, h)
    return im if s >= 1 else im.resize((round(w * s), round(h * s)), Image.LANCZOS)


def fit_width(im: Image.Image, width: int) -> Image.Image:
    w, h = im.size
    return im if w <= width else im.resize((width, round(h * width / w)), Image.LANCZOS)


made = 0
gal_src = ROOT / 'media' / 'galerie'
gal_out = ROOT / 'media' / 'galerie-web'
for f in sorted(gal_src.glob('*/*')):
    if f.suffix.lower() not in ('.jpg', '.jpeg', '.png', '.webp'):
        continue
    base = f.name.rsplit('.', 1)[0]
    big = gal_out / f.parent.name / f'{base}.webp'
    thumb = gal_out / f.parent.name / 't' / f'{base}.webp'
    if fresh(f, big) and fresh(f, thumb):
        continue
    try:
        im = load(f)
    except Exception as e:  # poškodený súbor zo starého webu
        print('preskakujem', f, e, file=sys.stderr)
        continue
    thumb.parent.mkdir(parents=True, exist_ok=True)
    fit_long(im, 1600).save(big, 'WEBP', quality=78, method=5)
    fit_width(im, 480).save(thumb, 'WEBP', quality=72, method=5)
    made += 1

vid_src = ROOT / 'media' / 'video'
vid_out = ROOT / 'src' / 'img' / 'video'
vid_out.mkdir(parents=True, exist_ok=True)
for f in sorted(vid_src.glob('*-max.jpg')):
    dst = vid_out / (f.name[:-len('-max.jpg')] + '.jpg')
    if fresh(f, dst):
        continue
    ImageOps.fit(load(f), (800, 450), Image.LANCZOS).save(dst, 'JPEG', quality=80, optimize=True, progressive=True)
    made += 1

# obrázky v kartách (bannery správ, štadión, história, náhľady videí): menšie webp pre srcset
#   src/img/<cesta>/<meno>.jpg -> src/img/opt/<cesta>/<meno>-640.webp, -1280.webp (len šírky menšie ako originál)
img_src = ROOT / 'src' / 'img'
opt_out = img_src / 'opt'
for f in sorted([*img_src.glob('archiv/**/*'), *img_src.glob('video/*')]):
    if f.suffix.lower() not in ('.jpg', '.jpeg', '.png') or 'fanshop' in f.parts:
        continue  # letáky fanshopu majú drobný text s cenami, ostávajú v plnej kvalite
    rel = f.relative_to(img_src).with_suffix('')
    todo = []
    with Image.open(f) as probe:
        width = probe.size[0]
    # originál užší ako 1280 (napr. 800 px) dostane aj variant v plnej šírke, inak by telefón s 2× displejom bral len 640
    for w in (640, 1280, *([width] if 640 < width < 1280 else [])):
        dst = opt_out / rel.parent / f'{rel.name}-{w}.webp'
        if w <= width and not fresh(f, dst):
            todo.append((w, dst))
    if not todo:
        continue
    im = load(f)
    for w, dst in todo:
        dst.parent.mkdir(parents=True, exist_ok=True)
        fit_width(im, w).save(dst, 'WEBP', quality=76, method=5)
        made += 1

# logá partnerov: orezať priehľadné okraje (niektoré súbory majú logo uprostred veľkého prázdneho štvorca)
#   src/img/archiv/partneri/<logo>.png -> src/img/opt/partneri/<logo>.png
par_out = opt_out / 'partneri'
for f in sorted((img_src / 'archiv' / 'partneri').glob('*.png')):
    dst = par_out / f.name
    if fresh(f, dst):
        continue
    im = Image.open(f).convert('RGBA')
    box = im.getchannel('A').getbbox()
    if box:
        im = im.crop(box)
    par_out.mkdir(parents=True, exist_ok=True)
    im.save(dst, optimize=True)
    made += 1

# obálky galérií v kartách: náhľad 480 px je na veľkej karte (až 780 px, 2× displej) rozmazaný
#   media/galerie/<slug>/<obálka> -> media/galerie-web/<slug>/m/<obálka>.webp (800 × 500, výrez 16:10 v 25 % výšky, kde sú tváre
#   ako .card-img s object-fit: cover; fotka na výšku by inak mala 800 × 1200 a zbytočne spomalila LCP)
import json
_gal_lists = [ROOT / 'data' / 'galerie.json', ROOT / 'data' / 'galerie-foto.json']  # starý web + zápasové fotky od fotografa
for g in [x for p in _gal_lists if p.exists() for x in json.loads(p.read_text(encoding='utf-8'))]:
    slug = g['path'].rstrip('/').split('/')[-1]
    f = gal_src / slug / g['cover']
    if not f.exists():
        continue
    dst = gal_out / slug / 'm' / (g['cover'].rsplit('.', 1)[0] + '.webp')
    if fresh(f, dst):
        continue
    im = load(f)
    if im.width <= 480:
        continue
    dst.parent.mkdir(parents=True, exist_ok=True)
    ImageOps.fit(im, (800, 500), Image.LANCZOS, centering=(0.5, 0.25)).save(dst, "WEBP", quality=74, method=5)
    made += 1

print('hotovo, nových obrázkov:', made)
