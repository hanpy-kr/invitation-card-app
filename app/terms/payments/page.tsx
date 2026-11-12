import type { Metadata } from 'next'
import Link from 'next/link'

import SiteFooter from '@/components/site/SiteFooter'

import styles from '../legal.module.scss'
import Body from '../_bodies/TermsPaid'

export const metadata: Metadata = {
  title: '이용약관 개정안(유료 서비스) — dearday',
  robots: { index: false },
}

/** 유료 서비스 · 환불 조항을 더한 약관 개정안. 시행일 미정(⏸) — 지금 시행 중인 약관은 /terms */
export default function TermsPaymentsPage() {
  return (
    <>
      <main className={styles.page}>
        <Link href="/terms">← 현재 이용약관</Link>
        <h1>이용약관 개정안 (유료 서비스)</h1>
        <p className={styles.date}>
          시행일 미정 · 시행 전까지는 <Link href="/terms">지금 약관</Link>이 적용돼요.
        </p>
        <Body />
      </main>
      <SiteFooter />
    </>
  )
}
