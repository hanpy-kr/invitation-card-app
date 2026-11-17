import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { handle, json, readJson, requireApiSession } from '@/lib/api'
import { startHubCheckout } from '@/lib/hub-checkout'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const schema = z.object({ attemptId: z.string().uuid(), agreedRefund: z.literal(true) })

/** 결제 시작(한피 결제 허브): SKU · 금액은 서버(허브)가 정하고, 브라우저는 돌려준 url로만 이동한다 */
export const POST = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireApiSession(req)
    const { id } = await params
    const body = await readJson(req, schema)
    return json(await startHubCheckout(id, session.userId, body.attemptId))
  },
)
