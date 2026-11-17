import type { NextRequest } from 'next/server'

import { handle, json, requireApiSession } from '@/lib/api'
import { hanpy } from '@/lib/hanpy'
import { refreshPremium } from '@/lib/premium'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 돌아오기 화면의 대체 확인(주문번호를 잃었을 때): 이 사용자의 가장 최근 허브 주문.
 * 카톡 → 카카오페이 · 네이버페이 앱을 다녀오면 새 창으로 돌아와 초대장 ID도 잃으므로 사용자 기준으로 찾는다.
 */
export const GET = handle(async (req: NextRequest) => {
  const session = await requireApiSession(req)
  const [o] = await hanpy.listOrders({ customerRef: session.userId, limit: 1 }).catch(() => [])
  if (o?.status === 'paid' && o.subject) await refreshPremium([o.subject.id])
  return json(
    { status: o?.status ?? 'none', invitationId: o?.subject?.id ?? null, orderId: o?.orderId ?? null },
    { headers: { 'Cache-Control': 'no-store' } },
  )
})
