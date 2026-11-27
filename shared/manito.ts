import type { RsvpQuestion } from './rsvp-questions'

/** 마니또 기능 스위치: 서버 환경변수 MANITO_ENABLED가 '0'이면 전부 꺼짐(기본 켜짐). 아래 판단은 서버에서만 호출 */
export const MANITO_MIN_PEOPLE = 3

export const GIFT_QUESTION_ID = 'gift01'
export const GIFT_YES = '참여'
export const GIFT_NO = '이번엔 빠질게요'

/** 선물 교환 질문: 템플릿이 넣은 id 또는 '선물 교환'이 들어간 선택형 질문 */
export function findGiftQuestion(questions: RsvpQuestion[]): RsvpQuestion | null {
  return (
    questions.find(
      (q) =>
        q.kind === 'choice' && (q.id === GIFT_QUESTION_ID || /선물\s*교환/.test(q.label)),
    ) ?? null
  )
}

/** 이 응답이 마니또 대상인가. 질문이 없으면 참석자 모두, 있으면 '참여'로 시작하는 답만 */
export function joinsGift(
  giftQuestion: RsvpQuestion | null,
  r: { attending: boolean; answers: unknown },
): boolean {
  if (!r.attending) return false
  if (!giftQuestion) return true
  const v = (r.answers as Record<string, unknown> | null)?.[giftQuestion.id]
  return typeof v === 'string' && v.startsWith(GIFT_YES)
}

/**
 * 한 바퀴 짝 뽑기: 무작위로 섞은 순서대로 다음 사람에게 선물 (자기 자신 · 서로 맞교환 없음, 3명 이상).
 * rand는 [0,1) 난수 (서버에서 crypto 기반을 넘김)
 */
export function drawCycle<T>(ids: T[], rand: () => number): [T, T][] {
  if (ids.length < MANITO_MIN_PEOPLE) throw new Error('3명 이상이어야 뽑을 수 있어요.')
  const a = [...ids]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.map((g, i) => [g, a[(i + 1) % a.length]])
}

/** 뽑은 뒤 바뀐 응답 수: 지금 대상 집합과 짝에 들어 있는 집합의 차이 */
export function changedCount(current: string[], paired: string[]): number {
  const c = new Set(current)
  const p = new Set(paired)
  let n = 0
  for (const id of c) if (!p.has(id)) n++
  for (const id of p) if (!c.has(id)) n++
  return n
}
