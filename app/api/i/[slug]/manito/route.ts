import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { handle, json, readJson } from '@/lib/api'
import { manitoForGuest } from '@/lib/guest'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 내 마니또: POST 본문의 응답 토큰으로 본인 확인 (member-notice와 같은 방식). 짝 정보는 이 응답 말고 어디에도 없음 */
export const POST = handle(
  async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params
    const { editToken } = await readJson(req, z.object({ editToken: z.string().min(10).max(300) }))
    await rateLimit(req, `manito:${slug}`, { limit: 60, windowSec: 600 })
    return json(await manitoForGuest(slug, editToken), {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  },
)
