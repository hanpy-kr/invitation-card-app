import type { NextRequest } from 'next/server'

import { handle, json, readJson, requireApiSession } from '@/lib/api'
import { createUpload, presignSchema } from '@/lib/uploads'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 사진 업로드 주소 발급 → { uploadUrl, token } */
export const POST = handle(async (req: NextRequest) => {
  const session = await requireApiSession(req)
  const input = await readJson(req, presignSchema)
  return json(await createUpload(session.userId, input))
})
