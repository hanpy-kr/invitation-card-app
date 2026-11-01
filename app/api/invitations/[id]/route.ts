import type { NextRequest } from 'next/server'

import { handle, json, readJson, requireApiSession } from '@/lib/api'
import { deleteInvitation, saveInvitation } from '@/lib/editor'
import { saveInvitationSchema } from '@/shared/invitation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** 자동 저장: 메타 + 블록 전체 */
export const PUT = handle(async (req: NextRequest, { params }: Ctx) => {
  const session = await requireApiSession(req)
  const { id } = await params
  const input = await readJson(req, saveInvitationSchema)
  return json(await saveInvitation(id, session.userId, input))
})

export const DELETE = handle(async (req: NextRequest, { params }: Ctx) => {
  const session = await requireApiSession(req)
  const { id } = await params
  await deleteInvitation(id, session.userId)
  return json({ ok: true })
})
