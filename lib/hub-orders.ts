import 'server-only'

import { inArray } from 'drizzle-orm'

import { EVENT_TYPE_LABELS } from '@/shared/blocks'
import { refundEligibility, REFUND_DAYS } from '@/shared/pricing'

import { getDb, schema } from './db/client'
import { hanpy } from './hanpy'
import { hubConfigured } from './plan'

/** 그로블 주문조회(구매자가 환불을 신청하는 곳). 바뀌면 GROBLE_ORDER_URL 환경변수로 */
export const GROBLE_ORDER_URL = process.env.GROBLE_ORDER_URL?.trim() || 'https://www.groble.im'

export type HubOrderRow = {
  orderId: string
  invitationId: string | null
  invitationTitle: string
  orderName: string
  amount: number
  status: 'paid' | 'cancel_requested' | 'refunded'
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
  const shown = orders.filter((o) => ['paid', 'cancel_requested', 'refunded'].includes(o.status))
  const ids = shown.flatMap((o) => (o.subject?.type === 'invitation' ? [o.subject.id] : []))
  const rows = ids.length
    ? await getDb()
        .select({
          id: schema.invitations.id,
          title: schema.invitations.title,
          eventType: schema.invitations.eventType,
          publishedAt: schema.invitations.publishedAt,
        })
        .from(schema.invitations)
        .where(inArray(schema.invitations.id, ids))
    : []
  const byId = new Map(rows.map((r) => [r.id, r]))
  return shown.map((o) => {
    const inv = o.subject ? byId.get(o.subject.id) : undefined
    const el = refundEligibility({
      status: o.status,
      approvedAt: o.paidAt,
      invitationPublishedAt: inv?.publishedAt ?? null,
    })
    return {
      orderId: o.orderId,
      invitationId: o.subject?.id ?? null,
      invitationTitle: inv ? inv.title || EVENT_TYPE_LABELS[inv.eventType] : '(삭제된 초대장)',
      orderName: inv ? `dearday 프리미엄 (${EVENT_TYPE_LABELS[inv.eventType]})` : 'dearday 프리미엄',
      amount: o.amount,
      status: o.status as HubOrderRow['status'],
      paidAt: o.paidAt,
      refundedAt: o.refundedAt,
      refundable: el.ok,
      refundNote: el.ok
        ? `결제 후 ${REFUND_DAYS}일 이내 · 발행 전이라 전액 환불돼요.`
        : o.status === 'paid'
          ? el.reason
          : '',
    }
  })
}
