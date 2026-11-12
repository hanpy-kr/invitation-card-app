/**
 * 가격 · 환불 규정 — 가격을 바꿀 때는 여기만 고친다 (기능 차이는 shared/entitlements.ts).
 * 결제 금액은 항상 서버가 이 표로 계산한다(클라이언트가 보낸 금액은 믿지 않음).
 * dearday는 이 이용료만 받는다. 축의금 · 회비는 하객 ↔ 주최자가 직접 주고받는다.
 */
import { EVENT_TYPE_LABELS, type EventType } from './blocks'

/** 초대장 1개당 1회, 부가세 포함, 원 */
export const PRICE_KRW: Record<EventType, number> = {
  wedding: 14900,
  dol: 14900,
  thanks: 14900,
  meetup: 3900,
  etc: 3900,
  yearend: 3900,
  prewedding: 3900,
  birthday: 3900,
  housewarming: 3900,
}

export function priceFor(eventType: EventType): number {
  return PRICE_KRW[eventType]
}

export const formatWon = (n: number): string => `${n.toLocaleString('ko-KR')}원`

/** 이 행사의 프리미엄이 결제되면 추가 결제 없이 같이 적용되는 파생 초대장(복제 · 청첩장 모임 · 감사장) */
export const PREMIUM_PARENT_EVENTS: readonly EventType[] = ['wedding', 'dol']
export const PREMIUM_DERIVED_EVENTS: readonly EventType[] = ['prewedding', 'thanks']

/** 환불: 결제 후 이 일수 이내이고 아직 발행하지 않았을 때 전액 */
export const REFUND_DAYS = 7

export const REFUND_NOTICE =
  `결제 후 ${REFUND_DAYS}일 이내이고 아직 초대장을 발행하지 않았다면 전액 환불돼요. ` +
  '발행한 뒤에는 서비스 제공이 시작된 것으로 보아 환불되지 않아요.'

export function orderNameFor(eventType: EventType): string {
  return `dearday 프리미엄 (${EVENT_TYPE_LABELS[eventType]})`
}

/** 환불 가능 판단 (서버 · 화면 공용) */
export function refundEligibility(input: {
  status: string
  approvedAt: Date | string | null
  invitationPublishedAt: Date | string | null
  now?: Date
}): { ok: true } | { ok: false; reason: string } {
  if (input.status !== 'paid' || !input.approvedAt) return { ok: false, reason: '결제 완료 상태가 아니에요.' }
  if (input.invitationPublishedAt)
    return { ok: false, reason: '초대장을 발행한 뒤에는 환불할 수 없어요.' }
  const now = (input.now ?? new Date()).getTime()
  const approved = new Date(input.approvedAt).getTime()
  if (now - approved > REFUND_DAYS * 24 * 60 * 60 * 1000)
    return { ok: false, reason: `결제 후 ${REFUND_DAYS}일이 지나 환불할 수 없어요.` }
  return { ok: true }
}

/** 토스 주문번호: 6~64자, 영문 · 숫자 · - · _ */
export const ORDER_ID_RE = /^[A-Za-z0-9_-]{6,64}$/
