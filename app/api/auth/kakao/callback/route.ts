import { NextResponse, type NextRequest } from 'next/server'

import { fetchKakaoProfile } from '@/lib/auth/kakao'
import { cookieBase, OAUTH_COOKIE, setSessionCookie } from '@/lib/auth/session'
import { verifyPayload } from '@/lib/auth/token'
import { upsertKakaoUser } from '@/lib/auth/users'
import { absoluteUrl, safeNextPath } from '@/lib/site'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function fail(reason: string) {
  const res = NextResponse.redirect(absoluteUrl(`/?login=${reason}`))
  res.cookies.set(OAUTH_COOKIE, '', { ...cookieBase, maxAge: 0 })
  return res
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  if (params.get('error')) return fail('cancelled') // 사용자가 동의 화면에서 취소

  const saved = verifyPayload<{ state: string; next: string; exp: number }>(
    req.cookies.get(OAUTH_COOKIE)?.value,
  )
  const code = params.get('code')
  if (!saved || !code || params.get('state') !== saved.state) return fail('expired')

  try {
    const profile = await fetchKakaoProfile(code)
    const session = await upsertKakaoUser(profile.kakaoId, profile.nickname)
    const res = NextResponse.redirect(absoluteUrl(safeNextPath(saved.next)))
    res.cookies.set(OAUTH_COOKIE, '', { ...cookieBase, maxAge: 0 })
    setSessionCookie(res, session)
    return res
  } catch (err) {
    console.error('[kakao callback]', err)
    return fail('failed')
  }
}
