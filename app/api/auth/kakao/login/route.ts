import { randomBytes } from 'node:crypto'

import { NextResponse, type NextRequest } from 'next/server'

import { notifyConfigured } from '@/lib/notify'
import { devLoginEnabled, kakaoAuthorizeUrl, kakaoConfigured } from '@/lib/auth/kakao'
import { mergeAnonymousInto } from '@/lib/auth/anonymous'
import { cookieBase, getSession, OAUTH_COOKIE, setSessionCookie } from '@/lib/auth/session'
import { signPayload } from '@/lib/auth/token'
import { upsertKakaoUser } from '@/lib/auth/users'
import { absoluteUrl, safeNextPath } from '@/lib/site'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 카카오 로그인 시작. ?next=/돌아갈경로  (로컬에서 DEV_LOGIN=1이면 ?dev=1 또는 키 없을 때 개발용 로그인) */
export async function GET(req: NextRequest) {
  const next = safeNextPath(req.nextUrl.searchParams.get('next'))

  if (devLoginEnabled() && (!kakaoConfigured() || req.nextUrl.searchParams.get('dev') === '1')) {
    // 개발용: ?as=2 로 두 번째 사용자 (공동 편집 테스트)
    const n = /^[2-9]$/.test(req.nextUrl.searchParams.get('as') ?? '')
      ? req.nextUrl.searchParams.get('as')
      : '1'
    const session = await upsertKakaoUser(`dev-${n}`, n === '1' ? '개발자' : `개발자${n}`)
    const prev = await getSession()
    if (prev?.anonymous) await mergeAnonymousInto(prev.userId, session.userId)
    const res = NextResponse.redirect(absoluteUrl(next))
    setSessionCookie(res, session)
    return res
  }

  if (!kakaoConfigured()) {
    return NextResponse.json({ error: '카카오 로그인이 아직 설정되지 않았어요.' }, { status: 503 })
  }

  const state = randomBytes(16).toString('base64url')
  // 새 응답 카톡 알림 켜기: 켜는 사람에게만 '카카오톡 메시지 전송' 동의를 추가로 받는다
  const notify = req.nextUrl.searchParams.get('notify') === '1' && notifyConfigured()
  const res = NextResponse.redirect(kakaoAuthorizeUrl(state, notify ? 'talk_message' : undefined))
  res.cookies.set(
    OAUTH_COOKIE,
    signPayload({
      state,
      next,
      ...(notify ? { notify: 1 } : {}),
      exp: Math.floor(Date.now() / 1000) + 600,
    }),
    {
      ...cookieBase,
      maxAge: 600,
    },
  )
  return res
}
