import type { NextRequest } from 'next/server'

import { handle, json, readJson, requireApiSession } from '@/lib/api'
import { completeSchema, completeUpload } from '@/lib/uploads'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 업로드 끝 → media 등록 → MediaRef */
export const POST = handle(async (req: NextRequest) => {
  const session = await requireApiSession(req)
  const input = await readJson(req, completeSchema)
  return json(await completeUpload(session.userId, input), 201)
})
