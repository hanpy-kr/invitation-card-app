import type { NextRequest } from 'next/server'

import { handle, json, requireApiSession } from '@/lib/api'
import { createEditorInvite } from '@/lib/editors'
import { siteUrl } from '@/lib/site'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 소유자: 공동 편집 초대 링크 만들기 */
export const POST = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireApiSession(req)
    const { id } = await params
    const { token, expiresAt } = await createEditorInvite(id, session.userId)
    return json({ url: `${siteUrl()}/join/${token}`, expiresAt }, 201)
  },
)
