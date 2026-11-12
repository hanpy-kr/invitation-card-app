/**
 * 연말 1차 기능 확인(로컬): QR 저장 · 진행 순서 · 인사말 추천 · 행사 당일 모드 · 큰 글씨. 실행: pnpm e2e:p4
 * 준비는 e2e-p2.ts와 같음 (DEV_LOGIN=1 서버).
 */
import { readFileSync } from 'node:fs'

import { chromium, type BrowserContext, type Page } from 'playwright'

const BASE = process.env.E2E_BASE ?? 'http://localhost:3001'

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
  reducedMotion: 'reduce' as const,
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

const kstToday = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

const row = (p: Page, name: RegExp) =>
  p.locator('li', { has: p.getByRole('button', { name }) }).first()
const openBlock = async (p: Page, name: RegExp) => {
  const r = row(p, name)
  const head = r.getByRole('button', { name }).first()
  if ((await head.getAttribute('aria-expanded')) !== 'true') await head.click()
  return r
}

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ ...mobile, acceptDownloads: true })
  const host = await newPage(ctx)
  await host.goto(`${BASE}/api/auth/kakao/login?dev=1&next=${encodeURIComponent('/new')}`)
  await host.getByRole('button', { name: /송년회/ }).first().click()
  await host.waitForURL(/\/edit\//)
  await host.getByLabel('초대장 제목').fill('E2E 송년회')
  await host.getByLabel('날짜').fill(kstToday())
  await waitSaved(host)

  // ② 진행 순서: 숨김으로 들어 있고 예시 3줄
  const tl = row(host, /^진행 순서/)
  check(await tl.getByText('숨김').count(), '② 송년회 템플릿에 진행 순서가 숨김으로 들어 있음')
  await tl.getByRole('button', { name: '보이기' }).click()
  await openBlock(host, /^진행 순서/)
  const tc = await host.getByLabel(/순서 \d 제목/).count()
  check(tc === 3, `② 예시 3줄 (${tc})`)
  await host.getByRole('button', { name: '순서 추가' }).click()
  await host.getByLabel('순서 4 시간').fill('오후 10시')
  await host.getByLabel('순서 4 제목').fill('귀가')
  await waitSaved(host)

  // ③ 인사말 추천 문구
  await openBlock(host, /^인사말/)
  await host.getByLabel('인사말').first().fill('직접 쓴 문구')
  await host.getByRole('button', { name: '추천 문구' }).click()
  check((await host.getByRole('list', { name: '추천 문구 목록' }).getByRole('listitem').count()) >= 5, '③ 추천 문구 5개 이상')
  await host.getByRole('button', { name: '추천 문구 1 고르기' }).click() // confirm 자동 수락
  check(!(await host.getByLabel('인사말').first().inputValue()).includes('직접 쓴 문구'), '③ 고르면 본문이 채워짐')
  await waitSaved(host)

  // ④ 위한 준비: 주소 · 주차 안내 · 연락처
  await openBlock(host, /^오시는 길|^위치/).catch(() => {})
  await host.getByLabel('주소').first().fill('서울 중구 세종대로 110').catch(() => {})
  await openBlock(host, /^안내/)
  await host.getByRole('button', { name: '안내 항목 추가' }).click()
  await host.waitForTimeout(300)
  const n = await host.getByLabel(/안내 \d+ 제목/).count()
  console.log('notice items', n)
  await host.getByLabel(`안내 ${n} 제목`).fill('주차 안내')
  await host.getByLabel(`안내 ${n} 내용`).fill('건물 지하 주차장 2시간 무료')
  await host.getByRole('button', { name: '+ 연락하기' }).click()
  if (!(await host.getByLabel('연락처 1 전화번호').count()))
    await host.getByRole('button', { name: '연락처 추가' }).click()
  await host.getByLabel('연락처 1 전화번호').fill('010-1234-5678')
  await waitSaved(host)

  // 발행
  await host.getByRole('button', { name: /^(발행하기|공유하기)$/ }).click()
  const sheet = host.getByRole('dialog')
  await sheet.getByRole('button', { name: '발행하기' }).click()
  await sheet.getByRole('heading', { name: '초대장이 발행됐어요' }).waitFor()
  const url = await sheet.getByLabel('초대장 주소').inputValue()
  await sheet.getByRole('button', { name: '닫기' }).click()

  // ① 대시보드 QR
  await host.goto(`${BASE}/dashboard`)
  await host.getByRole('button', { name: 'QR 저장' }).first().click()
  const dl1 = host.waitForEvent('download')
  await host.getByRole('button', { name: /QR만/ }).click()
  const f1 = await dl1
  const png = (b: Buffer) => b.subarray(1, 4).toString() === 'PNG'
  const b1 = readFileSync((await f1.path())!)
  // PNG 헤더의 가로 · 세로 (IHDR)
  check(png(b1) && b1.readUInt32BE(16) === 1024 && b1.readUInt32BE(20) === 1024, '① QR만 1024px PNG')
  const dl2 = host.waitForEvent('download')
  await host.getByRole('button', { name: /인쇄용 카드/ }).click()
  const f2 = await dl2
  const b2 = readFileSync((await f2.path())!)
  check(png(b2) && b2.readUInt32BE(16) === 1080 && b2.readUInt32BE(20) === 1500, '① 인쇄용 카드 PNG 1080×1500')

  // 하객 화면
  const guest = await newPage(await browser.newContext(mobile))
  await guest.goto(url)
  await guest.getByText('진행 순서').first().waitFor()
  check(await guest.getByText('TIMELINE').count(), '② 하객: TIMELINE / 진행 순서')
  check(await guest.getByText('귀가').count(), '② 하객: 추가한 순서 보임')
  const band = guest.getByRole('navigation', { name: '행사 당일 바로가기' })
  check(await band.count(), '④ 당일 띠 보임')
  check(await band.getByRole('link', { name: '길 찾기' }).count(), '④ 길 찾기')
  check(await band.getByRole('button', { name: '주차 안내' }).count(), '④ 주차 안내')
  check(
    (await band.getByRole('link', { name: '전화하기' }).getAttribute('href')) === 'tel:01012345678',
    '④ 전화하기 tel',
  )
  await band.getByRole('button', { name: '주차 안내' }).click()
  await guest.waitForTimeout(600)
  check(await guest.getByText('건물 지하 주차장').isVisible(), '④ 주차 안내 항목으로 이동')

  // ⑤ 큰 글씨
  const sizeOf = () =>
    guest.getByText('귀가').evaluate((e) => parseFloat(getComputedStyle(e).fontSize))
  const base = await sizeOf()
  await guest.getByRole('button', { name: '큰 글씨로 보기' }).click()
  const big = await sizeOf()
  check(Math.abs(big / base - 1.2) < 0.02, `⑤ 진행 순서 글자 1.2배 (${base}→${big})`)
  const btn = await guest.getByRole('button', { name: '글씨 원래 크기로' }).boundingBox()
  check(btn && btn.width >= 44 && btn.height >= 44, '⑤ 버튼 44px')
  check(
    await guest.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    '⑤ 390px 가로 넘침 없음',
  )
  await guest.reload()
  await guest.getByText('귀가').waitFor()
  await guest.waitForTimeout(300)
  check((await sizeOf()) === big, '⑤ 새로고침해도 기억')
  await guest.getByRole('button', { name: '글씨 원래 크기로' }).click()
  check((await sizeOf()) === base, '⑤ 다시 누르면 원래대로')

  check(errors.length === 0, `페이지 오류 없음 ${errors.join(' | ')}`)
  await browser.close()
  console.log(failures ? `\n❌ ${failures}개 실패` : '\n✅ 모두 통과')
  process.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
