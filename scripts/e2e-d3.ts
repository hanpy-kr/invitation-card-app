/**
 * D3 완료 기준(로컬): 만들기 → 발행 → 하객 응답 · 방명록 → 대시보드 집계 → 마감
 * 준비는 e2e-d2.ts와 같음 (운영 빌드, DEV_LOGIN=1, 서버 E2E_BASE)
 * 실행: pnpm e2e:d3
 */
import { mkdirSync } from 'node:fs'

import { chromium, type Browser, type Page } from 'playwright'

const BASE = process.env.E2E_BASE ?? 'http://localhost:3001'
const OUT = 'screenshots/e2e'

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

async function guestPage(browser: Browser, errors: string[]): Promise<Page> {
  const ctx = await browser.newContext(mobile)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  // 카카오 SDK는 이 테스트 범위가 아님 — 막아 둠
  await page.route(/kakao(cdn)?\.(com|net)/, (r) => r.abort())
  return page
}

async function rsvp(
  page: Page,
  url: string,
  name: string,
  attending: boolean,
  size = 1,
  meal?: '할게요' | '안 해요' | '미정',
) {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /참석 의사 전달하기|응답 고치기/ }).click()
  await page.getByLabel('성함').fill(name)
  await page.getByRole('button', { name: attending ? '참석할게요' : '못 가요' }).click()
  if (attending) {
    await page.getByLabel('인원 (본인 포함)').selectOption(String(size))
    if (meal) await page.getByRole('button', { name: meal, exact: true }).click()
  }
  await page.getByRole('button', { name: /^(보내기|고쳐서 보내기)$/ }).click()
  await page.getByText(`${name}님, 응답을 보냈어요.`).waitFor()
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROME || undefined,
  })
  const errors: string[] = []

  // ── 주최자: 만들기 · 발행
  const host = await (await browser.newContext(mobile)).newPage()
  host.on('pageerror', (e) => errors.push(e.message))
  host.on('dialog', (d) => d.accept())
  await host.route(/kakao(cdn)?\.(com|net)/, (r) => r.abort())
  await host.goto(`${BASE}/api/auth/kakao/login?dev=1&next=/new`)
  await host.getByRole('button', { name: /회식/ }).click()
  await host.waitForURL(/\/edit\//)
  const editUrl = host.url()
  const invitationId = editUrl.split('/').pop()!

  await host.getByLabel('날짜').fill('2026-12-19')
  await host.getByLabel('시간').fill('19:00')
  await host.getByRole('button', { name: '참석 여부', exact: true }).click()
  await host.getByRole('switch', { name: '식사 여부도 묻기' }).check()
  await host.getByLabel('한 응답당 최대 인원').selectOption('5')
  await host.getByRole('status').filter({ hasText: '저장됨' }).waitFor({ timeout: 15000 })

  await host.getByRole('button', { name: '발행하기' }).click()
  const sheet = host.getByRole('dialog')
  check(
    (await sheet.getByText('[신랑 이름] 같은 예시 문구가 아직 남아 있어요.').count()) === 1,
    '발행 전: 템플릿 자리 표시 문구 안내',
  )
  await sheet.getByRole('button', { name: '닫기' }).click()

  await host.getByLabel('초대장 제목').fill('E2E 13기 송년회')
  await host.getByRole('button', { name: '표지', exact: true }).click()
  await host.getByLabel('큰 제목').fill('13기 송년회')
  await host.getByRole('button', { name: '인사말', exact: true }).click()
  await host.getByLabel('인사말').fill('올해도 수고 많았어요.\n회비는 3만 원입니다.')
  await host.getByRole('textbox', { name: '보내는 사람 1' }).fill('총무 김하나')
  await host.getByRole('button', { name: '오시는 길', exact: true }).click()
  await host.getByLabel('장소 이름').fill('디어 다이닝')
  await host.getByRole('textbox', { name: /^주소/ }).fill('서울 강남구 테헤란로 152')
  await host.getByRole('status').filter({ hasText: '저장됨' }).waitFor({ timeout: 15000 })

  await host.getByRole('button', { name: '발행하기' }).click()
  check(
    (await sheet.getByLabel('발행 전에 확인해 보세요').count()) === 0,
    '문구를 바꾸면 안내 사라짐',
  )
  await sheet.getByRole('button', { name: '발행하기' }).click()
  await sheet.getByRole('heading', { name: '초대장이 발행됐어요' }).waitFor()
  const url = await sheet.getByLabel('초대장 주소').inputValue()
  const slug = url.split('/').pop()!
  check(true, `발행 → ${url}`)

  // ── 하객 3명
  const g1 = await guestPage(browser, errors)
  await rsvp(g1, url, '이참석', true, 2, '할게요')
  const g2 = await guestPage(browser, errors)
  await rsvp(g2, url, '박미정', true, 3, '미정')
  const g3 = await guestPage(browser, errors)
  await rsvp(g3, url, '최고민', true, 1, '안 해요')
  check(true, '하객 3명 참석 응답')

  // 같은 기기에서 다시 열면 기억, 고치면 기존 응답이 바뀜
  await g3.reload({ waitUntil: 'networkidle' })
  check(
    (await g3.getByText('최고민님, 응답을 보냈어요.').count()) === 1,
    '다시 열어도 내 응답 기억',
  )
  await rsvp(g3, url, '최고민', false)
  check((await g3.getByText('불참').count()) >= 1, '응답 고치기 → 불참')

  // 방명록
  await g1.getByRole('button', { name: '축하 글 남기기' }).click()
  await g1.getByLabel('이름', { exact: true }).fill('이참석')
  await g1.getByLabel('비밀번호').fill('1234')
  await g1.getByLabel('메시지').fill('올해도 고생했어! 그날 봐요')
  await g1.getByRole('button', { name: '남기기', exact: true }).click()
  await g1.getByText('올해도 고생했어! 그날 봐요').waitFor()

  await g2.reload({ waitUntil: 'networkidle' })
  await g2.getByRole('button', { name: '축하 글 남기기' }).click()
  await g2.getByLabel('이름', { exact: true }).fill('광고봇')
  await g2.getByLabel('비밀번호').fill('5678')
  await g2.getByLabel('메시지').fill('최저가 판매 http://spam.example')
  await g2.getByRole('button', { name: '남기기', exact: true }).click()
  await g2.getByText('최저가 판매').waitFor()

  await g2.getByRole('button', { name: '광고봇님 글 지우기' }).click()
  await g2.getByLabel('비밀번호').fill('0000')
  await g2.getByRole('button', { name: '지우기', exact: true }).click()
  check(
    (await g2
      .getByText('비밀번호가 맞지 않아요.')
      .waitFor()
      .then(() => 1)) === 1,
    '방명록: 틀린 비밀번호로는 못 지움',
  )

  // ── 주최자: 집계
  await host.goto(`${BASE}/dashboard/${invitationId}`, { waitUntil: 'networkidle' })
  const stat = async (label: string) =>
    (await host.locator('dl div').filter({ hasText: label }).locator('dd').textContent())?.replace(
      /\D/g,
      '',
    )
  check((await stat('참석 인원')) === '5', '집계: 참석 인원 5명 (2 + 3)')
  check((await stat('참석 응답')) === '2', '집계: 참석 응답 2건')
  check((await stat('불참')) === '1', '집계: 불참 1건 (고친 응답 반영)')
  check(
    (await host.getByText('식사 2명 · 안 함 0명 · 미정 3명').count()) === 1,
    '집계: 식사 2 · 안 함 0 · 미정 3',
  )
  check(
    (await host.getByText('참석 응답 3건').count()) === 1,
    '응답 목록 3건 (고친 응답은 새로 안 생김)',
  )

  // 대시보드 목록 카드의 응답 수 (상관 서브쿼리 버그 회귀 방지)
  await host.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
  check(
    (await host
      .locator('li')
      .filter({ hasText: 'E2E 13기 송년회' })
      .getByText('참석 5명 · 응답 3건')
      .count()) >= 1,
    '대시보드 목록: 참석 5명 · 응답 3건',
  )
  await host.goto(`${BASE}/dashboard/${invitationId}`, { waitUntil: 'networkidle' })

  await host
    .locator('li')
    .filter({ hasText: '광고봇' })
    .getByRole('button', { name: '숨기기' })
    .click()
  await host
    .locator('li')
    .filter({ hasText: '광고봇' })
    .getByRole('button', { name: '다시 보이기' })
    .waitFor()
  await host.screenshot({ path: `${OUT}/4-responses.png`, fullPage: true })

  await g2.reload({ waitUntil: 'networkidle' })
  await g2.getByText('올해도 고생했어! 그날 봐요').waitFor()
  check((await g2.getByText('최저가 판매').count()) === 0, '주최자가 숨긴 글은 하객에게 안 보임')

  // ── 마감
  await host.goto(editUrl, { waitUntil: 'networkidle' })
  await host.getByRole('button', { name: '참석 여부', exact: true }).click()
  await host.getByLabel('응답 마감일').fill('2026-10-01')
  await host.getByRole('status').filter({ hasText: '저장됨' }).waitFor({ timeout: 15000 })
  const g4 = await guestPage(browser, errors)
  await g4.goto(url, { waitUntil: 'networkidle' })
  check(
    (await g4.getByText('응답이 마감됐어요.').count()) === 1,
    '마감일 지나면 하객 화면에 마감 표시',
  )
  const late = await fetch(`${BASE}/api/i/${slug}/rsvp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.9' },
    body: JSON.stringify({ name: '늦은사람', attending: true, partySize: 1, meal: null }),
  })
  check(late.status === 403, '마감 후 API 직접 호출도 막힘')
  await g4.screenshot({ path: `${OUT}/5-guest-closed.png`, fullPage: true })

  check(errors.length === 0, `브라우저 에러 없음 ${errors.length ? JSON.stringify(errors) : ''}`)
  await browser.close()
  console.log(failures === 0 ? '\nD3 E2E 통과' : `\nD3 E2E 실패 ${failures}건`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
