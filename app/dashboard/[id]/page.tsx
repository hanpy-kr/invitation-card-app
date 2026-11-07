import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { requireSession } from '@/lib/auth/session'
import { getResponses } from '@/lib/dashboard'
import { EVENT_TYPE_LABELS } from '@/shared/blocks'
import { formatLongDate } from '@/shared/date'

import styles from './page.module.scss'
import { GuestbookList, RsvpList } from './Responses'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: '응답 확인 — dearday', robots: { index: false } }

export default async function ResponsesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireSession(`/dashboard/${id}`)
  const data = await getResponses(id, session.userId)
  if (!data) notFound()
  const s = data.summary

  return (
    <main className={styles.page}>
      <Link href="/dashboard" className={styles.back}>
        ← 내 초대장
      </Link>
      <h1 className={styles.title}>{data.title || EVENT_TYPE_LABELS[data.eventType]}</h1>
      <p className={styles.sub}>
        {data.eventAt ? formatLongDate(data.eventAt) : '날짜 미정'}
        <Link href={`/edit/${data.id}`}>편집</Link>
        {data.status === 'published' ? (
          <Link href={`/i/${data.slug}`} target="_blank">
            초대장 보기
          </Link>
        ) : null}
      </p>

      <dl className={styles.stats}>
        <div className={styles.main}>
          <dt>참석 인원</dt>
          <dd>
            {s.attendees}
            <small>명</small>
          </dd>
        </div>
        <div>
          <dt>참석 응답</dt>
          <dd>
            {s.attendingResponses}
            <small>건</small>
          </dd>
        </div>
        <div>
          <dt>불참</dt>
          <dd>
            {s.declined}
            <small>건</small>
          </dd>
        </div>
      </dl>
      {data.askMeal ? (
        <p className={styles.meal}>
          식사 {s.mealYes}명 · 안 함 {s.mealNo}명 · 미정 {s.mealUndecided}명
        </p>
      ) : (
        <div style={{ height: 20 }} />
      )}

      {data.choiceStats.map((q) => (
        <div key={q.id} className={styles.choice}>
          <h3>{q.label}</h3>
          <ul>
            {q.rows.map((r) => (
              <li key={r.label}>
                <span>{r.label}</span>
                <strong>{r.count}건</strong>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>참석 응답 {data.rsvps.length}건</h2>
          {data.rsvps.length > 0 ? (
            <a href={`/api/invitations/${data.id}/rsvps.csv`} download className={styles.csv}>
              엑셀로 받기
            </a>
          ) : null}
        </div>
        <RsvpList
          invitationId={data.id}
          initial={data.rsvps}
          askMeal={data.askMeal}
          questions={data.questions}
        />
      </section>

      <section className={styles.section}>
        <h2>방명록 {data.guestbook.length}개</h2>
        <GuestbookList invitationId={data.id} initial={data.guestbook} />
      </section>
    </main>
  )
}
