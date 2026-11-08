import type { NextRequest } from 'next/server'

import { albumPhotoFile } from '@/lib/album'
import { handle, requireApiSession } from '@/lib/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 주최자: 사진 파일 한 장 (전체 받기가 브라우저에서 한 장씩 받아 zip으로 묶음 — Amplify 응답 크기 한도 때문에 서버에서 묶지 않음) */
export const GET = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string; photoId: string }> }) => {
    const session = await requireApiSession(req)
    const { id, photoId } = await params
    const f = await albumPhotoFile(id, session.userId, photoId)
    return new Response(new Uint8Array(f.bytes), {
      headers: {
        'Content-Type': f.type,
        'Content-Disposition': `attachment; filename="${photoId}.${f.ext}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  },
)
