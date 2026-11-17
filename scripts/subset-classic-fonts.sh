#!/usr/bin/env bash
# 종이 편지 본문 서체(Cinzel 500·600, Bodoni Moda 400 숫자)를 필요한 글자만 남겨 woff2로 만든다.
# 사용: mkdir /tmp/fs && cd /tmp/fs && npm init -y && npm i @fontsource/cinzel @fontsource/bodoni-moda
#       FS=/tmp/fs/node_modules/@fontsource bash scripts/subset-classic-fonts.sh   (레포 루트에서, fonttools · brotli 필요)
# 글꼴은 SIL OFL 1.1. @font-face는 components/blocks/common/Section.module.scss
set -euo pipefail
LATIN="U+0020,U+0026-0029,U+002C-003A,U+0041-005A,U+00B7"
mkdir -p public/fonts/cinzel/v1
for w in 500 600; do
  pyftsubset "$FS/cinzel/files/cinzel-latin-$w-normal.woff2" --unicodes="$LATIN" --flavor=woff2 \
    --layout-features='kern' --output-file="public/fonts/cinzel/v1/cinzel-$w.woff2"
done
pyftsubset "$FS/bodoni-moda/files/bodoni-moda-latin-400-normal.woff2" --unicodes="U+0020,U+002E,U+0030-0039" \
  --flavor=woff2 --layout-features='kern,lnum' --output-file="public/fonts/bodoni-moda/v1/bodoni-moda-digits-400.woff2"
