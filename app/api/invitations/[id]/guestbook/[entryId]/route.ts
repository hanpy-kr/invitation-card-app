import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { ApiError, handle, json, readJson, requireApiSession } from '@/lib/api'
import { setGuestbookHidden } from '@/lib/dashboard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; entryId: string }> }

/** 주최자: 방명록 글 숨김 / 보이기 */
export const PATCH = handle(async (req: NextRequest, { params }: Ctx) => {
  const session = await requireApiSession(req)
  const { id, entryId } = await params
  const { hidden } = await readJson(req, z.object({ hidden: z.boolean() }))
  if (!(await setGuestbookHidden(id, entryId, session.userId, hidden)))
    throw new ApiError(404, '글을 찾을 수 없어요.')
  return json({ hidden })
})
