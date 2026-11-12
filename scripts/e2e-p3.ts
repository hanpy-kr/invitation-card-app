/**
 * 표지 봉투 · 떨어지는 효과 확인(로컬). 준비는 e2e-p2.ts와 같음. 실행: pnpm e2e:p3
 * 다른 e2e 파일은 reducedMotion으로 봉투를 건너뛰고, 여기서만 움직임을 켠 하객 화면을 본다.
 */
import { mkdirSync } from 'node:fs'

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'

const BASE = process.env.E2E_BASE ?? 'http://localhost:3001'
const OUT = 'screenshots/e2e'

let failures = 0
function check(ok: unknown, label: string) {
  console.log(`${ok ? '✅' : '❌'} ${label}`)
  if (!ok) failures++
}

const mobile = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  locale: 'ko-KR',
}

const errors: string[] = []

async function newPage(ctx: BrowserContext): Promise<Page> {
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('dialog', (d) => d.accept())
  await page.route(/t1\.kakaocdn\.net|dapi\.kakao\.com/, (r) => r.abort())
  return page
}

async function waitSaved(page: Page) {
  await page.getByRole('status').filter({ hasText: '저장됨' }).waitFor({ timeout: 15000 })
}

async function publish(page: Page): Promise<string> {
  await page.getByRole('button', { name: /^(발행하기|공유하기)$/ }).click()
  const sheet = page.getByRole('dialog')
  const pub = sheet.getByRole('button', { name: '발행하기' })
  if (await pub.count()) await pub.click()
  await sheet.getByRole('heading', { name: '초대장이 발행됐어요' }).waitFor()
  const url = await sheet.getByLabel('초대장 주소').inputValue()
  await sheet.getByRole('button', { name: '닫기' }).click()
  return url
}

const intro = (p: Page) =>
  p.getByRole('button', { name: /도장 봉투 열기|리본 카드 열기|책 표지 넘기기/ })

/** 새 결혼 초대장은 추천 봉투(도장) · 효과(꽃잎)로 시작 */
async function introFlow(browser: Browser) {
  const hostCtx = await browser.newContext(mobile)
  const host = await newPage(hostCtx)
  await host.goto(`${BASE}/api/auth/kakao/login?dev=1&next=${encodeURIComponent('/new')}`)
  await host
    .getByRole('button', { name: /결혼식/ })
    .first()
    .click()
  await host.waitForURL(/\/edit\//)
  await host.getByLabel('초대장 제목').fill('E2E 봉투 확인')
  await waitSaved(host)

  // 편집기: 표지 폼에 여는 방식 · 효과, 미리보기에 다시 재생
  await host.getByRole('button', { name: /^표지/ }).first().click()
  check(await host.getByRole('group', { name: '여는 방식' }).count(), '편집기: 여는 방식')
  check(
    (await host
      .getByRole('group', { name: '여는 방식' })
      .getByRole('button', { name: '도장 봉투' })
      .getAttribute('aria-pressed')) === 'true',
    '새 결혼 초대장은 도장 봉투로 시작',
  )
  check(
    await host
      .getByLabel('떨어지는 효과')
      .inputValue()
      .then((v) => v === 'petal'),
    '새 결혼 초대장은 꽃잎 효과로 시작',
  )
  await host.getByLabel(/도장 글자/).fill('우리')
  await waitSaved(host)
  await host.getByRole('tab', { name: '미리보기' }).click()
  check(await host.getByRole('button', { name: /다시 재생/ }).count(), '편집기: 미리보기 다시 재생')
  await host.getByRole('tab', { name: '편집' }).click()
  const url = await publish(host)

  // 움직임을 켠 하객: 봉투 → 열기 → 표지
  const mk = async (opts: object = {}) => {
    const ctx = await browser.newContext({ ...mobile, reducedMotion: 'no-preference', ...opts })
    return { ctx, page: await newPage(ctx) }
  }
  const { ctx: gctx, page: g } = await mk()
  await g.goto(url, { waitUntil: 'networkidle' })
  check(await intro(g).count(), '하객: 처음 열면 봉투가 보임')
  check((await g.getByText('도장을 눌러 열어 보세요').count()) === 1, '하객: 안내 문구')
  check((await g.getByText('우리').count()) >= 1, '하객: 도장 글자(직접 적은 것)')
  check((await g.locator('span[class*=CoverEffect_p__]').count()) === 24, '효과 조각 24개(보통)')
  const locked = await g.evaluate(() => document.documentElement.style.overflow)
  check(locked === 'hidden', '봉투가 닫힌 동안 스크롤 잠금')
  await g.screenshot({ path: `${OUT}/p3-intro-closed.png` })
  await intro(g).click()
  await g.waitForTimeout(1000)
  await g.screenshot({ path: `${OUT}/p3-intro-opening.png` })
  await g.waitForTimeout(1300)
  check((await intro(g).count()) === 0, '열고 나면 봉투가 사라지고 표지 화면')
  check(
    (await g.getByRole('button', { name: '다시 보기' }).count()) === 1,
    '표지 오른쪽 위 다시 보기',
  )
  check(
    (await g.evaluate(() => document.documentElement.style.overflow)) === '',
    '스크롤 잠금 풀림',
  )
  await g.screenshot({ path: `${OUT}/p3-intro-cover.png` })
  await g.getByRole('button', { name: '다시 보기' }).click()
  check(await intro(g).count(), '다시 보기를 누르면 봉투부터')

  // 같은 기기로 다시 열면 바로 표지
  await g.goto(url, { waitUntil: 'networkidle' })
  check((await intro(g).count()) === 0, '재방문: 봉투 건너뜀')
  await gctx.close()

  // ?go=rsvp 로 들어오면 새 기기여도 건너뜀
  const { ctx: c2, page: g2 } = await mk()
  await g2.goto(`${url}?go=rsvp`, { waitUntil: 'networkidle' })
  check((await intro(g2).count()) === 0, '?go= 링크: 봉투 건너뜀')
  await c2.close()

  // 움직임 줄이기: 봉투 없이 바로 표지, 효과 층은 표시 안 함
  const { ctx: c3, page: g3 } = await mk({ reducedMotion: 'reduce' })
  await g3.goto(url, { waitUntil: 'networkidle' })
  check((await intro(g3).count()) === 0, 'reduced-motion: 봉투 없음')
  const fxDisplay = await g3
    .locator('[class*=CoverEffect_fx]')
    .first()
    .evaluate((el) => getComputedStyle(el).display)
  check(fxDisplay === 'none', 'reduced-motion: 효과 층 표시 안 함')
  await c3.close()

  // 효과 '처음 5초만' + 없음: 저장되고 하객 화면에 반영
  await host.getByLabel('떨어지는 효과').selectOption('none')
  await host
    .getByRole('button', { name: '없음' })
    .first()
    .click()
    .catch(() => {})
  await waitSaved(host)
  await hostCtx.close()
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROME || undefined,
  })
  await introFlow(browser)
  check(errors.length === 0, `브라우저 에러 없음 ${errors.length ? JSON.stringify(errors) : ''}`)
  await browser.close()
  console.log(failures === 0 ? '\nP3 E2E 통과' : `\nP3 E2E 실패 ${failures}건`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
