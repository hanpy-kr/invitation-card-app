/** 환불 판단 (표시용). 실제 환불은 그로블에서 신청 → 대표가 처리 → 허브 알림으로만 반영된다. 서버 · 화면 공용(순수 함수) */
import { REFUND_DAYS } from '@/shared/pricing'

export type RefundStatus = 'full' | 'limited'

const DAY = 24 * 60 * 60 * 1000

export type RefundInput = {
  /** 허브 주문 결제 시각 */
  paidAt: Date | string | null
  /** 허브 주문 상태. 'paid'가 아니면 환불 판단 대상이 아님 */
  orderStatus?: string
  firstSharedAt: Date | string | null
  firstGuestViewAt: Date | string | null
  now?: Date
}

/** 전액 환불 마감 시각 (결제 + 7일). 결제 시각이 없으면 null */
export function refundDeadline(paidAt: Date | string | null): Date | null {
  return paidAt ? new Date(new Date(paidAt).getTime() + REFUND_DAYS * DAY) : null
}

/** full = 결제 후 7일 이내 && 아직 공유 전(first_shared_at 없음) && 주인 아닌 사람의 열람 없음(first_guest_view_at 없음) */
export function refundStatus(input: RefundInput): RefundStatus {
  if ((input.orderStatus ?? 'paid') !== 'paid') return 'limited'
  const deadline = refundDeadline(input.paidAt)
  if (!deadline) return 'limited'
  if ((input.now ?? new Date()).getTime() > deadline.getTime()) return 'limited'
  if (input.firstSharedAt || input.firstGuestViewAt) return 'limited'
  return 'full'
}

/** 제한인 이유 한 가지 (결제 내역 문구용). 우선순위: 기간 → 공유 → 열람 */
export function limitedReason(input: RefundInput): 'expired' | 'shared' | 'viewed' | null {
  if (refundStatus(input) === 'full') return null
  const deadline = refundDeadline(input.paidAt)
  if (deadline && (input.now ?? new Date()).getTime() > deadline.getTime()) return 'expired'
  if (input.firstSharedAt) return 'shared'
  return 'viewed'
}
