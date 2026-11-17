import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import SiteFooter from '@/components/site/SiteFooter'
import { requireKakaoSession } from '@/lib/auth/session'
import { getAccess } from '@/lib/access'
import { getDb, schema } from '@/lib/db/client'
import { isUuid } from '@/lib/editor'
import { canCheckout, derivedPremiumSql, hasPaidPremium } from '@/lib/plan'
import { priceOfEvent } from '@/lib/prices'
import { EVENT_TYPE_LABELS } from '@/shared/blocks'
import { PLAN_FEATURES } from '@/shared/entitlements'
import { FAMILY_OPEN_NOTE, formatWon, isFamilyEvent, REFUND_NOTICE } from '@/shared/pricing'
import { eq } from 'drizzle-orm'

import styles from '../pay.module.scss'
import HubPayClient from './HubPayClient'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: '프리미엄 결제 — dearday', robots: { index: false } }

export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireKakaoSession(`/pay/${id}`)
  if (!isUuid(id) || !(await canCheckout(session.userId))) notFound()
  const access = await getAccess(id, session.userId)
  if (!access || !access.isOwner) notFound()
  const inv = await getDb().query.invitations.findFirst({
    where: eq(schema.invitations.id, id),
    columns: { title: true, eventType: true, createdAt: true, premiumOrderId: true, premiumHub: true },
    extras: { derivedPremium: derivedPremiumSql().as('derived_premium') },
  })
  if (!inv) notFound()
  if (hasPaidPremium(inv)) redirect(`/edit/${id}`)

  const price = await priceOfEvent(inv.eventType)
  const f = PLAN_FEATURES.premium
  return (
    <>
      <main className={styles.page}>
        <Link href={`/edit/${id}`}>← 편집으로 돌아가기</Link>
        <h1>프리미엄 결제</h1>
        <div className={styles.summary}>
          <dl>
            <dt>초대장</dt>
            <dd>{inv.title || EVENT_TYPE_LABELS[inv.eventType]}</dd>
            <dt>행사</dt>
            <dd>{EVENT_TYPE_LABELS[inv.eventType]}</dd>
            <dt>결제 금액</dt>
            <dd className={styles.total}>
              {price === null ? '가격을 불러오지 못했어요' : formatWon(price)}
            </dd>
          </dl>
        </div>
        <ul className={styles.perks}>
          <li>봉투 열기 3종 · 떨어지는 효과 6종이 하객에게 보여요</li>
          <li>사진을 초대장당 {f.photoLimit}장까지 (무료 {PLAN_FEATURES.free.photoLimit}장)</li>
          <li>하단 &lsquo;dearday로 만들었어요&rsquo; 문구 숨기기</li>
          {['wedding', 'dol'].includes(inv.eventType) ? (
            <li>이 초대장에서 만드는 청첩장 모임 · 감사장에도 추가 결제 없이 적용돼요</li>
          ) : null}
        </ul>
        <p className={styles.note}>
          초대장 1개당 1회 결제 · 부가세 포함. 이용료만 결제하며 축의금 · 회비는 받지 않아요.
        </p>
        <HubPayClient
          invitationId={id}
          amount={price}
          openNote={isFamilyEvent(inv.eventType) ? FAMILY_OPEN_NOTE : null}
          refundNotice={REFUND_NOTICE}
        />
      </main>
      <SiteFooter />
    </>
  )
}
