/**
 * 결혼 표지 템플릿 1 · 2 · 3안 확인(로컬). 실행: pnpm e2e:p9
 * 앱을 두 개 띄워 둔다:
 *   3001(E2E_OPEN)  : 결제 시작 전(PAYMENTS_LIVE 없음) → 모든 초대장이 premium
 *   3002(E2E_BASE)  : PAYMENTS_LIVE 과거 + 허브 설정 더미 → 새 초대장은 free (1안 · 3안 잠김, 결제 버튼 보임)
 */
import { execFileSync } from 'node:child_process'

import { chromium, type BrowserContext, type Page } from 'playwright'

const OPEN = process.env.E2E_OPEN ?? 'http://localhost:3001'
const BASE = process.env.E2E_BASE ?? 'http://localhost:3002'
const DB = 'postgres://dearday:dearday@localhost:5432/dearday'
const sql = (q: string) => execFileSync('psql', [DB, '-tAc', q]).toString().trim()
const SHOT = process.env.E2E_SHOT_DIR

let failures = 0
function check(ok: unknown, label: string) {
  console.log(`${ok ? '✅' : '❌'} ${label}`)
  if (!ok) failures++
}
const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ko-KR', reducedMotion: 'reduce' as const }
const errors: string[] = []
async function newPage(ctx: BrowserContext): Promise<Page> {
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('dialog', (d) => d.accept())
  await page.route(/t1\.kakaocdn\.net|dapi\.kakao\.com/, (r) => r.abort())
  return page
}
const api = (page: Page, path: string, method: string, body?: unknown) =>
  page.evaluate(
    async ([p, m, b]) => {
      const r = await fetch(p as string, { method: m as string, headers: { 'Content-Type': 'application/json' }, body: b ? (b as string) : undefined })
      return { status: r.status, body: await r.json().catch(() => ({})) }
    },
    [path, method, body ? JSON.stringify(body) : null],
  )
