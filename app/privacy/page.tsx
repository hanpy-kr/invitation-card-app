import type { Metadata } from 'next'
import Link from 'next/link'

import BackLink from '@/components/site/BackLink'
import SiteFooter from '@/components/site/SiteFooter'
import { isNextInEffect, PRIVACY_CURRENT, PRIVACY_NEXT } from '@/shared/privacy'

import styles from '../terms/legal.module.scss'
import Next from './_bodies/Privacy20261115'
import Current from './_bodies/Privacy20261107'

// 시행일이 지나면 저절로 새 판으로 바뀌어야 하므로 요청 때마다 날짜를 확인
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: '개인정보처리방침 — dearday' }

export default function PrivacyPage() {
  const nextLive = isNextInEffect()
  return (
    <>
      <main className={styles.page}>
        <BackLink href="/" label="처음 화면으로" />
        <h1>개인정보처리방침</h1>
        <p className={styles.date}>
          시행일 {nextLive ? PRIVACY_NEXT.label : PRIVACY_CURRENT.label}
        </p>

        {nextLive ? null : (
          <aside className={styles.notice} aria-label="개정 안내">
            <strong>{PRIVACY_NEXT.short} 시행 개정 예정</strong>
            <p>{PRIVACY_NEXT.label}부터 아래처럼 바뀌어요. 그 전까지는 이 방침이 적용돼요.</p>
            <ul>
              {PRIVACY_NEXT.changes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <Link href="/privacy/next">개정안 보기</Link>
          </aside>
        )}

        {nextLive ? <Next /> : <Current />}

        <h2>이전 방침</h2>
        <ul>
          {nextLive ? (
            <li>
              <Link href="/privacy/v2">이전 방침(2026-11-07 시행) 보기</Link>
            </li>
          ) : null}
          <li>
            <Link href="/privacy/v1">이전 방침(2026-11-03 시행) 보기</Link>
          </li>
        </ul>
      </main>
      <SiteFooter />
    </>
  )
}
