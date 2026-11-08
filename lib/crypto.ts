import 'server-only'

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/** KAKAO_TOKEN_KEY: 32바이트를 hex 64자로 (openssl rand -hex 32). 없거나 형식이 틀리면 null */
function tokenKey(): Buffer | null {
  const hex = process.env.KAKAO_TOKEN_KEY ?? ''
  return /^[0-9a-f]{64}$/i.test(hex) ? Buffer.from(hex, 'hex') : null
}

export function tokenKeyConfigured(): boolean {
  return tokenKey() !== null
}

/** AES-256-GCM. 결과: v1.iv.tag.암호문 (모두 base64url) */
export function encryptSecret(plain: string): string {
  const key = tokenKey()
  if (!key) throw new Error('KAKAO_TOKEN_KEY가 설정되지 않았습니다.')
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return ['v1', iv, c.getAuthTag(), enc]
    .map((x) => (typeof x === 'string' ? x : x.toString('base64url')))
    .join('.')
}

/** 복호화 실패(키 변경 · 변조)는 null */
export function decryptSecret(stored: string): string | null {
  const key = tokenKey()
  const [v, iv, tag, enc] = stored.split('.')
  if (!key || v !== 'v1' || !iv || !tag || !enc) return null
  try {
    const d = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'))
    d.setAuthTag(Buffer.from(tag, 'base64url'))
    return Buffer.concat([d.update(Buffer.from(enc, 'base64url')), d.final()]).toString('utf8')
  } catch {
    return null
  }
}