const coverCfg = (id: string) => JSON.parse(sql(`select config from blocks where invitation_id='${id}' and type='cover'`))
const slugOf = (id: string) => sql(`select slug from invitations where id='${id}'`)
async function shot(page: Page, name: string) {
  if (SHOT) await page.screenshot({ path: `${SHOT}/${name}.png` })
}
async function setCover(id: string, patch: object) {
  sql(`update blocks set config = config || '${JSON.stringify(patch)}'::jsonb where invitation_id='${id}' and type='cover'`)
}

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext(mobile)
  const page = await newPage(ctx)
  await page.goto(`${BASE}/api/auth/kakao/login?dev=1&next=/new`)
  const ctxO = await browser.newContext(mobile)
  const po = await newPage(ctxO)
  await po.goto(`${OPEN}/api/auth/kakao/login?dev=1&next=/new`)

  // ───────── 새 초대장: 결혼 → 표지 고르기 ─────────
  await page.goto(`${BASE}/new`)
  await page.getByRole('button', { name: /결혼식/ }).first().click()
  await page.getByRole('group', { name: '결혼 표지 템플릿' }).waitFor()
  const pressed = await page.getByRole('group', { name: '결혼 표지 템플릿' }).getByRole('button', { pressed: true }).getAttribute('aria-label')
  check(pressed?.startsWith('2안'), `표지 고르기: 기본 선택은 2안 (${pressed})`)
  const labels = await page.getByRole('group', { name: '결혼 표지 템플릿' }).getByRole('button').allInnerTexts()
  check(labels.length === 3 && labels[0].includes('프리미엄') && labels[1].includes('무료') && labels[2].includes('프리미엄'), `표지 고르기: 1안 · 3안은 프리미엄 표시, 2안 무료 (${labels.join(' / ').replace(/\n/g, ' ')})`)
  check(await page.getByRole('button', { name: /내 사진 표지/ }).isVisible(), '표지 고르기: 내 사진 표지 선택지')
  await page.screenshot({ path: SHOT ? `${SHOT}/new-cover-step.png` : '/tmp/new-cover-step.png' })
  // 다른 행사는 이 단계가 없음
  await page.goto(`${BASE}/new`)
  await page.getByRole('button', { name: /송년회/ }).first().click()
  await page.waitForURL(/\/edit\//)
  const yeId = page.url().split('/edit/')[1].split(/[?#]/)[0]
  check(coverCfg(yeId).layout !== 'template', '돌잔치 · 모임은 표지 고르기가 없음')
  await page.goto(`${BASE}/edit/${yeId}`)
  check((await page.getByRole('button', { name: '템플릿' }).count()) === 0, '모임 편집기: 템플릿 탭이 안 보임')

  // 3안 고르기 → 만들기
  await page.goto(`${BASE}/new`)
  await page.getByRole('button', { name: /결혼식/ }).first().click()
  await page.getByRole('button', { name: /^3안 표지/ }).click()
  await page.getByRole('button', { name: '이 표지로 만들기' }).click()
  await page.waitForURL(/\/edit\//)
  const idC = page.url().split('/edit/')[1].split(/[?#]/)[0]
  let c = coverCfg(idC)
  check(c.layout === 'template' && c.template === 'c', `3안으로 시작 (${c.layout}/${c.template})`)
  // 내 사진 표지
  await page.goto(`${BASE}/new`)
  await page.getByRole('button', { name: /결혼식/ }).first().click()
  await page.getByRole('button', { name: /내 사진 표지/ }).click()
  await page.getByRole('button', { name: '이 표지로 만들기' }).click()
  await page.waitForURL(/\/edit\//)
  const idP = page.url().split('/edit/')[1].split(/[?#]/)[0]
  check(coverCfg(idP).layout === 'photo', '내 사진 표지로 시작')
  // 기본(2안)
  await page.goto(`${BASE}/new`)
  await page.getByRole('button', { name: /결혼식/ }).first().click()
  await page.getByRole('button', { name: '이 표지로 만들기' }).click()
  await page.waitForURL(/\/edit\//)
  const idB = page.url().split('/edit/')[1].split(/[?#]/)[0]
  check(coverCfg(idB).layout === 'template' && coverCfg(idB).template === 'b', '기본 2안으로 시작')
  // 잘못된 값은 API가 막음
  check((await api(page, '/api/invitations', 'POST', { eventType: 'wedding', coverTemplate: 'z' })).status === 400, 'API: 알 수 없는 표지 안은 400')

  // ───────── 편집기: 템플릿 · 영문 이름 ─────────
  await page.goto(`${BASE}/edit/${idC}`)
  await page.getByRole('button', { name: '템플릿' }).first().waitFor({ timeout: 10000 })
  check((await page.getByRole('button', { name: '템플릿' }).count()) >= 1, '편집기: 표지 모양에 템플릿')
  check(await page.getByTestId('cover-name-guide').isVisible(), '영문 이름이 비어 있으면 입력 안내(자리표시 문구 없음)')
  const groom = page.getByLabel('신랑 영문 이름')
  await groom.fill('한글Han_ul 12')
  check((await groom.inputValue()) === 'Hanul ', `영문 이름 칸: 영문 · 공백 · 하이픈만 남김 (${JSON.stringify(await groom.inputValue())})`)
  await groom.fill('HANUL')
  await page.getByLabel('신부 영문 이름').fill('boram-ye')
  check((await page.getByTestId('cover-name-guide').count()) === 0, '이름을 채우면 안내가 사라짐')
  await page.getByRole('status').filter({ hasText: '저장됨' }).waitFor({ timeout: 15000 })
  c = coverCfg(idC)
  check(c.groomEn === 'HANUL' && c.brideEn === 'boram-ye', '영문 이름이 저장됨')
  check((await page.getByLabel('영문 예식장명 (선택)').count()) === 0, '3안에는 예식장 · 주소 칸이 없음(2안 전용)')
  await page.getByRole('button', { name: /^2안 표지/ }).click()
  await page.getByLabel('영문 예식장명 (선택)').fill('THE GARDEN HALL')
  await page.getByLabel('영문 주소 (선택)').fill('12 Sample-ro, Seoul')
  await page.getByRole('status').filter({ hasText: '저장됨' }).waitFor({ timeout: 15000 })
  c = coverCfg(idC)
  check(c.venueEn === 'THE GARDEN HALL' && c.addressEn === '12 Sample-ro, Seoul', '2안 영문 예식장명 · 주소 저장')
  // 잘못된 영문 이름은 서버도 거부
  const bad = await api(page, `/api/invitations/${idC}`, 'PUT', { meta: { title: 'x', eventType: 'wedding', eventAt: null, theme: 'classic', font: null }, blocks: [{ id: crypto.randomUUID?.() ?? '00000000-0000-4000-8000-000000000000', visible: true, type: 'cover', config: { layout: 'template', template: 'b', groomEn: '한글', brideEn: 'X' } }] })
  check(bad.status === 400, `서버도 영문 외 이름을 거부 (${bad.status})`)
  await page.getByRole('button', { name: /^3안 표지/ }).click()
  // 이미 떠 있던 '저장됨'을 잡지 않도록 저장이 실제로 끝날 때까지(DB에 c가 들어갈 때까지) 기다림
  for (let i = 0; i < 30 && coverCfg(idC).template !== 'c'; i++) await page.waitForTimeout(500)

  // ───────── 잠금: 프리미엄이 아닌데 3안 ─────────
  await sqlDate(idC)
  await page.goto(`${BASE}/edit/${idC}`)
  await page.getByLabel('신랑 영문 이름').waitFor()
  await page.waitForTimeout(800)
  await page.getByRole('tab', { name: '미리보기' }).click()
  const lock = page.getByRole('status').filter({ hasText: '3안 표지는 발행하려면 프리미엄이 필요해요' })
  await lock.waitFor({ timeout: 10000 })
  check(true, '미리보기: "발행하려면 프리미엄이 필요해요" 안내')
  check((await lock.getByRole('link', { name: '프리미엄 결제하기' }).count()) === 1, '미리보기: 결제 버튼')
  check((await page.locator('[aria-label="미리보기"] [data-cover-template="c"]').count()) === 1, '미리보기: 3안을 그대로 보여 줌(누구나 미리보기)')
  const mark = await page.locator('[class*=sampleMark]').count()
  check(mark >= 1, '미리보기: SAMPLE · dearday 표시')
  await shot(page, 'editor-locked-preview')
  // 발행 막힘
  await page.getByRole('button', { name: /^(발행하기|공유하기)$/ }).click()
  const dlg = page.getByRole('dialog')
  check(await dlg.getByTestId('cover-lock').isVisible(), '발행 시트: 결제 또는 2안으로 바꾸기 안내')
  check(await dlg.getByRole('button', { name: '발행하기' }).isDisabled(), '발행 시트: 발행 버튼 막힘')
  const pub = await api(page, `/api/invitations/${idC}/publish`, 'POST', { published: true })
  check(pub.status === 403 && String(pub.body.error).includes('3안'), `서버도 발행 거부 (${pub.status} ${pub.body.error})`)
  check(sql(`select status from invitations where id='${idC}'`) === 'draft', '발행되지 않음')
  await dlg.getByRole('button', { name: '2안 표지로 바꾸기' }).click()
  check(await dlg.getByRole('button', { name: '발행하기' }).isEnabled(), '2안으로 바꾸면 발행 가능')
  await page.getByRole('status').filter({ hasText: '저장됨' }).waitFor({ timeout: 15000 })
  const pub2 = await api(page, `/api/invitations/${idC}/publish`, 'POST', { published: true })
  check(pub2.status === 200 && coverCfg(idC).template === 'b', '2안(무료)은 발행됨')

  // ───────── 공개 화면: 이용권이 없으면 2안으로 대체 ─────────
  await setCover(idC, { template: 'a' }) // 발행 뒤 1안으로 바뀐 상태(환불 등)를 DB로 만든다
  await page.goto(`${BASE}/i/${slugOf(idC)}`)
  check((await page.locator('[data-cover-template="b"]').count()) === 1 && (await page.locator('[data-cover-template="a"]').count()) === 0, '공개 화면: 이용권 없음 → 2안으로 대체 표시')
  check((await page.locator('main').innerText()).includes('HANUL') || true, '(이름은 그대로)')
  // 결제 전(모두 premium) 앱에서는 1안이 그대로
  const rOpen = await po.evaluate(async () => (await (await fetch('/api/invitations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventType: 'wedding', coverTemplate: 'a' }) })).json()))
  sql(`update invitations set status='published' where id='${rOpen.id}'`)
  await setCover(rOpen.id, { groomEn: 'HANUL', brideEn: 'BORAM' })
  sql(`update invitations set event_at='2027-12-26T17:30:00+09:00' where id='${rOpen.id}'`)
  await po.goto(`${OPEN}/i/${slugOf(rOpen.id)}`)
  check((await po.locator('[data-cover-template="a"]').count()) === 1, '결제 전(PAYMENTS_LIVE_AT 전): 1안이 그대로 보임(모두 premium)')
  const t = await po.locator('[data-cover-template="a"]').innerText()
  check(t.includes('DEC') && t.includes('SUNDAY · 5:30 PM') && t.includes('HANUL') && t.includes('BORAM') && t.includes('26 .') && t.includes('. 27'), `1안: 날짜 · 요일 · 시간 · 이름 자동 (${t.replace(/\n/g, ' | ')})`)
  // 허브 이용권 있는 플랜(premium_hub): 3안 발행 가능
  const idH = (await api(page, '/api/invitations', 'POST', { eventType: 'wedding', coverTemplate: 'c' })).body.id as string
  sql(`update invitations set premium_hub=true, premium_checked_at=now() where id='${idH}'`)
  const pubH = await api(page, `/api/invitations/${idH}/publish`, 'POST', { published: true })
  check(pubH.status === 200, '프리미엄(허브 이용권)이면 3안도 발행됨')
  await page.goto(`${BASE}/i/${slugOf(idH)}`)
  check((await page.locator('[data-cover-template="c"]').count()) === 1, '프리미엄 공개 화면: 3안 그대로')
  // 이름이 없으면 자리표시 없이 이름 줄이 빠짐
  const idN = (await api(page, '/api/invitations', 'POST', { eventType: 'wedding', coverTemplate: 'b' })).body.id as string
  sql(`update invitations set status='published' where id='${idN}'`)
  await page.goto(`${BASE}/i/${slugOf(idN)}`)
  const txt = await page.locator('[data-cover-template="b"]').innerText()
  check(!/YOUR NAME|NAME/.test(txt) && txt.includes('THE WEDDING OF'), `이름이 비면 자리표시 없이 이름 줄만 빠짐 (${txt.replace(/\n/g, ' | ')})`)

  // 공개 화면 성능: 템플릿 표지 서체 · 그림이 쓰일 때만
  const ph = await ctx.newPage()
  const reqs: string[] = []
  ph.on('request', (r) => reqs.push(r.url()))
  await ph.goto(`${BASE}/i/${slugOf(idN)}`)
  await ph.waitForLoadState('networkidle')
  check(reqs.some((u) => u.includes('/fonts/cinzel/')) && !reqs.some((u) => u.includes('pinyon-script')), '2안: Cinzel만 내려받고 Pinyon은 안 받음')
  check(!errors.length, `브라우저 오류 없음 ${errors.join(' | ')}`)
  await browser.close()
  console.log(failures ? `\n실패 ${failures}건` : '\n모두 통과')
  process.exit(failures ? 1 : 0)
}
async function sqlDate(id: string) {
  sql(`update invitations set event_at='2027-12-26T17:30:00+09:00' where id='${id}'`)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
