/**
 * 2차 P1 확인(로컬): 투표 · 명단 공개 · 응답 수정/취소 · 회비 체크 · 복제 · 공동 편집 · 방문 통계 · 익명 시작
 * 준비는 e2e-d2.ts와 같음 (운영 빌드, DEV_LOGIN=1, 서버 E2E_BASE) + 시드 새로(pnpm db:seed). 실행: pnpm e2e:p1
 * 완료 기준: 결혼 초대장에서 청첩장 모임을 만들어 날짜 투표 → 확정 → 같은 링크에서 참석 응답 · 명단 공개
 */
import { mkdirSync } from 'node:fs'

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'

const BASE = process.env.E2E_BASE ?? 'http://localhost:3001'
const OUT = 'screenshots/e2e'
const PHOTOS = process.env.E2E_PHOTOS ?? '.local/e2e-photos'
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
  // 결혼 초대장(표지 사진 · 이름) → 대시보드 [청첩장 모임 만들기]
  const { page: host } = await login(browser, '/new')
  await host.getByRole('button', { name: /결혼식/ }).click()
  await host.waitForURL(/\/edit\//)
  const weddingId = host.url().split('/').pop()!
  await host.getByLabel('초대장 제목').fill('E2E 민준 ♥ 서연 결혼합니다')
  await host.getByRole('button', { name: '표지', exact: true }).click()
  await host.locator('input[type=file]').first().setInputFiles(`${PHOTOS}/photo_1.jpg`)
  await host.getByAltText('표지 사진 미리보기').waitFor({ timeout: 30000 })
  const weddingCover = await host.getByAltText('표지 사진 미리보기').getAttribute('src')
  await host.getByRole('button', { name: '인사말', exact: true }).click()
  await host.getByRole('textbox', { name: '보내는 사람 1' }).fill('민준')
  await host.getByRole('textbox', { name: '보내는 사람 2' }).fill('서연')
  await waitSaved(host)

  await host.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
  await host
    .locator('li')
    .filter({ hasText: 'E2E 민준 ♥ 서연 결혼합니다' })
    .getByRole('button', { name: '청첩장 모임 만들기' })
    .click()
  await host.waitForURL(/\/edit\//)
  const invitationId = host.url().split('/').pop()!
  check(
    (await host.getByLabel('초대장 제목').inputValue()) === '민준 · 서연 청첩장 모임',
    '청첩장 모임 만들기: 이름 채워진 제목',
  )
  check(
    (await host.getByLabel('행사 종류').inputValue()) === 'prewedding',
    '청첩장 모임 만들기: 행사 종류 prewedding',
  )
  await host.getByRole('button', { name: '표지', exact: true }).click()
  const newCover = await host.getByAltText('표지 사진 미리보기').getAttribute('src')
  check(
    newCover &&
      weddingCover &&
      newCover !== weddingCover &&
      newCover.includes(`/inv/${invitationId}/`),
    '표지 사진은 새 key로 복사',
  )
  const coverRes = await host.request.get(`${BASE}${newCover}`)
  check(coverRes.ok(), '복사한 표지 사진 열림')
  // 결혼 초대장을 지워도 청첩장 모임 사진은 남음
  await host.request.delete(`${BASE}/api/invitations/${weddingId}`, { headers: { origin: BASE } })
  check(
    (await host.request.get(`${BASE}${weddingCover}`)).status() === 404,
    '원본 초대장 삭제 → 원본 사진 지워짐',
  )
  check((await host.request.get(`${BASE}${newCover}`)).ok(), '복사본 사진은 그대로')
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
    .filter({ has: host.getByText('디어고 12기 송년회', { exact: true }) })
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

/** 다시 보내기 카드 (시드 demomeet) */
async function resendFlow(browser: Browser) {
  const { page: host } = await login(browser, '/dashboard')
  await host.waitForURL(/\/dashboard/)
  const href = await host
    .locator('li')
    .filter({ has: host.getByText('디어고 12기 송년회', { exact: true }) })
    .getByRole('link', { name: '응답 보기' })
    .getAttribute('href')
  await host.goto(`${BASE}${href}`, { waitUntil: 'networkidle' })
  const read = () =>
    host.evaluate(() => {
      const w = window as unknown as { __kakaoShare?: unknown }
      const v = w.__kakaoShare
      w.__kakaoShare = undefined
      return v as {
        content: { title: string; description: string }
        buttons: { title: string; link: { mobileWebUrl: string } }[]
      }
    })
  await host.getByRole('button', { name: '응답 안 한 분께 다시 보내기' }).click()
  await host.waitForFunction(() => (window as unknown as { __kakaoShare?: unknown }).__kakaoShare)
  const r = await read()
  check(
    r.content.title.startsWith('참석 여부를 알려 주세요') &&
      r.content.description.startsWith('12월 12일까지') &&
      r.buttons[0].title === '참석 여부 알리기' &&
      r.buttons[0].link.mobileWebUrl.endsWith('/i/demomeet?go=rsvp'),
    `다시 보내기 카드: ${r.content.title} / ${r.content.description}`,
  )
  await host.getByRole('button', { name: '전날 안내 보내기' }).click()
  await host.waitForFunction(() => (window as unknown as { __kakaoShare?: unknown }).__kakaoShare)
  const d = await read()
  check(
    d.content.title.startsWith('내일 만나요') &&
      d.content.description === '내일 오후 7시 · 디어 다이닝',
    `전날 안내 카드: ${d.content.title} / ${d.content.description}`,
  )
}

/** 내 초대장 복제 (시드 demomeet) */
async function copyFlow(browser: Browser) {
  const { page: host } = await login(browser, '/dashboard')
  await host.waitForURL(/\/dashboard/)
  await host
    .locator('li')
    .filter({ has: host.getByText('디어고 12기 송년회', { exact: true }) })
    .getByRole('button', { name: '복제' })
    .first()
    .click()
  await host.waitForURL(/\/edit\//)
  check(
    (await host.getByLabel('초대장 제목').inputValue()) === '디어고 12기 송년회 (복사본)',
    '복제: 제목 (복사본)',
  )
  await host.getByRole('button', { name: '계좌 · 회비', exact: true }).click()
  check(
    (await host.getByLabel('그룹 1 계좌 1 계좌번호').inputValue()) === '3333-00-0000004',
    '복제: 내 초대장은 계좌까지 그대로',
  )
  const id = host.url().split('/').pop()!
  await host.goto(`${BASE}/dashboard/${id}`, { waitUntil: 'networkidle' })
  check((await host.getByText('참석 응답 0건').count()) === 1, '복제: 응답은 안 가져옴')
}

/** 공동 편집: 초대 링크 → 두 번째 사용자가 편집 · 응답 보기, 삭제 · 편집자 관리는 못 함 + 새 응답 n */
async function editorsFlow(browser: Browser) {
  const { page: owner } = await login(browser, '/dashboard')
  await owner.waitForURL(/\/dashboard/)
  const href = (await owner
    .locator('li')
    .filter({ has: owner.getByText('디어고 12기 송년회', { exact: true }) })
    .getByRole('link', { name: '응답 보기' })
    .first()
    .getAttribute('href'))!
  const id = href.split('/').pop()!
  await owner.goto(`${BASE}${href}`, { waitUntil: 'networkidle' })
  await owner.getByRole('button', { name: '초대 링크 만들기' }).click()
  const link = await owner.getByLabel('공동 편집 초대 링크').inputValue()
  check(/\/join\/.+/.test(link), '초대 링크 만들기')

  const { page: ed } = await login(browser, new URL(link).pathname, '2')
  await ed.waitForURL(new RegExp(`/edit/${id}`))
  check(true, '두 번째 사용자: 링크 → 로그인 → 편집기')
  check(
    (await ed.getByRole('button', { name: '초대장 지우기' }).count()) === 0,
    '편집자: 삭제 버튼 없음',
  )
  await ed.getByRole('button', { name: '인사말', exact: true }).click()
  await ed.getByLabel('제목', { exact: true }).fill('편집자가 고친 제목')
  await waitSaved(ed)
  check(true, '편집자: 고치고 자동 저장')
  const del = await ed.request.delete(`${BASE}/api/invitations/${id}`, {
    headers: { origin: BASE },
  })
  check(del.status() === 404, '편집자: 초대장 삭제 API 막힘')
  const inv2 = await ed.request.post(`${BASE}/api/invitations/${id}/editors`, {
    headers: { origin: BASE },
    data: {},
  })
  check(inv2.status() === 403, '편집자: 초대 링크 만들기 막힘')
  await ed.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
  check((await ed.getByText('함께 편집 중인 초대장').count()) >= 1, '편집자 대시보드에 공유 초대장')

  // 새 응답 n: 주인이 응답 화면을 본 뒤 응답 2건 → 목록에 '새 응답 2'
  await owner.goto(`${BASE}${href}`, { waitUntil: 'networkidle' })
  for (const [i, n] of ['새손님1', '새손님2'].entries()) {
    await fetch(`${BASE}/api/i/demomeet/rsvp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `203.0.113.4${i}` },
      body: JSON.stringify({
        name: n,
        attending: true,
        partySize: 1,
        meal: null,
        answers: { menu01: '채식' },
      }),
    })
  }
  await owner.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
  check(
    (await owner
      .locator('li')
      .filter({ has: owner.getByText('디어고 12기 송년회', { exact: true }) })
      .first()
      .getByText('새 응답 2')
      .count()) === 1,
    "대시보드: '새 응답 2'",
  )
  await owner.goto(`${BASE}${href}`, { waitUntil: 'networkidle' })
  check(
    (await owner.getByText('새', { exact: true }).count()) === 2,
    '응답 목록: 새 응답 2건에 표시',
  )
  await owner.screenshot({ path: `${OUT}/p1-editors.png`, fullPage: true })
  await owner.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
  check((await owner.getByText(/새 응답/).count()) === 0, '확인 뒤 새 응답 표시 사라짐')
  // 편집자 빼기
  await owner.goto(`${BASE}${href}`, { waitUntil: 'networkidle' })
  await owner.getByRole('button', { name: '개발자2 편집자 빼기' }).click()
  await owner.getByRole('button', { name: '개발자2 편집자 빼기' }).waitFor({ state: 'detached' })
  // 로딩 화면(loading.tsx) 때문에 상태 코드는 200일 수 있어 내용으로 확인
  await ed.goto(`${BASE}/edit/${id}`, { waitUntil: 'networkidle' })
  check(
    (await ed.getByText('찾으시는 페이지가 없어요').count()) === 1 &&
      (
        await ed.request.put(`${BASE}/api/invitations/${id}`, {
          headers: { origin: BASE },
          data: {},
        })
      ).status() !== 200,
    '편집자에서 빠지면 편집기 못 염',
  )
}

/** 방문 통계: 기기당 하루 1회 sendBeacon → 대시보드 열람 수 · /admin/stats 접근 제한 */
async function statsFlow(browser: Browser) {
  const g1 = await guest(browser)
  const beacon = g1.waitForRequest((r) => r.url().endsWith('/api/i/demomeet/view'))
  await g1.goto(`${BASE}/i/demomeet`, { waitUntil: 'networkidle' })
  await beacon
  await g1.reload({ waitUntil: 'networkidle' })
  const g2 = await guest(browser)
  await g2.goto(`${BASE}/i/demomeet`, { waitUntil: 'networkidle' })
  await g2.waitForTimeout(500)
  const { page: host } = await login(browser, '/dashboard')
  await host.waitForURL(/\/dashboard/)
  const href = (await host
    .locator('li')
    .filter({ has: host.getByText('디어고 12기 송년회', { exact: true }) })
    .getByRole('link', { name: '응답 보기' })
    .first()
    .getAttribute('href'))!
  await host.goto(`${BASE}${href}`, { waitUntil: 'networkidle' })
  const text = (await host.getByText(/열람 \d+회/).textContent()) ?? ''
  check(/열람 2회/.test(text), `대시보드 열람 수: 기기 2대 · 새로고침은 안 셈 (${text.trim()})`)
  await host.goto(`${BASE}/admin/stats`, { waitUntil: 'networkidle' })
  const adminVisible = (await host.getByRole('heading', { name: '운영 지표' }).count()) === 1
  if (process.env.EXPECT_ADMIN === '1') {
    check(adminVisible, '/admin/stats: ADMIN_KAKAO_IDS에 있으면 보임')
    await host.screenshot({ path: `${OUT}/p1-admin.png`, fullPage: true })
  } else {
    check(!adminVisible, '/admin/stats: ADMIN_KAKAO_IDS가 비어 있으면 아무도 못 봄')
  }
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
  if (run('resend')) await resendFlow(browser)
  if (run('copy')) await copyFlow(browser)
  if (run('editors')) await editorsFlow(browser)
  if (run('stats')) await statsFlow(browser)

  check(errors.length === 0, `브라우저 에러 없음 ${errors.length ? JSON.stringify(errors) : ''}`)
  await browser.close()
  console.log(failures === 0 ? '\nP1 E2E 통과' : `\nP1 E2E 실패 ${failures}건`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
