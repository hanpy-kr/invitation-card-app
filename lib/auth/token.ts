import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'

/** HMAC-SHA256으로 서명한 짧은 토큰: base64url(JSON).base64url(sig) */
function secret(): string {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 32) throw new Error('SESSION_SECRET(32자 이상)이 설정되지 않았습니다.')
  return s
}

function sign(data: string): string {
  return createHmac('sha256', secret()).update(data).digest('base64url')
}

export function signPayload(payload: Record<string, unknown>): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${data}.${sign(data)}`
}

export function verifyPayload<T extends { exp: number }>(token: string | undefined): T | null {
  if (!token) return null
  const [data, sig] = token.split('.')
  if (!data || !sig) return null
  const expected = Buffer.from(sign(data))
  const actual = Buffer.from(sig)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString()) as T
    if (typeof payload.exp !== 'number' || payload.exp < Date.now() / 1000) return null
    return payload
  } catch {
    return null
  }
}
