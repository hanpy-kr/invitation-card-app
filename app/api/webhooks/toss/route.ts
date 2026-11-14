import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { json } from '@/lib/api'
import { applyPaymentWebhook } from '@/lib/payments'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const body = z.object({
  eventType: z.string(),
  data: z.object({ paymentKey: z.string().min(1).max(200) }).passthrough(),
})

/**
 * 토스페이먼츠 웹훅 (토스 개발자센터 → 웹훅에 `https://thedearday.com/api/webhooks/toss`, 이벤트 PAYMENT_STATUS_CHANGED).
 * 본문은 신뢰하지 않고 payments.ts가 토스 조회 API로 다시 확인한다. 우리와 상관없는 이벤트는 200으로 끝낸다.
 * 토스 서버가 부르므로 로그인 · Origin 검사 없음. 일시 오류만 500(토스가 다시 보냄).
 */
export async function POST(req: NextRequest) {
  const parsed = body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return json({ ok: true, ignored: true })
  if (parsed.data.eventType !== 'PAYMENT_STATUS_CHANGED') return json({ ok: true, ignored: true })
  try {
    const result = await applyPaymentWebhook(parsed.data.data.paymentKey)
    return json({ ok: true, result })
  } catch (err) {
    console.error('[webhook/toss]', err)
    return json({ ok: false }, 500)
  }
}
