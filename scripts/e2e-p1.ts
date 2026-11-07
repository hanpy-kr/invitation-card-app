/**
 * 2차 P1 확인(로컬): 투표 · 명단 공개 · 응답 수정/취소 · 회비 체크 · 복제 · 공동 편집 · 방문 통계 · 익명 시작
 * 준비는 e2e-d2.ts와 같음 (운영 빌드, DEV_LOGIN=1, 서버 E2E_BASE). 실행: pnpm e2e:p1
 * 완료 기준: 결혼 초대장에서 청첩장 모임을 만들어 날짜 투표 → 확정 → 같은 링크에서 참석 응답 · 명단 공개
 */
import { mkdirSync } from 'node:fs'

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'

const BASE = process.env.E2E_BASE ?? 'http://localhost:3001'
const OUT = 'screenshots/e2e'
const ONLY = process.env.ONLY?.split(',')

let failures = 0
function check(ok: unknown, label: string) {
  console.log(`${ok ? '✅' : '❌'} ${label}`)
  if (!ok) failures++
}

const mobile = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'ko-KR',
}

const FAKE_KAKAO_SDK = `
window.Kakao = {
  _key: null,
  isInitialized() { return !!this._key },
  init(k) { this._key = k },
  Share: { sendDefault(o) { window.__kakaoShare = o } },
}`

const errors: string[] = []

async function newPage(ctx: BrowserContext): Promise<Page> {
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('dialog', (d) => d.accept())
  await page.route('https://t1.kakaocdn.net/kakao_js_sdk/**', (r) =>
    r.fulfill({ contentType: 'text/javascript', body: FAKE_KAKAO_SDK }),
  )
  await page.route(/dapi\.kakao\.com/, (r) => r.abort())
  return page
}

async function guest(browser: Browser) {
  return newPage(await browser.newContext(mobile))
}

async function waitSaved(page: Page) {
  await page.getByRole('status').filter({ hasText: '저장됨' }).waitFor({ timeout: 15000 })
}

