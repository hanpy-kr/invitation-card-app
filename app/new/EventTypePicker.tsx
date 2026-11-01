'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { api } from '@/components/ui/api'
import { EVENT_TYPE_LABELS, type EventType } from '@/shared/blocks'

import styles from './page.module.scss'

const OPTIONS: { type: EventType; emoji: string; sub: string }[] = [
  { type: 'wedding', emoji: '💍', sub: '모바일 청첩장' },
  { type: 'dol', emoji: '🎂', sub: '돌잔치 · 생일' },
  { type: 'meetup', emoji: '🍻', sub: '회식 · 동창회 · 송년회' },
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
