import type { Metadata } from 'next'
import Link from 'next/link'

import { requireSession } from '@/lib/auth/session'
import { listMyInvitations } from '@/lib/dashboard'
import { getNotifyState } from '@/lib/notify'
import { EVENT_TYPE_LABELS } from '@/shared/blocks'
import { formatLongDate } from '@/shared/date'

import DuplicateButtons from './DuplicateButtons'
import NotifyToggle from './NotifyToggle'
import styles from './page.module.scss'
import WithdrawButton from './WithdrawButton'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: '내 초대장 — dearday', robots: { index: false } }

export default async function DashboardPage() {
  const session = await requireSession('/dashboard')
  const [invitations, notify] = await Promise.all([
    listMyInvitations(session.userId),
    session.anonymous ? null : getNotifyState(session.userId),
  ])

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>{session.nickname ? `${session.nickname}님의 초대장` : '내 초대장'}</h1>
        <div className={styles.headerTools}>
          <Link href="/help">도움말</Link>
          <form action="/api/auth/kakao/logout" method="post">
            <button type="submit">로그아웃</button>
          </form>
        </div>
      </header>

      {session.anonymous ? (
        <div className={styles.anonBanner}>
          <p>
            로그인 없이 만드는 중이에요. 카카오로 로그인하면 내 계정에 저장되고 발행할 수 있어요.
            로그인하지 않은 초대장은 7일 뒤 지워져요.
          </p>
          <a href="/api/auth/kakao/login?next=/dashboard">카카오로 로그인</a>
        </div>
      ) : null}

      {notify?.available ? <NotifyToggle on={notify.on} /> : null}

      <Link href="/new" className={styles.create}>
        + 새 초대장 만들기
      </Link>

      {invitations.length === 0 ? (
        <p className={styles.empty}>아직 만든 초대장이 없어요.</p>
      ) : (
        <ul className={styles.list}>
          {invitations.map((inv) => (
            <li key={inv.id}>
              <Link href={`/edit/${inv.id}`} className={styles.cardLink}>
                <div className={styles.row}>
                  <div className={styles.title}>
                    {inv.title || EVENT_TYPE_LABELS[inv.eventType]}
                  </div>
                  <span
                    className={`${styles.badge} ${inv.status === 'published' ? styles.published : ''}`}
                  >
                    {inv.status === 'published' ? '발행됨' : '작성 중'}
                  </span>
                </div>
                <div className={styles.meta}>
                  {EVENT_TYPE_LABELS[inv.eventType]}
                  {inv.eventAt ? ` · ${formatLongDate(inv.eventAt)}` : ' · 날짜 미정'}
                </div>
              </Link>
              {inv.status === 'published' || inv.responses > 0 ? (
                <div className={styles.meta}>
                  참석 {inv.attendees}명 · 응답 {inv.responses}건
                  {inv.newResponses > 0 ? (
                    <Link href={`/dashboard/${inv.id}`} className={styles.newCount}>
                      새 응답 {inv.newResponses}
                    </Link>
                  ) : null}
                </div>
              ) : null}
              {!inv.isOwner ? <div className={styles.meta}>함께 편집 중인 초대장</div> : null}
              <div className={styles.actions}>
                <Link href={`/edit/${inv.id}`}>편집</Link>
                <Link href={`/dashboard/${inv.id}`}>응답 보기</Link>
                {inv.status === 'published' ? (
                  <Link href={`/i/${inv.slug}`} target="_blank">
                    초대장 보기
                  </Link>
                ) : null}
                {inv.isOwner ? <DuplicateButtons id={inv.id} eventType={inv.eventType} /> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.withdraw}>
        <WithdrawButton />
      </div>
    </main>
  )
}
