import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { ApiError, handle, json, readJson, requireApiSession } from '@/lib/api'
import { isUuid } from '@/lib/editor'
import { confirmVote, ownedFilter, reopenVote } from '@/lib/vote'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('confirm'),
    optionId: z.string().regex(/^[a-z0-9]{4,12}$/),
    after: z.enum(['result', 'hide']),
  }),
  z.object({ action: z.literal('reopen') }),
])

/** 주최자: 투표 확정 · 다시 열기 */
export const POST = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireApiSession(req)
    const { id } = await params
    if (!isUuid(id)) throw new ApiError(404, '초대장을 찾을 수 없어요.')
    const body = await readJson(req, bodySchema)
    const owned = ownedFilter(session.userId)
    if (body.action === 'confirm') await confirmVote(id, owned, body.optionId, body.after)
    else await reopenVote(id, owned)
    return json({ ok: true })
  },
)
