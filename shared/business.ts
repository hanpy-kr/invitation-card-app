/** 사업자 정보 (푸터 · 이용약관 · 개인정보처리방침). 한 곳에서만 고친다 */
export const BUSINESS = {
  serviceName: 'dearday',
  tradeName: '한피',
  representative: '강창현',
  registrationNumber: '207-39-62795',
  /** 문의 · 개인정보 보호책임자 연락처 */
  email: 'hanpy.kang@gmail.com',
  effectiveDate: '2026년 11월 2일',
} as const

/** 값이 비어 있으면 '등록 예정'으로 보여 준다 */
export const pending = (value: string) => value || '등록 예정'
