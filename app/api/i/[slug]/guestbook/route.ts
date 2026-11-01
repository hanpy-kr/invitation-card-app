import type { NextRequest } from 'next/server'

import { handle, json, readJson } from '@/lib/api'
import { createGuestbookEntry, listGuestbook } from '@/lib/guest'
import { rateLimit } from '@/lib/rate-limit'
import { guestbookInputSchema } from '@/shared/guest'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string }> }

/** 방명록 목록 (?before=ISO 로 다음 페이지) */
export const GET = handle(async (req: NextRequest, { params }: Ctx) => {
  const { slug } = await params
  const before = req.nextUrl.searchParams.get('before') ?? undefined
  return json(await listGuestbook(slug, before), { headers: { 'Cache-Control': 'no-store' } })
})

export const POST = handle(async (req: NextRequest, { params }: Ctx) => {
  const { slug } = await params
  const input = await readJson(req, guestbookInputSchema)
  await rateLimit(req, `guestbook:${slug}`, { limit: 5, windowSec: 600 })
  return json(await createGuestbookEntry(slug, input), 201)
})
