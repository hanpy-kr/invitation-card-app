import { NextResponse, type NextRequest } from 'next/server'

import { cleanupStaleAnonymous, createAnonymousUser } from '@/lib/auth/anonymous'
import { getSession, setSessionCookie } from '@/lib/auth/session'
import { rateLimit } from '@/lib/rate-limit'
import { absoluteUrl } from '@/lib/site'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 로그인 없이 만들기 시작 (랜딩의 폼 버튼). IP당 하루 5번 */
export async function POST(req: NextRequest) {
  if (await getSession()) return NextResponse.redirect(absoluteUrl('/new'), 303)
  try {
    await rateLimit(req, 'anon-start', { limit: 5, windowSec: 24 * 60 * 60 })
  } catch {
    return NextResponse.redirect(absoluteUrl('/?login=anon-limit'), 303)
  }
  const session = await createAnonymousUser()
  void cleanupStaleAnonymous()
  const res = NextResponse.redirect(absoluteUrl('/new'), 303)
  setSessionCookie(res, session)
  return res
}
