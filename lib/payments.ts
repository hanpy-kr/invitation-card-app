import 'server-only'

import { randomUUID } from 'node:crypto'

import { and, desc, eq, inArray } from 'drizzle-orm'

import { EVENT_TYPE_LABELS } from '@/shared/blocks'
import { orderNameFor, priceFor, refundEligibility, REFUND_DAYS } from '@/shared/pricing'

import { getAccess } from './access'
import { ApiError } from './api'
import { getDb, schema } from './db/client'
import { isUuid } from './editor'
import {
  canCheckout,
  derivedPremiumSql,
  grobleLinkFor,
  hasPaidPremium,
  paymentProvider,
} from './plan'

/**
 * 토스페이먼츠 결제 승인 · 취소 (서버 전용). 시크릿 키(TOSS_SECRET_KEY)는 여기서만 쓴다.
 * TOSS_API_BASE는 e2e가 가짜 토스 서버를 가리킬 때만 쓰는 값 (운영에서는 비워 둠).
 */
const base = () => (process.env.TOSS_API_BASE || 'https://api.tosspayments.com').replace(/\/$/, '')

type TossError = { code?: string; message?: string }
type TossPayment = {
  paymentKey: string
  orderId: string
  status: string
  totalAmount: number
  method?: string
  approvedAt?: string
  receipt?: { url?: string } | null
}

async function toss<T>(path: string, body?: unknown, method: 'POST' | 'GET' = 'POST'): Promise<T> {
  const secret = process.env.TOSS_SECRET_KEY
  if (!secret) throw new ApiError(503, '결제를 아직 열지 않았어요.')
  let res: Response
  try {
    res = await fetch(`${base()}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${secret}:`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
      signal: AbortSignal.timeout(15000),
    })
  } catch {
    throw new ApiError(502, '결제 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.')
  }
  const data = (await res.json().catch(() => ({}))) as T & TossError
  if (!res.ok) {
    const err = new ApiError(
      res.status === 429 ? 429 : 400,
      data.message || '결제를 처리하지 못했어요.',
    )
    ;(err as ApiError & { tossCode?: string }).tossCode = data.code
    throw err
  }
  return data
}

/** 그로블 주문조회(구매자가 환불을 신청하는 곳). 바뀌면 GROBLE_ORDER_URL 환경변수로 */
const GROBLE_ORDER_URL = process.env.GROBLE_ORDER_URL?.trim() || 'https://www.groble.im'

const tossCodeOf = (e: unknown) => (e as { tossCode?: string }).tossCode

/** 소유자(로그인한 회원)만 결제 · 환불할 수 있다 */
async function requireOwner(invitationId: string, userId: string) {
  if (!isUuid(invitationId)) throw new ApiError(404, '초대장을 찾을 수 없어요.')
  const access = await getAccess(invitationId, userId)
  if (!access) throw new ApiError(404, '초대장을 찾을 수 없어요.')
  if (!access.isOwner) throw new ApiError(403, '초대장 만든 사람만 결제할 수 있어요.')
  if (access.ownerAnonymous) throw new ApiError(403, '카카오로 로그인한 뒤에 결제할 수 있어요.')
  return access
}

async function loadInvitation(id: string) {
  const row = await getDb().query.invitations.findFirst({
    where: eq(schema.invitations.id, id),
    columns: {
      id: true,
      title: true,
      eventType: true,
      status: true,
      publishedAt: true,
      createdAt: true,
      premiumOrderId: true,
    },
    extras: { derivedPremium: derivedPremiumSql().as('derived_premium') },
  })
  if (!row) throw new ApiError(404, '초대장을 찾을 수 없어요.')
  return row
}

export type CheckoutInfo =
  | {
      provider: 'toss'
      orderId: string
      orderName: string
      amount: number
      customerKey: string
      clientKey: string
    }
  | {
      provider: 'groble'
      orderId: string
      orderName: string
      amount: number
      /** 그로블 결제창 링크 + ?ref=주문번호 (웹훅의 sellerReference로 돌아옴) */
      redirectUrl: string
    }

