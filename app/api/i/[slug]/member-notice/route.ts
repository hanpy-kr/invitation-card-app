import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { handle, json, readJson } from '@/lib/api'
import { memberNotices } from '@/lib/guest'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 참석자 전용 안내 (POST 본문의 참석 응답 토큰으로 확인, 주소 · 로그에 토큰이 남지 않게 GET을 쓰지 않음) */
export const POST = handle(
  async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params
    const { editToken } = await readJson(req, z.object({ editToken: z.string().min(10).max(300) }))
    await rateLimit(req, `member-notice:${slug}`, { limit: 60, windowSec: 600 })
    return json(await memberNotices(slug, editToken), {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  },
)
