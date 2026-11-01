import type { Metadata } from 'next'
import Link from 'next/link'

import { requireSession } from '@/lib/auth/session'

import EventTypePicker from './EventTypePicker'
import styles from './page.module.scss'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: '새 초대장 — dearday', robots: { index: false } }

export default async function NewInvitationPage() {
  await requireSession('/new')
  return (
    <main className={styles.page}>
      <Link href="/dashboard" className={styles.back}>
        ← 내 초대장
      </Link>
      <h1 className={styles.title}>어떤 초대장을 만들까요?</h1>
      <p className={styles.desc}>고르면 기본 구성이 채워져요. 나중에 자유롭게 바꿀 수 있어요.</p>
      <EventTypePicker />
    </main>
  )
}
