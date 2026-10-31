/**
 * 모바일 뷰포트(390×844) 스크린샷. 완료 기준 확인용.
 * 사용: pnpm shot /i/demowed1 [/dashboard ...]   (서버가 먼저 떠 있어야 함)
 * 로그인 필요한 화면: SHOT_LOGIN=1 (로컬 DEV_LOGIN으로 먼저 로그인)
 * 크롬 경로: PLAYWRIGHT_CHROME=/usr/bin/google-chrome (없으면 playwright 기본 chromium)
 */
import { mkdirSync } from 'node:fs'

import { chromium } from 'playwright'

const BASE = process.env.SHOT_BASE_URL ?? 'http://localhost:3000'
const OUT = 'screenshots'

async function main() {
  const paths = process.argv.slice(2)
  if (paths.length === 0) throw new Error('경로를 하나 이상 넘겨 주세요. 예: pnpm shot /i/demowed1')
  mkdirSync(OUT, { recursive: true })

  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROME || undefined,
  })
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'ko-KR',
  })
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  if (process.env.SHOT_LOGIN === '1') {
    await page.goto(`${BASE}/api/auth/kakao/login?dev=1&next=/`)
  }

  for (const path of paths) {
    const res = await page.goto(BASE + path, { waitUntil: 'networkidle' })
    // lazy 이미지가 로드되도록 끝까지 스크롤했다가 맨 위로
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 400) {
        window.scrollTo(0, y)
        await new Promise((r) => setTimeout(r, 80))
      }
      window.scrollTo(0, 0)
      await document.fonts.ready
    })
    await page.waitForLoadState('networkidle')
    const name = path.replace(/^\/+/, '').replace(/[^a-z0-9]+/gi, '_') || 'home'
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
    console.log(`${res?.status()} ${path} → ${OUT}/${name}.png`)
  }
  if (errors.length) console.log('브라우저 에러:\n' + errors.join('\n'))
  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
