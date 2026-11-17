// @fontsource 패키지(npm, SIL OFL 1.1)에서 한 글씨체의 400 굵기 woff2 조각만 가져온다.
// 굵기 여러 개: 넷째 인자에 '400,700' (기본 400). 미리 받기 목록(slices)은 400만 쓴다.
// 사용:
//   mkdir /tmp/fs && cd /tmp/fs && npm init -y && npm i @fontsource/gowun-batang
//   node scripts/import-fontsource.mjs /tmp/fs/node_modules/@fontsource/gowun-batang gowun-batang v1
// 결과: public/fonts/<id>/<ver>/*.woff2 + font.css (이 글씨체를 고른 초대장만 <link>로 불러옴)
//       public/fonts/<id>/LICENSE.txt, lib/fonts/slices/<id>.json (서버가 미리 받을 조각을 고를 때 씀)
// woff(구형) · 베트남어 · latin-ext 조각은 가져오지 않는다. 글씨체나 자르는 방식이 바뀌면 ver를 올린다.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const [pkgDir, id, ver = 'v1', weightArg = '400'] = process.argv.slice(2)
const weights = weightArg.split(',').map((w) => w.trim())
if (!pkgDir || !id) throw new Error('usage: import-fontsource.mjs <pkgDir> <id> [ver]')

const out = join('public/fonts', id, ver)
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
mkdirSync('lib/fonts/slices', { recursive: true })

const faces = []
const slices = []
let bytes = 0
for (const weight of weights) {
  const css = readFileSync(join(pkgDir, `${weight}.css`), 'utf8')
  const blocks = css.split('/* ').slice(1)
  for (const b of blocks) {
    const name = b.slice(0, b.indexOf(' */'))
    if (/vietnamese|latin-ext/.test(name)) continue
    const family = /font-family: '([^']+)'/.exec(b)[1]
    const file = /url\(\.\/files\/([^)]+\.woff2)\)/.exec(b)[1]
    const range = /unicode-range: ([^;]+);/.exec(b)?.[1]
    copyFileSync(join(pkgDir, 'files', file), join(out, file))
    bytes += readFileSync(join(out, file)).length
    faces.push(
      `@font-face{font-family:'${family}';font-style:normal;font-display:swap;font-weight:${weight};` +
        `src:url(/fonts/${id}/${ver}/${file}) format('woff2');${range ? `unicode-range:${range};` : ''}}`,
    )
    const ranges = (range ?? '').split(',').map((r) => {
      const [a, z] = r.trim().replace(/^U\+/i, '').split('-')
      return [parseInt(a, 16), parseInt(z ?? a, 16)]
    })
    // 조각 번호가 큰 쪽이 자주 쓰는 글자 — 미리 받을 때 앞에 둔다
    if (weight !== '400') continue
    const idx = /-(\d+)-400-normal/.exec(file)
    slices.push({ url: `/fonts/${id}/${ver}/${file}`, ranges, order: idx ? Number(idx[1]) : 9999 })
  }
}
slices.sort((x, y) => y.order - x.order)
writeFileSync(join(out, 'font.css'), faces.join('\n') + '\n')
writeFileSync(
  `lib/fonts/slices/${id}.json`,
  JSON.stringify(slices.map(({ url, ranges }) => ({ url, ranges }))),
)
copyFileSync(join(pkgDir, 'LICENSE'), join('public/fonts', id, 'LICENSE.txt'))
console.log(`${id}: ${faces.length}조각, ${(bytes / 1024) | 0}KB`)
