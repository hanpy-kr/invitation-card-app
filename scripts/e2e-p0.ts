/**
 * 2차 P0 완료 기준(로컬): 송년회 초대장을 새로 만들어 장소 2개 · 메뉴 질문 · 회비 계좌를 넣고 발행
 * → 카톡 카드의 [참석 여부 알리기](?go=rsvp)로 응답 → 대시보드 집계 · CSV에 메뉴 열
 * + 계좌 복사 · 토스 링크, 캘린더 저장(.ics), 나도 만들기(내용 안 가져옴), 친구에게 공유
 * 준비는 e2e-d2.ts와 같음 (운영 빌드, DEV_LOGIN=1, 서버 E2E_BASE). 실행: pnpm e2e:p0
 */
import { mkdirSync } from 'node:fs'

import { chromium, type Browser, type Page } from 'playwright'

const BASE = process.env.E2E_BASE ?? 'http://localhost:3001'
const OUT = 'screenshots/e2e'

const FAKE_KAKAO_SDK = `
window.Kakao = {
  _key: null,
  isInitialized() { return !!this._key },
  init(k) { this._key = k },
  Share: { sendDefault(o) { window.__kakaoShare = o } },
}`

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
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.0',
}

type Feed = {
  content: { title: string; imageUrl: string; link: { mobileWebUrl: string } }
  buttons: { title: string; link: { mobileWebUrl: string } }[]
}

async function prepare(page: Page, errors: string[]) {
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('dialog', (d) => d.accept())
  await page.route('https://t1.kakaocdn.net/kakao_js_sdk/**', (r) =>
    r.fulfill({ contentType: 'text/javascript', body: FAKE_KAKAO_SDK }),
  )
  await page.route(/dapi\.kakao\.com/, (r) => r.abort())
}

async function waitSaved(page: Page) {
  await page.getByRole('status').filter({ hasText: '저장됨' }).waitFor({ timeout: 15000 })
}

async function readFeed(page: Page): Promise<Feed> {
  await page.waitForFunction(() => (window as unknown as { __kakaoShare?: unknown }).__kakaoShare)
  return page.evaluate(() => (window as unknown as { __kakaoShare: Feed }).__kakaoShare)
}

