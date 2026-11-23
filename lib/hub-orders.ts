import 'server-only'

import { inArray } from 'drizzle-orm'

import { EVENT_TYPE_LABELS } from '@/shared/blocks'
import { GROBLE_REFUND_URL_DEFAULT } from '@/shared/pricing'

import { getDb, schema } from './db/client'
import { hanpy } from './hanpy'
import { hubConfigured } from './plan'
import { limitedReason, refundDeadline, refundStatus } from './refund'

/** 그로블 주문조회(구매자가 환불을 신청하는 곳). 바뀌면 GROBLE_ORDERS_URL 환경변수로(GROBLE_ORDER_URL도 읽음) */
export const GROBLE_ORDER_URL =
  process.env.GROBLE_ORDERS_URL?.trim() ||
  process.env.GROBLE_ORDER_URL?.trim() ||
  GROBLE_REFUND_URL_DEFAULT

/** '11월 30일' (한국 날짜) */
function monthDay(d: Date): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  )
  return `${p.month}월 ${p.day}일`
}

export type HubOrderRow = {
  orderId: string
  invitationId: string | null
  invitationTitle: string
  orderName: string
  amount: number
  status: 'paid' | 'cancel_requested' | 'partially_refunded' | 'refunded'
  /** 누적 환불액(원). 환불이 없으면 0 */
  refundedAmount: number
  paidAt: string | null
  refundedAt: string | null
  refundable: boolean
  refundNote: string
}

/** 대시보드 결제 내역: 허브 주문(내 customerRef). 초대장 제목은 우리 DB에서 subject.id로 찾는다 */
export async function listHubOrders(userId: string): Promise<HubOrderRow[]> {
  if (!hubConfigured()) return []
  let orders
  try {
    orders = await hanpy.listOrders({ customerRef: userId, limit: 50 })
  } catch {
    return []
  }
  const shown = orders.filter((o) => ['paid', 'cancel_requested', 'partially_refunded', 'refunded'].includes(o.status))
  const ids = shown.flatMap((o) => (o.subject?.type === 'invitation' ? [o.subject.id] : []))
  const rows = ids.length
    ? await getDb()
        .select({
          id: schema.invitations.id,
          title: schema.invitations.title,
          eventType: schema.invitations.eventType,
          firstSharedAt: schema.invitations.firstSharedAt,
          firstGuestViewAt: schema.invitations.firstGuestViewAt,
        })
        .from(schema.invitations)
        .where(inArray(schema.invitations.id, ids))
    : []
  const byId = new Map(rows.map((r) => [r.id, r]))
  return shown.map((o) => {
    const inv = o.subject ? byId.get(o.subject.id) : undefined
    // 표시용 판단(실제 환불은 그로블에서). 지워진 초대장은 기록이 없어 판단하지 않는다
    const input = {
      orderStatus: o.status,
      paidAt: o.paidAt,
      firstSharedAt: inv?.firstSharedAt ?? null,
      firstGuestViewAt: inv?.firstGuestViewAt ?? null,
    }
    const full = Boolean(inv) && refundStatus(input) === 'full'
    const until = refundDeadline(o.paidAt)
    const reason = inv && o.status === 'paid' ? limitedReason(input) : null
    return {
      orderId: o.orderId,
      invitationId: o.subject?.id ?? null,
      invitationTitle: inv ? inv.title || EVENT_TYPE_LABELS[inv.eventType] : '(삭제된 초대장)',
      orderName: inv ? `dearday 프리미엄 (${EVENT_TYPE_LABELS[inv.eventType]})` : 'dearday 프리미엄',
      amount: o.amount,
      status: o.status as HubOrderRow['status'],
      paidAt: o.paidAt,
      refundedAt: o.refundedAt,
      refundedAmount: o.refundedAmount ?? 0,
      refundable: full,
      refundNote: full
        ? `전액 환불 가능 · ${until ? monthDay(until) : ''}까지(아직 공유 전)`
        : reason === 'expired'
          ? '결제 후 7일이 지나 환불이 제한돼요'
          : reason === 'shared'
            ? '공유 후라 환불이 제한돼요'
            : reason === 'viewed'
              ? '하객이 열어 본 뒤라 환불이 제한돼요'
              : '',
    }
  })
}
