/**
 * 프리미엄 결제 확인(로컬). 실행: pnpm e2e:p5
 * 준비(자동 아님):
 *  - 빌드: NEXT_PUBLIC_TOSS_CLIENT_KEY=test_gck_e2e 를 넣어 빌드 (+ p2와 같은 e2e 값)
 *  - 서버 A(3001, 결제 켬): PAYMENTS_LIVE=2026-11-01T00:00:00+09:00 TOSS_SECRET_KEY=test_gsk_e2e TOSS_API_BASE=http://localhost:4010
 *  - 서버 B(3002, 결제 꺼짐): PAYMENTS_LIVE 없음
 * 토스 서버는 이 스크립트가 4010 포트에 가짜로 띄우고, 결제위젯 SDK는 스텁으로 바꿔 끼운다.
 */
import { execFileSync } from 'node:child_process'
import { createServer } from 'node:http'

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'

const ON = process.env.E2E_BASE ?? 'http://localhost:3001'
const OFF = process.env.E2E_BASE_OFF ?? 'http://localhost:3002'
const DB = 'postgres://dearday:dearday@localhost:5432/dearday'
const SECRET = 'test_gsk_e2e'

let failures = 0
function check(ok: unknown, label: string) {
  console.log(`${ok ? '✅' : '❌'} ${label}`)
  if (!ok) failures++
}
const sql = (q: string) => execFileSync('psql', [DB, '-tAc', q]).toString().trim()

// ── 가짜 토스 서버 ──
type Call = { path: string; auth: string; body: Record<string, unknown> }
const calls: Call[] = []
const paid = new Map<string, { orderId: string; amount: number }>()
const mock = createServer((req, res) => {
  let raw = ''
  req.on('data', (c) => (raw += c))
  req.on('end', () => {
    const body = raw ? JSON.parse(raw) : {}
    const path = req.url ?? ''
    calls.push({ path, auth: String(req.headers.authorization ?? ''), body })
    const send = (code: number, obj: unknown) => {
      res.writeHead(code, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(obj))
    }
    const okAuth = req.headers.authorization === `Basic ${Buffer.from(`${SECRET}:`).toString('base64')}`
    if (!okAuth) return send(401, { code: 'UNAUTHORIZED_KEY', message: '인증되지 않은 키예요.' })
    if (path === '/v1/payments/confirm') {
      if (String(body.paymentKey).startsWith('pk_reject'))
        return send(400, { code: 'REJECT_CARD_PAYMENT', message: '카드사에서 결제를 거절했어요.' })
      paid.set(String(body.paymentKey), { orderId: String(body.orderId), amount: Number(body.amount) })
      return send(200, {
        paymentKey: body.paymentKey,
        orderId: body.orderId,
        status: 'DONE',
        totalAmount: body.amount,
        method: '카드',
        approvedAt: new Date().toISOString(),
        receipt: { url: `https://example.test/receipt/${body.paymentKey}` },
      })
    }
    const m = path.match(/^\/v1\/payments\/([^/]+)\/cancel$/)
    if (m) return send(200, { paymentKey: decodeURIComponent(m[1]), status: 'CANCELED' })
    send(404, { code: 'NOT_FOUND', message: 'not found' })
  })
})

// 토스 결제위젯 SDK 스텁: requestPayment가 바로 successUrl / failUrl로 이동
const SDK_STUB = `
window.TossPayments = function (clientKey) {
  return { widgets: function (o) {
    var amount = 0;
    return {
      setAmount: async function (a) { amount = a.value },
      renderPaymentMethods: async function () {},
      renderAgreement: async function () {},
      requestPayment: async function (p) {
        var mode = window.__tossMode || 'ok';
        if (mode === 'cancel') { location.href = p.failUrl + '&code=PAY_PROCESS_CANCELED&message=' + encodeURIComponent('사용자가 결제를 취소했어요.'); return }
        var pk = (mode === 'reject' ? 'pk_reject_' : 'pk_ok_') + p.orderId;
        var amt = window.__tamper != null ? window.__tamper : amount;
        location.href = p.successUrl + '?paymentKey=' + pk + '&orderId=' + p.orderId + '&amount=' + amt;
      }
    }
  } }
};`

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
  await page.route('https://js.tosspayments.com/**', (r) =>
    r.fulfill({ contentType: 'application/javascript', body: SDK_STUB }),
  )
  return page
}

async function waitSaved(page: Page) {
  await page.getByRole('status').filter({ hasText: '저장됨' }).waitFor({ timeout: 15000 })
}

