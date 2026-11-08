import type { NextRequest } from 'next/server'

import { albumCompleteSchema, completeAlbumUpload } from '@/lib/album'
import { handle, json, readJson } from '@/lib/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 업로드 끝 → 앨범에 등록 → { photo, deleteToken } (삭제 토큰은 하객 브라우저에만 보관) */
export const POST = handle(
  async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params
    const input = await readJson(req, albumCompleteSchema)
    return json(await completeAlbumUpload(slug, input), 201)
  },
)
