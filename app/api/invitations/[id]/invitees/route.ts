import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { handle, json, readJson, requireApiSession } from '@/lib/api'
import { saveInvitees } from '@/lib/host-tools'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const body = z.object({ text: z.string().max(10_000) })

/** 주최자 전용: 초대 명단(이름만) 저장 */
export const PUT = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireApiSession(req)
    const { id } = await params
    const { text } = await readJson(req, body)
    return json(await saveInvitees(id, session.userId, text))
  },
)
