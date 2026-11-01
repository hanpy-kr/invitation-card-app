import type { NextRequest } from 'next/server'

import { ApiError, handle, json, requireApiSession } from '@/lib/api'
import { deleteRsvp } from '@/lib/dashboard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 주최자: 참석 응답 지우기 */
export const DELETE = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string; rsvpId: string }> }) => {
    const session = await requireApiSession(req)
    const { id, rsvpId } = await params
    if (!(await deleteRsvp(id, rsvpId, session.userId)))
      throw new ApiError(404, '응답을 찾을 수 없어요.')
    return json({ ok: true })
  },
)
