import 'server-only'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { NextResponse } from 'next/server'

import { signPayload, verifyPayload } from './token'

export const SESSION_COOKIE = 'dd_session'
/** 카카오 로그인 중 state · 돌아갈 경로를 담는 10분짜리 쿠키 */
export const OAUTH_COOKIE = 'dd_oauth'
const SESSION_DAYS = 30

export type Session = {
  userId: string
  nickname: string
  /** (2차) 로그인 없이 시작한 임시 사용자 — 발행 · 공유하려면 카카오 로그인 */
  anonymous?: boolean
}
type SessionPayload = { uid: string; nick: string; anon?: 1; exp: number }

const cookieBase = {
  httpOnly: true,
  secure:
    process.env.NODE_ENV === 'production' &&
    !process.env.NEXT_PUBLIC_SITE_URL?.startsWith('http://'),
  sameSite: 'lax' as const,
  path: '/',
}

export function setSessionCookie(res: NextResponse, session: Session) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 24 * 60 * 60
  res.cookies.set(
    SESSION_COOKIE,
    signPayload({
      uid: session.userId,
      nick: session.nickname,
      ...(session.anonymous ? { anon: 1 } : {}),
      exp,
    }),
    {
      ...cookieBase,
      maxAge: SESSION_DAYS * 24 * 60 * 60,
    },
  )
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, '', { ...cookieBase, maxAge: 0 })
}

/** 서명된 세션 쿠키를 읽는다. DB 조회 없음. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies()
  const payload = verifyPayload<SessionPayload>(store.get(SESSION_COOKIE)?.value)
  return payload
    ? { userId: payload.uid, nickname: payload.nick, anonymous: payload.anon === 1 }
    : null
}

/** 로그인 필요한 페이지에서 사용. 없으면 로그인으로 보낸 뒤 원래 경로로 돌아옴 */
export async function requireSession(nextPath: string): Promise<Session> {
  const session = await getSession()
  if (!session) redirect(`/api/auth/kakao/login?next=${encodeURIComponent(nextPath)}`)
  return session
}

/** 카카오 계정이 꼭 필요한 페이지(공동 편집 참여 · 관리자). 익명이면 카카오 로그인으로 */
export async function requireKakaoSession(nextPath: string): Promise<Session> {
  const session = await requireSession(nextPath)
  if (session.anonymous) redirect(`/api/auth/kakao/login?next=${encodeURIComponent(nextPath)}`)
  return session
}

export { cookieBase }