async function guestRsvp(
  browser: Browser,
  errors: string[],
  link: string,
  name: string,
  menu: string,
) {
  const page = await (await browser.newContext(mobile)).newPage()
  await prepare(page, errors)
  await page.goto(link, { waitUntil: 'networkidle' })
  // ?go=rsvp → 응답 폼이 열린 채로 참석 칸에 와 있어야 함
  const form = page.locator('#rsvp form')
  await form.waitFor()
  const top = await page.locator('#rsvp').evaluate((el) => el.getBoundingClientRect().top)
  await form.getByLabel('성함').fill(name)
  await form.getByRole('button', { name: '참석할게요' }).click()
  await form.getByRole('button', { name: menu, exact: true }).click()
  await form.getByRole('button', { name: '보내기', exact: true }).click()
  await page.getByText(`${name}님, 응답을 보냈어요.`).waitFor()
  return { page, top }
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROME || undefined,
  })
  const errors: string[] = []

  // ── 주최자: 송년회 만들기
  const hostCtx = await browser.newContext(mobile)
  const host = await hostCtx.newPage()
  await prepare(host, errors)
  await host.goto(`${BASE}/api/auth/kakao/login?dev=1&next=/new`)
  await host.getByRole('button', { name: /송년회/ }).click()
  await host.waitForURL(/\/edit\//)
  const invitationId = host.url().split('/').pop()!
  await host.getByRole('button', { name: '표지', exact: true }).waitFor()
  const blockNames = await host
    .locator('[aria-expanded]')
    .evaluateAll((els) => els.map((e) => e.textContent?.replace(/[▾▴]/g, '').trim()))
  check(
    ['표지', '인사말', '오시는 길1차', '오시는 길2차', '참석 여부', '계좌 · 회비', '안내'].every(
      (n) => blockNames.includes(n),
    ),
    `송년회 템플릿: 표지 · 인사말 · 장소 2개(1차 · 2차) · 참석 · 계좌 · 안내 (${blockNames.join(', ')})`,
  )

  await host.getByLabel('초대장 제목').fill('E2E 디어 13기 송년회')
  await host.getByLabel('날짜').fill('2026-12-19')
  await host.getByLabel('시간').fill('19:00')
  await host.getByRole('button', { name: '표지', exact: true }).click()
  await host.getByLabel('큰 제목').fill('디어 13기 송년회')
  await host.getByRole('button', { name: '인사말', exact: true }).click()
  await host.getByRole('textbox', { name: '보내는 사람 1' }).fill('총무 김하나')

  const places = host.getByRole('button', { name: '오시는 길', exact: true })
  await places.nth(0).click()
  await host.getByLabel('장소 이름').fill('디어 다이닝')
  await host.getByRole('textbox', { name: /^주소/ }).fill('서울 강남구 테헤란로 152')
  await places.nth(0).click()
  await places.nth(1).click()
  await host.getByLabel('장소 이름').fill('디어 펍')
  await host.getByRole('textbox', { name: /^주소/ }).fill('서울 강남구 테헤란로 146')
  await places.nth(1).click()

  await host.getByRole('button', { name: '참석 여부', exact: true }).click()
  check(
    (await host.getByRole('textbox', { name: '질문 1', exact: true }).inputValue()) ===
      '메뉴를 골라 주세요',
    '참석 질문 예시: 메뉴 선택',
  )
  await host.getByRole('button', { name: '참석 여부', exact: true }).click()

  await host.getByRole('button', { name: '계좌 · 회비', exact: true }).click()
  await host.getByLabel('1인 회비(원)').fill('30000')
  await host.getByLabel('그룹 1 계좌 1 은행').fill('카카오뱅크')
  await host.getByLabel('그룹 1 계좌 1 계좌번호').fill('3333-01-2345678')
  await host.getByLabel('예금주').first().fill('김하나')
  await host.getByRole('button', { name: '계좌 · 회비', exact: true }).click()

  await host.getByRole('button', { name: '안내', exact: true }).click()
  await host.getByLabel('안내 1 내용').fill('1인 3만 원 · 2차는 n분의 1\n문의 010-1234-5678')
  await waitSaved(host)
  await host.screenshot({ path: `${OUT}/p0-1-editor.png`, fullPage: true })

  await host.getByRole('button', { name: '발행하기' }).click()
  const sheet = host.getByRole('dialog')
  const warnings = await sheet.getByLabel('발행 전에 확인해 보세요').allTextContents()
  check(warnings.length === 0, `발행 전 확인 항목 없음 ${warnings.join(' / ')}`)
  check(
    (await sheet
      .getByLabel('카카오톡 공유 카드 미리보기')
      .getByText('참석 여부 알리기')
      .count()) === 1,
    '발행 패널: 카드 미리보기에 [참석 여부 알리기]',
  )
  await sheet.getByRole('button', { name: '발행하기' }).click()
  await sheet.getByRole('heading', { name: '초대장이 발행됐어요' }).waitFor()
  const url = await sheet.getByLabel('초대장 주소').inputValue()
  const slug = url.split('/').pop()!
  await sheet.getByRole('button', { name: '카카오톡으로 보내기' }).click()
  const feed = await readFeed(host)
  const rsvpButton = feed.buttons.find((b) => b.title === '참석 여부 알리기')
  check(
    feed.buttons[0]?.title === '초대장 보기' && rsvpButton?.link.mobileWebUrl === `${url}?go=rsvp`,
    `카톡 카드 버튼: [초대장 보기] [참석 여부 알리기 → ${rsvpButton?.link.mobileWebUrl}]`,
  )
  check(feed.content.title === 'E2E 디어 13기 송년회', '카톡 카드 제목')
  check(
    /\/covers\/share\/yearend-snow\.jpg$/.test(feed.content.imageUrl),
    '카톡 카드 사진: 사진이 없으면 송년회 디자인 표지(눈꽃) JPEG',
  )
  await sheet.screenshot({ path: `${OUT}/p0-2-publish.png` })

  // ── 하객: 카톡 카드의 참석 버튼으로 들어와 응답
  const g1 = await guestRsvp(browser, errors, rsvpButton!.link.mobileWebUrl, '이참석', '해산물')
  check(g1.top < 200 && g1.top > -50, `?go=rsvp → 참석 칸으로 스크롤 (top ${Math.round(g1.top)})`)
  await g1.page.screenshot({ path: `${OUT}/p0-3-guest-rsvp.png` })
  await guestRsvp(browser, errors, rsvpButton!.link.mobileWebUrl, '박고기', '고기')
  check(true, '하객 2명 응답 (메뉴: 해산물 · 고기)')

  // ── 하객 화면: 장소 2개 · 회비 · 계좌 · 공유
  const gp = g1.page
  await gp.goto(url, { waitUntil: 'networkidle' })
  check((await gp.getByText('오후 9시부터').count()) === 1, '장소 2개 (2차 시간 표시)')
  check((await gp.getByText('30,000원').count()) === 1, '1인 회비 크게 표시')
  const toss = await gp.getByRole('link', { name: '토스로 보내기' }).getAttribute('href')
  check(
    toss?.startsWith('supertoss://send?') &&
      toss.includes('amount=30000') &&
      toss.includes('accountNo=3333012345678'),
    `토스 링크 ${toss}`,
  )
  await gp.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
  await gp.getByRole('button', { name: /계좌번호 복사/ }).click()
  check(
    (await gp.evaluate(() => navigator.clipboard.readText())) === '카카오뱅크 3333-01-2345678',
    '계좌 복사',
  )
  check(
    (await gp.getByRole('link', { name: '010-1234-5678' }).getAttribute('href')) ===
      'tel:01012345678',
    '안내: 전화번호 자동 링크',
  )
  await gp.getByRole('button', { name: '친구에게 공유' }).click()
  const friend = await readFeed(gp)
  check(
    friend.content.link.mobileWebUrl === url && friend.buttons.length === 2,
    '친구에게 공유: 주최자와 같은 카드',
  )
  await gp.screenshot({ path: `${OUT}/p0-4-guest.png`, fullPage: true })

  // ── 주최자: 대시보드 집계 + CSV
  await host.goto(`${BASE}/dashboard/${invitationId}`, { waitUntil: 'networkidle' })
  const stat = host
    .locator('div')
    .filter({ has: host.getByRole('heading', { name: '메뉴를 골라 주세요' }) })
  const statText = (await stat.last().textContent()) ?? ''
  check(
    statText.includes('고기1건') && statText.includes('해산물1건') && statText.includes('채식0건'),
    `대시보드: 메뉴 보기별 집계 (${statText})`,
  )
  await host.screenshot({ path: `${OUT}/p0-5-dashboard.png`, fullPage: true })
  const csvRes = await hostCtx.request.get(`${BASE}/api/invitations/${invitationId}/rsvps.csv`)
  const csv = await csvRes.text()
  const [head, ...rows] = csv.replace(/^﻿/, '').trim().split('\r\n')
  check(csv.startsWith('﻿'), 'CSV: UTF-8 BOM')
  check(head.split(',').includes('메뉴를 골라 주세요'), `CSV 머리: ${head}`)
  check(
    rows.some((r) => r.startsWith('이참석,참석,1,해산물')) &&
      rows.some((r) => r.startsWith('박고기,참석,1,고기')),
    'CSV: 메뉴 열에 답',
  )
  const other = await (
    await browser.newContext()
  ).request.get(`${BASE}/api/invitations/${invitationId}/rsvps.csv`)
  check(other.status() === 401, 'CSV: 로그인 안 한 사람은 못 받음')

  // ── 나도 만들기: 원본 내용(계좌 · 장소 · 안내)이 새 초대장에 없어야 함
  await host.goto(`${BASE}/new?from=${slug}`, { waitUntil: 'networkidle' })
  await host.getByRole('button', { name: '이 구성으로 만들기' }).click()
  await host.waitForURL(/\/edit\//)
  await host.getByRole('button', { name: '계좌 · 회비', exact: true }).click()
  check(
    (await host.getByLabel('그룹 1 계좌 1 계좌번호').inputValue()) === '' &&
      (await host.getByLabel('1인 회비(원)').inputValue()) === '',
    '나도 만들기: 계좌 · 회비는 비어 있음',
  )
  check(
    (await host.getByLabel('초대장 제목').inputValue()) === '[모임 이름] 송년회',
    '나도 만들기: 템플릿 기본 문구',
  )

  check(errors.length === 0, `브라우저 에러 없음 ${errors.length ? JSON.stringify(errors) : ''}`)
  console.log(`\n테스트 초대장: ${url}`)
  await browser.close()
  console.log(failures === 0 ? '\nP0 E2E 통과' : `\nP0 E2E 실패 ${failures}건`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