async function login(browser: Browser, base: string, opts: Partial<typeof mobile> = {}) {
  const ctx = await browser.newContext({ ...mobile, ...opts })
  const page = await newPage(ctx)
  await page.goto(`${base}/api/auth/kakao/login?dev=1&next=${encodeURIComponent('/new')}`)
  return { ctx, page }
}

/** 새 초대장 만들기 → 편집 화면. 만든 초대장 id 반환 */
async function create(page: Page, base: string, label: RegExp, title: string): Promise<string> {
  await page.goto(`${base}/new`)
  await page.getByRole('button', { name: label }).first().click()
  await page.waitForURL(/\/edit\//)
  await page.getByLabel('초대장 제목').fill(title)
  await waitSaved(page)
  return page.url().split('/edit/')[1].split(/[?#]/)[0]
}

async function openPublish(page: Page) {
  await page.getByRole('button', { name: /^(발행하기|공유하기)$/ }).click()
  return page.getByRole('dialog')
}

async function publish(page: Page): Promise<string> {
  const sheet = await openPublish(page)
  const pub = sheet.getByRole('button', { name: '발행하기' })
  if (await pub.count()) await pub.click()
  await sheet.getByRole('heading', { name: '초대장이 발행됐어요' }).waitFor()
  const url = await sheet.getByLabel('초대장 주소').inputValue()
  await sheet.getByRole('button', { name: '닫기' }).click()
  return url
}

async function pay(page: Page, base: string, id: string, mode: 'ok' | 'cancel' | 'reject' = 'ok', tamper?: number) {
  await page.goto(`${base}/pay/${id}`)
  await page.evaluate(
    ([m, t]) => {
      ;(window as unknown as Record<string, unknown>).__tossMode = m
      if (t != null) (window as unknown as Record<string, unknown>).__tamper = t
    },
    [mode, tamper ?? null] as const,
  )
  const btn = page.getByRole('button', { name: /결제하기$/ })
  return btn
}

async function main() {
  mock.listen(4010)
  const browser = await chromium.launch()

  // ───────── 결제 꺼짐(B): 지금처럼 무료, 결제 버튼 없음 ─────────
  {
    const { ctx, page } = await login(browser, OFF)
    const id = await create(page, OFF, /송년회/, 'E2E 결제꺼짐')
    const sheet = await openPublish(page)
    check((await sheet.getByRole('link', { name: '프리미엄 결제하기' }).count()) === 0, '꺼짐: 발행 창에 결제 버튼 없음')
    check((await sheet.getByText('프리미엄', { exact: false }).count()) === 0, '꺼짐: 프리미엄 안내 문구 없음')
    await sheet.getByRole('button', { name: '발행하기' }).click()
    await sheet.getByRole('heading', { name: '초대장이 발행됐어요' }).waitFor()
    check(await sheet.getByLabel(/문구 숨기기/).count(), '꺼짐: 모두 프리미엄 권한 (하단 문구 숨기기 가능)')
    const url = await sheet.getByLabel('초대장 주소').inputValue()
    const r = await page.goto(`${OFF}/pay/${id}`)
    check(r?.status() === 404, '꺼짐: /pay 는 404')
    const guest = await newPage(await browser.newContext(mobile))
    await guest.goto(url.replace(/^https?:\/\/[^/]+/, OFF))
    check(await guest.getByText('dearday로 만들었어요').count(), '꺼짐: 하단 문구는 기본 표시(지금처럼)')
    await guest.goto(`${OFF}/pricing`)
    check(await guest.getByText('모든 기능을 무료로 열어 두었어요').count(), '꺼짐: /pricing 에 무료 안내')
    check(await guest.getByText('통신판매업 신고번호').count(), '푸터에 통신판매업 신고번호 자리')
    await ctx.close()
  }

  // ───────── 결제 켜짐(A) ─────────
  const { ctx, page } = await login(browser, ON)
  const rowCount = (q: string) => Number(sql(q))

  // 1. 성공 · 3,900원 (송년회)
  const id1 = await create(page, ON, /송년회/, 'E2E 결제 성공')
  let sheet = await openPublish(page)
  check(await sheet.getByText('프리미엄 3,900원').count(), '켜짐: 발행 창에 프리미엄 3,900원 안내')
  check(await sheet.getByText('발행한 뒤에는 서비스 제공이 시작된 것으로 보아 환불되지 않아요').count(), '켜짐: 발행 후 환불 불가 고지')
  await sheet.getByRole('link', { name: '프리미엄 결제하기' }).click()
  await page.waitForURL(/\/pay\//)
  await page.evaluate(() => ((window as unknown as Record<string, unknown>).__tossMode = 'ok'))
  const payBtn = page.getByRole('button', { name: /3,900원 결제하기/ })
  await page.waitForFunction(() => document.querySelector('#payment-method') !== null)
  check(await payBtn.isDisabled(), '동의 체크 전에는 결제 버튼 비활성')
  await page.getByRole('checkbox').check()
  await page.waitForTimeout(300)
  check(await payBtn.isEnabled(), '동의 체크하면 결제 버튼 활성')
  await payBtn.click()
  await page.waitForURL(/\/pay\/.*\/done/)
  check(await page.getByRole('heading', { name: '결제가 완료됐어요' }).count(), '성공: 결제 완료 화면')
  check(await page.getByRole('link', { name: '영수증 보기' }).count(), '성공: 영수증 링크')
  const confirmCall = calls.find((c) => c.path === '/v1/payments/confirm')
  check(confirmCall && Number(confirmCall.body.amount) === 3900, '서버가 토스 승인 API를 금액 3900으로 호출')
  check(rowCount(`select count(*) from orders where invitation_id='${id1}' and status='paid' and amount=3900`) === 1, 'orders: paid 1건 · 3900원')
  check(sql(`select premium_order_id is not null from invitations where id='${id1}'`) === 't', '초대장에 프리미엄 적용')
  check(sql(`select refund_agreed_at is not null from orders where invitation_id='${id1}'`) === 't', '환불 동의 시각 기록')

  // 2. 중복 결제 막기
  await page.goto(`${ON}/pay/${id1}`)
  check(page.url().includes(`/edit/${id1}`), '이미 프리미엄이면 /pay 가 편집으로 돌려보냄')
  const dup = await page.evaluate(
    async (id) => (await fetch(`/api/invitations/${id}/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agreedRefund: true }) })).status,
    id1,
  )
  check(dup === 409, '중복 결제 시작은 409')
  const noAgree = await page.evaluate(
    async (id) => (await fetch(`/api/invitations/${id}/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agreedRefund: false }) })).status,
    id1,
  )
  check(noAgree === 400, '동의 없이 결제 시작은 400')

  // 3. 프리미엄 적용 후 편집기: 안내 없음 · 문구 숨기기
  await page.goto(`${ON}/edit/${id1}`)
  sheet = await openPublish(page)
  check((await sheet.getByRole('link', { name: '프리미엄 결제하기' }).count()) === 0, '프리미엄이면 결제 안내 없음')
  await sheet.getByRole('button', { name: '닫기' }).click()

  // 4. 대시보드 결제 내역 · 환불
  await page.goto(`${ON}/dashboard`)
  await page.getByRole('region', { name: '결제 내역' }).waitFor()
  check(await page.getByRole('region', { name: '결제 내역' }).getByText('결제 완료').count(), '대시보드: 결제 내역')
  check(await page.getByRole('link', { name: '영수증' }).count(), '대시보드: 영수증 링크')
  await page.getByRole('button', { name: '환불 요청' }).first().click()
  await page.getByText('환불됨').first().waitFor()
  const cancelCall = calls.find((c) => c.path.endsWith('/cancel'))
  check(cancelCall && cancelCall.path.includes('pk_ok_'), '환불: 토스 취소 API 호출')
  check(rowCount(`select count(*) from orders where invitation_id='${id1}' and status='canceled'`) === 1, 'orders: canceled')
  check(sql(`select premium_order_id is null from invitations where id='${id1}'`) === 't', '환불 후 프리미엄 해제')
  await page.goto(`${ON}/edit/${id1}`)
  sheet = await openPublish(page)
  check(await sheet.getByText('프리미엄 3,900원').count(), '환불 후 다시 결제 안내')
  await sheet.getByRole('button', { name: '닫기' }).click()

  // 5. 발행 후에는 환불 불가
  let btn = await pay(page, ON, id1)
  await page.getByRole('checkbox').check()
  await page.waitForTimeout(300)
  await btn.click()
  await page.waitForURL(/\/pay\/.*\/done/)
  await page.goto(`${ON}/edit/${id1}`)
  await publish(page)
  await page.goto(`${ON}/dashboard`)
  await page.getByRole('region', { name: '결제 내역' }).waitFor()
  check((await page.getByRole('button', { name: '환불 요청' }).count()) === 0, '발행 후에는 환불 요청 버튼 없음')
  const refundAfter = await page.evaluate(async (id) => (await fetch(`/api/invitations/${id}/refund`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, id1)
  check(refundAfter === 409, '발행 후 환불 API는 409')
  check(sql(`select premium_order_id is not null from invitations where id='${id1}'`) === 't', '발행 후 환불 시도해도 프리미엄 유지')

  // 6. 7일 지나면 환불 불가
  const id6 = await create(page, ON, /송년회/, 'E2E 7일')
  btn = await pay(page, ON, id6)
  await page.getByRole('checkbox').check()
  await page.waitForTimeout(300)
  await btn.click()
  await page.waitForURL(/\/pay\/.*\/done/)
  sql(`update orders set approved_at = now() - interval '8 days' where invitation_id='${id6}'`)
  const late = await page.evaluate(async (id) => (await fetch(`/api/invitations/${id}/refund`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, id6)
  check(late === 409, '결제 후 7일이 지나면 환불 API는 409')

  // 7. 실패 · 취소 · 카드 거절 · 금액 조작
  const id7 = await create(page, ON, /송년회/, 'E2E 실패')
  btn = await pay(page, ON, id7, 'cancel')
  await page.getByRole('checkbox').check()
  await page.waitForTimeout(300)
  await btn.click()
  await page.waitForURL(/\/fail/)
  check(await page.getByRole('heading', { name: '결제를 취소했어요' }).count(), '취소: 취소 화면')
  check(sql(`select premium_order_id is null from invitations where id='${id7}'`) === 't', '취소: 프리미엄 아님')
  check(await page.getByRole('link', { name: '다시 결제하기' }).count(), '취소: 다시 결제하기 링크')

  btn = await pay(page, ON, id7, 'reject')
  await page.getByRole('checkbox').check()
  await page.waitForTimeout(300)
  await btn.click()
  await page.waitForURL(/\/fail/)
  check(await page.getByText('카드사에서 결제를 거절했어요.').count(), '카드 거절: 토스 메시지 표시')
  check(sql(`select count(*) from orders where invitation_id='${id7}' and status='failed'`) !== '0', '실패 주문은 failed로 기록')
  check(sql(`select premium_order_id is null from invitations where id='${id7}'`) === 't', '거절: 프리미엄 아님')

  const before = calls.filter((c) => c.path === '/v1/payments/confirm').length
  btn = await pay(page, ON, id7, 'ok', 100)
  await page.getByRole('checkbox').check()
  await page.waitForTimeout(300)
  await btn.click()
  await page.waitForURL(/\/fail/)
  check(await page.getByText('결제 금액이 달라서').count(), '금액 조작(100원): 서버가 거부')
  check(calls.filter((c) => c.path === '/v1/payments/confirm').length === before, '금액 조작: 토스 승인 API를 부르지 않음')
  check(sql(`select premium_order_id is null from invitations where id='${id7}'`) === 't', '금액 조작: 프리미엄 아님')

  // 8. 결혼 14,900원 · 파생(청첩장 모임) 권한 · 복제는 별도
  const id8 = await create(page, ON, /결혼식/, 'E2E 결혼 파생')
  sheet = await openPublish(page)
  check(await sheet.getByText('프리미엄 14,900원').count(), '결혼: 14,900원')
  await sheet.getByRole('button', { name: '닫기' }).click()
  btn = await pay(page, ON, id8)
  check(await page.getByRole('button', { name: /14,900원 결제하기/ }).count(), '결제 화면에도 14,900원')
  await page.getByRole('checkbox').check()
  await page.waitForTimeout(300)
  await btn.click()
  await page.waitForURL(/\/pay\/.*\/done/)
  check(Number(calls.filter((c) => c.path === '/v1/payments/confirm').at(-1)?.body.amount) === 14900, '결혼 승인 금액 14900')

  const dupPre = await page.evaluate(async (id) => (await (await fetch(`/api/invitations/${id}/duplicate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'prewedding' }) })).json()).id, id8)
  const dupCopy = await page.evaluate(async (id) => (await (await fetch(`/api/invitations/${id}/duplicate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'copy' }) })).json()).id, id8)
  check(sql(`select derived_from_id='${id8}' from invitations where id='${dupPre}'`) === 't', 'derived_from_id 기록 (청첩장 모임)')
  await page.goto(`${ON}/edit/${dupPre}`)
  sheet = await openPublish(page)
  check((await sheet.getByRole('link', { name: '프리미엄 결제하기' }).count()) === 0, '파생 청첩장 모임: 추가 결제 없이 프리미엄')
  await sheet.getByRole('button', { name: '닫기' }).click()
  await page.goto(`${ON}/edit/${dupCopy}`)
  sheet = await openPublish(page)
  check(await sheet.getByText('프리미엄 14,900원').count(), '결혼 복제본은 파생 아님(별도 결제)')
  await sheet.getByRole('button', { name: '닫기' }).click()
  const dupThanks = await page.evaluate(async (id) => (await (await fetch(`/api/invitations/${id}/duplicate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'thanks' }) })).json()).id, id8)
  await page.goto(`${ON}/edit/${dupThanks}`)
  sheet = await openPublish(page)
  check((await sheet.getByRole('link', { name: '프리미엄 결제하기' }).count()) === 0, '파생 감사장: 프리미엄')
  await sheet.getByRole('button', { name: '닫기' }).click()

  // 9. 봉투 · 효과: 프리미엄 O / 무료 새 초대장 X / 결제 전에 만든 초대장 유지
  const motion = { reducedMotion: 'no-preference' as const }
  const hasIntro = async (url: string) => {
    const g = await newPage(await browser.newContext({ ...mobile, ...motion }))
    await g.goto(url.replace(/^https?:\/\/[^/]+/, ON))
    await g.waitForTimeout(500)
    const n = await g.getByRole('button', { name: /도장 봉투 열기|리본 카드 열기|책 표지 넘기기/ }).count()
    await g.close()
    return n > 0
  }
  await page.goto(`${ON}/edit/${id8}`)
  const premiumUrl = await publish(page)
  check(await hasIntro(premiumUrl), '프리미엄 결혼 초대장: 봉투가 하객에게 보임')

  await create(page, ON, /결혼식/, 'E2E 무료')
  const freeUrl = await publish(page)
  check(!(await hasIntro(freeUrl)), '결제 시작 뒤 만든 무료 초대장: 봉투 안 보임')

  const idOld = await create(page, ON, /결혼식/, 'E2E 소급없음')
  sql(`update invitations set created_at = '2026-10-01' where id='${idOld}'`)
  const oldUrl = await publish(page)
  check(await hasIntro(oldUrl), '결제 시작 전에 만든 초대장: 봉투 그대로 유지(소급 없음)')
  await page.goto(`${ON}/edit/${idOld}`)
  sheet = await openPublish(page)
  check(await sheet.getByText('프리미엄 14,900원').count(), '결제 전에 만든 초대장도 원하면 프리미엄 구매 가능')
  await sheet.getByRole('button', { name: '닫기' }).click()

  // 10. 하단 문구 숨기기: 프리미엄만
  await page.goto(`${ON}/edit/${id8}`)
  sheet = await openPublish(page)
  await sheet.getByLabel(/문구 숨기기/).check()
  await waitSaved(page)
  const g2 = await newPage(await browser.newContext(mobile))
  await g2.goto(premiumUrl.replace(/^https?:\/\/[^/]+/, ON))
  check((await g2.getByText('dearday로 만들었어요').count()) === 0, '프리미엄: 하단 문구 숨김 적용')
  await g2.goto(freeUrl.replace(/^https?:\/\/[^/]+/, ON))
  check(await g2.getByText('dearday로 만들었어요').count(), '무료: 하단 문구 표시')

  // 11. 가격 페이지
  await g2.goto(`${ON}/pricing`)
  check(await g2.getByRole('cell', { name: '14,900원' }).count(), '/pricing: 14,900원')
  check(await g2.getByRole('cell', { name: '3,900원' }).count(), '/pricing: 3,900원')
  check(await g2.getByText('발행한 뒤에는 환불되지 않아요').count(), '/pricing: 환불 규정')
  check((await g2.getByText('모든 기능을 무료로 열어 두었어요').count()) === 0, '켜짐: /pricing 에 무료 안내 없음')
  await g2.goto(`${ON}/terms/payments`)
  check(await g2.getByRole('heading', { name: /유료 서비스/ }).count(), '/terms/payments 개정안')
  await g2.goto(`${ON}/privacy/payments`)
  check(await g2.getByText('토스페이먼츠 주식회사').count(), '/privacy/payments 개정안')
  await g2.goto(`${ON}/terms`)
  check((await g2.getByText('프리미엄').count()) === 0, '지금 시행 중인 /terms 는 그대로')

  check(errors.length === 0, `페이지 오류 없음 ${errors.join(' | ')}`)
  await ctx.close()
  await browser.close()
  mock.close()
  console.log(failures ? `\n❌ ${failures}개 실패` : '\n✅ 모두 통과')
  process.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
