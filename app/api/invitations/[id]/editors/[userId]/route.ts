import type { NextRequest } from 'next/server'

import { handle, json, requireApiSession } from '@/lib/api'
import { removeEditor } from '@/lib/editors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 소유자: 편집자 빼기 */
export const DELETE = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) => {
    const session = await requireApiSession(req)
    const { id, userId } = await params
    await removeEditor(id, session.userId, userId)
    return json({ ok: true })
  },
)
