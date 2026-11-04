# Fotky produktov fanshopu z letákov: data/fanshop.json (vyrez) + src/img/archiv/fanshop -> src/img/fanshop/<slug>.webp/.jpg
#   python -I scripts/fanshop.py
# Každý produkt má fotku na výšku 4:5 (ako karta v e-shope). Pri viacerých výrezoch (dáždnik: dve farby)
# sa výrezy poskladajú pod seba na bielom podklade.
import json
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'src' / 'img' / 'archiv' / 'fanshop'
OUT = ROOT / 'src' / 'img' / 'fanshop'
OUT.mkdir(parents=True, exist_ok=True)
W, H = 640, 800  # 4:5

data = json.loads((ROOT / 'data' / 'fanshop.json').read_text(encoding='utf-8'))
for p in data['produkty']:
    flyer = Image.open(SRC / p['letak']).convert('RGB')
    fw, fh = flyer.size
    parts = [flyer.crop((round(x0 * fw), round(y0 * fh), round(x1 * fw), round(y1 * fh))) for x0, y0, x1, y1 in p['vyrez']]
    if len(parts) == 1:
        img = ImageOps.fit(parts[0], (W, H), Image.LANCZOS, centering=(0.5, 0.3))
    else:
        img = Image.new('RGB', (W, H), (255, 255, 255))
        slot = H // len(parts)
        for i, part in enumerate(parts):
            part.thumbnail((W - 40, slot - 24), Image.LANCZOS)
            img.paste(part, ((W - part.width) // 2, i * slot + (slot - part.height) // 2))
    img.save(OUT / f"{p['slug']}.webp", 'WEBP', quality=80, method=5)
    img.save(OUT / f"{p['slug']}.jpg", 'JPEG', quality=82, optimize=True, progressive=True)
    print(p['slug'], parts[0].size, '->', img.size)
