import type { Metadata } from 'next'
import Link from 'next/link'

import { requireSession } from '@/lib/auth/session'
import { getLayoutSource } from '@/lib/editor'
import { EVENT_TYPE_LABELS } from '@/shared/blocks'
import { THEMES } from '@/shared/themes'

import EventTypePicker, { StartFromDesign } from './EventTypePicker'
import styles from './page.module.scss'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: '새 초대장 — dearday', robots: { index: false } }

export default async function NewInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  const { from } = await searchParams
  const fromSlug = typeof from === 'string' && /^[a-z0-9]{8}$/.test(from) ? from : null
  await requireSession(fromSlug ? `/new?from=${fromSlug}` : '/new')
  const source = fromSlug ? await getLayoutSource(fromSlug) : null
  return (
    <main className={styles.page}>
      <Link href="/dashboard" className={styles.back}>
        ← 내 초대장
      </Link>
      {source ? (
        <>
          <h1 className={styles.title}>이 디자인으로 만들어 볼까요?</h1>
          <StartFromDesign
            from={source.slug}
            eventType={source.eventType}
            summary={`${EVENT_TYPE_LABELS[source.eventType]} · ${THEMES[source.theme as keyof typeof THEMES]?.label ?? '기본'} 테마 · 블록 ${source.blockCount}개`}
          />
          <h2 className={styles.subtitle}>다른 종류로 시작하기</h2>
        </>
      ) : (
        <>
          <h1 className={styles.title}>어떤 초대장을 만들까요?</h1>
          <p className={styles.desc}>
            고르면 기본 구성이 채워져요. 나중에 자유롭게 바꿀 수 있어요.
          </p>
        </>
      )}
      <EventTypePicker />
    </main>
  )
}
