# Redimensionne et compresse les textures téléchargées (asset-src/) vers public/assets/.
# Usage : python3 -I scripts/prepare-textures.py
import os, shutil, sys
from PIL import Image
Image.MAX_IMAGE_PIXELS = None

SRC = os.path.join(os.getcwd(), 'asset-src')
DST = os.path.join(os.getcwd(), 'public', 'assets')
BIG = {'leafy_grass', 'forest_ground_04', 'moon_dusted_02', 'moon_01', 'metal_plate', 'anti_skid_tiles'}

def save(img, path, size, q=82, gray=False):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img = img.convert('L' if gray else 'RGB')
    w, h = img.size
    s = min(1.0, size / max(w, h))
    if s < 1:
        img = img.resize((round(w * s), round(h * s)), Image.LANCZOS)
    img.save(path, 'JPEG', quality=q, optimize=True, progressive=True)

for tid in sorted(os.listdir(os.path.join(SRC, 'textures'))):
    d = os.path.join(SRC, 'textures', tid)
    size = 2048 if tid in BIG else 1024
    for k in ('diff', 'nor', 'arm'):
        for ext in ('jpg', 'png'):
            f = os.path.join(d, f'{k}.{ext}')
            if os.path.exists(f):
                save(Image.open(f), os.path.join(DST, 'tex', tid, f'{k}.jpg'), size, 84 if k == 'nor' else 80)
                break

P = os.path.join(SRC, 'planets')
save(Image.open(os.path.join(P, '8k_moon.jpg')), os.path.join(DST, 'planets', 'moon.jpg'), 4096, 84)
save(Image.open(os.path.join(P, '8k_earth_daymap.jpg')), os.path.join(DST, 'planets', 'earth_day.jpg'), 4096, 84)
save(Image.open(os.path.join(P, '8k_earth_nightmap.jpg')), os.path.join(DST, 'planets', 'earth_night.jpg'), 4096, 80)
save(Image.open(os.path.join(P, '8k_earth_clouds.jpg')), os.path.join(DST, 'planets', 'earth_clouds.jpg'), 4096, 78, gray=True)
save(Image.open(os.path.join(P, '8k_stars_milky_way.jpg')), os.path.join(DST, 'planets', 'milky_way.jpg'), 4096, 86)
save(Image.open(os.path.join(P, '8k_saturn.jpg')), os.path.join(DST, 'planets', 'saturn.jpg'), 2048, 84)
ring = Image.open(os.path.join(P, '8k_saturn_ring_alpha.png'))
ring.thumbnail((2048, 2048))
ring.save(os.path.join(DST, 'planets', 'saturn_ring.png'), optimize=True)

os.makedirs(os.path.join(DST, 'hdri'), exist_ok=True)
for f in os.listdir(os.path.join(SRC, 'hdri')):
    shutil.copy(os.path.join(SRC, 'hdri', f), os.path.join(DST, 'hdri', f))
print('ok')
