import type { NextRequest } from 'next/server'

import { albumDeleteSchema, deleteOwnAlbumPhoto } from '@/lib/album'
import { handle, json, readJson } from '@/lib/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 하객: 내가 올린 사진 지우기 (올릴 때 받은 삭제 토큰으로만) */
export const DELETE = handle(
  async (req: NextRequest, { params }: { params: Promise<{ slug: string; photoId: string }> }) => {
    const { slug, photoId } = await params
    const { deleteToken } = await readJson(req, albumDeleteSchema)
    await deleteOwnAlbumPhoto(req, slug, photoId, deleteToken)
    return json({ ok: true })
  },
)
