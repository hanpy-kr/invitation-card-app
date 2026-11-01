import type { NextRequest } from 'next/server'

import { handle, json, readJson } from '@/lib/api'
import { submitRsvp } from '@/lib/guest'
import { rateLimit } from '@/lib/rate-limit'
import { rsvpInputSchema } from '@/shared/guest'

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
