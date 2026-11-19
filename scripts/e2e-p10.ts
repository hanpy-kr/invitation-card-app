/**
 * 내 초대장 카드(세로형 · 가로형) 확인(로컬). 실행: pnpm exec tsx scripts/e2e-p10.ts
 * 앱 하나(3001, DEV_LOGIN=1)만 띄워 둔다.
 */
import { execFileSync } from 'node:child_process'

import { chromium } from 'playwright'

const BASE = process.env.E2E_BASE ?? 'http://localhost:3001'
const DB = 'postgres://dearday:dearday@localhost:5432/dearday'
const sql = (q: string) => execFileSync('psql', [DB, '-tAc', q]).toString().trim()
const SHOT = process.env.E2E_SHOT_DIR

let failures = 0
function check(ok: unknown, label: string) {
  console.log(`${ok ? '✅' : '❌'} ${label}`)
  if (!ok) failures++
}

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ko-KR' })
  const errors: string[] = []
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${BASE}/api/auth/kakao/login?dev=1&as=9&next=/dashboard`)
  await page.waitForURL(/\/dashboard/)
  // 시드: 가상 데이터(발행 · 미래 / 발행 · 지난 행사 / 초안)
  sql(`delete from invitations where owner_id=(select id from users where kakao_id='dev-9')`)
  const uid = sql(`select id from users where kakao_id='dev-9'`)
  const ins = (slug: string, type: string, title: string, at: string, status: string) =>
    sql(
      `insert into invitations(owner_id,slug,event_type,title,event_at,status) values('${uid}','${slug}','${type}','${title}',${at},'${status}') returning id`,
    ).split('\n')[0]
  const fut = ins('cardfut1', 'yearend', 'E2E 미래 송년회', `now()+interval '30 days'`, 'published')
  ins('cardpast', 'birthday', 'E2E 지난 생일', `now()-interval '5 days'`, 'published')
  ins('carddraf', 'dol', 'E2E 초안 돌잔치', 'null', 'draft')
  for (let i = 1; i <= 6; i++)
    sql(`insert into rsvps(invitation_id,name,attending,party_size) values('${fut}','손님${i}',${i % 3 !== 0},1)`)
  await page.goto(`${BASE}/dashboard`)
  await page.waitForSelector('[data-testid=view-v]')

  const card = (t: string) => page.locator('li').filter({ hasText: t }).first()
  // 세로형(기본)
  check((await page.getByTestId('view-v').getAttribute('aria-pressed')) === 'true', '기본은 세로형')
  check((await card('E2E 미래 송년회').getByText(/^D-\d+$/).count()) === 1, '세로형: 발행 · 행사 전 → D-day 칩')
  check((await card('E2E 지난 생일').getByText(/^D-/).count()) === 0, '세로형: 지난 행사는 D-day 칩 없음')
  check((await card('E2E 미래 송년회').getByRole('button', { name: '공유' }).count()) === 1, '세로형: 발행됨 → 공유 버튼')
  check((await card('E2E 초안 돌잔치').getByRole('button', { name: '공유' }).count()) === 0, '세로형: 초안 → 공유 없음')
  check((await card('E2E 미래 송년회').getByRole('img', { name: /참석 4건, 불참 2건/ }).count()) === 1, '세로형: 참석 비율 막대(참석 4 · 불참 2)')
  check(/발행하면 참석 · 응답이 여기에 모여요/.test(await card('E2E 초안 돌잔치').innerText()), '세로형: 초안 안내 문구')
  // ⋯ 메뉴: 초대장 보기 · QR · 복제 · 삭제
  const fc = card('E2E 미래 송년회')
  await fc.getByRole('button', { name: '더 보기' }).click()
  for (const n of ['초대장 보기', 'QR 저장', '복제', '삭제'])
    check((await fc.getByRole(n === '초대장 보기' ? 'menuitem' : n === '삭제' ? 'menuitem' : 'button', { name: n }).count()) === 1, `⋯ 메뉴: ${n}`)
  await page.keyboard.press('Escape')
  if (SHOT) await page.screenshot({ path: `${SHOT}/p10-v.png`, fullPage: true })

  // 가로형 전환 + 새로고침 후 유지
  await page.getByTestId('view-h').click()
  check((await page.locator('ul[data-view=h]').count()) === 1, '가로형으로 전환')
  const h = await card('E2E 미래 송년회').boundingBox()
  check(h && h.height < 130, `가로형 카드 높이 ${Math.round(h?.height ?? 0)}px (< 130)`)
  check((await card('E2E 초안 돌잔치').getByText('발행 전').count()) === 1, '가로형: 초안은 "발행 전"')
  check((await page.locator('li >> text=공유').count()) === 0, '가로형: 액션 버튼 없음')
  if (SHOT) await page.screenshot({ path: `${SHOT}/p10-h.png`, fullPage: true })
  await page.reload()
  await page.waitForSelector('[data-testid=view-h][aria-pressed=true]')
  check((await page.locator('ul[data-view=h]').count()) === 1, '새로고침 후에도 가로형 유지')
  // 저장소를 못 써도 세로형으로 동작
  const bctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await bctx.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked') } })
  })
  const bp = await bctx.newPage()
  await bp.goto(`${BASE}/api/auth/kakao/login?dev=1&as=9&next=/dashboard`)
  await bp.waitForSelector('[data-testid=view-v]')
  await bp.getByTestId('view-h').click()
  check((await bp.locator('ul[data-view=h]').count()) === 1, 'localStorage 차단에서도 전환은 동작')
  await bctx.close()
  // 카드를 누르면 편집으로
  await page.getByTestId('view-v').click()
  await card('E2E 초안 돌잔치').getByRole('link', { name: /E2E 초안 돌잔치/ }).first().click()
  await page.waitForURL(/\/edit\//)
  check(true, '카드 본문 → 편집 이동')

  check(!errors.length, `브라우저 오류 없음 ${errors.join(' | ')}`)
  await browser.close()
  console.log(failures ? `\n실패 ${failures}건` : '\n모두 통과')
  process.exit(failures ? 1 : 0)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
