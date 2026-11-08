import 'server-only'

import { isLocalSite, siteUrl } from '../site'

const KAUTH = 'https://kauth.kakao.com'
const KAPI = 'https://kapi.kakao.com'

export function kakaoConfigured(): boolean {
  return Boolean(process.env.KAKAO_REST_API_KEY)
}

/** DEV_LOGIN=1 이면서 사이트 주소가 localhost일 때만 개발용 로그인 허용 (운영 실수 방지 이중 잠금) */
export function devLoginEnabled(): boolean {
  return process.env.DEV_LOGIN === '1' && isLocalSite()
}

export function kakaoRedirectUri(): string {
  return process.env.KAKAO_REDIRECT_URI || `${siteUrl()}/api/auth/kakao/callback`
}

export function kakaoAuthorizeUrl(state: string, scope?: string): string {
  const url = new URL('/oauth/authorize', KAUTH)
  url.searchParams.set('client_id', process.env.KAKAO_REST_API_KEY ?? '')
  url.searchParams.set('redirect_uri', kakaoRedirectUri())
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('state', state)
  if (scope) url.searchParams.set('scope', scope)
  return url.toString()
}

export type KakaoProfile = {
  kakaoId: string
  nickname: string
  /** 사용자가 talk_message(카카오톡 메시지 전송)에 동의했을 때만 */
  refreshToken?: string
}

export async function fetchKakaoProfile(code: string): Promise<KakaoProfile> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.KAKAO_REST_API_KEY ?? '',
    redirect_uri: kakaoRedirectUri(),
    code,
  })
  // 새 앱은 Client Secret이 기본 사용(필수). 비어 있으면 카카오가 KOE010으로 거절한다
  if (process.env.KAKAO_CLIENT_SECRET) body.set('client_secret', process.env.KAKAO_CLIENT_SECRET)

  const tokenRes = await fetch(`${KAUTH}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body,
    cache: 'no-store',
  })
  if (!tokenRes.ok)
    throw new Error(`카카오 토큰 발급 실패 (${tokenRes.status}): ${await tokenRes.text()}`)
  const { access_token, refresh_token, scope } = (await tokenRes.json()) as {
    access_token?: string
    refresh_token?: string
    scope?: string
  }
  if (!access_token) throw new Error('카카오 토큰 응답에 access_token이 없습니다.')

  const meRes = await fetch(`${KAPI}/v2/user/me`, {
    headers: { Authorization: `Bearer ${access_token}` },
    cache: 'no-store',
  })
  if (!meRes.ok) throw new Error(`카카오 사용자 정보 조회 실패 (${meRes.status})`)
  const me = (await meRes.json()) as {
    id: number
    properties?: { nickname?: string }
    kakao_account?: { profile?: { nickname?: string } }
  }
  const nickname = me.kakao_account?.profile?.nickname ?? me.properties?.nickname ?? ''
  const talk = refresh_token && (scope ?? '').split(' ').includes('talk_message')
  return {
    kakaoId: String(me.id),
    nickname: nickname.slice(0, 40),
    ...(talk ? { refreshToken: refresh_token } : {}),
  }
}
