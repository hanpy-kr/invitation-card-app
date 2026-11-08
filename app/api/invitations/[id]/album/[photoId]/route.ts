import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { deleteAlbumPhotoByHost, setAlbumPhotoHidden } from '@/lib/album'
import { handle, json, readJson, requireApiSession } from '@/lib/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; photoId: string }> }

/** 주최자: 사진 숨기기 · 다시 보이기 */
export const PATCH = handle(async (req: NextRequest, { params }: Ctx) => {
  const session = await requireApiSession(req)
  const { id, photoId } = await params
  const { hidden } = await readJson(req, z.object({ hidden: z.boolean() }))
  await setAlbumPhotoHidden(id, session.userId, photoId, hidden)
  return json({ ok: true })
})

/** 주최자: 사진 지우기 */
export const DELETE = handle(async (req: NextRequest, { params }: Ctx) => {
  const session = await requireApiSession(req)
  const { id, photoId } = await params
  await deleteAlbumPhotoByHost(id, session.userId, photoId)
  return json({ ok: true })
})