/** 결제 시작: 금액은 서버가 가격표로 계산하고, 주문(pending)을 만든 뒤 결제창에 넘길 값을 준다 */
export async function startCheckout(
  invitationId: string,
  userId: string,
  agreedRefund: boolean,
): Promise<CheckoutInfo> {
  if (!(await canCheckout(userId))) throw new ApiError(403, '결제를 아직 열지 않았어요.')
  if (!agreedRefund) throw new ApiError(400, '환불 규정에 동의해 주세요.')
  await requireOwner(invitationId, userId)
  const inv = await loadInvitation(invitationId)
  if (hasPaidPremium(inv)) throw new ApiError(409, '이미 프리미엄이 적용된 초대장이에요.')

  const amount = priceFor(inv.eventType)
  const provider = paymentProvider()
  // 그로블: 금액에 맞는 링크가 없으면 결제를 막는다
  const link = provider === 'groble' ? grobleLinkFor(amount) : null
  if (provider === 'groble' && !link)
    throw new ApiError(
      503,
      '이 금액의 결제 링크가 아직 준비되지 않았어요. 결제를 시작하지 않았어요.',
    )
  const orderId = `dd-${randomUUID().replaceAll('-', '')}`
  const orderName = orderNameFor(inv.eventType)
  await getDb().insert(schema.orders).values({
    invitationId,
    userId,
    orderId,
    orderName,
    amount,
    status: 'pending',
    provider,
    refundAgreedAt: new Date(),
  })
  if (link) {
    const url = new URL(link)
    url.searchParams.set('ref', orderId)
    return { provider: 'groble', orderId, orderName, amount, redirectUrl: url.toString() }
  }
  return {
    provider: 'toss',
    orderId,
    orderName,
    amount,
    customerKey: userId,
    clientKey: process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? '',
  }
}

/**
 * 결제 승인 (successUrl에서 호출). 주문번호 · 금액을 서버 기록과 대조한 뒤 토스 승인 API를 부른다.
 * 같은 주문을 다시 불러도(새로고침) 결과는 같다.
 */
export async function confirmPayment(input: {
  invitationId: string
  userId: string
  paymentKey: string
  orderId: string
  amount: number
}): Promise<{ ok: true }> {
  await requireOwner(input.invitationId, input.userId)
  const db = getDb()
  const [order] = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.orderId, input.orderId))
  if (!order || order.invitationId !== input.invitationId || order.userId !== input.userId)
    throw new ApiError(404, '주문을 찾을 수 없어요.')
  if (order.provider !== 'toss') throw new ApiError(400, '이 주문은 토스 결제가 아니에요.')
  if (order.status === 'paid') return { ok: true }
  if (order.status !== 'pending') throw new ApiError(409, '이미 처리된 주문이에요.')

  const inv = await loadInvitation(input.invitationId)
  const expected = priceFor(inv.eventType)
  // 결제창에서 돌아온 금액 · 주문에 적어 둔 금액 · 현재 가격표가 모두 같아야 승인한다
  if (input.amount !== order.amount || order.amount !== expected) {
    await markFailed(order.id, '금액 불일치')
    throw new ApiError(400, '결제 금액이 달라서 승인하지 않았어요. 처음부터 다시 시도해 주세요.')
  }
  if (hasPaidPremium(inv)) {
    throw new ApiError(409, '이미 프리미엄이 적용된 초대장이에요. 결제는 승인하지 않았어요.')
  }

  let paid: TossPayment
  try {
    paid = await toss<TossPayment>('/v1/payments/confirm', {
      paymentKey: input.paymentKey,
      orderId: order.orderId,
      amount: order.amount,
    })
  } catch (err) {
    await markFailed(order.id, (err as Error).message)
    throw err
  }
  if (
    paid.status !== 'DONE' ||
    paid.totalAmount !== order.amount ||
    paid.orderId !== order.orderId
  ) {
    await cancelQuietly(paid.paymentKey ?? input.paymentKey, '승인 결과 불일치')
    await markFailed(order.id, '승인 결과 불일치')
    throw new ApiError(400, '결제 승인 결과를 확인하지 못했어요. 결제는 취소했어요.')
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(schema.orders)
        .set({
          status: 'paid',
          paymentKey: paid.paymentKey,
          method: paid.method ?? null,
          receiptUrl: paid.receipt?.url ?? null,
          approvedAt: paid.approvedAt ? new Date(paid.approvedAt) : new Date(),
        })
        .where(eq(schema.orders.id, order.id))
      await tx
        .update(schema.invitations)
        .set({ premiumOrderId: order.id })
        .where(eq(schema.invitations.id, order.invitationId!))
    })
  } catch (err) {
    // 승인은 됐는데 우리 DB에 못 적었다 → 돈이 나가지 않게 취소
    await cancelQuietly(paid.paymentKey, '시스템 오류로 적용하지 못함')
    await markFailed(order.id, '적용 실패 후 취소')
    throw err
  }
  return { ok: true }
}

