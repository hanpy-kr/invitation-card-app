"""
손글씨 폰트(NanumGeumEunBoHwa, 2.5MB)를 Google Fonts 한국어 빈도 슬라이스대로 잘라
unicode-range가 붙은 @font-face를 만든다. 브라우저는 화면에 실제로 나온 글자가 든 조각만 받는다.

사용:
  pip install fonttools brotli
  curl -O https://raw.githubusercontent.com/googlefonts/nam-files/main/slices/korean_default.txt
  python3 scripts/subset-font.py assets/fonts/NanumGeumEunBoHwa.woff2 korean_default.txt
원본은 assets/fonts/ (서비스에서 직접 쓰지 않음, 다시 자를 때만 사용)
결과: public/fonts/nanum-geumeunbohwa/*.woff2, styles/_display-font.scss
"""
import os
import re
import sys
import tempfile

from fontTools import subset
from fontTools.ttLib import TTFont

FAMILY = 'NanumGeumEunBoHwa'
OUT_DIR = 'public/fonts/nanum-geumeunbohwa'
URL_BASE = '/fonts/nanum-geumeunbohwa'
SCSS = 'styles/_display-font.scss'


def ranges(cps):
    cps = sorted(cps)
    out, start, prev = [], cps[0], cps[0]
    for c in cps[1:]:
        if c == prev + 1:
            prev = c
            continue
        out.append((start, prev))
        start = prev = c
    out.append((start, prev))
    return ', '.join(f'U+{a:X}' if a == b else f'U+{a:X}-{b:X}' for a, b in out)


def main(src, slices_path):
    blocks = open(slices_path, encoding='utf-8').read().split('subsets {')[1:]
    slices = [set(int(x) for x in re.findall(r'codepoints: (\d+)', b)) for b in blocks]
    # woff2는 열 때마다 압축을 풀어 느리므로 한 번 TTF로 풀어 두고 조각마다 그걸 연다
    base = TTFont(src)
    cmap = set(base.getBestCmap().keys())
    base.flavor = None
    tmp = tempfile.NamedTemporaryFile(suffix='.ttf', delete=False).name
    base.save(tmp)

    os.makedirs(OUT_DIR, exist_ok=True)
    for f in os.listdir(OUT_DIR):
        os.remove(os.path.join(OUT_DIR, f))

    faces, total = [], 0
    # 파일 끝쪽 슬라이스가 가장 자주 쓰는 글자 → CSS에서 먼저 선언
    for idx in reversed(range(len(slices))):
        cps = slices[idx] & cmap
        if not cps:
            continue
        name = f'{idx:03d}.woff2'
        opts = subset.Options()
        opts.flavor = 'woff2'
        opts.hinting = False
        opts.desubroutinize = True
        opts.layout_features = ['*']
        font = TTFont(tmp)
        sub = subset.Subsetter(opts)
        sub.populate(unicodes=cps)
        sub.subset(font)
        path = os.path.join(OUT_DIR, name)
        font.flavor = 'woff2'
        font.save(path)
        size = os.path.getsize(path)
        total += size
        faces.append(
            '@font-face {\n'
            f"  font-family: '{FAMILY}';\n"
            f"  src: url('{URL_BASE}/{name}') format('woff2');\n"
            '  font-display: swap;\n'
            f'  unicode-range: {ranges(cps)};\n'
            '}\n'
        )
    os.remove(tmp)
    header = (
        '// 자동 생성: scripts/subset-font.py — 직접 고치지 말 것\n'
        f'// {FAMILY}를 Google Fonts 한국어 빈도 슬라이스 {len(faces)}조각으로 나눔 (합계 {total // 1024}KB)\n'
        '// 브라우저는 화면에 나온 글자가 든 조각만 내려받는다\n\n'
    )
    open(SCSS, 'w', encoding='utf-8').write(header + '\n'.join(faces))
    print(f'{len(faces)}조각, 합계 {total // 1024}KB → {OUT_DIR}, {SCSS}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
