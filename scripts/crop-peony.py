"""홈 배경 작약(public/landing/page-peony-white.webp)에서 한 송이씩 잘라 표지 템플릿용 webp를 만든다.
왼쪽 가장자리 작약만 쓴다(오른쪽은 좌우 반전 복제). 배경은 흰색으로 맞춰 mix-blend-mode: multiply로 종이 위에 얹는다.
원본이 780x2520이라 한 송이가 215x310px 정도다 → 2배 Lanczos로 키워 부드럽게 보이게 한다(없던 디테일이 생기지는 않는다).
저작자 정보(EXIF · XMP)는 원본 파일에 든 것을 그대로 옮긴다. 실행: python3 scripts/crop-peony.py
"""
import numpy as np
from PIL import Image, ImageFilter, ImageOps

SRC = 'public/landing/page-peony-white.webp'
OUT = 'public/covers/templates'
src = Image.open(SRC)
exif, xmp = src.info.get('exif'), src.info.get('xmp')
gray = np.asarray(src.convert('L').filter(ImageFilter.GaussianBlur(0.5))).astype(np.float32)


def crop(box, name, flip, gain=1.25, fade=None):
    c = gray[box[1]:box[3], box[0]:box[2]]
    bg = np.percentile(c, 80)
    v = np.clip(255 - (bg - c) * gain, 0, 255)
    h, w = v.shape
    m = np.ones((h, w), np.float32)
    for side, px in (fade or {'r': 40, 'b': 50, 't': 40}).items():
        r = np.linspace(0, 1, px) ** 1.5
        if side == 'r': m[:, -px:] *= r[::-1][None, :]
        if side == 't': m[:px, :] *= r[:, None]
        if side == 'b': m[-px:, :] *= r[::-1][:, None]
    o = Image.fromarray((255 - (255 - v) * m).astype(np.uint8))
    o = o.resize((w * 2, h * 2), Image.LANCZOS)
    if flip:
        o = ImageOps.mirror(o)
    o.convert('RGB').save(f'{OUT}/{name}.webp', quality=88, method=6, exif=exif, xmp=xmp)
    print(name, o.size)


import os
os.makedirs(OUT, exist_ok=True)
crop((0, 700, 215, 1010), 'peony-tl', False, gain=1.8)  # 1안 좌상
crop((0, 2010, 215, 2340), 'peony-br', True, gain=1.8)  # 1안 우하(오른쪽 가장자리에 붙임)
crop((0, 700, 215, 1010), 'peony-tr', True, gain=1.8, fade={'r': 40, 'b': 50})  # 2안 우상 (1안 좌상과 같은 송이를 좌우 반전)
