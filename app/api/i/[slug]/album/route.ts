import type { NextRequest } from 'next/server'

import { handle, json } from '@/lib/api'
import { listAlbum } from '@/lib/album'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 하객 앨범 사진 목록 (숨긴 사진 제외). 앨범 블록이 보이는 발행된 초대장만 */
export const GET = handle(
  async (_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params
    return json({ photos: await listAlbum(slug) }, { headers: { 'Cache-Control': 'no-store' } })
  },
)
