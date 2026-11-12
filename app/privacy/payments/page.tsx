import type { Metadata } from 'next'
import Link from 'next/link'

import SiteFooter from '@/components/site/SiteFooter'
import { PRIVACY_PAID } from '@/shared/privacy'

import styles from '../../terms/legal.module.scss'
import Body from '../_bodies/PrivacyPaid'

export const metadata: Metadata = {
  title: '개인정보처리방침 개정안(결제) — dearday',
  robots: { index: false },
}

/** 결제 정보 보관 · 토스페이먼츠 위탁을 더한 방침 개정안. 시행일 미정(⏸) — 지금 방침은 /privacy */
export default function PrivacyPaymentsPage() {
  return (
    <>
      <main className={styles.page}>
        <Link href="/privacy">← 현재 개인정보처리방침</Link>
        <h1>개인정보처리방침 개정안 (결제)</h1>
        <p className={styles.date}>
          시행일 미정 · 시행 전까지는 <Link href="/privacy">지금 방침</Link>이 적용돼요.
        </p>
        <ul>
          {PRIVACY_PAID.changes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <Body />
      </main>
      <SiteFooter />
    </>
  )
}
