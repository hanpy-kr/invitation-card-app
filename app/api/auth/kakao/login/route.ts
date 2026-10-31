import { randomBytes } from 'node:crypto'

import { NextResponse, type NextRequest } from 'next/server'

import { devLoginEnabled, kakaoAuthorizeUrl, kakaoConfigured } from '@/lib/auth/kakao'
import { cookieBase, OAUTH_COOKIE, setSessionCookie } from '@/lib/auth/session'
import { signPayload } from '@/lib/auth/token'
import { upsertKakaoUser } from '@/lib/auth/users'
import { absoluteUrl, safeNextPath } from '@/lib/site'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 카카오 로그인 시작. ?next=/돌아갈경로  (로컬에서 DEV_LOGIN=1이면 ?dev=1 또는 키 없을 때 개발용 로그인) */
export async function GET(req: NextRequest) {
  const next = safeNextPath(req.nextUrl.searchParams.get('next'))

  if (devLoginEnabled() && (!kakaoConfigured() || req.nextUrl.searchParams.get('dev') === '1')) {
    const session = await upsertKakaoUser('dev-1', '개발자')
    const res = NextResponse.redirect(absoluteUrl(next))
    setSessionCookie(res, session)
    return res
  }

  if (!kakaoConfigured()) {
    return NextResponse.json({ error: '카카오 로그인이 아직 설정되지 않았어요.' }, { status: 503 })
  }

  const state = randomBytes(16).toString('base64url')
  const res = NextResponse.redirect(kakaoAuthorizeUrl(state))
  res.cookies.set(
    OAUTH_COOKIE,
    signPayload({ state, next, exp: Math.floor(Date.now() / 1000) + 600 }),
    {
      ...cookieBase,
      maxAge: 600,
    },
  )
  return res
}
