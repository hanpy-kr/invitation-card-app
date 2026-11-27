/**
 * 크리스마스 시즌 상수 (날짜 하나로 화면이 자동 전환 — 12/26에 배포하지 않음).
 * 시각은 한국 시간(KST) 명시. 판단 함수는 now를 받아 테스트(e2e)에서 날짜를 바꿔 볼 수 있다.
 */
export const CHRISTMAS_HOME_FROM = '2026-12-01T00:00:00+09:00'
/** 이 시각까지 /new 목록 · 홈 띠에 보임 (12/25 23:59:59 KST) */
export const CHRISTMAS_SEASON_END = '2026-12-25T23:59:59+09:00'
/** 홈 시즌 카드의 [예시 보기] 슬러그 — 가상 이름으로 발행한 예시 초대장 (⏸ 사용자 발행 후 채움). null이면 버튼 없음 */
export const CHRISTMAS_EXAMPLE_SLUG: string | null = null

const ms = (iso: string) => new Date(iso).getTime()

/** /new 목록에 크리스마스 파티를 보일 기간: 출시 ~ 12/25 KST */
export function isChristmasSeason(now: Date = new Date()): boolean {
  return now.getTime() <= ms(CHRISTMAS_SEASON_END)
}

/** 홈 시즌 띠 · 카드: 12/1 ~ 12/25 KST */
export function isChristmasHome(now: Date = new Date()): boolean {
  const t = now.getTime()
  return t >= ms(CHRISTMAS_HOME_FROM) && t <= ms(CHRISTMAS_SEASON_END)
}

/** 시즌 판단용 '지금'. e2e에서만 SEASON_NOW(ISO)로 바꿀 수 있고, 운영에서는 비워 둔다 */
export function seasonNow(): Date {
  const o = process.env.SEASON_NOW
  return o ? new Date(o) : new Date()
}

/** 하객 화면 '이 디자인으로 나도 만들기' 아래 한 줄 (크리스마스 초대장만). 12/26부터 자동으로 신년회 문구로 */
export function makeOwnNote(eventType: string, now: Date = new Date()): string | null {
  if (eventType !== 'christmas') return null
  return isChristmasSeason(now)
    ? '우리 모임도 크리스마스 파티 열기'
    : '신년회 초대장도 무료로 만들어 보세요'
}