async function markFailed(orderRowId: string, reason: string) {
  await getDb()
    .update(schema.orders)
    .set({ status: 'failed', failReason: reason.slice(0, 200) })
    .where(and(eq(schema.orders.id, orderRowId), eq(schema.orders.status, 'pending')))
}

async function cancelQuietly(paymentKey: string, reason: string) {
  try {
    await toss(`/v1/payments/${encodeURIComponent(paymentKey)}/cancel`, { cancelReason: reason })
  } catch {
    // 취소 실패는 운영자가 토스 대시보드에서 확인 (주문은 failed로 남음)
  }
}

/** 결제창에서 실패 · 취소하고 돌아왔을 때 주문을 실패로 표시 (내 주문만) */
export async function recordPaymentFailure(
  invitationId: string,
  userId: string,
  orderId: string,
  reason: string,
) {
  await getDb()
    .update(schema.orders)
    .set({ status: 'failed', failReason: reason.slice(0, 200) })
    .where(
      and(
        eq(schema.orders.orderId, orderId),
        eq(schema.orders.invitationId, invitationId),
        eq(schema.orders.userId, userId),
        eq(schema.orders.status, 'pending'),
      ),
    )
}

/** 환불: 결제 후 7일 이내 · 아직 발행 전 → 토스 결제 취소(전액) → 프리미엄 해제 */
export async function requestRefund(invitationId: string, userId: string): Promise<{ ok: true }> {
  await requireOwner(invitationId, userId)
  const db = getDb()
  const inv = await loadInvitation(invitationId)
  if (!inv.premiumOrderId) throw new ApiError(404, '환불할 결제가 없어요.')
  const [order] = await db
    .select()
    .from(schema.orders)
    .where(
      and(eq(schema.orders.id, inv.premiumOrderId), eq(schema.orders.invitationId, invitationId)),
    )
  if (!order) throw new ApiError(404, '환불할 결제가 없어요.')
  const ok = refundEligibility({
    status: order.status,
    approvedAt: order.approvedAt,
    invitationPublishedAt: inv.publishedAt,
  })
  if (!ok.ok) throw new ApiError(409, ok.reason)
  if (order.provider === 'groble')
    throw new ApiError(409, '그로블 결제는 그로블 주문조회에서 환불을 신청해 주세요.')
  if (!order.paymentKey) throw new ApiError(409, '결제 정보를 찾을 수 없어요. 문의해 주세요.')

  try {
    await toss(`/v1/payments/${encodeURIComponent(order.paymentKey)}/cancel`, {
      cancelReason: '고객 요청 환불 (발행 전)',
    })
  } catch (err) {
    // 이미 취소된 결제면 우리 쪽 기록만 맞춘다
    if (tossCodeOf(err) !== 'ALREADY_CANCELED_PAYMENT') throw err
  }
  await db.transaction(async (tx) => {
    await tx
      .update(schema.orders)
      .set({ status: 'canceled', canceledAt: new Date() })
      .where(eq(schema.orders.id, order.id))
    await tx
      .update(schema.invitations)
      .set({ premiumOrderId: null })
      .where(eq(schema.invitations.id, invitationId))
  })
  return { ok: true }
}

