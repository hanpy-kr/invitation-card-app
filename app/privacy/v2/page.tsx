import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import SiteFooter from '@/components/site/SiteFooter'
import { isNextInEffect, PRIVACY_NEXT } from '@/shared/privacy'

import styles from '../../terms/legal.module.scss'
import Body from '../_bodies/Privacy20261107'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: '이전 개인정보처리방침 (2026-11-07 시행) — dearday',
  robots: { index: false },
}

/** 11/7 판. 지금 적용 중이면(개정 시행 전) /privacy 가 이 본문이므로 그쪽으로 보낸다 */
export default function PrivacyV2Page() {
  if (!isNextInEffect()) redirect('/privacy')
  return (
    <>
      <main className={styles.page}>
        <Link href="/privacy">← 현재 개인정보처리방침</Link>
        <h1>개인정보처리방침 (이전 방침)</h1>
        <p className={styles.date}>
          시행 2026년 11월 7일 ~ {PRIVACY_NEXT.label} 전날 · 지금 적용되는 방침은{' '}
          <Link href="/privacy">여기</Link>에서 볼 수 있어요.
        </p>
        <Body />

        <h2>이전 방침</h2>
        <ul>
          <li>
            <Link href="/privacy/v1">이전 방침(2026-11-03 시행) 보기</Link>
          </li>
        </ul>
      </main>
      <SiteFooter />
    </>
  )
}
