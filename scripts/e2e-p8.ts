/**
 * 한피 결제 허브 연동 확인(로컬). 실행: pnpm e2e:p8
 * 가짜 허브 서버(이 스크립트가 4020 포트로 띄움: listProducts · checkout · getOrder · listOrders · getSubjectEntitlements)와
 * 서명된 알림을 만들어 앱에 보낸다. 앱은 아래 환경으로 따로 띄워 둔다:
 *   HANPY_API_ORIGIN=http://localhost:4020 HANPY_SERVICE_TOKEN=tok_e2e HANPY_NOTIFY_SECRET=notify_e2e
 *   PAYMENTS_LIVE=2026-11-01T00:00:00+09:00 ADMIN_KAKAO_IDS=dev-1 KAKAO_REST_API_KEY=e2e DEV_LOGIN=1 (포트 3001)
 */
import { createHmac, randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createServer } from 'node:http'

import { chromium, type BrowserContext, type Page } from 'playwright'

import { getEntitlements, planDecision, resolvePlan } from '../shared/entitlements'
import { MEETUP_EVENT_UNTIL, skuFor } from '../shared/pricing'

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
function markRefunded(o: Order) {
  o.status = 'refunded'
  o.refundedAt = new Date().toISOString()
  if (o.subject) entitled.delete(o.subject.id)
}

