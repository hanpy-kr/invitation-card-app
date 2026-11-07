'use client'

import { useState } from 'react'

import { api } from '@/components/ui/api'
import { formatShortDate } from '@/shared/date'
import type { Answers, RsvpQuestion } from '@/shared/rsvp-questions'

import styles from './page.module.scss'

type Rsvp = {
  id: string
  name: string
  attending: boolean
  partySize: number
  meal: boolean | null
  answers: Answers
  createdAt: string
}
type Entry = { id: string; name: string; message: string; hidden: boolean; createdAt: string }

const mealLabel = (m: boolean | null) =>
  m === true ? '식사' : m === false ? '식사 안 함' : '식사 미정'

export function RsvpList({
  invitationId,
  initial,
  askMeal,
  questions,
}: {
  invitationId: string
  initial: Rsvp[]
  askMeal: boolean
  questions: RsvpQuestion[]
}) {
  const [rows, setRows] = useState(initial)
  if (rows.length === 0)
    return <p className={styles.empty}>아직 받은 응답이 없어요. 초대장을 공유해 보세요.</p>
  return (
    <ul className={styles.rows}>
      {rows.map((r) => (
        <li key={r.id}>
          <span className={styles.name}>{r.name}</span>
          <span className={`${styles.tag} ${r.attending ? styles.yes : ''}`}>
            {r.attending ? `참석 ${r.partySize}명` : '불참'}
          </span>
          {askMeal && r.attending ? <span className={styles.meta}>{mealLabel(r.meal)}</span> : null}
          <span className={styles.meta}>{formatShortDate(r.createdAt)}</span>
          {questions.some((q) => r.answers[q.id] !== undefined) ? (
            <span className={styles.answers}>
              {questions
                .filter((q) => r.answers[q.id] !== undefined)
                .map((q) => `${q.label}: ${r.answers[q.id]}`)
                .join(' · ')}
            </span>
          ) : null}
          <button
            type="button"
            aria-label={`${r.name} 응답 지우기`}
            onClick={async () => {
              if (!window.confirm(`${r.name}님의 응답을 지울까요?`)) return
              try {
                await api(`/api/invitations/${invitationId}/rsvps/${r.id}`, { method: 'DELETE' })
                setRows((list) => list.filter((x) => x.id !== r.id))
              } catch (err) {
                window.alert((err as Error).message)
              }
            }}
          >
            지우기
          </button>
        </li>
      ))}
    </ul>
  )
}

export function GuestbookList({
  invitationId,
  initial,
}: {
  invitationId: string
  initial: Entry[]
}) {
  const [entries, setEntries] = useState(initial)
  if (entries.length === 0) return <p className={styles.empty}>아직 남겨진 글이 없어요.</p>
  return (
    <ul className={styles.entries}>
      {entries.map((e) => (
        <li key={e.id} data-hidden={e.hidden}>
          <div className={styles.head}>
            <strong>{e.name}</strong>
            <time dateTime={e.createdAt}>{formatShortDate(e.createdAt)}</time>
            <button
              type="button"
              onClick={async () => {
                try {
                  const { hidden } = await api<{ hidden: boolean }>(
                    `/api/invitations/${invitationId}/guestbook/${e.id}`,
                    { method: 'PATCH', body: { hidden: !e.hidden } },
                  )
                  setEntries((list) => list.map((x) => (x.id === e.id ? { ...x, hidden } : x)))
                } catch (err) {
                  window.alert((err as Error).message)
                }
              }}
            >
              {e.hidden ? '다시 보이기' : '숨기기'}
            </button>
          </div>
          <p>{e.message}</p>
        </li>
      ))}
    </ul>
  )
}
