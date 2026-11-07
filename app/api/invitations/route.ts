import type { NextRequest } from 'next/server'

import { handle, json, readJson, requireApiSession } from '@/lib/api'
import { createInvitation } from '@/lib/editor'
import { createInvitationSchema } from '@/shared/invitation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 새 초대장 만들기 → { id } */
export const POST = handle(async (req: NextRequest) => {
  const session = await requireApiSession(req)
  const { eventType, from } = await readJson(req, createInvitationSchema)
  const { id } = await createInvitation(session.userId, eventType, from)
  return json({ id }, 201)
})