function markPartiallyRefunded(o: Order, amount: number) {
  o.status = 'partially_refunded'
  o.refundedAmount = amount
  o.refundedAt = new Date().toISOString()
  // 일부 환불은 이용권 유지 (entitled 그대로)
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
const premiumHub = (id: string) => sql(`select premium_hub from invitations where id='${id}'`) === 't'

const ADMIN_LINE = '[data-testid=admin-hub]'

/** E2E_SWITCH_OFF=1: 앱을 PAYMENTS_LIVE 없이 띄워 두고 실행. 스위치가 꺼져도 플랜 판단은 그대로인지 확인 */
async function switchOffMode() {
  await new Promise<void>((r) => server.listen(HUB_PORT, r))
  const browser = await chromium.launch()
  const ctx = await browser.newContext(mobile)
  const page = await newPage(ctx)
  await page.goto(`${BASE}/api/auth/kakao/login?dev=1&next=/new`)
  const id = await create(page, /결혼식/, 'E2E 스위치 꺼짐')
  await page.goto(`${BASE}/edit/${id}`)
  const line = await page.locator(ADMIN_LINE).innerText()
  check(line.includes('프리미엄 근거: 무료'), `스위치 꺼짐: PAYMENTS_LIVE_AT 이후 생성분은 여전히 무료 (${line})`)
  const premium = await create(page, /결혼식/, 'E2E 스위치 꺼짐 오픈 전')
  sql(`update invitations set created_at = '2026-10-01T00:00:00+09:00' where id='${premium}'`)
  await page.goto(`${BASE}/edit/${premium}`)
  check((await page.locator(ADMIN_LINE).innerText()).includes('프리미엄 근거: 오픈 전 생성'), '스위치 꺼짐: 오픈 전 생성분은 그대로 premium')
  // 관리자는 미리 보기로 결제 화면을 쓸 수 있으니, 일반 사용자 화면에서 결제 안내가 숨는지 본다
  const ctx2 = await browser.newContext(mobile)
  const p2 = await newPage(ctx2)
  await p2.goto(`${BASE}/api/auth/kakao/login?dev=1&as=2&next=/new`)
  const nid = await create(p2, /결혼식/, 'E2E 스위치 꺼짐 일반')
  await p2.goto(`${BASE}/edit/${nid}`)
  await p2.getByRole('button', { name: /^(발행하기|공유하기)$/ }).click()
  check((await p2.getByRole('dialog').getByRole('link', { name: '프리미엄 결제하기' }).count()) === 0, '스위치 꺼짐: 일반 사용자에게 결제 안내만 숨김')
  await browser.close()
  server.close()
  console.log(failures ? `\n실패 ${failures}건` : '\n모두 통과')
  process.exit(failures ? 1 : 0)
}

async function main() {
  if (process.env.E2E_SWITCH_OFF) return switchOffMode()
  await new Promise<void>((r) => server.listen(HUB_PORT, r))
  const browser = await chromium.launch()
  const ordersBefore = sql('select count(*) from orders')

  // ───────── 규칙(순수 함수): 결제 전 초대장 · 모임 이벤트 · 경계 ─────────
  {
    const base = { premiumHub: false, premiumOrderId: null, derivedPremium: false, isMeetup: false }
    const live = new Date('2026-11-20T00:00:00+09:00')
    const after = new Date('2026-12-01T00:00:00+09:00')
    check(resolvePlan({ ...base, liveAt: null, createdAt: after }) === 'premium', '결제 꺼짐 → premium')
    check(resolvePlan({ ...base, liveAt: live, createdAt: '2026-11-10T00:00:00+09:00', now: after }) === 'premium', 'PAYMENTS_LIVE 전에 만든 초대장 = premium (legacy 아님)')
    check(resolvePlan({ ...base, liveAt: live, createdAt: after, now: after }) === 'free', '결제 시작 뒤 가족 행사(허브 이용권 없음) = free')
    check(resolvePlan({ ...base, premiumHub: true, liveAt: live, createdAt: after, now: after }) === 'premium', '허브 이용권 캐시 true = premium')
    check(resolvePlan({ ...base, derivedPremium: true, liveAt: live, createdAt: after, now: after }) === 'premium', '파생(부모 이용권) = premium')
    const justIn = new Date(MEETUP_EVENT_UNTIL.getTime())
    const justOut = new Date(MEETUP_EVENT_UNTIL.getTime() + 1000)
    check(MEETUP_EVENT_UNTIL.toISOString() === '2027-01-31T14:59:59.000Z', '이벤트 마감 = 2027-01-31 23:59:59 KST')
    check(resolvePlan({ ...base, isMeetup: true, liveAt: live, createdAt: justIn, now: justIn }) === 'event', '1/31 23:59:59 KST 만든 모임 = event')
    check(resolvePlan({ ...base, isMeetup: true, liveAt: live, createdAt: justOut, now: justOut }) === 'free', '2/1 00:00:00 KST 만든 모임 = free')
    check(resolvePlan({ ...base, isMeetup: false, liveAt: live, createdAt: after, now: after }) === 'free', '이벤트는 가족 행사에는 없음')
    // 플랜 판단은 고정 시각(liveAt)만 본다: 결제 스위치(PAYMENTS_LIVE)는 입력에 없다 → 스위치를 꺼도 같다
    const d = planDecision({ ...base, liveAt: live, createdAt: after, now: after })
    check(d.plan === 'free' && d.basis === 'free', '스위치와 무관: PAYMENTS_LIVE_AT 이후 생성분 = free (근거 free)')
    check(planDecision({ ...base, liveAt: live, createdAt: after, now: after }).plan === resolvePlan({ ...base, liveAt: live, createdAt: after, now: after }), '같은 입력 → 같은 플랜(스위치 입력 없음)')
    check(planDecision({ ...base, liveAt: live, createdAt: '2026-10-01T00:00:00+09:00', now: after }).basis === 'before-live', '근거: 오픈 전 생성')
    check(planDecision({ ...base, liveAt: null, createdAt: after, now: after }).basis === 'payments-off', '근거: 결제 꺼짐(PAYMENTS_LIVE_AT=null)')
    const ev = getEntitlements({ plan: 'event' })
    check(ev.photoLimit === 60 && ev.introEffects && !ev.canHideMadeWith, 'event 등급: 사진 60 · 봉투 · 효과 O, 하단 문구 숨기기 X')
    check(skuFor('wedding') === 'invitation.premium.family.open' && skuFor('thanks') === 'invitation.premium.family.open' && skuFor('yearend') === 'invitation.premium.meetup', '행사 → SKU 매핑')
  }

  // ───────── 허브가 안 될 때: 가격 대신 안내, 결제 버튼 비활성 ─────────
  const ctx = await browser.newContext(mobile)
  const page = await newPage(ctx)
  await page.goto(`${BASE}/api/auth/kakao/login?dev=1&next=/new`)
  hub.down = true // 가격 캐시(5분)가 채워지기 전에 먼저 불통 상태로 시작
  const wedding = await create(page, /결혼식/, 'E2E 허브 결혼')
  await page.goto(`${BASE}/pay/${wedding}`)
  check(await page.getByText('가격을 불러오지 못했어요').first().isVisible(), '허브 불통: "가격을 불러오지 못했어요"')
  await page.getByRole('checkbox').check()
  check(await page.getByRole('button', { name: /가격을 불러오지 못했어요/ }).isDisabled(), '허브 불통: 결제 버튼 비활성')
  hub.down = false

  // ───────── 가격 표시(허브 값) · 오픈 특가 표기 ─────────
  await page.goto(`${BASE}/pay/${wedding}`)
  check(await page.getByText('9,900원').first().isVisible(), '/pay: 허브 가격 9,900원')
  check(await page.getByText('오픈 특가').count(), '/pay: 오픈 특가 표기')
  check((await page.locator('del, s').count()) === 0, '/pay: 취소선 없음(14,900원을 원래 가격처럼 보이지 않음)')
  check(!(await page.content()).includes('14,900'), '/pay: 14,900원이 화면에 없음')
  await page.goto(`${BASE}/pricing`)
  const pr = await page.locator('main').innerText()
  check(pr.includes('9,900원') && pr.includes('3,900원') && !pr.includes('14,900'), '/pricing: 허브 가격 9,900 · 3,900')

  // ───────── 결제 시작 → 허브 checkout ─────────
  const uid = userIdOf('dev-1')
  await page.goto(`${BASE}/pay/${wedding}`)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: /9,900원 결제하기/ }).click()
  await page.waitForURL(/groble\.test/)
  const o1 = [...orders.values()].find((o) => o.subject?.id === wedding)!
  check(page.url() === `https://groble.test/pay?ref=${o1.ref}`, '허브가 준 action.url로만 이동(그로블 링크는 화면 코드에 없음)')
  const log = checkoutLog.at(-1)!
  check(log.sku === 'invitation.premium.family.open' && log.customerRef === uid && log.subjectId === wedding, 'checkout: SKU는 서버가 정함 · customerRef=users.id · subject=초대장')
  check(/^[0-9a-f-]{36}:[0-9a-f-]{36}$/.test(log.key) && log.key.startsWith(`${uid}:`), 'checkout: idempotencyKey = userId:attemptId')
  check(sql('select count(*) from orders') === ordersBefore, '자체 orders 행을 만들지 않음')

  // ───────── 돌아오기: pending → paid ─────────
  await page.goto(`${BASE}/pay/return`)
  const stored = await page.evaluate(() => [sessionStorage.getItem('hanpy:lastOrderId'), sessionStorage.getItem('hanpy:lastInvitationId')])
  check(stored[0] === o1.orderId && stored[1] === wedding, '이동 전에 sessionStorage에 주문번호 · 초대장 저장')
  // 같은 탭의 sessionStorage는 유지된다(위에서 저장된 값)
  await page.getByText('결제를 확인하고 있어요').first().waitFor()
  check(true, '/pay/return: pending이면 확인 중 화면')
  markPaid(o1)
  check((await notify(o1, 'payment.paid')) === 200, '알림(paid) → 200')
  check(premiumHub(wedding), '알림 → 허브에 다시 물어 premium_hub=true')
  await page.waitForURL(new RegExp(`/edit/${wedding}`), { timeout: 15000 })
  check(true, '/pay/return: paid → 편집기로')
  await page.getByRole('button', { name: /^(발행하기|공유하기)$/ }).click()
  check((await page.getByRole('dialog').getByRole('link', { name: '프리미엄 결제하기' }).count()) === 0, '프리미엄 켜짐: 결제 안내 사라짐')
  await page.keyboard.press('Escape')

  // ───────── 알림 검증 ─────────
  check((await notify(o1, 'payment.paid', { sig: 'deadbeef' })) === 401, '알림 서명 틀림 → 401')
  check((await notify(o1, 'payment.paid', { secret: 'other' })) === 401, '다른 키로 서명 → 401')
  check((await notify(o1, 'payment.paid', { ts: String(Math.floor(Date.now() / 1000) - 900) })) === 401, '오래된 알림 → 401')
  const evId = randomUUID()
  check((await notify(o1, 'payment.paid', { eventId: evId })) === 200 && (await notify(o1, 'payment.paid', { eventId: evId })) === 200, '같은 eventId 두 번 → 둘 다 2xx')
  check(sql(`select count(*) from webhook_events where key='hanpy:${evId}'`) === '1', 'eventId는 한 번만 기록(provider hanpy)')
  hub.down = true
  const failId = randomUUID()
  check((await notify(o1, 'payment.paid', { eventId: failId })) === 500, '허브 재조회 실패 → 500(허브가 다시 보냄)')
  check(sql(`select count(*) from webhook_events where key='hanpy:${failId}'`) === '0', '처리 실패한 알림은 중복 기록을 되돌림')
  hub.down = false
  check(premiumHub(wedding), '허브가 응답하지 않아도 기존 캐시는 유지')

  // ───────── 대시보드 결제 내역 ─────────
  await page.goto(`${BASE}/dashboard`)
  const dash = await page.locator('#orders').innerText()
  check(dash.includes('결제 완료') && dash.includes('9,900원') && dash.includes('E2E 허브 결혼'), '대시보드: 허브 주문 · 초대장 제목(우리 DB)')
  const lk = await page.locator('#orders a', { hasText: '그로블에서 환불 신청' }).count()
  const bt = await page.locator('#orders button').count()
  check(lk === 1 && bt === 0, `대시보드: 그로블 주문조회 링크만, 환불 버튼 없음 (링크 ${lk}, 버튼 ${bt})`)
  check(dash.includes('발행 전이면 전액 환불돼요'), '대시보드: 환불 안내 문구')

  // ───────── 환불 → 꺼짐 ─────────
  markRefunded(o1)
  check((await notify(o1, 'payment.refunded')) === 200, '알림(refunded) → 200')
  check(!premiumHub(wedding), 'refunded → 허브 재조회로 premium_hub=false')

  // ───────── 주인 화면 재조회(알림이 안 와도 10분 뒤 대조) ─────────
  const lateId = await create(page, /결혼식/, 'E2E 허브 대조')
  entitled.add(lateId)
  sql(`update invitations set premium_checked_at = now() - interval '11 minutes' where id='${lateId}'`)
  await page.goto(`${BASE}/edit/${lateId}`)
  await page.waitForLoadState('networkidle')
  check(premiumHub(lateId), '편집기: 10분 지난 캐시는 허브에 다시 물어 갱신')
  entitled.delete(lateId)

  // ───────── ALREADY_ENTITLED · PAYMENT_UNAVAILABLE ─────────
  const dupId = await create(page, /결혼식/, 'E2E 허브 중복')
  entitled.add(dupId) // 캐시는 아직 false
  const dup = await checkout(page, dupId)
  check(dup.status === 409 && dup.body.error === '이미 프리미엄이에요', 'ALREADY_ENTITLED → 409 "이미 프리미엄이에요"')
  check(premiumHub(dupId), 'ALREADY_ENTITLED → 캐시도 true로 갱신')
  const noLink = await create(page, /송년회/, 'E2E 허브 불가')
  hub.unavailable = true
  const un = await checkout(page, noLink)
  check(un.status === 503 && un.body.error === '지금은 결제를 시작할 수 없어요', 'PAYMENT_UNAVAILABLE → 503')
  hub.unavailable = false
  const meet = await checkout(page, noLink)
  check(meet.status === 200 && checkoutLog.at(-1)!.sku === 'invitation.premium.meetup', '모임은 meetup SKU')

  // ───────── 파생 초대장 ─────────
  const parent = await create(page, /결혼식/, 'E2E 허브 부모')
  const child = await create(page, /결혼식/, 'E2E 허브 자식')
  sql(`update invitations set event_type='prewedding', derived_from_id='${parent}' where id='${child}'`)
  const openPublish = async (id: string) => {
    await page.goto(`${BASE}/edit/${id}`)
    await page.getByRole('button', { name: /^(발행하기|공유하기)$/ }).click()
  }
  await openPublish(child)
  check((await page.getByRole('dialog').getByRole('link', { name: '프리미엄 결제하기' }).count()) === 1, '파생: 부모 이용권 없으면 결제 안내 보임')
  sql(`update invitations set premium_hub = true where id='${parent}'`)
  await openPublish(child)
  check((await page.getByRole('dialog').getByRole('link', { name: '프리미엄 결제하기' }).count()) === 0, '파생: 부모(결혼) 이용권이 있으면 추가 결제 없음')

  // ───────── 관리자 확인 줄 · 관리자 화면 · 부모 환불 → 파생 · 이벤트 안내 ─────────
  const adminLine = async (id: string) => {
    await page.goto(`${BASE}/edit/${id}`)
    return page.locator(ADMIN_LINE).innerText()
  }
  const pa = await create(page, /결혼식/, 'E2E 허브 관리자줄')
  let l = await adminLine(pa)
  check(/허브 이용권: 없음 · 확인 시각 \d\d:\d\d · 프리미엄 근거: 무료/.test(l), `관리자 줄: 결제 전 → 없음 · 무료 (${l})`)
  const pc = await checkout(page, pa)
  check(pc.status === 200, '관리자 줄용 결제 시작')
  const opa = [...orders.values()].find((o) => o.subject?.id === pa)!
  markPaid(opa)
  l = await adminLine(pa) // 알림이 오기 전이라도 화면을 여는 순간 허브에 바로 다시 물어 본다(캐시 아님)
  check(l.includes('허브 이용권: 있음') && l.includes('프리미엄 근거: 허브 결제'), `관리자 줄: 결제 → 있음 · 허브 결제 (${l})`)
  // 파생: 부모(결혼) 결제 → 파생 청첩장 모임 premium → 부모 환불 알림 → 파생도 premium 아님
  await notify(opa, 'payment.paid')
  const pk = await create(page, /결혼식/, 'E2E 허브 파생 자식')
  sql(`update invitations set event_type='prewedding', derived_from_id='${pa}' where id='${pk}'`)
  l = await adminLine(pk)
  check(l.includes('프리미엄 근거: 부모 상속'), `부모 결제 → 파생 청첩장 모임 premium (${l})`)
  markRefunded(opa)
  check((await notify(opa, 'payment.refunded')) === 200, '부모 환불 알림 → 200')
  l = await adminLine(pa)
  check(l.includes('허브 이용권: 없음'), `관리자 줄: 환불 → 없음 (${l})`)
  l = await adminLine(pk)
  check(!l.includes('부모 상속') && !l.includes('허브 결제'), `부모 환불 → 파생은 더 이상 부모 상속 premium이 아님(지금은 모임 이벤트 등급) (${l})`)
  await openPublish(pk)
  check((await page.getByRole('dialog').getByRole('link', { name: '프리미엄 결제하기' }).count()) === 1, '부모 환불 뒤 파생 화면에 결제 안내가 다시 보임')
  await page.keyboard.press('Escape')

  // 오픈 전 생성 · 모임 이벤트 근거와 3,900원 안내 문구
  const old = await create(page, /결혼식/, 'E2E 허브 오픈전')
  sql(`update invitations set created_at = '2026-10-01T00:00:00+09:00' where id='${old}'`)
  check((await adminLine(old)).includes('프리미엄 근거: 오픈 전 생성'), '관리자 줄: 오픈 전 생성')
  const ye = await create(page, /송년회/, 'E2E 허브 이벤트')
  check((await adminLine(ye)).includes('프리미엄 근거: 모임 이벤트'), '관리자 줄: 모임 이벤트')
  await openPublish(ye)
  const dlg = await page.getByRole('dialog').innerText()
  check(dlg.includes('하단 문구 숨기기는 프리미엄에서만 돼요 · 3,900원'), '모임 이벤트: "하단 문구 숨기기는 프리미엄에서만 돼요 · 3,900원"')
  check(!dlg.includes('사진을 초대장당'), '모임 이벤트: 이미 열린 기능(사진 한도 등)은 나열하지 않음')
  await page.keyboard.press('Escape')
  hub.down = true
  l = await adminLine(pa)
  check(/허브 이용권: 확인 못 함\(503 HUB_DOWN\)/.test(l) && !l.includes('tok_e2e'), `관리자 줄: 허브 불통이면 status · code만 (${l})`)
  hub.down = false

  // 대시보드 줄 · 관리자가 아니면 안 보임
  await page.goto(`${BASE}/dashboard`)
  check((await page.locator(ADMIN_LINE).count()) >= 3, '대시보드: 관리자에게 초대장별 줄')
  const ctxN = await browser.newContext(mobile)
  const pn = await newPage(ctxN)
  await pn.goto(`${BASE}/api/auth/kakao/login?dev=1&as=2&next=/new`)
  const nid = await create(pn, /결혼식/, 'E2E 일반 사용자')
  await pn.goto(`${BASE}/edit/${nid}`)
  check((await pn.locator(ADMIN_LINE).count()) === 0 && !(await pn.content()).includes('허브 이용권'), '일반 사용자 편집기: 관리자 줄 없음')
  await pn.goto(`${BASE}/dashboard`)
  check((await pn.locator(ADMIN_LINE).count()) === 0, '일반 사용자 대시보드: 관리자 줄 없음')
  check((await pn.goto(`${BASE}/admin/stats`))!.status() === 404, '일반 사용자: /admin/stats 404')
  await ctxN.close()

  // /admin/stats '결제 허브' 칸
  await page.goto(`${BASE}/admin/stats`)
  const panel = await page.getByTestId('hub-panel').innerText()
  check(['HANPY_API_ORIGIN', 'HANPY_SERVICE_TOKEN', 'HANPY_NOTIFY_SECRET'].every((k) => new RegExp(`${k}\\s+있음`).test(panel)), '/admin/stats: 설정 3개 있음')
  const prod = await page.getByTestId('hub-products').innerText()
  check(prod.includes('invitation.premium.family.open') && prod.includes('9,900원') && prod.includes('invitation.premium.family') && prod.includes('14,900원') && prod.includes('중지') && prod.includes('invitation.premium.meetup') && prod.includes('3,900원'), '/admin/stats: SKU · 가격 · 판매 여부 3줄')
  let html = await page.content()
  check(!html.includes('tok_e2e') && !html.includes('notify_e2e') && !html.includes('localhost:4020'), '/admin/stats: 토큰 · 키 · 허브 주소 값은 표시하지 않음')
  await page.screenshot({ path: process.env.E2E_SHOT ?? '/tmp/admin-stats.png', fullPage: false })
  hub.down = true
  await page.goto(`${BASE}/admin/stats`)
  const txt = await page.locator('main').innerText()
  html = await page.content()
  check(txt.includes('상품 조회 실패 · status 503 · code HUB_DOWN') && !html.includes('tok_e2e') && !html.includes('"title":"down"'), '/admin/stats: 허브 실패는 status · code만')
  hub.down = false

  // ───────── 다른 사람 주문 404 · 사용자 기준 대체 확인 ─────────
  const ctx2 = await browser.newContext(mobile)
  const p2 = await newPage(ctx2)
  await p2.goto(`${BASE}/api/auth/kakao/login?dev=1&as=2&next=/new`)
  const other = await p2.evaluate(async (oid) => (await fetch(`/api/pay/orders/${oid}`)).status, o1.orderId)
  check(other === 404, '남의 주문 조회 → 404')
  const mine = await p2.evaluate(async () => (await (await fetch('/api/pay/status')).json()).status)
  check(mine === 'none', '/api/pay/status: 내 주문이 없으면 none(남의 주문을 보지 않음)')
  await ctx2.close()

  const o2 = [...orders.values()].filter((o) => o.customerRef === uid).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  markPaid(o2)
  await page.goto(`${BASE}/`)
  await page.evaluate(() => sessionStorage.clear())
  await page.goto(`${BASE}/pay/return`)
  await page.waitForURL(/\/edit\//, { timeout: 15000 })
  check(page.url().includes(o2.subject!.id), '/pay/return: 주문번호가 없어도 내 최근 주문으로 판단 → 편집기')

  // ───────── 상태별 돌아오기 화면 ─────────
  for (const [status, text] of [['expired', '결제가 완료되지 않았어요'], ['cancel_requested', '환불을 신청했어요']] as const) {
    const o = orders.get([...orders.keys()][0])!
    const fake = { ...o, orderId: randomUUID(), customerRef: uid, status }
    orders.set(fake.orderId, fake)
    await page.goto(`${BASE}/`)
    await page.evaluate((id) => sessionStorage.setItem('hanpy:lastOrderId', id), fake.orderId)
    await page.goto(`${BASE}/pay/return`)
    await page.getByText(text).first().waitFor({ timeout: 10000 }).catch(() => {})
    check(await page.getByText(text).first().isVisible(), `/pay/return: ${status} → "${text}"`)
  }

  // ───────── 일부 환불 (partially_refunded): 이용권 유지 · "일부 환불" 표시 ─────────
  const partId = await create(page, /결혼식/, 'E2E 일부 환불')
  const co = await checkout(page, partId)
  check(co.status === 200, '일부 환불용 결제 시작')
  const op = [...orders.values()].filter((o) => o.subject?.id === partId)[0]
  markPaid(op)
  check((await notify(op, 'payment.paid')) === 200 && premiumHub(partId), '일부 환불 전: 결제 완료 → premium_hub=true')
  markPartiallyRefunded(op, 3000)
  check((await notify(op, 'payment.refunded')) === 200, '알림(일부 환불) → 200')
  check(premiumHub(partId), '일부 환불: 허브 이용권이 남아 있어 premium_hub=true 유지(상태값으로 판단하지 않음)')
  await page.goto(`${BASE}/dashboard`)
  const dash2 = await page.locator('#orders').innerText()
  check(dash2.includes('일부 환불') && dash2.includes('환불 3,000원'), `대시보드: "일부 환불" + 환불액 (${dash2.replace(/\n/g, ' ').slice(0, 160)})`)
  const dashAdmin = await page.locator('[data-testid=admin-hub]').allInnerTexts()
  check(dashAdmin.some((t) => t.includes('주문 상태: 일부 환불(3,000원)') && t.includes('허브 이용권: 있음')), '관리자 확인 줄(대시보드): 주문 상태 일부 환불 + 이용권 있음')
  await page.goto(`${BASE}/edit/${partId}`)
  const editAdmin = await page.locator(ADMIN_LINE).innerText()
  check(editAdmin.includes('주문 상태: 일부 환불') && editAdmin.includes('허브 이용권: 있음'), `관리자 확인 줄(편집기): ${editAdmin}`)
  await page.goto(`${BASE}/`)
  await page.evaluate((id) => sessionStorage.setItem('hanpy:lastOrderId', id), op.orderId)
  await page.goto(`${BASE}/pay/return`)
  await page.getByText('일부 환불된 결제예요').first().waitFor({ timeout: 10000 }).catch(() => {})
  const ret = await page.locator('main').innerText()
  check(ret.includes('일부 환불된 결제예요') && ret.includes('3,000원이 환불됐어요') && ret.includes('프리미엄은 그대로 유지돼요'), '/pay/return: 일부 환불 + 환불액 표시')
  const detail = [...orders.values()].find((o) => o.orderId === op.orderId)!
  markRefunded(detail)
  check((await notify(detail, 'payment.refunded')) === 200 && !premiumHub(partId), '이어서 전액 환불 → 이용권 회수')

  // ───────── 미성년자 고지: 결제 버튼이 있는 화면마다 ─────────
  const MINOR = '만 19세 미만은 법정대리인의 동의가 필요합니다'
  const minorId = await create(page, /결혼식/, 'E2E 미성년자 고지')
  await page.goto(`${BASE}/pay/${minorId}`)
  await page.getByRole('button', { name: /결제하기/ }).waitFor()
  check((await page.getByText(MINOR).count()) === 1, '/pay: 결제 버튼 옆 미성년자 고지')
  const nextBtn = await page.getByRole('button', { name: /결제하기/ }).boundingBox()
  const note = await page.getByTestId('minor-notice').boundingBox()
  check(!!nextBtn && !!note && note.y >= nextBtn.y && note.y - (nextBtn.y + nextBtn.height) < 40, '/pay: 고지가 결제 버튼 바로 아래')
  await page.goto(`${BASE}/edit/${minorId}`)
  await page.getByLabel('초대장 제목').waitFor()
  await page.getByRole('button', { name: /^(발행하기|공유하기)$/ }).first().click()
  const sheet = page.getByRole('dialog')
  await sheet.getByRole('link', { name: '프리미엄 결제하기' }).first().waitFor({ timeout: 10000 })
  check((await sheet.getByText(MINOR).count()) >= 1, '편집기 발행 시트(결제 안내): 미성년자 고지')
  await page.keyboard.press('Escape')
  await page.goto(`${BASE}/pricing`)
  check((await page.getByText(MINOR).count()) === 1, '/pricing: 미성년자 고지')

  check(hub.auth === 0, '허브 호출은 모두 서비스 토큰 · 서비스 키 헤더가 맞음')
  check(sql('select count(*) from orders') === ordersBefore, '끝까지 자체 orders 행은 늘지 않음')
  check(errors.length === 0, `브라우저 오류 없음 ${errors.join(' | ')}`)
  await browser.close()
  server.close()
  console.log(failures ? `\n실패 ${failures}건` : '\n모두 통과')
  process.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
