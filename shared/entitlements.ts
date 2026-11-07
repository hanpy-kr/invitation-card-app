/**
 * 가격 레버 — 유료 범위가 정해지면 여기만 바꾼다. 기능마다 따로 잠그지 말 것.
 * 지금은 결제가 없어 모든 초대장이 같은 값(무료)을 쓴다.
 * 웹 · API · 편집기 공용이라 서버 전용 import를 두지 않는다.
 */
export interface Entitlements {
  /** 초대장 하나에 올릴 수 있는 사진 수 (표지 + 사진첩 + 공유 카드) */
  photoLimit: number
  /** 하객 화면 맨 아래 'dearday로 만든 초대장' 문구 · 나도 만들기 카드 표시 */
  showMadeWith: boolean
}

const FREE: Entitlements = { photoLimit: 10, showMadeWith: true }

/** 로그인 없이 만들기 시작한 임시 사용자 (카카오로 로그인하면 FREE) */
const ANONYMOUS: Entitlements = { ...FREE, photoLimit: 3 }

/** 나중에 초대장별 플랜을 받게 되면 인자를 추가한다 */
export function getEntitlements(owner?: { anonymous?: boolean }): Entitlements {
  return owner?.anonymous ? ANONYMOUS : FREE
}

/**
 * 블록 스키마가 받아 주는 사진첩 최대 장수. 유료로 photoLimit을 올릴 때 같이 올릴 것
 * (스키마 상한이 photoLimit보다 작으면 올린 사진을 저장하지 못함).
 */
export const PHOTO_LIMIT_CAP = 10
