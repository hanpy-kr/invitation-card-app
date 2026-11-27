/**
 * 옛 자체 결제(토스 · 그로블 직접 연결) 전용 — 허브 전환 뒤 정리할 코드(PLAN.md '옛 결제 코드 정리')만 쓴다.
 * 새 코드는 shared/pricing.ts(SKU 매핑)와 허브 listProducts 가격을 쓴다.
 */
import { EVENT_TYPE_LABELS, type EventType } from './blocks'

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
  christmas: 3900,
}

export const priceFor = (eventType: EventType): number => PRICE_KRW[eventType]

export function orderNameFor(eventType: EventType): string {
  return `dearday 프리미엄 (${EVENT_TYPE_LABELS[eventType]})`
}

/** 토스 주문번호: 6~64자, 영문 · 숫자 · - · _ */
export const ORDER_ID_RE = /^[A-Za-z0-9_-]{6,64}$/
