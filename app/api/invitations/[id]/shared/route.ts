import type { NextRequest } from 'next/server'

import { getAccess } from '@/lib/access'
import { handle, json, requireApiSession } from '@/lib/api'
import { getDb, schema } from '@/lib/db/client'
import { and, eq, isNull } from 'drizzle-orm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 공유 기록: 주인 · 공동 편집자가 링크 복사 · 카톡 공유 · QR 저장을 처음 한 시각(first_shared_at).
 * 이미 있으면 그대로 둔다(한 번만 기록). 환불 판단(표시용)에만 쓰인다.
 */
export const POST = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireApiSession(req)
    const { id } = await params
    const access = await getAccess(id, session.userId)
    if (!access) return json({ error: '찾을 수 없어요.' }, 404)
    const inv = schema.invitations
    await getDb()
      .update(inv)
      .set({ firstSharedAt: new Date() })
      .where(and(eq(inv.id, id), isNull(inv.firstSharedAt)))
    return json({ ok: true })
  },
)
