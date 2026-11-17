import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'

import { getDb, schema } from '@/lib/db/client'
import { verifyHanpyNotification } from '@/lib/hanpy-payments'
import { refreshPremium } from '@/lib/premium'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 한피 결제 허브 알림 수신. 알림은 "바뀌었다"는 신호로만 쓴다 —
 * 서명 확인(원문 그대로) → eventId 중복 제거 → 허브에 다시 물어 premium_hub 갱신 → 2xx.
 * 구매자 정보 · 알림 원문은 로그에 남기지 않는다.
 */
export async function POST(req: Request) {
  const rawBody = await req.text()
  const secret = process.env.HANPY_NOTIFY_SECRET
  if (!secret) return NextResponse.json({ error: 'not configured' }, { status: 503 })
  const result = verifyHanpyNotification({ rawBody, headers: req.headers, secret })
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 401 })

  const { eventId, event } = result
  const db = getDb()
  const key = `hanpy:${eventId}`
  const inserted = await db
    .insert(schema.webhookEvents)
    .values({ key, provider: 'hanpy' })
    .onConflictDoNothing()
    .returning({ key: schema.webhookEvents.key })
  if (inserted.length === 0) return NextResponse.json({ ok: true }) // 이미 처리한 알림

  try {
    const subject = event.order.subject
    if (subject && subject.type === 'invitation') {
      const ok = await refreshPremium([subject.id])
      if (!ok) throw new Error('hub lookup failed')
    }
  } catch {
    // 처리 실패: 중복 기록을 되돌리고 500 → 허브가 다시 보낸다
    await db.delete(schema.webhookEvents).where(eq(schema.webhookEvents.key, key))
    return NextResponse.json({ error: 'retry' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
