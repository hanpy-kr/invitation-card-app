import 'server-only'

import { NextResponse, type NextRequest } from 'next/server'
import type { z } from 'zod'

import { getSession, type Session } from './auth/session'
import { siteUrl } from './site'

/** API 공용: 에러 응답은 { error: 한국어 메시지 } 형태 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export function json<T>(data: T, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === 'number' ? { status: init } : init)
}

/** 다른 사이트에서 보낸 요청 차단 (쿠키 SameSite=Lax에 더한 2차 방어) */
function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin')
  if (!origin) return
  const allowed = new Set([new URL(siteUrl()).origin, req.nextUrl.origin])
  if (!allowed.has(origin)) throw new ApiError(403, '허용되지 않은 요청입니다.')
}

export async function readJson<S extends z.ZodType>(
  req: NextRequest,
  schema: S,
): Promise<z.infer<S>> {
  assertSameOrigin(req)
  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw new ApiError(400, '요청 형식이 올바르지 않습니다.')
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    throw new ApiError(400, `입력값을 확인해 주세요. (${first?.path.join('.') || '본문'})`)
  }
  return parsed.data
}

export async function requireApiSession(req?: NextRequest): Promise<Session> {
  if (req && req.method !== 'GET') assertSameOrigin(req)
  const session = await getSession()
  if (!session) throw new ApiError(401, '로그인이 필요합니다.')
  return session
}

/** 라우트 핸들러를 감싸 ApiError · 예상 못 한 에러를 JSON으로 바꾼다 */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args)
    } catch (err) {
      if (err instanceof ApiError) return json({ error: err.message }, err.status)
      console.error('[api]', err)
      return json({ error: '잠시 후 다시 시도해 주세요.' }, 500)
    }
  }
}
