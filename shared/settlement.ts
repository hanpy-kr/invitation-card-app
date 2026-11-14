/**
 * 회비 정산 마무리 계산 (대시보드 · 서버 공용, zod 없이).
 * dearday는 돈을 받거나 보내지 않는다 — 여기는 계산과 안내 문구만.
 */
import { formatWon } from './money'

export const MAX_EXPENSES = 20
export const MAX_EXPENSE_AMOUNT = 100_000_000

export type Expense = { name: string; amount: number }

export type Settlement = {
  /** 걷은 회비 = 입금 체크한 인원 × 1인 회비 */
  collected: number
  spent: number
  /** collected - spent (모자라면 음수) */
  remaining: number
  /** 남았을 때: 입금한 사람 1인당 돌려줄 금액(원 미만 버림, 남는 푼돈은 총무에게) */
  refundEach: number
  /** 모자랄 때: 참석 인원 1인당 더 낼 금액(원 올림) */
  extraEach: number
  paidPeople: number
  attendees: number
}

export function computeSettlement(input: {
  perPerson: number
  paidPeople: number
  attendees: number
  expenses: Expense[]
}): Settlement {
  const collected = input.paidPeople * input.perPerson
  const spent = input.expenses.reduce((n, e) => n + Math.max(0, Math.floor(e.amount) || 0), 0)
  const remaining = collected - spent
  return {
    collected,
    spent,
    remaining,
    refundEach:
      remaining > 0 && input.paidPeople > 0 ? Math.floor(remaining / input.paidPeople) : 0,
    extraEach: remaining < 0 && input.attendees > 0 ? Math.ceil(-remaining / input.attendees) : 0,
    paidPeople: input.paidPeople,
    attendees: input.attendees,
  }
}

/** 정산 내역 문구 (단톡방 복사 · 하객 화면 안내 공용). 계좌번호 · 개인 이름은 넣지 않는다 */
export function settlementText(input: {
  title: string
  perPerson: number
  expenses: Expense[]
  result: Settlement
}): string {
  const { result: r } = input
  const used = input.expenses.filter((e) => e.name.trim() && e.amount > 0)
  const lines = [
    `[${input.title || '모임'}] 정산 내역`,
    `걷은 회비 ${formatWon(r.collected)} (입금 ${r.paidPeople}명 × ${formatWon(input.perPerson)})`,
    `쓴 돈 ${formatWon(r.spent)}`,
    ...used.map((e) => `- ${e.name.trim()} ${formatWon(e.amount)}`),
  ]
  if (r.remaining > 0) {
    lines.push(
      `남은 돈 ${formatWon(r.remaining)} → 입금하신 ${r.paidPeople}명께 1인당 ${formatWon(r.refundEach)}씩 돌려드릴게요.`,
    )
  } else if (r.remaining < 0) {
    lines.push(
      `부족한 돈 ${formatWon(-r.remaining)} → 참석하신 ${r.attendees}명이 1인당 ${formatWon(r.extraEach)}씩 더 내 주세요.`,
    )
  } else {
    lines.push('남은 돈 없이 딱 맞게 썼어요!')
  }
  return lines.join('\n')
}
