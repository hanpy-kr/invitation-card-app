import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'

import { and, eq } from 'drizzle-orm'

import { priceFor } from '@/shared/pricing'

import { getDb, schema } from './db/client'
import { derivedPremiumSql, hasPaidPremium } from './plan'
import { markOrderCanceled } from './payments'

/**
 * 그로블(통신판매중개) 결제 웹훅 처리. 결제는 그로블 결제창에서 끝나고, 결과는 이 웹훅으로만 알게 된다.
 * 구매자 이름 · 전화 · 이메일은 읽지도 저장하지도 로그에 남기지도 않는다 (필요한 값만 골라 읽음).
 */
export const GROBLE_TOLERANCE_SEC = 5 * 60

export class GrobleError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

/** X-Groble-Signature = HMAC-SHA256(secret, `${timestamp}.${rawBody}`) hex. 시각은 ±5분 */
export function verifyGrobleSignature(input: {
  secret: string
  timestamp: string | null
  signature: string | null
  rawBody: string
  now?: number
}): void {
  const { secret, timestamp, signature, rawBody } = input
  if (!timestamp || !signature) throw new GrobleError(401, '서명이 없어요.')
  const t = Number(timestamp)
  if (!Number.isFinite(t) || t <= 0) throw new GrobleError(401, '시각이 올바르지 않아요.')
  // 초 단위(10자리)와 밀리초 단위(13자리)를 모두 받는다
  const sec = t > 1e11 ? t / 1000 : t
  const nowSec = (input.now ?? Date.now()) / 1000
  if (Math.abs(nowSec - sec) > GROBLE_TOLERANCE_SEC)
    throw new GrobleError(401, '요청 시각이 너무 달라요.')
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')
  const given = signature
    .trim()
    .replace(/^sha256=/i, '')
    .toLowerCase()
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(given, 'utf8')
  if (a.length !== b.length || !timingSafeEqual(a, b))
    throw new GrobleError(401, '서명이 맞지 않아요.')
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

const AMOUNT_KEYS = ['amount', 'paidAmount', 'totalAmount', 'paymentAmount', 'totalPrice', 'price']

export type GrobleEvent = {
  type: string
  /** 우리 주문번호(결제 링크의 ?ref= 값) */
  reference: string | null
  /** 그로블 주문번호 */
  merchantUid: string | null
  amount: number | null
}

/** 필요한 값만 골라 읽는다. 참조값은 data.object.sellerReference(공식 가이드), 없으면 data.sellerReference */
export function parseGrobleEvent(body: unknown): GrobleEvent | null {
  if (!isObj(body)) return null
  const type = str(body.type) ?? str(body.event) ?? str(body.eventType) ?? str(body.event_type)
  if (!type) return null
  const data = isObj(body.data) ? body.data : {}
  const obj = isObj(data.object) ? data.object : {}
  const reference = str(obj.sellerReference) ?? str(data.sellerReference)
  const merchantUid = str(obj.merchantUid) ?? str(data.merchantUid)
  let amount: number | null = null
  for (const k of AMOUNT_KEYS) {
    const v = obj[k] ?? data[k]
    if (typeof v === 'number' && Number.isFinite(v)) {
      amount = v
      break
    }
  }
  return { type, reference, merchantUid, amount }
}

/** 이 멱등 키를 처음 보는가 (처음이면 기록하고 true). 처리 중 실패하면 releaseIdempotency로 되돌린다 */
export async function claimIdempotency(key: string): Promise<boolean> {
  const rows = await getDb()
    .insert(schema.webhookEvents)
    .values({ key, provider: 'groble' })
    .onConflictDoNothing()
    .returning({ key: schema.webhookEvents.key })
  return rows.length > 0
}

export async function releaseIdempotency(key: string): Promise<void> {
  await getDb().delete(schema.webhookEvents).where(eq(schema.webhookEvents.key, key))
}

export type GrobleResult =
  'paid' | 'canceled' | 'cancel_requested' | 'ignored' | 'amount_mismatch' | 'conflict'

export async function applyGrobleEvent(ev: GrobleEvent): Promise<GrobleResult> {
  if (!ev.reference) return 'ignored'
  const db = getDb()
  const [order] = await db
    .select()
    .from(schema.orders)
    .where(and(eq(schema.orders.orderId, ev.reference), eq(schema.orders.provider, 'groble')))
  if (!order) return 'ignored'
  const setFail = (reason: string) =>
    db
      .update(schema.orders)
      .set({ failReason: reason.slice(0, 200) })
      .where(eq(schema.orders.id, order.id))

  if (ev.type === 'payment.completed') {
    if (order.status !== 'pending') return 'ignored' // 이미 처리됨 · 환불됨 등
    const inv = order.invitationId
      ? await db.query.invitations.findFirst({
          where: eq(schema.invitations.id, order.invitationId),
          columns: { eventType: true, premiumOrderId: true },
          extras: { derivedPremium: derivedPremiumSql().as('derived_premium') },
        })
      : null
    if (!inv) {
      await setFail('초대장을 찾을 수 없음')
      return 'conflict'
    }
    // 결제 금액 = 주문 금액 = 현재 가격 이어야만 paid
    if (
      ev.amount === null ||
      ev.amount !== order.amount ||
      order.amount !== priceFor(inv.eventType)
    ) {
      await setFail(`금액 불일치 (결제 ${ev.amount ?? '?'} / 주문 ${order.amount})`)
      return 'amount_mismatch'
    }
    if (hasPaidPremium(inv)) {
      await setFail('이미 프리미엄이 적용된 초대장 — 중복 결제, 환불 필요')
      return 'conflict'
    }
    await db.transaction(async (tx) => {
      await tx
        .update(schema.orders)
        .set({
          status: 'paid',
          paymentKey: ev.merchantUid ?? order.paymentKey,
          method: '그로블',
          approvedAt: new Date(),
          failReason: null,
        })
        .where(and(eq(schema.orders.id, order.id), eq(schema.orders.status, 'pending')))
      await tx
        .update(schema.invitations)
        .set({ premiumOrderId: order.id })
        .where(eq(schema.invitations.id, order.invitationId!))
    })
    return 'paid'
  }

  if (ev.type === 'payment.refunded') {
    if (order.status === 'canceled') return 'ignored'
    if (order.status !== 'paid' && order.status !== 'cancel_requested') return 'ignored'
    await markOrderCanceled(order.id)
    return 'canceled'
  }

  if (ev.type === 'payment.cancel_requested') {
    if (order.status !== 'paid') return 'ignored'
    await db
      .update(schema.orders)
      .set({ status: 'cancel_requested' })
      .where(and(eq(schema.orders.id, order.id), eq(schema.orders.status, 'paid')))
    return 'cancel_requested'
  }
  return 'ignored'
}
