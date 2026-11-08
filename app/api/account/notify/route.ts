import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { handle, json, readJson, requireApiSession } from '@/lib/api'
import { disableNotify } from '@/lib/notify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 새 응답 카톡 알림 끄기 (켜기는 카카오 동의가 필요해 /api/auth/kakao/login?notify=1 로) */
export const POST = handle(async (req: NextRequest) => {
  const session = await requireApiSession(req)
  await readJson(req, z.object({ enabled: z.literal(false) }))
  await disableNotify(session.userId)
  return json({ ok: true })
})
