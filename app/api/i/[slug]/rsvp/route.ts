import type { NextRequest } from 'next/server'

import { handle, json, readJson } from '@/lib/api'
import { cancelRsvp, submitRsvp } from '@/lib/guest'
import { rateLimit } from '@/lib/rate-limit'
import { rsvpCancelSchema, rsvpInputSchema } from '@/shared/guest'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string }> }

/** 하객 참석 응답 (로그인 없음) */
export const POST = handle(async (req: NextRequest, { params }: Ctx) => {
  const { slug } = await params
  const input = await readJson(req, rsvpInputSchema)
  await rateLimit(req, `rsvp:${slug}`, { limit: 10, windowSec: 600 })
  return json(await submitRsvp(slug, input), 201)
})

/** 하객: 내 응답 취소 (브라우저에 있는 수정 토큰으로만) */
export const DELETE = handle(async (req: NextRequest, { params }: Ctx) => {
  const { slug } = await params
  const { editToken } = await readJson(req, rsvpCancelSchema)
  await rateLimit(req, `rsvp:${slug}`, { limit: 10, windowSec: 600 })
  await cancelRsvp(slug, editToken)
  return json({ ok: true })
})
