import { sql } from 'drizzle-orm'

import { kakaoConfigured } from '@/lib/auth/kakao'
import { getDb } from '@/lib/db/client'
import { storageMode } from '@/lib/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 배포 확인용: 환경변수가 런타임까지 들어왔는지 (값은 내보내지 않음) */
export async function GET() {
  let db = false
  try {
    await getDb().execute(sql`select 1`)
    db = true
  } catch {
    db = false
  }
  const body = {
    ok: db && Boolean(process.env.SESSION_SECRET),
    db,
    session: Boolean(process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32),
    storage: storageMode(),
    kakaoLogin: kakaoConfigured(),
    kakaoJs: Boolean(process.env.NEXT_PUBLIC_KAKAO_JS_KEY),
    devLogin: process.env.DEV_LOGIN === '1',
  }
  return Response.json(body, {
    status: body.ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  })
}
