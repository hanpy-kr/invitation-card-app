'use client'

import { useMemo, useState } from 'react'

import { copyText } from '@/components/blocks/common/CopyButton'
import { api } from '@/components/ui/api'
import { formatWon } from '@/shared/money'
import {
  computeSettlement,
  MAX_EXPENSE_AMOUNT,
  MAX_EXPENSES,
  settlementText,
  type Expense,
} from '@/shared/settlement'

import styles from './page.module.scss'

/**
 * 회비 정산 마무리 — 행사 뒤 쓴 돈을 넣으면 걷은 회비(입금 체크 기준)에서 빼서 남은 돈 / 더 낼 돈을 계산한다.
 * dearday는 돈을 받거나 보내지 않는다. 계산과 단톡방용 문구만 준다.
 */
export default function SettlementPanel({
  invitationId,
  title,
  perPerson,
  paidPeople,
  attendees,
  initialExpenses,
  initialShow,
}: {
  invitationId: string
  title: string
  perPerson: number
  paidPeople: number
  attendees: number
  initialExpenses: Expense[]
  initialShow: boolean
}) {
  const [items, setItems] = useState<Expense[]>(
    initialExpenses.length > 0 ? initialExpenses : [{ name: '', amount: 0 }],
  )
  const [show, setShow] = useState(initialShow)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const result = useMemo(
    () => computeSettlement({ perPerson, paidPeople, attendees, expenses: items }),
    [perPerson, paidPeople, attendees, items],
  )
  const text = settlementText({ title, perPerson, expenses: items, result })

  const set = (i: number, patch: Partial<Expense>) =>
    setItems((xs) => xs.map((x, k) => (k === i ? { ...x, ...patch } : x)))

  async function save(nextShow = show) {
    setBusy(true)
    setMsg('')
    const prev = show
    setShow(nextShow)
    try {
      await api(`/api/invitations/${invitationId}/settlement`, {
        method: 'PUT',
        body: { items: items.filter((e) => e.name.trim() || e.amount > 0), showGuests: nextShow },
      })
      setMsg(
        nextShow
          ? '저장했어요. 하객 화면에도 정산 내역이 보여요. (입금 체크를 바꾸면 다시 저장해야 반영돼요)'
          : '저장했어요.',
      )
    } catch (err) {
      setShow(prev)
      setMsg((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={styles.section} aria-label="회비 정산">
      <h2>회비 정산 마무리</h2>
      <p className={styles.hint}>
        행사 뒤 쓴 돈을 적으면 걷은 회비(입금 체크한 인원 기준)와 비교해 줘요. dearday는 돈을 받거나
        보내지 않고 계산만 도와요.
      </p>

      <ul className={styles.expenses}>
        {items.map((e, i) => (
          <li key={i}>
            <input
              aria-label={`지출 ${i + 1} 항목`}
              value={e.name}
              maxLength={30}
              placeholder="예) 식비"
              onChange={(ev) => set(i, { name: ev.target.value })}
            />
            <input
              aria-label={`지출 ${i + 1} 금액`}
              inputMode="numeric"
              value={e.amount ? e.amount.toLocaleString('ko-KR') : ''}
              placeholder="금액"
              onChange={(ev) =>
                set(i, {
                  amount: Math.min(
                    MAX_EXPENSE_AMOUNT,
                    Number(ev.target.value.replace(/\D/g, '')) || 0,
                  ),
                })
              }
            />
            <button
              type="button"
              aria-label={`지출 ${i + 1} 지우기`}
              onClick={() => setItems((xs) => xs.filter((_, k) => k !== i))}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      {items.length < MAX_EXPENSES ? (
        <button
          type="button"
          className={styles.add}
          onClick={() => setItems((xs) => [...xs, { name: '', amount: 0 }])}
        >
          + 지출 추가
        </button>
      ) : null}

      <dl className={styles.calc}>
        <div>
          <dt>걷은 회비</dt>
          <dd>
            {formatWon(result.collected)}
            <small>
              {' '}
              입금 {paidPeople}명 × {formatWon(perPerson)}
            </small>
          </dd>
        </div>
        <div>
          <dt>쓴 돈</dt>
          <dd>{formatWon(result.spent)}</dd>
        </div>
        <div data-result={result.remaining >= 0 ? 'plus' : 'minus'}>
          <dt>{result.remaining >= 0 ? '남은 돈' : '부족한 돈'}</dt>
          <dd role="status">{formatWon(Math.abs(result.remaining))}</dd>
        </div>
        {result.remaining > 0 ? (
          <div>
            <dt>돌려줄 금액</dt>
            <dd>
              입금한 {paidPeople}명께 1인당 {formatWon(result.refundEach)}
            </dd>
          </div>
        ) : null}
        {result.remaining < 0 ? (
          <div>
            <dt>1인당 더 낼 금액</dt>
            <dd>
              참석 {attendees}명이 1인당 {formatWon(result.extraEach)}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className={styles.toolRow}>
        <button
          type="button"
          className={styles.wide}
          onClick={async () => setMsg((await copyText(text)) ? '정산 내역을 복사했어요.' : '')}
        >
          정산 내역 복사
        </button>
        <button type="button" className={styles.wide} onClick={() => save()} disabled={busy}>
          {busy ? '저장 중…' : '저장'}
        </button>
      </div>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={show}
          disabled={busy}
          onChange={(e) => void save(e.target.checked)}
        />
        정산 내역을 하객 화면에도 보이기
      </label>
      {msg ? (
        <p className={styles.hint} role="status">
          {msg}
        </p>
      ) : null}
    </section>
  )
}
