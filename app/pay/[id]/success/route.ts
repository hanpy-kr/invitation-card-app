import { NextResponse, type NextRequest } from 'next/server'

import { ApiError } from '@/lib/api'
import { getSession } from '@/lib/auth/session'
import { confirmPayment } from '@/lib/payments'
import { siteUrl } from '@/lib/site'
import { ORDER_ID_RE } from '@/shared/pricing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const to = (path: string) => NextResponse.redirect(new URL(path, siteUrl()), 303)

/** 토스 결제창이 결제 후 돌아오는 주소 (paymentKey · orderId · amount가 쿼리로 옴). 서버가 승인한다 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const q = req.nextUrl.searchParams
  const paymentKey = q.get('paymentKey') ?? ''
  const orderId = q.get('orderId') ?? ''
  const amount = Number(q.get('amount'))
  const session = await getSession()
  if (!session) return to(`/api/auth/kakao/login?next=${encodeURIComponent(`/pay/${id}`)}`)
  if (!paymentKey || paymentKey.length > 200 || !ORDER_ID_RE.test(orderId) || !Number.isInteger(amount))
    return to(`/pay/${id}/fail?message=${encodeURIComponent('결제 정보가 올바르지 않아요.')}`)
  try {
    await confirmPayment({ invitationId: id, userId: session.userId, paymentKey, orderId, amount })
  } catch (err) {
    const message = err instanceof ApiError ? err.message : '결제를 처리하지 못했어요.'
    return to(`/pay/${id}/fail?message=${encodeURIComponent(message)}`)
  }
  return to(`/pay/${id}/done`)
}