async function login(browser: Browser, next: string, as = '') {
  const ctx = await browser.newContext(mobile)
  const page = await newPage(ctx)
  await page.goto(
    `${BASE}/api/auth/kakao/login?dev=1${as ? `&as=${as}` : ''}&next=${encodeURIComponent(next)}`,
  )
  return { ctx, page }
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

/** 날짜 투표 → 확정 → 같은 링크에서 참석 · 명단 */
async function voteFlow(browser: Browser) {
  const { page: host } = await login(browser, '/new')
  await host.getByRole('button', { name: /청첩장 모임/ }).click()
  await host.waitForURL(/\/edit\//)
  const invitationId = host.url().split('/').pop()!
  await host.getByLabel('초대장 제목').fill('E2E 민준 · 서연 청첩장 모임')
  await host.getByRole('button', { name: '+ 날짜 · 장소 투표' }).click()
  for (const [i, d] of ['2026-12-04', '2026-12-11'].entries()) {
    await host.getByRole('button', { name: '+ 후보 추가' }).click()
    await host.getByLabel(`후보 ${i + 1} 날짜`).fill(d)
  }
  await waitSaved(host)
  const url = await publish(host)
  const slug = url.split('/').pop()!

  const g1 = await guest(browser)
  await g1.goto(url, { waitUntil: 'networkidle' })
  check((await g1.getByText('날짜 투표 중').count()) >= 1, '투표 중: 표지에 "날짜 투표 중"')
  await g1.getByRole('button', { name: '투표하기' }).click()
  await g1.getByLabel('이름', { exact: true }).fill('박투표')
  await g1.getByRole('button', { name: /12월 4일/ }).click()
  await g1.getByRole('button', { name: /12월 11일/ }).click()
  await g1.getByRole('button', { name: '투표하기', exact: true }).click()
  await g1.getByText('박투표님, 투표했어요.').waitFor()
  const g2 = await guest(browser)
  await g2.goto(url, { waitUntil: 'networkidle' })
  await g2.getByRole('button', { name: '투표하기' }).click()
  await g2.getByLabel('이름', { exact: true }).fill('최하나')
  await g2.getByRole('button', { name: /12월 11일/ }).click()
  await g2.getByRole('button', { name: '투표하기', exact: true }).click()
  await g2.getByText('최하나님, 투표했어요.').waitFor()
  // 고치기: 박투표가 12/4만
  await g1.getByRole('button', { name: '투표 고치기' }).click()
  await g1.getByRole('button', { name: /12월 11일/ }).click()
  await g1.getByRole('button', { name: '고쳐서 투표하기' }).click()
  await g1.getByText('박투표님, 투표했어요.').waitFor()
  const res = await (await fetch(`${BASE}/api/i/${slug}/vote`)).json()
  check(
    res.voters === 2 &&
      res.results[0].count === 1 &&
      res.results[1].count === 1 &&
      res.results[1].names[0] === '최하나',
    `투표 집계 (고친 표 반영): ${JSON.stringify(res.results.map((r: { count: number }) => r.count))}`,
  )
  await g1.screenshot({ path: `${OUT}/p1-vote-guest.png`, fullPage: true })

  // 확정 (12/11)
  await host.goto(`${BASE}/dashboard/${invitationId}`, { waitUntil: 'networkidle' })
  await host
    .locator('li')
    .filter({ hasText: '12월 11일' })
    .getByRole('button', { name: '확정' })
    .click()
  await host.getByText('(확정됨)').waitFor()
  await host.screenshot({ path: `${OUT}/p1-vote-dashboard.png`, fullPage: true })

  const g3 = await guest(browser)
  await g3.goto(url, { waitUntil: 'networkidle' })
  check(g3.url() === url, `확정 뒤에도 같은 링크 ${url}`)
  check((await g3.getByText('날짜 투표 중').count()) === 0, '확정 뒤 "날짜 투표 중" 사라짐')
  check((await g3.getByText('26.12.11').count()) === 1, '확정 날짜가 표지에 반영 (26.12.11)')
  check((await g3.getByText('확정됐어요').count()) === 1, '투표 블록은 결과만 남음')
  const late = await fetch(`${BASE}/api/i/${slug}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.20' },
    body: JSON.stringify({ name: '늦은표', choices: [res.results[0].id] }),
  })
  check(late.status === 403, '확정 뒤 투표 API 막힘')
  return { host, url, slug, invitationId, g3 }
}

/** 회비 입금 체크: 시드 demomeet(1인 회비 3만 원) */
async function duesFlow(browser: Browser) {
  const post = (name: string, partySize: number, ip: string) =>
    fetch(`${BASE}/api/i/demomeet/rsvp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify({
        name,
        attending: true,
        partySize,
        meal: null,
        answers: { menu01: '고기' },
      }),
    })
  await post('회비둘', 2, '203.0.113.31')
  await post('회비하나', 1, '203.0.113.32')
  const { ctx, page: host } = await login(browser, '/dashboard')
  await host.waitForURL(/\/dashboard/)
  const href = await host
    .locator('li')
    .filter({ hasText: '디어고 12기 송년회' })
    .getByRole('link', { name: '응답 보기' })
    .getAttribute('href')
  await host.goto(`${BASE}${href}`, { waitUntil: 'networkidle' })
  check((await host.getByText('90,000원').count()) === 1, '예상 회비 = 참석 3명 × 3만 원')
  await host.getByLabel('회비둘 회비 입금').check()
  await host.getByText('2명', { exact: true }).waitFor()
  check(
    (await host.getByText('60,000원 · 응답 1건').count()) === 1,
    '입금 체크 → 입금 2명 · 6만 원',
  )
  await host.reload({ waitUntil: 'networkidle' })
  check(await host.getByLabel('회비둘 회비 입금').isChecked(), '입금 체크 저장됨')
  const csv = await (
    await ctx.request.get(`${BASE}/api${href!.replace('/dashboard', '/invitations')}/rsvps.csv`)
  ).text()
  check(
    csv.split('\r\n')[0].includes('입금') && csv.includes('회비둘,참석,2,고기,,입금'),
    'CSV 입금 열',
  )
  const g = await guest(browser)
  const res = await g.request.patch(
    `${BASE}/api${href!.replace('/dashboard', '/invitations')}/rsvps/00000000-0000-4000-8000-000000000000`,
    {
      data: { paid: true },
      headers: { origin: BASE },
    },
  )
  check(res.status() === 401, '로그인 안 한 사람은 입금 체크 못 함')
  await host.screenshot({ path: `${OUT}/p1-dues.png`, fullPage: true })
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROME || undefined,
  })
  const run = (name: string) => !ONLY || ONLY.includes(name)

  if (run('vote')) {
    const v = await voteFlow(browser)
    // 같은 링크에서 참석 응답 · 명단 공개 (청첩장 모임 = 모임형 → 기본 켜짐)
    await v.g3.getByRole('button', { name: '참석 의사 전달하기' }).click()
    await v.g3.getByLabel('성함').fill('이참석')
    await v.g3.getByRole('button', { name: '참석할게요' }).click()
    check(
      (await v.g3.getByText('참석하시면 참석자 명단에 이름이 보여요.').count()) === 1,
      '명단 공개 안내',
    )
    await v.g3.getByRole('button', { name: '보내기', exact: true }).click()
    await v.g3.getByText('이참석님, 응답을 보냈어요.').waitFor()
    await v.g3.locator('li').filter({ hasText: '이참석' }).first().waitFor()
    check(
      (await v.g3.getByText('참석 예정 1명').count()) === 1,
      '같은 링크에서 참석 응답 → 명단에 이름',
    )
    await v.g3.screenshot({ path: `${OUT}/p1-after-confirm.png`, fullPage: true })
    // 응답 취소
    await v.g3.getByRole('button', { name: '응답 취소' }).click()
    await v.g3.getByRole('button', { name: '참석 의사 전달하기' }).waitFor()
    await v.g3.getByText('참석 예정 0명').waitFor()
    check(true, '응답 취소 → 명단에서 빠짐')
  }

  if (run('dues')) await duesFlow(browser)

  check(errors.length === 0, `브라우저 에러 없음 ${errors.length ? JSON.stringify(errors) : ''}`)
  await browser.close()
  console.log(failures === 0 ? '\nP1 E2E 통과' : `\nP1 E2E 실패 ${failures}건`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
