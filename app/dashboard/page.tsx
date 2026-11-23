import type { Metadata } from 'next'
import Eyebrow from '@/components/site/Eyebrow'
import Logo from '@/components/site/Logo'
import Link from 'next/link'

import { requireSession } from '@/lib/auth/session'
import { listMyInvitations } from '@/lib/dashboard'
import { planBadgeOf } from '@/lib/plan'
import { getNotifyState } from '@/lib/notify'
import { adminHubLines } from '@/lib/admin-hub'
import { GROBLE_ORDER_URL, listHubOrders } from '@/lib/hub-orders'
import RefundGuide from '@/components/site/RefundGuide'
import { REFUND_NOTICE } from '@/shared/pricing'
import { EVENT_TYPE_LABELS } from '@/shared/blocks'
import { daysUntilKst, formatEnParts, formatLongDate, formatTime } from '@/shared/date'
import { mediaSrc } from '@/shared/media'
import { getMediaBaseUrl } from '@/lib/media'
import { formatWon } from '@/shared/pricing'

import CopyOrderId from './CopyOrderId'
import DashboardList, { type CardItem } from './DashboardList'
import NotifyToggle from './NotifyToggle'
import styles from './page.module.scss'
import WithdrawButton from './WithdrawButton'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: '내 초대장 — dearday', robots: { index: false } }

export default async function DashboardPage() {
  const session = await requireSession('/dashboard')
  const [invitations, notify, orders] = await Promise.all([
    listMyInvitations(session.userId),
    session.anonymous ? null : getNotifyState(session.userId),
    session.anonymous ? [] : listHubOrders(session.userId),
  ])

  const hubLines = session.anonymous
    ? null
    : await adminHubLines(
        session.userId,
        invitations.filter((i) => i.isOwner),
      )

  const mediaBase = getMediaBaseUrl()
  const items: CardItem[] = invitations.map((inv) => {
    const badge = planBadgeOf(inv)
    // 주문이 환불됨이고 이용권(허브 결제 · 상속)이 없으면 '환불됨' (이 페이지가 이미 읽은 허브 주문 목록 재사용)
    const refunded =
      badge !== 'paid' &&
      !inv.premiumHub &&
      orders.some((o) => o.invitationId === inv.id && o.status === 'refunded')
    const en = inv.eventAt ? formatEnParts(inv.eventAt) : null
    const left = inv.eventAt ? daysUntilKst(inv.eventAt) : null
    return {
      id: inv.id,
      slug: inv.slug,
      title: inv.title || EVENT_TYPE_LABELS[inv.eventType],
      eventType: inv.eventType,
      typeLabel: EVENT_TYPE_LABELS[inv.eventType],
      published: inv.status === 'published',
      dateLabel: inv.eventAt ? formatLongDate(inv.eventAt) : null,
      shortDate: en ? `${en.month}.${en.day.padStart(2, '0')}` : null,
      timeLabel: inv.eventAt ? formatTime(inv.eventAt) : null,
      day: en ? en.day.padStart(2, '0') : null,
      monthShort: en?.monthShort ?? null,
      year: en?.year ?? null,
      cover: inv.coverKey ? mediaSrc(mediaBase, inv.coverKey) : null,
      // 발행된 초대장만, 행사 당일까지. 지난 행사는 칩을 숨김
      dday:
        inv.status === 'published' && left !== null && left >= 0
          ? left === 0
            ? 'D-DAY'
            : `D-${left}`
          : null,
      plan: badge ?? (refunded ? 'refunded' : null),
      attendees: inv.attendees,
      responses: inv.responses,
      attendingResponses: inv.attendingResponses,
      declined: inv.declined,
      newResponses: inv.newResponses,
      isOwner: inv.isOwner,
      paid: Boolean(inv.premiumHub),
      shareGuard: orders.some((o) => o.invitationId === inv.id && o.refundable),
      hubLine: hubLines?.[inv.id] ?? null,
    }
  })

  return (
    <main className={styles.page}>
      <div className={styles.top}>
        <Logo />
        <div className={styles.headerTools}>
          <Link href="/help">도움말</Link>
          <form action="/api/auth/kakao/logout" method="post">
            <button type="submit">로그아웃</button>
          </form>
        </div>
      </div>
      <header className={styles.header}>
        <Eyebrow>MY INVITATIONS</Eyebrow>
        <h1>{session.nickname ? `${session.nickname}님의 초대장` : '내 초대장'}</h1>
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
        <div className={styles.empty}>
          <p>아직 만든 초대장이 없어요.</p>
          <Link href="/new">첫 초대장 만들기</Link>
        </div>
      ) : (
        <DashboardList items={items} />
      )}
      {orders.length > 0 ? (
        <section id="orders" className={styles.orders} aria-label="결제 내역">
          <h2>결제 내역</h2>
          <ul>
            {orders.map((o) => (
              <li key={o.orderId}>
                <div className={styles.row}>
                  <div className={styles.title}>{o.orderName}</div>
                  <span className={styles.badge}>
                    {o.status === 'refunded'
                      ? '환불됨'
                      : o.status === 'partially_refunded'
                        ? '일부 환불'
                        : o.status === 'cancel_requested'
                          ? '환불 요청됨'
                          : '결제 완료'}
                  </span>
                </div>
                <div className={styles.meta}>
                  {o.invitationTitle} · {formatWon(o.amount)}
                  {o.status === 'partially_refunded' ? ` · 환불 ${formatWon(o.refundedAmount)}` : ''}
                </div>
                <div className={styles.meta}>
                  {o.status === 'refunded' && o.refundedAt
                    ? `환불 ${formatLongDate(o.refundedAt)}`
                    : o.paidAt
                      ? `결제 ${formatLongDate(o.paidAt)}`
                      : ''}
                </div>
                <div className={styles.actions}>
                  <CopyOrderId orderId={o.orderId} />
                </div>
                {o.status === 'paid' ? (
                  <div className={styles.meta} data-testid="refund-guide">
                    {o.refundNote ? (
                      <strong data-testid="refund-status" data-refund={o.refundable ? 'full' : 'limited'}>
                        {o.refundNote}
                      </strong>
                    ) : null}
                    <br />
                    {REFUND_NOTICE} <RefundGuide url={GROBLE_ORDER_URL} /> 환불이 확인되면 이 내역이
                    바뀌어요.
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className={styles.withdraw}>
        <WithdrawButton />
      </div>
    </main>
  )
}
