import type { Metadata } from 'next'
import Link from 'next/link'

import SiteFooter from '@/components/site/SiteFooter'
import { getSession } from '@/lib/auth/session'
import { recordPaymentFailure } from '@/lib/payments'
import { ORDER_ID_RE } from '@/shared/pricing'

import styles from '../../pay.module.scss'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: '결제하지 못했어요 — dearday', robots: { index: false } }

type Search = { message?: string; code?: string; orderId?: string }

/** 결제창에서 실패 · 취소하고 돌아온 화면 (토스는 code · message를 붙여 줌). 결제는 일어나지 않았다 */
export default async function PayFailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Search>
}) {
  const { id } = await params
  const { message, code, orderId } = await searchParams
  const text = (message ?? '').slice(0, 200) || '결제를 완료하지 못했어요.'
  const session = await getSession()
  if (session && orderId && ORDER_ID_RE.test(orderId)) {
    await recordPaymentFailure(id, session.userId, orderId, `${code ?? ''} ${text}`.trim())
  }
  const canceled = code === 'PAY_PROCESS_CANCELED' || code === 'USER_CANCEL'
  return (
    <>
      <main className={styles.page}>
        <h1>{canceled ? '결제를 취소했어요' : '결제하지 못했어요'}</h1>
        <p role="alert">{text}</p>
        <p className={styles.note}>결제는 일어나지 않았고, 초대장은 그대로예요.</p>
        <Link className={styles.btn} href={`/pay/${id}`}>
          다시 결제하기
        </Link>
        <Link className={styles.ghost} href={`/edit/${id}`}>
          편집으로 돌아가기
        </Link>
      </main>
      <SiteFooter />
    </>
  )
}
