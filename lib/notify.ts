import 'server-only'

import { eq } from 'drizzle-orm'

import { decryptSecret, encryptSecret, tokenKeyConfigured } from './crypto'
import { getDb, schema } from './db/client'
import { kakaoConfigured } from './auth/kakao'
import { siteUrl } from './site'

const KAUTH = 'https://kauth.kakao.com'
const KAPI = 'https://kapi.kakao.com'
const TIMEOUT_MS = 3000

/** 알림을 쓸 수 있는 환경인지: 카카오 앱 + 토큰 암호화 키가 모두 있어야 함 (없으면 UI도 숨김 = ⏸ 상태) */
export function notifyConfigured(): boolean {
  return kakaoConfigured() && tokenKeyConfigured()
}

export async function saveNotifyToken(userId: string, refreshToken: string): Promise<void> {
  if (!notifyConfigured()) return
  await getDb()
    .update(schema.users)
    .set({ kakaoRefreshEnc: encryptSecret(refreshToken), notifyRsvp: true })
    .where(eq(schema.users.id, userId))
}

export async function disableNotify(userId: string): Promise<void> {
  await getDb()
    .update(schema.users)
    .set({ kakaoRefreshEnc: null, notifyRsvp: false })
    .where(eq(schema.users.id, userId))
}

export async function getNotifyState(userId: string): Promise<{ available: boolean; on: boolean }> {
  if (!notifyConfigured()) return { available: false, on: false }
  const [row] = await getDb()
    .select({ on: schema.users.notifyRsvp, enc: schema.users.kakaoRefreshEnc })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1)
  return { available: true, on: Boolean(row?.on && row.enc) }
}

type RefreshResult = { access: string; refresh?: string } | 'invalid' | null

async function refreshAccess(refreshToken: string): Promise<RefreshResult> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.KAKAO_REST_API_KEY ?? '',
    refresh_token: refreshToken,
  })
  if (process.env.KAKAO_CLIENT_SECRET) body.set('client_secret', process.env.KAKAO_CLIENT_SECRET)
  const res = await fetch(`${KAUTH}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body,
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (res.status === 400 || res.status === 401) return 'invalid' // 만료 · 철회
  if (!res.ok) return null
  const j = (await res.json()) as { access_token?: string; refresh_token?: string }
  return j.access_token ? { access: j.access_token, refresh: j.refresh_token } : null
}

/**
 * 새 응답을 주최자 본인의 카카오톡("나와의 채팅")으로 알림. 어떤 이유로든 실패하면 조용히 건너뜀 —
 * 하객의 응답 저장을 막으면 안 된다. 키 · 토큰이 없으면 아무것도 하지 않음.
 */
export async function notifyNewRsvp(
  invitationId: string,
  rsvp: { name: string; attending: boolean; partySize: number },
): Promise<void> {
  if (!notifyConfigured()) return
  try {
    const [row] = await getDb()
      .select({
        userId: schema.users.id,
        enc: schema.users.kakaoRefreshEnc,
        on: schema.users.notifyRsvp,
        title: schema.invitations.title,
      })
      .from(schema.invitations)
      .innerJoin(schema.users, eq(schema.users.id, schema.invitations.ownerId))
      .where(eq(schema.invitations.id, invitationId))
      .limit(1)
    if (!row?.on || !row.enc) return
    const refresh = decryptSecret(row.enc)
    if (!refresh) return
    const got = await refreshAccess(refresh)
    if (got === 'invalid') return void (await disableNotify(row.userId))
    if (!got) return
    // 카카오가 refresh token을 새로 주면 교체 (만료 연장)
    if (got.refresh) {
      await getDb()
        .update(schema.users)
        .set({ kakaoRefreshEnc: encryptSecret(got.refresh) })
        .where(eq(schema.users.id, row.userId))
    }
    const link = `${siteUrl()}/dashboard/${invitationId}`
    const who = rsvp.attending
      ? `${rsvp.name}님이 참석해요 (${rsvp.partySize}명)`
      : `${rsvp.name}님이 못 오세요`
    const template = {
      object_type: 'text',
      text: `새 응답이 왔어요\n${who}${row.title ? `\n「${row.title}」` : ''}`,
      link: { web_url: link, mobile_web_url: link },
      button_title: '응답 보기',
    }
    const res = await fetch(`${KAPI}/v2/api/talk/memo/default/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${got.access}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body: new URLSearchParams({ template_object: JSON.stringify(template) }),
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    // 동의 철회(-402) 등 권한 오류면 알림을 꺼 둠
    if (res.status === 401 || res.status === 403) await disableNotify(row.userId)
  } catch (err) {
    console.error('[notify]', err instanceof Error ? err.message : err)
  }
}
