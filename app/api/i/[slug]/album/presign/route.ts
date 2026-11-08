import type { NextRequest } from 'next/server'

import { albumPresignSchema, createAlbumUpload } from '@/lib/album'
import { handle, json, readJson } from '@/lib/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 하객 앨범 업로드 주소 발급 (로그인 없음). 초대장당 200장 · IP당 하루 30장 */
export const POST = handle(
  async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params
    const input = await readJson(req, albumPresignSchema)
    return json(await createAlbumUpload(req, slug, input))
  },
)
