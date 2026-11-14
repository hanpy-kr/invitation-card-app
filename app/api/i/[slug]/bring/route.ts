import type { NextRequest } from 'next/server'

import { handle, json, readJson } from '@/lib/api'
import { bringResults, cancelBring, claimBring } from '@/lib/bring'
import { rateLimit } from '@/lib/rate-limit'
import { bringCancelSchema, bringInputSchema } from '@/shared/guest'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string }> }

/** 항목별 맡은 수 · 이름 */
export const GET = handle(async (_req: NextRequest, { params }: Ctx) => {
  const { slug } = await params
  return json(await bringResults(slug), { headers: { 'Cache-Control': 'no-store' } })
})

/** 하객: 항목 하나 맡기 (로그인 없음) */
export const POST = handle(async (req: NextRequest, { params }: Ctx) => {
  const { slug } = await params
  const input = await readJson(req, bringInputSchema)
  await rateLimit(req, `bring:${slug}`, { limit: 10, windowSec: 600 })
  return json(await claimBring(slug, input), 201)
})

/** 하객: 내가 맡은 것 취소 */
export const DELETE = handle(async (req: NextRequest, { params }: Ctx) => {
  const { slug } = await params
  const input = await readJson(req, bringCancelSchema)
  await rateLimit(req, `bring:${slug}`, { limit: 10, windowSec: 600 })
  await cancelBring(slug, input)
  return json({ ok: true })
})
