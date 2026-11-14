import type { NextRequest } from 'next/server'
import { desc, and, eq } from 'drizzle-orm'

import { handle, json, requireApiSession } from '@/lib/api'
import { getDb, schema } from '@/lib/db/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 그로블 결제 뒤 돌아온 화면이 확인하는 값: 내 가장 최근 그로블 주문의 상태 (본인 것만) */
export const GET = handle(async (req: NextRequest) => {
  const session = await requireApiSession(req)
  const [o] = await getDb()
    .select({ status: schema.orders.status, invitationId: schema.orders.invitationId })
    .from(schema.orders)
    .where(and(eq(schema.orders.userId, session.userId), eq(schema.orders.provider, 'groble')))
    .orderBy(desc(schema.orders.createdAt))
    .limit(1)
  return json(
    { status: o?.status ?? 'none', invitationId: o?.invitationId ?? null },
    { headers: { 'Cache-Control': 'no-store' } },
  )
})
