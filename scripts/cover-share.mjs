// 디자인 표지의 카톡 공유용 JPEG를 만든다 (카카오 스크랩은 webp를 못 읽음).
// public/covers/{key}-800.webp → public/covers/share/{key}.jpg (800×1000, q80). 결과물은 커밋하지 않음(.gitignore).
// dev · build 앞에서 자동으로 돈다.
import { mkdirSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const dir = join(process.cwd(), 'public', 'covers')
const out = join(dir, 'share')
mkdirSync(out, { recursive: true })
let made = 0
for (const f of readdirSync(dir)) {
  const m = f.match(/^(.+)-800\.webp$/)
  if (!m) continue
  const target = join(out, `${m[1]}.jpg`)
  try {
    if (statSync(target).mtimeMs >= statSync(join(dir, f)).mtimeMs) continue
  } catch {}
  await sharp(join(dir, f))
    .resize(800, 1000, { fit: 'cover' })
    .jpeg({ quality: 80, progressive: true })
    .toFile(target)
  made++
}
console.log(`표지 공유 이미지: ${made}개 새로 만듦`)
