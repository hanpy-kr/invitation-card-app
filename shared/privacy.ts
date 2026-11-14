/**
 * 개인정보처리방침 판 관리. 방침이 바뀔 때는 같은 방식으로:
 *  1) 새 본문을 app/privacy/_bodies/Privacy<시행일>.tsx 로 만든다 (시행된 판은 고치지 않음)
 *  2) 아래 PRIVACY_NEXT 를 새 판 정보로 바꾸고, 지금까지 시행된 판을 PRIVACY_PAST 에 보탠다
 *  3) 시행 7일 전(방침 8항)까지 배포한다. 시행일 0시(한국 시간)가 지나면 새 판이 자동으로 /privacy 가 된다
 *  4) /privacy/next 는 개정안, /privacy/v{n} 은 지난 판
 */
export const PRIVACY_NEXT = {
  /** 한국 시간 0시부터 시행 */
  effectiveAt: '2026-11-15T00:00:00+09:00',
  label: '2026년 11월 15일',
  short: '11/15',
  /** /privacy 맨 위 안내에 보여 줄 바뀌는 점 (3줄) */
  changes: [
    '하객 앨범에 올린 사진(과 지울 때 쓰는 확인용 값)을 받는 항목을 추가했어요.',
    '영상 블록의 썸네일 · 재생기를 위해 Google(YouTube)에 맡기는 항목을 추가했어요.',
    '새 응답 카톡 알림을 켠 회원의 카카오톡 메시지 전송용 접속 정보(암호화 저장) 항목을 추가했어요.',
  ],
} as const

/** 현재 방침 (PRIVACY_NEXT 시행 전까지) */
export const PRIVACY_CURRENT = { label: '2026년 11월 7일', iso: '2026-11-07' } as const

export function isNextInEffect(now: Date = new Date()): boolean {
  return now.getTime() >= new Date(PRIVACY_NEXT.effectiveAt).getTime()
}

/**
 * 결제(프리미엄) 개정안 — 개인정보처리방침에 '결제 정보 보관'과 '토스페이먼츠 위탁'을 추가한 판.
 * 시행일은 정해지지 않았다(⏸ 사용자). 정해지면: 위 PRIVACY_NEXT 처럼 이 판의 본문(app/privacy/_bodies/PrivacyPaid.tsx)을
 * 새 시행일 이름의 파일로 옮기고 PRIVACY_NEXT 를 바꿔, 시행 7일 전(방침 8항)까지 배포한다.
 */
export const PRIVACY_PAID = {
  changes: [
    '이용료를 결제한 회원의 주문번호 · 결제 금액 · 결제 시각 등 결제 기록을 5년간 보관하는 항목을 추가했어요.',
    '결제 처리를 맡기는 그로블(통신판매중개) · 결제대행사와 토스페이먼츠(대한민국)를 위탁 목록에 추가했어요. 카드번호와 구매자 정보는 회사가 받지 않아요.',
  ],
} as const
