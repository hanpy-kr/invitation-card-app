import 'server-only'

import { createHash } from 'node:crypto'

import { sql } from 'drizzle-orm'
import type { NextRequest } from 'next/server'

import { ApiError } from './api'
import { getDb, schema } from './db/client'

export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
}

/**
 * 고정 창 rate limit (쿼리 1회). 여러 서버 인스턴스(Amplify Lambda)에서도 공유되도록 DB에 둔다.
 * 원래 IP 대신 해시만 저장한다.
 */
export async function rateLimit(
  req: NextRequest,
  scope: string,
  { limit, windowSec }: { limit: number; windowSec: number },
): Promise<void> {
  const key = createHash('sha256')
    .update(`${process.env.SESSION_SECRET ?? ''}:${scope}:${clientIp(req)}`)
    .digest('base64url')
  const t = schema.rateLimits
  const [row] = await getDb()
    .insert(t)
    .values({ key, count: 1, resetAt: sql`now() + make_interval(secs => ${windowSec})` })
    .onConflictDoUpdate({
      target: t.key,
      set: {
        count: sql`case when ${t.resetAt} < now() then 1 else ${t.count} + 1 end`,
        resetAt: sql`case when ${t.resetAt} < now() then now() + make_interval(secs => ${windowSec}) else ${t.resetAt} end`,
      },
    })
    .returning({ count: t.count })
  if (row.count > limit) throw new ApiError(429, '잠시 후 다시 시도해 주세요.')
}
