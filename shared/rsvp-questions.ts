/**
 * 참석 질문 규칙 — zod 없이 (하객 화면 번들 · 서버 공용).
 * 하객 답은 `rsvps.answers`에 `{질문id: 값}`으로 저장한다. 연락처를 묻는 질문 예시는 두지 않는다.
 */
export type QuestionKind = 'text' | 'choice' | 'number'
export type QuestionTarget = 'attending' | 'absent' | 'all'

export type RsvpQuestion = {
  id: string
  kind: QuestionKind
  label: string
  options: string[]
  required: boolean
  target: QuestionTarget
}

export type AnswerValue = string | number
export type Answers = Record<string, AnswerValue>

export const QUESTION_LIMITS = { count: 5, options: 8, text: 100, numberMax: 999 } as const

export const QUESTION_KIND_LABELS: Record<QuestionKind, string> = {
  choice: '선택',
  text: '짧은 글',
  number: '숫자',
}

export const QUESTION_TARGET_LABELS: Record<QuestionTarget, string> = {
  attending: '참석자',
  absent: '불참자',
  all: '모두',
}

/** 표시할 질문: 제목이 있고(선택형은 보기도 있고) 대상이 맞는 것 */
export function visibleQuestions(questions: RsvpQuestion[], attending: boolean | null) {
  if (attending === null) return []
  return questions.filter(
    (q) =>
      q.label.trim() !== '' &&
      (q.kind !== 'choice' || q.options.some((o) => o.trim() !== '')) &&
      (q.target === 'all' || (q.target === 'attending') === attending),
  )
}

export const choiceOptions = (q: RsvpQuestion) => q.options.filter((o) => o.trim() !== '')

/** 답을 질문에 맞게 정리. 문제가 있으면 { error } */
export function cleanAnswers(
  questions: RsvpQuestion[],
  attending: boolean,
  raw: Record<string, unknown> | undefined,
): { answers: Answers } | { error: string } {
  const answers: Answers = {}
  for (const q of visibleQuestions(questions, attending)) {
    const v = raw?.[q.id]
    const empty = v === undefined || v === null || (typeof v === 'string' && v.trim() === '')
    if (empty) {
      if (q.required) return { error: `'${q.label}'에 답해 주세요.` }
      continue
    }
    if (q.kind === 'number') {
      const n = typeof v === 'number' ? v : Number(String(v).trim())
      if (!Number.isInteger(n) || n < 0 || n > QUESTION_LIMITS.numberMax)
        return { error: `'${q.label}'에는 0~${QUESTION_LIMITS.numberMax} 숫자를 적어 주세요.` }
      answers[q.id] = n
    } else if (q.kind === 'choice') {
      if (typeof v !== 'string' || !choiceOptions(q).includes(v))
        return { error: `'${q.label}'의 보기 중에서 골라 주세요.` }
      answers[q.id] = v
    } else {
      const t = String(v).trim()
      if (t.length > QUESTION_LIMITS.text)
        return { error: `'${q.label}' 답은 ${QUESTION_LIMITS.text}자까지예요.` }
      answers[q.id] = t
    }
  }
  return { answers }
}

/** 편집기에서 새 질문 id */
export function newQuestionId(): string {
  return Math.random().toString(36).slice(2, 10).padEnd(6, '0')
}
