import { MEETUP_EVENT_UNTIL } from './pricing'

/**
 * 가격 레버 — 기능 차이는 여기만 바꾼다(가격은 shared/pricing.ts). 기능마다 따로 잠그지 말 것.
 * 웹 · API · 편집기 공용이라 서버 전용 import를 두지 않는다.
 *
 * 플랜
 *  - premium: 결제된 초대장(또는 결제된 결혼 · 돌에서 파생된 청첩장 모임 · 감사장).
 *             PAYMENTS_LIVE가 꺼져 있으면(= 결제 시작 전) 모든 초대장이 premium과 같다.
 *  - legacy : 결제가 시작되기 전에 만든 초대장. 소급하지 않으므로 그때 쓰던 그대로(봉투 · 효과 · 사진 10장).
 *  - free   : 결제 시작 뒤에 만든 무료 초대장.
 */
export interface Entitlements {
  /** 초대장 하나에 올릴 수 있는 사진 수 (표지 + 사진첩 + 공유 카드) */
  photoLimit: number
  /** 하객 화면 맨 아래 'dearday로 만든 초대장' 문구를 주최자가 숨길 수 있음 (기본은 표시) */
  canHideMadeWith: boolean
  /** 표지 봉투 열기 · 떨어지는 효과. false면 설정이 있어도 하객 화면에 나오지 않음 */
  introEffects: boolean
  /** 결혼 표지 템플릿 1안 · 3안을 하객 화면에 보여 줌 (2안은 누구나). false면 2안으로 대체 표시 */
  coverTemplates: boolean
}

/**
 *  - event  : 모임 연말 이벤트(결제 없이 사진 60 · 봉투 · 효과, 하단 문구 숨기기는 불가). shared/pricing.ts MEETUP_EVENT_UNTIL까지.
 *  - legacy : 옛 값. 결제 시작 전에 만든 초대장은 이제 premium과 같게 열려 resolvePlan이 더는 주지 않는다.
 */
export type Plan = 'free' | 'legacy' | 'premium' | 'event'

const FREE: Entitlements = {
  photoLimit: 10,
  canHideMadeWith: false,
  introEffects: false,
  coverTemplates: false,
}
const EVENT: Entitlements = {
  photoLimit: 60,
  canHideMadeWith: false,
  introEffects: true,
  coverTemplates: false,
}
const PREMIUM: Entitlements = {
  photoLimit: 60,
  canHideMadeWith: true,
  introEffects: true,
  coverTemplates: true,
}

/** 결혼 표지 템플릿 중 무료로 쓸 수 있는 안 (나머지는 프리미엄). 잠금 규칙은 이 한 곳 */
export const FREE_COVER_TEMPLATE = 'b' as const

/** 이 이용권으로 template 표지를 쓸 수 있나. 못 쓰면 FREE_COVER_TEMPLATE으로 대체해 보여 준다 */
export function coverTemplateLocked(template: string, ent: Pick<Entitlements, 'coverTemplates'>): boolean {
  return template !== FREE_COVER_TEMPLATE && !ent.coverTemplates
}

/** 로그인 없이 만들기 시작한 임시 사용자 (카카오로 로그인하면 원래 플랜) */
const ANONYMOUS_PHOTO_LIMIT = 3

/** 플랜 없이 부르면 무료 기준(랜딩 · 약관의 '사진 N장' 같은 고정 문구용) */
export function getEntitlements(opts?: { plan?: Plan; anonymous?: boolean }): Entitlements {
  const base =
    opts?.plan === 'premium' || opts?.plan === 'legacy'
      ? PREMIUM
      : opts?.plan === 'event'
        ? EVENT
        : FREE
  return opts?.anonymous ? { ...base, photoLimit: ANONYMOUS_PHOTO_LIMIT } : base
}

export const PLAN_FEATURES = { free: FREE, premium: PREMIUM } as const

/**
 * 초대장의 플랜 결정 (순수 함수).
 * liveSince: PAYMENTS_LIVE가 켜진 시각(null이면 결제 시작 전).
 */
export function resolvePlan(input: {
  liveSince: Date | null
  now?: Date
  createdAt: Date | string
  /** 허브 이용권 캐시 (invitations.premium_hub) */
  premiumHub: boolean
  /** 옛 자체 결제로 받은 프리미엄 (전환기 안전장치. 운영 paid 0건이면 정리 때 지움) */
  premiumOrderId: string | null
  /** 허브 이용권이 있는 결혼 · 돌에서 파생된 청첩장 모임 · 감사장 */
  derivedPremium: boolean
  /** 모임(결혼 · 돌 · 감사장 아닌 행사)인가 — 연말 이벤트 판단 */
  isMeetup: boolean
}): Plan {
  const now = input.now ?? new Date()
  // 1. 결제 꺼짐 → 모두 프리미엄
  if (!input.liveSince || now.getTime() < input.liveSince.getTime()) return 'premium'
  // 2~4. 허브 이용권 · 파생 · 옛 결제
  if (input.premiumHub || input.derivedPremium || input.premiumOrderId) return 'premium'
  const created = new Date(input.createdAt).getTime()
  // 5. 결제 시작 전에 만든 초대장은 소급하지 않고 premium
  if (created < input.liveSince.getTime()) return 'premium'
  // 6. 모임 연말 이벤트 (하단 문구 숨기기 제외)
  if (input.isMeetup && created <= MEETUP_EVENT_UNTIL.getTime()) return 'event'
  return 'free'
}

/**
 * 블록 스키마가 받아 주는 사진첩 최대 장수. 프리미엄 photoLimit과 같게 둘 것
 * (스키마 상한이 photoLimit보다 작으면 올린 사진을 저장하지 못함).
 */
export const PHOTO_LIMIT_CAP = 60
