import type { NextRequest } from 'next/server'

import { handle, json, requireApiSession } from '@/lib/api'
import { requestRefund } from '@/lib/payments'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 환불 요청: 결제 후 7일 이내 · 발행 전이면 전액 취소하고 프리미엄을 해제 */
export const POST = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireApiSession(req)
    const { id } = await params
    return json(await requestRefund(id, session.userId))
  },
)
