import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { ApiError, handle, json, requireApiSession } from '@/lib/api'
import { searchPlaces } from '@/lib/geo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const querySchema = z.string().trim().min(2).max(60)

/** 편집기 주소 검색 (로그인 필요 — API 사용량 보호) */
export const GET = handle(async (req: NextRequest) => {
  await requireApiSession(req)
  const parsed = querySchema.safeParse(req.nextUrl.searchParams.get('q') ?? '')
  if (!parsed.success) throw new ApiError(400, '두 글자 이상 입력해 주세요.')
  return json({ results: await searchPlaces(parsed.data) })
})
