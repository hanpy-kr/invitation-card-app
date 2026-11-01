import type { NextRequest } from 'next/server'

import { ApiError, handle, json, requireApiSession } from '@/lib/api'
import { storageMode, writeLocal } from '@/lib/storage'
import { readUploadToken } from '@/lib/uploads'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 개발용 우회: R2 키가 없을 때(localhost 한정) R2 presigned PUT 대신 여기로 올린다.
 * 운영(R2 연결)에서는 404.
 */
export const PUT = handle(async (req: NextRequest) => {
  if (storageMode() !== 'local') throw new ApiError(404, '없는 주소예요.')
  const session = await requireApiSession(req)
  const t = readUploadToken(req.nextUrl.searchParams.get('token'), session.userId)
  if (req.headers.get('content-type') !== t.ct) throw new ApiError(400, '파일 형식이 맞지 않아요.')
  const data = new Uint8Array(await req.arrayBuffer())
  if (data.byteLength === 0 || data.byteLength > t.size)
    throw new ApiError(400, '파일 크기가 맞지 않아요.')
  await writeLocal(t.key, data)
  return json({ ok: true })
})
