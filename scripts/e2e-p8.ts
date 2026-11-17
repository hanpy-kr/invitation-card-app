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

import { getEntitlements, resolvePlan } from '../shared/entitlements'
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

async function main() {
  await new Promise<void>((r) => server.listen(HUB_PORT, r))
  const browser = await chromium.launch()
  const ordersBefore = sql('select count(*) from orders')

  // ───────── 규칙(순수 함수): 결제 전 초대장 · 모임 이벤트 · 경계 ─────────
  {
    const base = { premiumHub: false, premiumOrderId: null, derivedPremium: false, isMeetup: false }
    const live = new Date('2026-11-20T00:00:00+09:00')
    const after = new Date('2026-12-01T00:00:00+09:00')
    check(resolvePlan({ ...base, liveSince: null, createdAt: after }) === 'premium', '결제 꺼짐 → premium')
    check(resolvePlan({ ...base, liveSince: live, createdAt: '2026-11-10T00:00:00+09:00', now: after }) === 'premium', 'PAYMENTS_LIVE 전에 만든 초대장 = premium (legacy 아님)')
    check(resolvePlan({ ...base, liveSince: live, createdAt: after, now: after }) === 'free', '결제 시작 뒤 가족 행사(허브 이용권 없음) = free')
    check(resolvePlan({ ...base, premiumHub: true, liveSince: live, createdAt: after, now: after }) === 'premium', '허브 이용권 캐시 true = premium')
    check(resolvePlan({ ...base, derivedPremium: true, liveSince: live, createdAt: after, now: after }) === 'premium', '파생(부모 이용권) = premium')
    const justIn = new Date(MEETUP_EVENT_UNTIL.getTime())
    const justOut = new Date(MEETUP_EVENT_UNTIL.getTime() + 1000)
    check(MEETUP_EVENT_UNTIL.toISOString() === '2027-01-31T14:59:59.000Z', '이벤트 마감 = 2027-01-31 23:59:59 KST')
    check(resolvePlan({ ...base, isMeetup: true, liveSince: live, createdAt: justIn, now: justIn }) === 'event', '1/31 23:59:59 KST 만든 모임 = event')
    check(resolvePlan({ ...base, isMeetup: true, liveSince: live, createdAt: justOut, now: justOut }) === 'free', '2/1 00:00:00 KST 만든 모임 = free')
    check(resolvePlan({ ...base, isMeetup: false, liveSince: live, createdAt: after, now: after }) === 'free', '이벤트는 가족 행사에는 없음')
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
