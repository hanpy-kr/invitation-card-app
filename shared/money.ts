/**
 * 계좌 블록 도우미 (순수 함수, 클라이언트 번들에 들어감 — zod 쓰지 말 것).
 * dearday는 돈을 받거나 보관하지 않는다. 송금 앱으로 연결만 한다.
 */

/** 편집기 은행 이름 추천 목록 (토스가 알아듣는 짧은 이름 위주) */
export const BANK_NAMES = [
  'KB국민',
  '신한',
  '우리',
  '하나',
  'NH농협',
  'IBK기업',
  '카카오뱅크',
  '토스뱅크',
  '케이뱅크',
  'SC제일',
  '새마을금고',
  '우체국',
  '신협',
  '수협',
  '부산',
  '경남',
  '광주',
  '전북',
  '제주',
  'iM뱅크(대구)',
  '씨티',
] as const

export const KAKAOPAY_PREFIX = 'https://qr.kakaopay.com/'

export function isKakaoPayUrl(url: string): boolean {
  return url.startsWith(KAKAOPAY_PREFIX) && url.length > KAKAOPAY_PREFIX.length
}

export function digitsOnly(text: string): string {
  return text.replace(/\D/g, '')
}

/**
 * 토스 송금 화면 딥링크. 앱이 있으면 받는 계좌(+금액)가 채워진 송금 화면이 열린다.
 * 앱이 없거나 PC면 아무 일도 안 일어나거나 오류가 뜨므로, 버튼을 누를 때 계좌번호를 먼저 복사해 둔다.
 */
export function tossSendUrl(bank: string, accountNo: string, amount?: number | null): string {
  const q = new URLSearchParams()
  if (amount && amount > 0) q.set('amount', String(amount))
  q.set('bank', bank.replace(/\(.*\)$/, ''))
  q.set('accountNo', digitsOnly(accountNo))
  q.set('origin', 'qr')
  return `supertoss://send?${q.toString()}`
}

export function formatWon(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`
}

/** 송금 앱 버튼을 보여 줄 환경(휴대폰)인지 */
export function isMobileUA(ua: string): boolean {
  return /iPhone|iPad|iPod|Android/i.test(ua)
}
