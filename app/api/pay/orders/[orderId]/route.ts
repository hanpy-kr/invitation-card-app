import type { NextRequest } from 'next/server'

import { ApiError, handle, json, requireApiSession } from '@/lib/api'
import { hanpy } from '@/lib/hanpy'
import { refreshPremium } from '@/lib/premium'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 돌아오기 화면이 주문 상태를 묻는 곳. 내 주문만(남의 주문은 404). paid면 허브에 다시 물어 캐시를 갱신 */
export const GET = handle(
  async (req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) => {
    const session = await requireApiSession(req)
    const { orderId } = await params
    const order = await hanpy.getOrder(orderId).catch(() => null)
    if (!order || order.customerRef !== session.userId)
      throw new ApiError(404, '없는 주문이에요.')
    if (order.status === 'paid' && order.subject) await refreshPremium([order.subject.id])
    return json(
      {
        status: order.status,
        invitationId: order.subject?.id ?? null,
        refundedAmount: order.refundedAmount ?? 0,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  },
)
