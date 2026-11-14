import type { NextRequest } from 'next/server'

import { json } from '@/lib/api'
import {
  applyGrobleEvent,
  claimIdempotency,
  GrobleError,
  parseGrobleEvent,
  releaseIdempotency,
  verifyGrobleSignature,
} from '@/lib/groble'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 그로블 결제 웹훅 (그로블 판매자 설정에 `https://thedearday.com/api/webhooks/groble` 등록).
 * 서명(HMAC-SHA256 · ±5분) → 멱등 키로 중복 차단 → 이벤트 처리. 본문(구매자 정보 포함)은 로그에 남기지 않는다.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.GROBLE_WEBHOOK_SECRET?.trim()
  if (!secret) return json({ error: '웹훅이 설정되지 않았어요.' }, 503)
  const raw = await req.text()
  try {
    verifyGrobleSignature({
      secret,
      timestamp: req.headers.get('x-groble-timestamp'),
      signature: req.headers.get('x-groble-signature'),
      rawBody: raw,
    })
  } catch (err) {
    if (err instanceof GrobleError) return json({ error: err.message }, err.status)
    throw err
  }

  const key = req.headers.get('x-groble-idempotency-key')?.trim()
  if (!key || key.length > 200) return json({ error: '멱등 키가 없어요.' }, 400)
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return json({ error: '요청 형식이 올바르지 않아요.' }, 400)
  }
  const event = parseGrobleEvent(body)
  if (!event) return json({ ok: true, ignored: true })

  if (!(await claimIdempotency(key))) return json({ ok: true, duplicate: true })
  try {
    const result = await applyGrobleEvent(event)
    return json({ ok: true, result })
  } catch (err) {
    // 처리 실패는 같은 키로 다시 보내도 처리되도록 기록을 되돌리고 500 (구매자 정보는 로그에 없음)
    await releaseIdempotency(key).catch(() => {})
    console.error('[webhook/groble] 처리 실패', err instanceof Error ? err.message : 'unknown')
    return json({ ok: false }, 500)
  }
}
