/**
 * 사업자 정보 (푸터 · 약관). ⏸ 표시는 사용자에게 받을 값 — 받기 전에는 화면에 '등록 예정'으로 보임
 */
export const BUSINESS = {
  serviceName: 'dearday',
  tradeName: '한피',
  /** ⏸ 대표자명 */
  representative: '',
  /** ⏸ 사업자등록번호 */
  registrationNumber: '',
  /** ⏸ 연락처 이메일 (개인정보 보호책임자 연락처로도 씀) */
  email: '',
  effectiveDate: '2026년 11월 2일',
} as const

export const pending = (value: string) => value || '등록 예정'
