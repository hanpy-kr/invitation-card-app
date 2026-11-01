import type { NextRequest } from 'next/server'

import { handle, json, readJson, requireApiSession } from '@/lib/api'
import { setPublished } from '@/lib/editor'
import { publishSchema } from '@/shared/invitation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 발행 / 발행 취소 → { slug, status } */
export const POST = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireApiSession(req)
    const { id } = await params
    const { published } = await readJson(req, publishSchema)
    return json(await setPublished(id, session.userId, published))
  },
)
