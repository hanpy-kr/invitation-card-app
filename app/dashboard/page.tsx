import type { Metadata } from 'next'
import Link from 'next/link'

import { requireSession } from '@/lib/auth/session'
import { listMyInvitations } from '@/lib/dashboard'
import { EVENT_TYPE_LABELS } from '@/shared/blocks'
import { formatLongDate } from '@/shared/date'

import styles from './page.module.scss'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: '내 초대장 — dearday', robots: { index: false } }

export default async function DashboardPage() {
  const session = await requireSession('/dashboard')
  const invitations = await listMyInvitations(session.userId)

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>{session.nickname ? `${session.nickname}님의 초대장` : '내 초대장'}</h1>
        <form action="/api/auth/kakao/logout" method="post">
          <button type="submit">로그아웃</button>
        </form>
      </header>

      {invitations.length === 0 ? (
        <p className={styles.empty}>아직 만든 초대장이 없어요.</p>
      ) : (
        <ul className={styles.list}>
          {invitations.map((inv) => (
            <li key={inv.id}>
              <div className={styles.row}>
                <div className={styles.title}>{inv.title || EVENT_TYPE_LABELS[inv.eventType]}</div>
                <span
                  className={`${styles.badge} ${inv.status === 'published' ? styles.published : ''}`}
                >
                  {inv.status === 'published' ? '발행됨' : '작성 중'}
                </span>
              </div>
              <div className={styles.meta}>
                {EVENT_TYPE_LABELS[inv.eventType]}
                {inv.eventAt ? ` · ${formatLongDate(inv.eventAt)}` : ''}
              </div>
              {inv.status === 'published' ? (
                <div className={styles.meta}>
                  <Link href={`/i/${inv.slug}`}>초대장 보기</Link>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
