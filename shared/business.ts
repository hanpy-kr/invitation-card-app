/** 사업자 정보 (푸터 · 이용약관 · 개인정보처리방침). 한 곳에서만 고친다 */
export const BUSINESS = {
  serviceName: 'dearday',
  tradeName: '한피',
  representative: '강창현',
  registrationNumber: '207-39-62795',
  /** 통신판매업 신고번호 (⏸ 사용자: 신고 후 입력. 비어 있으면 푸터에 '등록 예정'으로 보임) */
  mailOrderNumber: '',
  /** 문의 · 개인정보 보호책임자 연락처 */
  email: 'hanpy.kang@gmail.com',
  /** 이용약관 시행일 */
  effectiveDate: '2026년 11월 2일',
  /** 개인정보처리방침 시행일은 shared/privacy.ts 에서 판별로 관리 */
} as const

/** 값이 비어 있으면 '등록 예정'으로 보여 준다 */
export const pending = (value: string) => value || '등록 예정'
