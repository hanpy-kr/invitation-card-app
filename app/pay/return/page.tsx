import type { Metadata } from 'next'

import SiteFooter from '@/components/site/SiteFooter'
import { requireKakaoSession } from '@/lib/auth/session'

import styles from '../pay.module.scss'
import ReturnClient from './ReturnClient'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: '결제 확인 — dearday', robots: { index: false } }

/** 그로블 결제창의 '이동 페이지'. 결제 결과는 웹훅으로 오므로 여기서는 확인만 한다 */
export default async function PayReturnPage() {
  await requireKakaoSession('/pay/return')
  return (
    <>
      <main className={styles.page}>
        <ReturnClient />
      </main>
      <SiteFooter />
    </>
  )
}
