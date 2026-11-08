import type { NextRequest } from 'next/server'

import { handle, json, readJson, requireApiSession } from '@/lib/api'
import { audioPresignSchema, createAudioUpload } from '@/lib/uploads'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 배경음악(mp3 · m4a, 10MB 이하) 업로드 주소 발급 → { uploadUrl, token }. 완료는 /api/uploads/complete */
export const POST = handle(async (req: NextRequest) => {
  const session = await requireApiSession(req)
  const input = await readJson(req, audioPresignSchema)
  return json(await createAudioUpload(session.userId, input))
})
