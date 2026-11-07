import type { NextRequest } from 'next/server'

import { handle, json, readJson } from '@/lib/api'
import { rateLimit } from '@/lib/rate-limit'
import { cancelVote, submitVote, voteResults } from '@/lib/vote'
import { voteCancelSchema, voteInputSchema } from '@/shared/guest'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string }> }

/** 투표 결과 (후보별 표 수 · 이름) */
export const GET = handle(async (_req: NextRequest, { params }: Ctx) => {
  const { slug } = await params
  return json(await voteResults(slug), { headers: { 'Cache-Control': 'no-store' } })
})

/** 하객 투표 (로그인 없음, 같은 브라우저 토큰이면 고치기) */
export const POST = handle(async (req: NextRequest, { params }: Ctx) => {
  const { slug } = await params
  const input = await readJson(req, voteInputSchema)
  await rateLimit(req, `vote:${slug}`, { limit: 10, windowSec: 600 })
  return json(await submitVote(slug, input), 201)
})

/** 하객: 내 투표 취소 */
export const DELETE = handle(async (req: NextRequest, { params }: Ctx) => {
  const { slug } = await params
  const input = await readJson(req, voteCancelSchema)
  await rateLimit(req, `vote:${slug}`, { limit: 10, windowSec: 600 })
  await cancelVote(slug, input)
  return json({ ok: true })
})
