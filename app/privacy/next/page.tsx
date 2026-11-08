import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import SiteFooter from '@/components/site/SiteFooter'
import { isNextInEffect, PRIVACY_NEXT } from '@/shared/privacy'

import styles from '../../terms/legal.module.scss'
import Next from '../_bodies/Privacy20261115'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: `개인정보처리방침 개정안 (${PRIVACY_NEXT.label} 시행) — dearday`,
  robots: { index: false },
}

/** 시행 전 개정안. 시행일이 지나면 /privacy 가 이 본문이므로 그쪽으로 보낸다 */
export default function PrivacyNextPage() {
  if (isNextInEffect()) redirect('/privacy')
  return (
    <>
      <main className={styles.page}>
        <Link href="/privacy">← 현재 개인정보처리방침</Link>
        <h1>개인정보처리방침 개정안</h1>
        <p className={styles.date}>
          {PRIVACY_NEXT.label} 시행 예정 · 그 전까지는 <Link href="/privacy">지금 방침</Link>이
          적용돼요.
        </p>
        <Next />
      </main>
      <SiteFooter />
    </>
  )
}
