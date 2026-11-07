import type { NextRequest } from 'next/server'

import { handle } from '@/lib/api'
import { rateLimit } from '@/lib/rate-limit'
import { recordView } from '@/lib/stats'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 하객 화면 열람 (sendBeacon). 실패해도 하객에게는 아무 영향 없음 */
export const POST = handle(
  async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params
    await rateLimit(req, `view:${slug}`, { limit: 20, windowSec: 3600 })
    await recordView(slug)
    return new Response(null, { status: 204 })
  },
)
