import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { handle, json, readJson, requireApiSession } from '@/lib/api'
import { duplicateInvitation } from '@/lib/duplicate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 내 초대장 복제 · 결혼 초대장에서 청첩장 모임 만들기 → { id } */
export const POST = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireApiSession(req)
    const { id } = await params
    const { mode } = await readJson(req, z.object({ mode: z.enum(['copy', 'prewedding', 'thanks']) }))
    return json(await duplicateInvitation(id, session.userId, mode), 201)
  },
)
