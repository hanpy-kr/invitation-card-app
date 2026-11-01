import type { NextRequest } from 'next/server'

import { ApiError, handle, json, readJson } from '@/lib/api'
import { isUuid } from '@/lib/editor'
import { deleteGuestbookEntry } from '@/lib/guest'
import { rateLimit } from '@/lib/rate-limit'
import { guestbookDeleteSchema } from '@/shared/guest'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string; entryId: string }> }

/** 작성자 본인 삭제 — 비밀번호 확인 (DELETE 본문 대신 POST 사용: 일부 인앱 브라우저 호환) */
export const POST = handle(async (req: NextRequest, { params }: Ctx) => {
  const { slug, entryId } = await params
  if (!isUuid(entryId)) throw new ApiError(404, '이미 지워진 글이에요.')
  const { password } = await readJson(req, guestbookDeleteSchema)
  await rateLimit(req, `guestbook-del:${slug}`, { limit: 10, windowSec: 600 })
  await deleteGuestbookEntry(slug, entryId, password)
  return json({ ok: true })
})
