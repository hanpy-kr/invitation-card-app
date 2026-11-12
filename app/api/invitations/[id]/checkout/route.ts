import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { handle, json, readJson, requireApiSession } from '@/lib/api'
import { startCheckout } from '@/lib/payments'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const schema = z.object({ agreedRefund: z.literal(true) })

/** 결제 시작: 서버가 금액을 계산해 주문을 만들고 결제창에 넘길 값을 돌려준다 (클라이언트 금액은 받지 않음) */
export const POST = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireApiSession(req)
    const { id } = await params
    await readJson(req, schema)
    return json(await startCheckout(id, session.userId, true))
  },
)
