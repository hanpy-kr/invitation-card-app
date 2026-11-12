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
}

export type Plan = 'free' | 'legacy' | 'premium'

const FREE: Entitlements = { photoLimit: 10, canHideMadeWith: false, introEffects: false }
const LEGACY: Entitlements = { photoLimit: 10, canHideMadeWith: false, introEffects: true }
const PREMIUM: Entitlements = { photoLimit: 60, canHideMadeWith: true, introEffects: true }

/** 로그인 없이 만들기 시작한 임시 사용자 (카카오로 로그인하면 원래 플랜) */
const ANONYMOUS_PHOTO_LIMIT = 3

/** 플랜 없이 부르면 무료 기준(랜딩 · 약관의 '사진 N장' 같은 고정 문구용) */
export function getEntitlements(opts?: { plan?: Plan; anonymous?: boolean }): Entitlements {
  const base = opts?.plan === 'premium' ? PREMIUM : opts?.plan === 'legacy' ? LEGACY : FREE
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
  premiumOrderId: string | null
  /** 결제된 결혼 · 돌에서 파생된 청첩장 모임 · 감사장 */
  derivedPremium: boolean
}): Plan {
  const now = input.now ?? new Date()
  if (!input.liveSince || now.getTime() < input.liveSince.getTime()) return 'premium'
  if (input.premiumOrderId || input.derivedPremium) return 'premium'
  if (new Date(input.createdAt).getTime() < input.liveSince.getTime()) return 'legacy'
  return 'free'
}

/**
 * 블록 스키마가 받아 주는 사진첩 최대 장수. 프리미엄 photoLimit과 같게 둘 것
 * (스키마 상한이 photoLimit보다 작으면 올린 사진을 저장하지 못함).
 */
export const PHOTO_LIMIT_CAP = 60
