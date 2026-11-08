import type { NextRequest } from 'next/server'

import { albumLocalInvitationCheck, albumLocalTarget, readAlbumToken } from '@/lib/album'
import { ApiError, handle, json } from '@/lib/api'
import { storageMode, writeLocal } from '@/lib/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 개발용 우회: R2 키가 없을 때(localhost 한정) presigned PUT 대신 여기로 올린다. 운영(R2 연결)에서는 404 */
export const PUT = handle(
  async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
    if (storageMode() !== 'local') throw new ApiError(404, '없는 주소예요.')
    const { slug } = await params
    const t = readAlbumToken(req.nextUrl.searchParams.get('token'))
    await albumLocalInvitationCheck(slug, t)
    const part = req.nextUrl.searchParams.get('part') === 'thumb' ? 'thumb' : 'main'
    const target = albumLocalTarget(t, part)
    if (req.headers.get('content-type') !== target.ct)
      throw new ApiError(400, '파일 형식이 맞지 않아요.')
    const data = new Uint8Array(await req.arrayBuffer())
    if (data.byteLength === 0 || data.byteLength > target.size)
      throw new ApiError(400, '파일 크기가 맞지 않아요.')
    await writeLocal(target.key, data)
    return json({ ok: true })
  },
)
