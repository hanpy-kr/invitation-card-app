/**
 * 그로블 결제 연결 확인(로컬). 실행: pnpm e2e:p7
 * 서버: PAYMENT_PROVIDER=groble GROBLE_LINK_14900=https://groble.test/p/14900 GROBLE_LINK_3900=https://groble.test/p/3900
 *       GROBLE_WEBHOOK_SECRET=whsec_e2e ADMIN_KAKAO_IDS=dev-1 KAKAO_REST_API_KEY=e2e DEV_LOGIN=1 (PAYMENTS_LIVE 비움)
 * 그로블 결제창은 브라우저에서 가로채고, 웹훅은 이 스크립트가 서명해서 직접 보낸다.
 */
import { createHmac } from 'node:crypto'
import { execFileSync } from 'node:child_process'

import { chromium, type BrowserContext, type Page } from 'playwright'

const BASE = process.env.E2E_BASE ?? 'http://localhost:3001'
const DB = 'postgres://dearday:dearday@localhost:5432/dearday'
const SECRET = 'whsec_e2e'
const sql = (q: string) => execFileSync('psql', [DB, '-tAc', q]).toString().trim()

let failures = 0
function check(ok: unknown, label: string) {
  console.log(`${ok ? '✅' : '❌'} ${label}`)
  if (!ok) failures++
}

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
  await page.route('https://groble.test/**', (r) =>
    r.fulfill({ contentType: 'text/html', body: '<h1>그로블 결제창(가짜)</h1>' }),
  )
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

let seq = 0
type Hook = { type: string; ref?: string | null; amount?: number; key?: string; legacyRef?: boolean }
async function hook(
  h: Hook,
  opts: { secret?: string; ts?: string | null; sig?: string | null; noKey?: boolean; rawOverride?: string } = {},
) {
  const body =
    opts.rawOverride ??
    JSON.stringify({
      type: h.type,
      data: h.legacyRef
        ? { sellerReference: h.ref, object: { merchantUid: `GR-${h.ref?.slice(-6)}`, amount: h.amount } }
        : {
            object: {
              sellerReference: h.ref,
              merchantUid: `GR-${h.ref?.slice(-6)}`,
              amount: h.amount,
              // 구매자 정보 (저장 · 로그 금지 확인용)
              buyerName: '홍길동구매자',
              buyerEmail: 'buyer-secret@example.com',
              buyerPhone: '010-7777-8888',
            },
          },
    })
  const ts = opts.ts === undefined ? String(Math.floor(Date.now() / 1000)) : opts.ts
  const sig =
    opts.sig === undefined
      ? createHmac('sha256', opts.secret ?? SECRET).update(`${ts}.${body}`).digest('hex')
      : opts.sig
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (ts !== null) headers['X-Groble-Timestamp'] = ts
  if (sig !== null) headers['X-Groble-Signature'] = sig
  if (!opts.noKey) headers['X-Groble-Idempotency-Key'] = h.key ?? `k-${Date.now()}-${seq++}`
  const res = await fetch(`${BASE}/api/webhooks/groble`, { method: 'POST', headers, body })
  return { status: res.status, json: (await res.json().catch(() => ({}))) as Record<string, unknown> }
}

const orderOf = (inv: string) =>
  sql(`select order_id from orders where invitation_id='${inv}' order by created_at desc limit 1`)
const field = (inv: string, f: string) =>
  sql(`select ${f} from orders where invitation_id='${inv}' order by created_at desc limit 1`)

