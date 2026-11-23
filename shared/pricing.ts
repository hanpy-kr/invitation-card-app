/**
 * 가격 · 환불 규정 · SKU 매핑.
 * 가격 숫자는 여기에 없다 — 결제 금액은 허브가 정하고, 화면 가격은 서버가 허브 listProducts()에서 읽는다(lib/prices.ts).
 * 이 파일은 "어떤 행사에 어떤 SKU를 파는가"와 결제 없이 열리는 규칙의 날짜만 가진다.
 * dearday는 이 이용료만 받는다. 축의금 · 회비는 하객 ↔ 주최자가 직접 주고받는다.
 */
import { type EventType } from './blocks'

/**
 * 결혼 · 돌 · 감사장 SKU. 지금은 오픈 특가. 결혼 표지 템플릿(1안 · 3안)이 나오면
 * 이 한 줄만 'invitation.premium.family'(14,900)로 바꾼다. 이미 산 이용권은 그대로다.
 */
export const FAMILY_SKU = 'invitation.premium.family.open'
export const FAMILY_SKU_REGULAR = 'invitation.premium.family'
export const MEETUP_SKU = 'invitation.premium.meetup'

/** 결혼 · 돌 · 감사장 = 가족 행사 SKU. 나머지는 모임 */
export const FAMILY_EVENTS: readonly EventType[] = ['wedding', 'dol', 'thanks']

export const isFamilyEvent = (eventType: EventType): boolean => FAMILY_EVENTS.includes(eventType)

/** 서버가 행사 종류로 SKU를 정한다(브라우저가 보낸 값은 쓰지 않음) */
export function skuFor(eventType: EventType): string {
  return isFamilyEvent(eventType) ? FAMILY_SKU : MEETUP_SKU
}

/** 오픈 특가 표기(취소선 없이 — 판 적 없는 가격을 원래 가격처럼 보이지 않게) */
export const FAMILY_OPEN_NOTE = '오픈 특가 (결혼 표지 템플릿 출시 전까지)'

/**
 * 모임 연말 이벤트: 이 시각까지 만든 모임 초대장은 결제 없이 사진 60장 · 봉투 · 효과.
 * 하단 문구 숨기기는 제외. 결제 기록이 아니라 이 명시 규칙으로만 열린다(허브 규칙 0-7).
 */
/**
 * 결제를 여는 고정 시각(KST 명시 ISO). null이면 아직 결제 시작 전 → 모든 초대장이 premium.
 * 이 시각 전에 만든 초대장은 premium(오픈 전 생성)으로 영구 유지된다.
 * 결제를 여는 날 값을 정해 같은 배포로 넣는다. 환경변수 PAYMENTS_LIVE(결제 버튼 · 화면 스위치)와는 별개라
 * 스위치를 잠깐 꺼도 플랜 판단은 바뀌지 않는다.
 */
export const PAYMENTS_LIVE_AT: string | null = null

export const MEETUP_EVENT_UNTIL = new Date('2027-01-31T23:59:59+09:00')

export const formatWon = (n: number): string => `${n.toLocaleString('ko-KR')}원`

/** 이 행사의 프리미엄이 결제되면 추가 결제 없이 같이 적용되는 파생 초대장(청첩장 모임 · 감사장) */
export const PREMIUM_PARENT_EVENTS: readonly EventType[] = ['wedding', 'dol']
export const PREMIUM_DERIVED_EVENTS: readonly EventType[] = ['prewedding', 'thanks']

/** 환불 안내 기준: 결제 후 이 일수 이내이고 아직 공유하지 않았을 때 전액 (판단은 lib/refund.ts) */
export const REFUND_DAYS = 7

/** 환불 규칙 안내 — 결제 버튼 근처 · /pay · 가격 페이지 · 결제 완료 모달 · 삭제 확인은 모두 이 상수 하나를 쓴다 */
export const REFUND_NOTICE =
  `결제 후 ${REFUND_DAYS}일 이내이고 아직 공유하지 않았다면 전액 환불돼요. 링크를 공유하거나 하객이 열어 본 뒤에는 환불이 제한돼요.`

/** 그로블 환불 안내 링크 기본값 (환경변수 GROBLE_ORDERS_URL로 바꿈) */
export const GROBLE_REFUND_URL_DEFAULT = 'https://www.groble.im/legal/refund'

/** 환불 신청 방법 안내 — '그로블 주문조회'가 나오는 모든 화면은 이 문구 하나를 쓴다 */
export const GROBLE_REFUND_GUIDE =
  '환불은 그로블에서 신청해 주세요. 회원은 로그인 후 구매내역, 비회원은 결제한 휴대폰 번호 인증 후 주문조회에서 신청할 수 있어요. 어려우면 groble@groble.im 으로 주문번호와 함께 문의해 주세요.'
export const GROBLE_REFUND_LINK_LABEL = '그로블 환불 안내 보기'

/** 환불 가능 안내 판단 (서버 · 화면 공용). 실제 환불 신청은 그로블 주문조회에서 */
export function refundEligibility(input: {
  status: string
  approvedAt: Date | string | null
  invitationPublishedAt: Date | string | null
  now?: Date
}): { ok: true } | { ok: false; reason: string } {
  if (input.status !== 'paid' || !input.approvedAt)
    return { ok: false, reason: '결제 완료 상태가 아니에요.' }
  if (input.invitationPublishedAt)
    return { ok: false, reason: '초대장을 발행한 뒤에는 그로블 환불 규정을 따라요.' }
  const now = (input.now ?? new Date()).getTime()
  const approved = new Date(input.approvedAt).getTime()
  if (now - approved > REFUND_DAYS * 24 * 60 * 60 * 1000)
    return { ok: false, reason: `결제 후 ${REFUND_DAYS}일이 지나 그로블 환불 규정을 따라요.` }
  return { ok: true }
}
