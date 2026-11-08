import type { NextRequest } from 'next/server'

import { listAlbumForHost } from '@/lib/album'
import { handle, json, requireApiSession } from '@/lib/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 주최자: 숨긴 사진까지 모든 앨범 사진 */
export const GET = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireApiSession(req)
    const { id } = await params
    return json({ photos: await listAlbumForHost(id, session.userId) })
  },
)