/**
 * 토스 웹훅 PAYMENT_STATUS_CHANGED: 토스 대시보드에서 취소한 결제를 우리 기록에 반영한다.
 * 웹훅 본문은 믿지 않고, 결제 키로 토스 조회 API를 다시 불러 실제 상태를 확인한 뒤에만 바꾼다.
 * 반환: 'applied'(취소 반영) · 'ignored'(우리 주문이 아니거나 바꿀 것 없음)
 */
export async function applyPaymentWebhook(paymentKey: string): Promise<'applied' | 'ignored'> {
  const db = getDb()
  const [order] = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.paymentKey, paymentKey))
  if (!order) return 'ignored'
  const live = await toss<TossPayment>(
    `/v1/payments/${encodeURIComponent(paymentKey)}`,
    undefined,
    'GET',
  )
  if (live.orderId !== order.orderId) return 'ignored'
  // 전액 취소만 반영 (부분 취소는 프리미엄을 유지)
  if (live.status !== 'CANCELED' || order.status !== 'paid') return 'ignored'
  await markOrderCanceled(order.id)
  return 'applied'
}

/** 환불 · 취소가 확인된 주문을 취소로 기록하고 프리미엄을 해제 (토스 · 그로블 웹훅 공용) */
export async function markOrderCanceled(orderRowId: string): Promise<void> {
  await getDb().transaction(async (tx) => {
    await tx
      .update(schema.orders)
      .set({ status: 'canceled', canceledAt: new Date() })
      .where(
        and(
          eq(schema.orders.id, orderRowId),
          inArray(schema.orders.status, ['paid', 'cancel_requested']),
        ),
      )
    await tx
      .update(schema.invitations)
      .set({ premiumOrderId: null })
      .where(eq(schema.invitations.premiumOrderId, orderRowId))
  })
}

export type OrderRow = {
  id: string
  invitationId: string | null
  invitationTitle: string
  eventLabel: string
  orderName: string
  amount: number
  status: string
  provider: string
  /** 그로블 주문이면 환불을 신청할 그로블 주문조회 주소 */
  refundUrl: string | null
  method: string | null
  receiptUrl: string | null
  approvedAt: string | null
  canceledAt: string | null
  /** 환불 요청 버튼을 보일지 */
  refundable: boolean
  refundNote: string
}

/** 대시보드 결제 내역 (pending · failed는 숨김) */
export async function listOrders(userId: string): Promise<OrderRow[]> {
  const rows = await getDb()
    .select({
      o: schema.orders,
      title: schema.invitations.title,
      eventType: schema.invitations.eventType,
      publishedAt: schema.invitations.publishedAt,
      premiumOrderId: schema.invitations.premiumOrderId,
    })
    .from(schema.orders)
    .leftJoin(schema.invitations, eq(schema.invitations.id, schema.orders.invitationId))
    .where(eq(schema.orders.userId, userId))
    .orderBy(desc(schema.orders.createdAt))
  return rows
    .filter((r) => ['paid', 'canceled', 'cancel_requested'].includes(r.o.status))
    .map((r) => {
      const el =
        r.o.status === 'paid' && r.premiumOrderId === r.o.id
          ? refundEligibility({
              status: r.o.status,
              approvedAt: r.o.approvedAt,
              invitationPublishedAt: r.publishedAt,
            })
          : ({ ok: false, reason: '' } as const)
      return {
        id: r.o.id,
        invitationId: r.o.invitationId,
        invitationTitle: r.title ?? '(삭제된 초대장)',
        eventLabel: r.eventType ? EVENT_TYPE_LABELS[r.eventType] : '',
        orderName: r.o.orderName,
        amount: r.o.amount,
        status: r.o.status,
        provider: r.o.provider,
        refundUrl: r.o.provider === 'groble' ? GROBLE_ORDER_URL : null,
        method: r.o.method,
        receiptUrl: r.o.receiptUrl,
        approvedAt: r.o.approvedAt?.toISOString() ?? null,
        canceledAt: r.o.canceledAt?.toISOString() ?? null,
        refundable: el.ok,
        refundNote: el.ok
          ? `결제 후 ${REFUND_DAYS}일 이내 · 발행 전까지 환불할 수 있어요.`
          : r.o.status === 'paid'
            ? el.reason
            : '',
      }
    })
}
