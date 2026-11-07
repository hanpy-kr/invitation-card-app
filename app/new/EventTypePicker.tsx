'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { api } from '@/components/ui/api'
import { EVENT_TYPE_LABELS, type EventType } from '@/shared/blocks'

import styles from './page.module.scss'

const OPTIONS: { type: EventType; emoji: string; sub: string }[] = [
  { type: 'wedding', emoji: '💍', sub: '모바일 청첩장' },
  { type: 'yearend', emoji: '🥂', sub: '1차 · 2차 · 회비까지' },
  { type: 'prewedding', emoji: '💌', sub: '청첩장 드리는 자리' },
  { type: 'dol', emoji: '🎂', sub: '첫 생일 잔치' },
  { type: 'birthday', emoji: '🎈', sub: '생일 파티' },
  { type: 'housewarming', emoji: '🏠', sub: '새 집에 초대' },
  { type: 'meetup', emoji: '🍻', sub: '회식 · 동창회 · 모임' },
  { type: 'etc', emoji: '✉️', sub: '그 밖의 모임' },
]

export default function EventTypePicker() {
  const router = useRouter()
  const [pending, setPending] = useState<EventType | null>(null)
  const [error, setError] = useState('')

  async function create(eventType: EventType) {
    setPending(eventType)
    setError('')
    try {
      const { id } = await api<{ id: string }>('/api/invitations', { body: { eventType } })
      router.push(`/edit/${id}`)
    } catch (err) {
      setError((err as Error).message)
      setPending(null)
    }
  }

  return (
    <>
      <div className={styles.grid}>
        {OPTIONS.map((o) => (
          <button
            key={o.type}
            type="button"
            className={styles.card}
            disabled={pending !== null}
            onClick={() => create(o.type)}
          >
            <span className={styles.emoji} aria-hidden>
              {o.emoji}
            </span>
            <span className={styles.label}>{EVENT_TYPE_LABELS[o.type]}</span>
            <span className={styles.sub}>{pending === o.type ? '만드는 중…' : o.sub}</span>
          </button>
        ))}
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
    </>
  )
}

/** '나도 만들기': 원본과 같은 행사 종류 · 테마 · 블록 구성, 내용은 기본 문구로 */
export function StartFromDesign({
  from,
  eventType,
  summary,
}: {
  from: string
  eventType: EventType
  summary: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  return (
    <div className={styles.from}>
      <p className={styles.fromSummary}>{summary}</p>
      <p className={styles.fromNote}>
        글 · 사진 · 계좌 · 연락처는 비어 있는 새 초대장으로 시작해요. 받은 초대장의 내용은 가져오지
        않아요.
      </p>
      <button
        type="button"
        className={styles.fromBtn}
        disabled={pending}
        onClick={async () => {
          setPending(true)
          setError('')
          try {
            const { id } = await api<{ id: string }>('/api/invitations', {
              body: { eventType, from },
            })
            router.push(`/edit/${id}`)
          } catch (err) {
            setError((err as Error).message)
            setPending(false)
          }
        }}
      >
        {pending ? '만드는 중…' : '이 구성으로 만들기'}
      </button>
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  )
}
