import 'server-only'

import { createHash, randomBytes } from 'node:crypto'

/**
 * 하객 수정 토큰 (응답 · 투표 공통). 토큰 원문은 하객 브라우저 localStorage에만 있고,
 * DB에는 SHA-256 해시만 저장한다. 원문이 무작위 32바이트라 솔트 없는 해시로 충분.
 */
export function newGuestToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashGuestToken(token) }
}

export function hashGuestToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url')
}

/** 새 형식 토큰인지 (43자 base64url). 1차의 서명 토큰(점 포함)과 구분 */
export function isGuestToken(token: string | undefined): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token)
}
