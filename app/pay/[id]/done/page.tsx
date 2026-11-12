import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, eq } from 'drizzle-orm'

import SiteFooter from '@/components/site/SiteFooter'
import { requireKakaoSession } from '@/lib/auth/session'
import { getDb, schema } from '@/lib/db/client'
import { isUuid } from '@/lib/editor'
import { formatLongDate } from '@/shared/date'
import { formatWon, REFUND_NOTICE } from '@/shared/pricing'

import styles from '../../pay.module.scss'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: '결제 완료 — dearday', robots: { index: false } }

export default async function PayDonePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireKakaoSession(`/pay/${id}/done`)
  if (!isUuid(id)) notFound()
  const [order] = await getDb()
    .select()
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.invitationId, id),
        eq(schema.orders.userId, session.userId),
        eq(schema.orders.status, 'paid'),
      ),
    )
  if (!order) notFound()
  return (
    <>
      <main className={styles.page}>
        <h1>결제가 완료됐어요</h1>
        <div className={styles.summary}>
          <dl>
            <dt>상품</dt>
            <dd>{order.orderName}</dd>
            <dt>결제 금액</dt>
            <dd className={styles.total}>{formatWon(order.amount)}</dd>
            {order.approvedAt ? (
              <>
                <dt>결제 시각</dt>
                <dd>{formatLongDate(order.approvedAt)}</dd>
              </>
            ) : null}
          </dl>
        </div>
        <p>프리미엄이 적용됐어요. 봉투 열기 · 효과, 사진 60장, 하단 문구 숨기기를 쓸 수 있어요.</p>
        <p className={styles.note}>{REFUND_NOTICE}</p>
        {order.receiptUrl ? (
          <a className={styles.ghost} href={order.receiptUrl} target="_blank" rel="noopener noreferrer">
            영수증 보기
          </a>
        ) : null}
        <Link className={styles.btn} href={`/edit/${id}`}>
          초대장 편집하러 가기
        </Link>
      </main>
      <SiteFooter />
    </>
  )
}
