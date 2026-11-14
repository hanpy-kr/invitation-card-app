'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { api } from '@/components/ui/api'
import { EVENT_TYPE_LABELS, type EventType } from '@/shared/blocks'

import styles from './page.module.scss'

/** 행사 아이콘: 가는 선 그림(24px, 포인트 색). 이모지는 종이 · 프리미엄 느낌과 맞지 않아 뺌 */
const ICONS: Record<EventType, React.ReactNode> = {
  wedding: (
    <>
      <circle cx="9.5" cy="14" r="5" />
      <circle cx="14.5" cy="14" r="5" />
      <path d="M12 3.5l1.6 2-1.6 2-1.6-2z" />
    </>
  ),
  yearend: (
    <>
      <path d="M6.5 3.5h4l-.4 5a1.6 1.6 0 01-3.2 0z" />
      <path d="M8.5 10.2v8M6.5 18.5h4" />
      <path d="M13.5 6.5h4l-.4 5a1.6 1.6 0 01-3.2 0z" />
      <path d="M15.5 13.2v6M13.5 19.5h4" />
    </>
  ),
  prewedding: (
    <>
      <rect x="3.5" y="6.5" width="17" height="12" rx="1" />
      <path d="M4 7l8 6 8-6" />
    </>
  ),
  dol: (
    <>
      <path d="M5 20.5V13h14v7.5zM4 20.5h16" />
      <path d="M7.5 13V10h9v3" />
      <path d="M12 10V6.5M12 4.2v.3" />
    </>
  ),
  birthday: (
    <>
      <path d="M12 15c-3 0-5-2.8-5-6a5 5 0 0110 0c0 3.2-2 6-5 6z" />
      <path d="M11.2 15l.8 1.2.8-1.2M12 16.2c-.8 1.5.8 2.6 0 4.3" />
    </>
  ),
  housewarming: (
    <>
      <path d="M4.5 11L12 4.5l7.5 6.5" />
      <path d="M6.5 9.5v10h11v-10" />
      <path d="M10.5 19.5v-5h3v5" />
    </>
  ),
  thanks: (
    <>
      <path d="M12 20.5V8" />
      <path d="M12 15c-3.2-.4-5.4-2.6-6-5.8 3.2.4 5.4 2.6 6 5.8zM12 12c3.2-.4 5.4-2.6 6-5.8-3.2.4-5.4 2.6-6 5.8z" />
    </>
  ),
  meetup: (
    <>
      <path d="M5.5 7.5h9v11a1.5 1.5 0 01-1.5 1.5h-6a1.5 1.5 0 01-1.5-1.5z" />
      <path d="M14.5 10h1.8a2 2 0 012 2v1.5a2 2 0 01-2 2h-1.8" />
      <path d="M5.5 10.5h9" />
    </>
  ),
  etc: (
    <>
      <rect x="4.5" y="5.5" width="15" height="14" rx="1" />
      <path d="M4.5 9.5h15M8.5 3.5v3M15.5 3.5v3" />
    </>
  ),
}

const GROUPS: { title: string; items: { type: EventType; sub: string }[] }[] = [
  {
    title: '가족 행사',
    items: [
      { type: 'wedding', sub: '모바일 청첩장' },
      { type: 'dol', sub: '첫 생일 잔치' },
      { type: 'thanks', sub: '결혼 · 돌 감사 인사' },
    ],
  },
  {
    title: '모임',
    items: [
      { type: 'yearend', sub: '1차 · 2차 · 회비까지' },
      { type: 'prewedding', sub: '청첩장 드리는 자리' },
      { type: 'birthday', sub: '생일 파티' },
      { type: 'housewarming', sub: '새 집에 초대' },
      { type: 'meetup', sub: '회식 · 동창회 · 모임' },
      { type: 'etc', sub: '그 밖의 모임' },
    ],
  },
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
      {GROUPS.map((g) => (
        <section key={g.title} className={styles.group}>
          <h2 className={styles.groupTitle}>{g.title}</h2>
          <ul className={styles.list}>
            {g.items.map((o) => (
              <li key={o.type}>
                <button
                  type="button"
                  className={styles.row}
                  disabled={pending !== null}
                  onClick={() => create(o.type)}
                >
                  <span className={styles.icon} aria-hidden>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {ICONS[o.type]}
                    </svg>
                  </span>
                  <span className={styles.text}>
                    <span className={styles.label}>{EVENT_TYPE_LABELS[o.type]}</span>
                    <span className={styles.sub}>{pending === o.type ? '만드는 중…' : o.sub}</span>
                  </span>
                  <svg
                    className={styles.chev}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
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
