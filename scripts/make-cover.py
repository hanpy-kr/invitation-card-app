#!/usr/bin/env python3
"""새 디자인 표지 이미지 만들기: python3 scripts/make-cover.py <key> <원본그림.png|jpg> [...]
public/covers/{key}-800.webp, -1200.webp (q80, 4:5), -share.jpg (카톡용) 를 만든다.
그 뒤 shared/covers.ts 의 COVERS 에 한 줄을 더하면 끝. 원본은 4:5 비율이고 가로 1200px 이상을 권장."""
import os, re, sys
from PIL import Image

if len(sys.argv) != 3 or not re.fullmatch(r'[a-z0-9-]{1,30}', sys.argv[1]):
    sys.exit(__doc__)
key, src = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
if abs(im.width / im.height - 0.8) > 0.02:
    print(f'경고: 비율이 4:5가 아니에요 ({im.width}x{im.height}). 4:5로 늘려 맞춥니다.')
if im.width < 1200:
    print(f'경고: 가로 {im.width}px — 1200px 파일은 늘려서 만들어져요.')
out = os.path.join(os.path.dirname(__file__), '..', 'public', 'covers')
os.makedirs(out, exist_ok=True)
for w in (800, 1200):
    path = os.path.join(out, f'{key}-{w}.webp')
    im.resize((w, round(w * 5 / 4)), Image.LANCZOS).save(path, 'WEBP', quality=80, method=6)
    kb = os.path.getsize(path) // 1024
    print(f'{path} {kb}KB' + ('  ← 120KB 초과!' if kb > 120 else ''))
share = os.path.join(out, f'{key}-share.jpg')
im.resize((800, 1000), Image.LANCZOS).save(share, 'JPEG', quality=80, optimize=True, progressive=True)
print(f'{share} {os.path.getsize(share) // 1024}KB')