async function checkout(page: Page, id: string) {
  return page.evaluate(async (i) => {
    const r = await fetch(`/api/invitations/${i}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agreedRefund: true }),
    })
    return { status: r.status, body: await r.json() }
  }, id)
}

async function main() {
  const browser = await chromium.launch()

  // ───────── 일반 회원: 결제 꺼짐(PAYMENTS_LIVE 비어 있음)이라 아무것도 안 보임 ─────────
  {
    const ctx = await browser.newContext(mobile)
    const p = await newPage(ctx)
    await p.goto(`${BASE}/api/auth/kakao/login?dev=1&as=2&next=/new`)
    const id = await create(p, /송년회/, 'E2E 그로블 일반')
    await p.getByRole('button', { name: /^(발행하기|공유하기)$/ }).click()
    check((await p.getByRole('dialog').getByRole('link', { name: '프리미엄 결제하기' }).count()) === 0, '일반 회원: 결제 버튼 없음')
    check((await checkout(p, id)).status === 403, '일반 회원: 결제 시작 API 403')
    await ctx.close()
  }

  // ───────── 관리자 미리 보기: 그로블 결제 링크로 이동 ─────────
  const ctx = await browser.newContext(mobile)
  const page = await newPage(ctx)
  await page.goto(`${BASE}/api/auth/kakao/login?dev=1&next=/new`)
  const id = await create(page, /송년회/, 'E2E 그로블 결제')
  await page.goto(`${BASE}/pay/${id}`)
  check(await page.getByText('그로블 표준 환불 규정이 함께 적용돼요').count(), '결제 화면: 그로블 표준 환불 규정 한 줄')
  check((await page.locator('#payment-method').count()) === 0, '그로블이면 토스 결제위젯을 부르지 않음')
  const btn = page.getByRole('button', { name: /3,900원 결제하기/ })
  check(await btn.isDisabled(), '동의 전에는 결제 버튼 비활성')
  await page.getByRole('checkbox').check()
  await btn.click()
  await page.waitForURL(/groble\.test/)
  const ref = orderOf(id)
  check(page.url() === `https://groble.test/p/3900?ref=${ref}`, `3,900원 링크 + ?ref=주문번호 (${page.url()})`)
  check(field(id, 'provider') === 'groble' && field(id, 'status') === 'pending' && field(id, 'amount') === '3900', 'orders: provider groble · pending · 3900')
  const wedding = await create(page, /결혼식/, 'E2E 그로블 결혼')
  const wc = await checkout(page, wedding)
  check(wc.status === 200 && wc.body.redirectUrl.startsWith('https://groble.test/p/14900?ref='), '14,900원은 14900 링크로')

  // ───────── 웹훅 ─────────
  const bad = await hook({ type: 'payment.completed', ref, amount: 3900 }, { sig: 'deadbeef' })
  check(bad.status === 401, '서명 틀림 → 401')
  check((await hook({ type: 'payment.completed', ref, amount: 3900 }, { secret: 'other' })).status === 401, '다른 시크릿으로 서명 → 401')
  check((await hook({ type: 'payment.completed', ref, amount: 3900 }, { ts: null })).status === 401, '타임스탬프 없음 → 401')
  const old = String(Math.floor(Date.now() / 1000) - 600)
  check((await hook({ type: 'payment.completed', ref, amount: 3900 }, { ts: old })).status === 401, '시각 10분 지남(서명은 맞음) → 401')
  const future = String(Math.floor(Date.now() / 1000) + 600)
  check((await hook({ type: 'payment.completed', ref, amount: 3900 }, { ts: future })).status === 401, '시각 10분 앞 → 401')
  check((await hook({ type: 'payment.completed', ref, amount: 3900 }, { noKey: true })).status === 400, '멱등 키 없음 → 400')
  check(field(id, 'status') === 'pending', '위 요청들로는 상태가 안 바뀜')

  const mism = await hook({ type: 'payment.completed', ref, amount: 100 })
  check(mism.status === 200 && mism.json.result === 'amount_mismatch', '금액 불일치 → 처리 결과 amount_mismatch')
  check(field(id, 'status') === 'pending' && field(id, 'fail_reason').includes('불일치'), '금액 불일치: paid로 안 바꾸고 fail_reason 기록')
  check(sql(`select premium_order_id is null from invitations where id='${id}'`) === 't', '금액 불일치: 프리미엄 안 켜짐')
  check((await hook({ type: 'payment.completed', ref, amount: undefined })).json.result === 'amount_mismatch', '금액이 없는 완료 알림도 paid로 안 바꿈')

  const okKey = `idem-completed-${Date.now()}`
  const done = await hook({ type: 'payment.completed', ref, amount: 3900, key: okKey })
  check(done.status === 200 && done.json.result === 'paid', '완료 → paid')
  check(field(id, 'status') === 'paid' && field(id, 'payment_key') === `GR-${ref.slice(-6)}` && field(id, 'approved_at') !== '', '주문번호(merchantUid)가 payment_key, 승인 시각 기록')
  check(sql(`select premium_order_id is not null from invitations where id='${id}'`) === 't', '완료 → 프리미엄 적용')
  const dup = await hook({ type: 'payment.completed', ref, amount: 3900, key: okKey })
  check(dup.json.duplicate === true, '같은 멱등 키 재전송 → 중복으로 차단')
  const again = await hook({ type: 'payment.completed', ref, amount: 3900 })
  check(again.json.result === 'ignored', '이미 paid인 주문의 새 완료 알림은 무시')
  check(sql(`select count(*) from webhook_events where key='${okKey}'`) === '1', '멱등 키는 한 번만 기록')
  const dump = sql(`select row_to_json(o)::text from orders o where invitation_id='${id}'`) + sql('select string_agg(key, \',\') from webhook_events')
  check(!/홍길동|buyer-secret|7777/.test(dump), '구매자 이름 · 이메일 · 전화는 저장되지 않음')
  check((await hook({ type: 'payment.completed', ref: 'dd-unknown', amount: 3900 })).json.result === 'ignored', '모르는 주문번호는 무시(200)')
  check((await hook({ type: 'something.else', ref, amount: 3900 })).json.result === 'ignored', '다른 이벤트는 무시')
  check((await hook({ type: 'x' }, { rawOverride: 'not json' })).status === 400, '서명은 맞지만 JSON이 아니면 400')

  // 대시보드 + 환불 안내
  await page.goto(`${BASE}/dashboard`)
  const orders = page.getByRole('region', { name: '결제 내역' })
  await orders.waitFor()
  check(await orders.getByText('결제 완료').count(), '대시보드: 결제 완료')
  check(await orders.getByRole('link', { name: '그로블에서 환불 신청' }).count(), '대시보드: 그로블에서 환불 신청 링크')
  check((await orders.getByRole('button', { name: '환불 요청' }).count()) === 0, '그로블 주문은 [환불 요청] 버튼 없음')
  check(await orders.getByText('그로블 주문조회에서 환불을 신청해 주세요').count(), '대시보드: 환불 가능 안내')
  const rf = await page.evaluate(async (i) => (await fetch(`/api/invitations/${i}/refund`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, id)
  check(rf === 409, '그로블 주문은 dearday 환불 API로 취소 불가(409)')

  // 이동 페이지: 결제 완료 주문이 최신이면 편집기로
  const wref = new URL(wc.body.redirectUrl).searchParams.get('ref')!
  await hook({ type: 'payment.completed', ref: wref, amount: 14900 })
  await page.goto(`${BASE}/pay/return`)
  await page.waitForURL(new RegExp(`/edit/${wedding}`), { timeout: 15000 })
  check(true, '/pay/return: 최신 그로블 주문이 paid → 편집기로 이동')

  // 환불 요청됨 → 환불됨
  const cr = await hook({ type: 'payment.cancel_requested', ref })
  check(cr.json.result === 'cancel_requested' && field(id, 'status') === 'cancel_requested', 'cancel_requested → 상태 cancel_requested')
  check(sql(`select premium_order_id is not null from invitations where id='${id}'`) === 't', '환불 요청 중에는 프리미엄 유지')
  await page.goto(`${BASE}/dashboard`)
  await page.getByRole('region', { name: '결제 내역' }).waitFor()
  check(await page.getByRole('region', { name: '결제 내역' }).getByText('환불 요청됨').first().count(), '대시보드: 환불 요청됨')
  const rfd = await hook({ type: 'payment.refunded', ref })
  check(rfd.json.result === 'canceled' && field(id, 'status') === 'canceled', 'refunded → canceled')
  check(sql(`select premium_order_id is null from invitations where id='${id}'`) === 't', 'refunded → 프리미엄 해제')
  check((await hook({ type: 'payment.refunded', ref })).json.result === 'ignored', '이미 환불된 주문의 refunded는 무시')
  await page.goto(`${BASE}/dashboard`)
  await page.getByRole('region', { name: '결제 내역' }).waitFor()
  check(await page.getByRole('region', { name: '결제 내역' }).getByText('환불됨').first().count(), '대시보드: 환불됨')

  // sellerReference가 data 바로 아래에 오는 형태도 읽음
  const lg = await create(page, /결혼식/, 'E2E 그로블 상위위치')
  const ref2 = new URL((await checkout(page, lg)).body.redirectUrl).searchParams.get('ref')!
  const legacy = await hook({ type: 'payment.completed', ref: ref2, amount: 14900, legacyRef: true })
  check(legacy.json.result === 'paid', 'data.sellerReference(상위 위치)도 읽음')
  check(sql(`select count(*) from orders where order_id='${ref2}' and status='paid' and amount=14900`) === '1', '결혼 14,900원 paid')

  // /pay/return: 최근 그로블 주문이 paid가 아니면 안내 문구 (최신 주문을 pending으로 만든 뒤)
  const w2 = await create(page, /송년회/, 'E2E 그로블 대기')
  await checkout(page, w2)
  await page.goto(`${BASE}/pay/return`)
  check(await page.getByText('결제를 확인하고 있어요').count(), '/pay/return: 확인 중 문구')
  await page.getByText('결제 확인 중이에요. 잠시 뒤 대시보드에서 확인해 주세요.').waitFor({ timeout: 45000 })
  check(true, '/pay/return: 30초 확인 후 대시보드 안내')

  // ───────── ⑨ 편집기 저장이 정산 안내 블록을 지우지 않음 ─────────
  const ed = await create(page, /송년회/, 'E2E 보존')
  const cfg = JSON.stringify({ title: '정산 내역', items: [{ title: '정산', body: '걷은 회비 1원', attendeesOnly: false }], buttonLabel: '', buttonUrl: '', source: 'settlement' })
  sql(`insert into blocks (invitation_id, type, position, config) values ('${ed}', 'notice', 900, '${cfg}'::jsonb)`)
  await page.goto(`${BASE}/edit/${ed}`)
  await page.getByLabel('초대장 제목').fill('E2E 보존 수정')
  const saved = page.waitForResponse((r) => r.request().method() !== 'GET' && /\/api\/invitations\//.test(r.url()))
  await saved
  await waitSaved(page)
  check(sql(`select count(*) from blocks where invitation_id='${ed}' and config->>'source'='settlement'`) === '1', '⑨ 편집기 저장 뒤에도 정산 안내 블록이 남음')
  check(sql(`select config->'items'->0->>'body' from blocks where invitation_id='${ed}' and config->>'source'='settlement'`) === '걷은 회비 1원', '⑨ 내용도 그대로')
  check(sql(`select title from invitations where id='${ed}'`) === 'E2E 보존 수정', '⑨ 다른 수정은 저장됨')

  check(errors.length === 0, `페이지 오류 없음 ${errors.join(' | ')}`)
  await browser.close()
  console.log(failures ? `\n❌ ${failures}개 실패` : '\n✅ 모두 통과')
  process.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
