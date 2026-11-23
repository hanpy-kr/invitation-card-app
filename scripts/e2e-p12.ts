/**
 * 환불 규칙('공유 · 열람 전') 확인(로컬). 실행: pnpm exec tsx scripts/e2e-p12.ts  (앱 환경은 e2e-p8과 같음, 포트 3001)
 * 결제 → 결제 내역 '전액 환불 가능' → 링크 복사 → '환불 제한', 주인 · 편집자 열람은 기록 안 됨, 다른 브라우저 열람은 기록됨.
 */
import { createHmac, randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createServer } from 'node:http'

import { chromium, type BrowserContext, type Page } from 'playwright'


const BASE = process.env.E2E_BASE ?? 'http://localhost:3001'
const DB = 'postgres://dearday:dearday@localhost:5432/dearday'
const NOTIFY_SECRET = 'notify_e2e'
const HUB_PORT = 4020
const sql = (q: string) => execFileSync('psql', [DB, '-tAc', q]).toString().trim()

let failures = 0
function check(ok: unknown, label: string) {
  console.log(`${ok ? '✅' : '❌'} ${label}`)
  if (!ok) failures++
}

// ───────── 가짜 허브 ─────────
type Order = {
  orderId: string
  ref: string
  service: string
  sku: string
  customerRef: string
  subject: { type: string; id: string } | null
  amount: number
  currency: 'KRW'
  status: string
  createdAt: string
  paidAt: string | null
  refundedAt: string | null
  refundedAmount: number
}
const PRODUCTS = [
  { sku: 'invitation.premium.family.open', name: '프리미엄 (결혼·돌·감사장) 오픈', amount: 9900, currency: 'KRW', onSale: true, grants: { key: 'premium', days: null, subjectType: 'invitation' } },
  { sku: 'invitation.premium.family', name: '프리미엄 (결혼·돌·감사장)', amount: 14900, currency: 'KRW', onSale: false, grants: { key: 'premium', days: null, subjectType: 'invitation' } },
  { sku: 'invitation.premium.meetup', name: '프리미엄 (모임)', amount: 3900, currency: 'KRW', onSale: true, grants: { key: 'premium', days: null, subjectType: 'invitation' } },
]
const orders = new Map<string, Order>()
const entitled = new Set<string>() // 초대장 id
const checkoutLog: { sku: string; customerRef: string; subjectId?: string; key: string }[] = []
const hub = { down: false, unavailable: false, auth: 0 }

function send(res: import('node:http').ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json', 'x-request-id': 'req-e2e' })
  res.end(JSON.stringify(body))
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${HUB_PORT}`)
  let raw = ''
  req.on('data', (c) => (raw += c))
  req.on('end', () => {
    if (hub.down) return send(res, 503, { code: 'HUB_DOWN', title: 'down' })
    if (req.headers.authorization !== 'Bearer tok_e2e' || req.headers['x-hanpy-service'] !== 'invitation') {
      hub.auth++
      return send(res, 401, { code: 'UNAUTHENTICATED', title: 'no' })
    }
    const p = url.pathname
    if (req.method === 'GET' && p === '/v1/payments/products') return send(res, 200, { items: PRODUCTS })
    if (req.method === 'POST' && p === '/v1/payments/checkout') {
      const b = JSON.parse(raw) as { sku: string; customerRef: string; subject?: { type: string; id: string } }
      const key = String(req.headers['idempotency-key'] ?? '')
      checkoutLog.push({ sku: b.sku, customerRef: b.customerRef, subjectId: b.subject?.id, key })
      if (b.subject && entitled.has(b.subject.id)) return send(res, 409, { code: 'ALREADY_ENTITLED', title: 'already' })
      if (hub.unavailable) return send(res, 503, { code: 'PAYMENT_UNAVAILABLE', title: 'no link' })
      const product = PRODUCTS.find((x) => x.sku === b.sku)
      if (!product) return send(res, 404, { code: 'PRODUCT_NOT_FOUND', title: 'x' })
      const order: Order = {
        orderId: randomUUID(),
        ref: `hp-${randomUUID().slice(0, 8)}`,
        service: 'invitation',
        sku: b.sku,
        customerRef: b.customerRef,
        subject: b.subject ?? null,
        amount: product.amount,
        currency: 'KRW',
        status: 'pending',
        createdAt: new Date().toISOString(),
        paidAt: null,
        refundedAt: null,
        refundedAmount: 0,
      }
      orders.set(order.orderId, order)
      return send(res, 200, { order, action: { type: 'redirect', url: `https://groble.test/pay?ref=${order.ref}` } })
    }
    const one = p.match(/^\/v1\/payments\/orders\/([^/]+)$/)
    if (req.method === 'GET' && one) {
      const o = orders.get(decodeURIComponent(one[1]))
      return o ? send(res, 200, o) : send(res, 404, { code: 'NOT_FOUND', title: 'nf' })
    }
    if (req.method === 'GET' && p === '/v1/payments/orders') {
      const cr = url.searchParams.get('customerRef')
      const sid = url.searchParams.get('subjectId')
      const st = url.searchParams.get('status')
      const limit = Number(url.searchParams.get('limit') ?? 20)
      const items = [...orders.values()]
        .filter((o) => (!cr || o.customerRef === cr) && (!sid || o.subject?.id === sid) && (!st || o.status === st))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit)
      return send(res, 200, { items })
    }
    if (req.method === 'GET' && p === '/v1/payments/entitlements') {
      const ids = (url.searchParams.get('subjectIds') ?? '').split(',').filter(Boolean)
      return send(res, 200, {
        items: ids.filter((id) => entitled.has(id)).map((id) => ({ key: 'premium', orderId: 'x', subject: { type: 'invitation', id }, validFrom: new Date().toISOString(), validUntil: null })),
      })
    }
    send(res, 404, { code: 'NOT_FOUND', title: 'route' })
  })
})

function markPaid(o: Order) {
  o.status = 'paid'
  o.paidAt = new Date().toISOString()
  if (o.subject) entitled.add(o.subject.id)
}


async function notify(
  o: Order,
  type: string,
  opts: { eventId?: string; secret?: string; ts?: string; sig?: string } = {},
) {
  const rawBody = JSON.stringify({ type, occurredAt: new Date().toISOString(), order: o })
  const ts = opts.ts ?? String(Math.floor(Date.now() / 1000))
  const sig = opts.sig ?? createHmac('sha256', opts.secret ?? NOTIFY_SECRET).update(`${ts}.${rawBody}`).digest('hex')
  const res = await fetch(`${BASE}/api/hanpy/payments`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-hanpy-event-id': opts.eventId ?? randomUUID(),
      'x-hanpy-timestamp': ts,
      'x-hanpy-signature': sig,
    },
    body: rawBody,
  })
  return res.status
}

// ───────── 브라우저 도우미 ─────────
const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'ko-KR', reducedMotion: 'reduce' as const }
const errors: string[] = []
async function newPage(ctx: BrowserContext): Promise<Page> {
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('dialog', (d) => d.accept())
  await page.route(/t1\.kakaocdn\.net|dapi\.kakao\.com/, (r) => r.abort())
  await page.route('https://groble.test/**', (r) => r.fulfill({ contentType: 'text/html', body: '<h1>그로블 결제창(가짜)</h1>' }))
  return page
}
async function waitSaved(page: Page) {
  await page.getByRole('status').filter({ hasText: '저장됨' }).waitFor({ timeout: 15000 })
}
async function create(page: Page, label: RegExp, title: string): Promise<string> {
  await page.goto(`${BASE}/new`)
  await page.getByRole('button', { name: label }).first().click()
  // 결혼식은 '표지 고르기'(기본 2안)를 거친다
  const startBtn = page.getByRole('button', { name: '이 표지로 만들기' })
  if (await startBtn.waitFor({ timeout: 1500 }).then(() => true, () => false)) await startBtn.click()
  await page.waitForURL(/\/edit\//)
  await page.getByLabel('초대장 제목').fill(title)
  await waitSaved(page)
  return page.url().split('/edit/')[1].split(/[?#]/)[0]
}
const checkout = (page: Page, id: string, attemptId = randomUUID()) =>
  page.evaluate(
    async ([i, a]) => {
      const r = await fetch(`/api/invitations/${i}/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ attemptId: a, agreedRefund: true }) })
      return { status: r.status, body: await r.json().catch(() => ({})) }
    },
    [id, attemptId],
  )
const userIdOf = (kakao: string) => sql(`select id from users where kakao_id='${kakao}'`)


const ADMIN_LINE = '[data-testid=admin-hub]'
const SHOT = process.env.E2E_SHOT_DIR
const shot = async (page: Page, name: string, focus?: string) => {
  if (!SHOT) return
  await page.waitForLoadState('networkidle').catch(() => {})
  if (focus) {
    await page.locator(focus).first().scrollIntoViewIfNeeded()
    await page.evaluate((sel) => {
      const el = document.querySelector(sel)
      if (el) window.scrollBy(0, el.getBoundingClientRect().top - 120)
    }, focus)
  }
  await page.screenshot({ path: `${SHOT}/${name}.png` })
}

/** 결제한 결혼 초대장 하나: 만들기 → 결제 → 허브 알림 → 발행 */
async function paidWedding(page: Page, title: string) {
  const id = await create(page, /결혼식/, title)
  const c = await checkout(page, id)
  if (c.status !== 200) throw new Error(`checkout ${c.status}`)
  const o = [...orders.values()].find((x) => x.subject?.id === id)!
  markPaid(o)
  await notify(o, 'payment.paid')
  const slug = sql(`select slug from invitations where id='${id}'`)
  const pub = await page.evaluate(async (i) => (await fetch(`/api/invitations/${i}/publish`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ published: true }) })).status, id)
  if (pub !== 200) throw new Error(`publish ${pub}`)
  return { id, slug, order: o }
}
const col = (id: string, c: string) => sql(`select ${c} is not null from invitations where id='${id}'`) === 't'
const viewsDaily = (id: string) => Number(sql(`select coalesce(sum(views),0) from invitation_views_daily where invitation_id='${id}'`))

async function main() {
  await new Promise<void>((r) => server.listen(HUB_PORT, r))
  const browser = await chromium.launch()
  const ctx = await browser.newContext(mobile)
  const page = await newPage(ctx)
  await page.goto(`${BASE}/api/auth/kakao/login?dev=1&next=/new`)
  const refundText = async (title: string) => {
    await page.goto(`${BASE}/dashboard`)
    const li = page.locator('#orders li', { hasText: title })
    const st = li.locator('[data-testid=refund-status]')
    return { text: (await st.innerText().catch(() => '')).trim(), kind: await st.getAttribute('data-refund').catch(() => null) }
  }

  // ───────── 순수 함수 ─────────
  {
    const { refundStatus, refundDeadline } = await import('../lib/refund')
    const paid = new Date('2026-11-10T00:00:00Z')
    const base = { paidAt: paid, firstSharedAt: null, firstGuestViewAt: null }
    const day = 24 * 3600 * 1000
    check(refundStatus({ ...base, now: new Date(paid.getTime() + 6 * day) }) === 'full', 'refundStatus: 7일 이내 · 공유 전 · 열람 없음 = full')
    check(refundStatus({ ...base, now: new Date(paid.getTime() + 7 * day) }) === 'full', 'refundStatus: 정확히 7일째까지 full')
    check(refundStatus({ ...base, now: new Date(paid.getTime() + 7 * day + 1000) }) === 'limited', 'refundStatus: 7일 지나면 limited')
    check(refundStatus({ ...base, firstSharedAt: new Date(), now: paid }) === 'limited', 'refundStatus: 공유했으면 limited')
    check(refundStatus({ ...base, firstGuestViewAt: new Date(), now: paid }) === 'limited', 'refundStatus: 하객 열람 있으면 limited')
    check(refundStatus({ ...base, orderStatus: 'refunded', now: paid }) === 'limited', 'refundStatus: 결제 완료가 아니면 limited')
    check(refundDeadline(paid)!.getTime() === paid.getTime() + 7 * day, 'refundDeadline = 결제 + 7일')
  }

  // ───────── A: 결제 → 결제 내역 '전액 환불 가능' → (대시보드) 공유 → '환불 제한' ─────────
  const A = await paidWedding(page, 'E2E 환불 A 공유')
  check(!col(A.id, 'first_shared_at') && !col(A.id, 'first_guest_view_at'), 'A: 처음엔 두 기록 모두 null')
  let r = await refundText('E2E 환불 A 공유')
  check(r.kind === 'full' && /^전액 환불 가능 · \d+월 \d+일까지\(아직 공유 전\)$/.test(r.text), `결제 내역: 전액 환불 가능 · ○월 ○일까지(아직 공유 전) (${r.text})`)
  const notice = await page.locator('#orders [data-testid=refund-guide]').first().innerText()
  check(notice.includes('결제 후 7일 이내이고 아직 공유하지 않았다면 전액 환불돼요. 링크를 공유하거나 하객이 열어 본 뒤에는 환불이 제한돼요.'), '결제 내역: 새 REFUND_NOTICE')
  check(!notice.includes('발행하면 초대장이 하객에게 공개'), '결제 내역: 옛 문구 없음')
  await shot(page, 'refund-orders-full', '#orders')
  // 관리자 줄 (대시보드 카드)
  const adminCard = await page.locator('[data-testid=admin-hub]').first().innerText()
  check(adminCard.includes('첫 공유 없음') && adminCard.includes('첫 하객 열람 없음') && adminCard.includes('환불 판단 전액 환불 가능'), `관리자 줄(대시보드): 첫 공유 · 첫 하객 열람 · 환불 판단 (${adminCard.slice(-70)})`)
  // 주인이 내 초대장 열기 · 공개 화면 열기: 기록 안 남음
  await page.goto(`${BASE}/i/${A.slug}`)
  await page.waitForTimeout(800)
  check(!col(A.id, 'first_guest_view_at'), '주인이 자기 초대장 열람 → first_guest_view_at 안 남음')
  // 공유 버튼: 확인 창 → 취소 → 안 남음
  await page.goto(`${BASE}/dashboard`)
  const card = page.locator('article, li', { hasText: 'E2E 환불 A 공유' }).filter({ has: page.getByRole('button', { name: '공유' }) }).first()
  await card.getByRole('button', { name: '공유', exact: true }).click()
  const dlg = page.getByTestId('share-guard')
  await dlg.waitFor()
  check((await dlg.innerText()).includes('공유하면 환불이 제한돼요. 공유할까요?'), '공유 확인 창 문구')
  await shot(page, 'refund-share-guard')
  await dlg.getByRole('button', { name: '취소' }).click()
  await page.waitForTimeout(500)
  check(!col(A.id, 'first_shared_at') && (await dlg.count()) === 0, '확인 창 [취소] → 공유 기록 없음')
  await card.getByRole('button', { name: '공유', exact: true }).click()
  await dlg.getByRole('button', { name: '공유하기' }).click()
  await page.waitForTimeout(1200)
  check(col(A.id, 'first_shared_at'), '[공유하기] → first_shared_at 기록')
  const t1 = sql(`select first_shared_at from invitations where id='${A.id}'`)
  await card.getByRole('button').filter({ hasText: /공유|링크 복사됨/ }).first().click().catch(() => {})
  await page.waitForTimeout(600)
  check((await dlg.count()) === 0, '이미 공유한 뒤에는 확인 창이 다시 뜨지 않음')
  check(sql(`select first_shared_at from invitations where id='${A.id}'`) === t1, '공유 기록은 처음 시각 그대로(한 번만)')
  r = await refundText('E2E 환불 A 공유')
  check(r.kind === 'limited' && r.text === '공유 후라 환불이 제한돼요', `링크 복사 후 결제 내역: 공유 후라 환불이 제한돼요 (${r.text})`)
  await shot(page, 'refund-orders-limited', '#orders')
  const adminA = await page.locator('[data-testid=admin-hub]').first().innerText()
  check(/첫 공유 \d+\/\d+ \d+:\d+/.test(adminA) && adminA.includes('환불 판단 환불 제한'), `관리자 줄: 첫 공유 시각 · 환불 제한 (${adminA.slice(-60)})`)
  // 공유 API 권한: 다른 사용자는 기록 못 함
  const ctx3 = await browser.newContext(mobile)
  const p3 = await newPage(ctx3)
  await p3.goto(`${BASE}/api/auth/kakao/login?dev=1&as=3&next=/new`)
  const other = await p3.evaluate(async (i) => (await fetch(`/api/invitations/${i}/shared`, { method: 'POST' })).status, A.id)
  check(other === 404, `공유 API: 남의 초대장은 기록 불가(${other})`)

  // ───────── B: 하객 열람 ─────────
  const B = await paidWedding(page, 'E2E 환불 B 열람')
  const vB0 = viewsDaily(B.id)
  const own = await page.evaluate(async (s) => (await fetch(`/api/i/${s}/view`, { method: 'POST' })).status, B.slug)
  check(own === 204 && !col(B.id, 'first_guest_view_at') && viewsDaily(B.id) === vB0, '주인 열람(로그인 세션): first_guest_view_at 안 남고 views_daily도 안 늘어남')
  // 공동 편집자
  sql(`insert into invitation_editors (invitation_id, user_id) values ('${B.id}', '${userIdOf('dev-3')}') on conflict do nothing`)
  const ed = await p3.evaluate(async (s) => (await fetch(`/api/i/${s}/view`, { method: 'POST' })).status, B.slug)
  check(ed === 204 && !col(B.id, 'first_guest_view_at') && viewsDaily(B.id) === vB0, '공동 편집자 열람: 기록 · 집계 모두 안 남음')
  // 다른 브라우저(세션 없음)
  const guest = await browser.newContext({ ...mobile })
  const gp = await guest.newPage()
  await gp.goto(`${BASE}/i/${B.slug}`)
  await gp.waitForTimeout(1500)
  let seen = col(B.id, 'first_guest_view_at')
  if (!seen) {
    const st = await guest.request.post(`${BASE}/api/i/${B.slug}/view`)
    seen = st.status() === 204 && col(B.id, 'first_guest_view_at')
  }
  check(seen && viewsDaily(B.id) === vB0 + 1, '다른 브라우저(로그인 없음) 열람 → first_guest_view_at 기록 · views_daily +1')
  const t2 = sql(`select first_guest_view_at from invitations where id='${B.id}'`)
  await guest.request.post(`${BASE}/api/i/${B.slug}/view`)
  check(sql(`select first_guest_view_at from invitations where id='${B.id}'`) === t2, '하객 열람 기록은 처음 한 번만')
  r = await refundText('E2E 환불 B 열람')
  check(r.kind === 'limited' && r.text === '하객이 열어 본 뒤라 환불이 제한돼요', `하객 열람 후 결제 내역 (${r.text})`)

  // ───────── C: 편집기 발행 완료 화면의 공유 버튼 → 확인 창 ─────────
  const C = await paidWedding(page, 'E2E 환불 C 편집기')
  await page.goto(`${BASE}/edit/${C.id}`)
  const line = await page.locator(ADMIN_LINE).innerText()
  check(line.includes('환불 판단 전액 환불 가능') && line.includes('첫 공유 없음'), `관리자 줄(편집기): 환불 판단 (${line.slice(-70)})`)
  await shot(page, 'refund-admin-line', ADMIN_LINE)
  await page.getByRole('button', { name: /^(발행하기|공유하기)$/ }).click()
  await page.getByRole('dialog', { name: /공유하기|발행하기/ }).getByRole('button', { name: '복사' }).click()
  await page.getByTestId('share-guard').waitFor()
  check(true, '편집기 공유 시트: 처음 복사 → 확인 창')
  await shot(page, 'refund-editor-guard')
  await page.getByTestId('share-guard').getByRole('button', { name: '공유하기' }).click()
  await page.waitForTimeout(1000)
  check(col(C.id, 'first_shared_at'), '편집기 [공유하기] → first_shared_at 기록')

  // ───────── D: 결제 후 7일 경과 ─────────
  const D = await paidWedding(page, 'E2E 환불 D 기간')
  D.order.paidAt = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString()
  r = await refundText('E2E 환불 D 기간')
  check(r.kind === 'limited' && r.text === '결제 후 7일이 지나 환불이 제한돼요', `7일 경과: 환불 제한 (${r.text})`)

  // 결제 완료 모달 · 삭제 확인 문구
  await page.goto(`${BASE}/edit/${D.id}?paid=1`)
  const wel = await page.getByTestId('paid-welcome-refund').innerText().catch(() => '')
  check(wel.includes('결제 후 7일 이내이고 아직 공유하지 않았다면 전액 환불돼요'), '결제 완료 모달: 새 환불 문구')

  // ───────── 문구: 가격 페이지 · 약관 ─────────
  await page.goto(`${BASE}/pricing`)
  const pr = await page.locator('main').innerText()
  check(pr.includes('결제 후 7일 이내이고 아직 공유하지 않았다면 전액 환불돼요'), '/pricing: 새 환불 문구')
  await page.goto(`${BASE}/terms/payments`)
  const tm = await page.locator('main').innerText()
  check(tm.includes('링크 복사 · 카카오톡 공유 · QR 저장') && tm.includes('무료 미리보기') && tm.includes('회사의 사정으로 프리미엄 기능을 이용하지 못한 경우'), '/terms/payments: 공유 · 무료 미리보기 · 회사 사정 예외')
  await page.goto(`${BASE}/terms`)
  check(!(await page.locator('main').innerText()).includes('QR 저장'), '/terms(시행 중): 바뀌지 않음')
  check(errors.length === 0, `페이지 오류 없음 ${errors.join(' | ')}`)
  await browser.close()
  server.close()
  console.log(failures ? `\n실패 ${failures}건` : '\n모두 통과')
  process.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
