import type { Metadata } from 'next'
import BackLink from '@/components/site/BackLink'
import Eyebrow from '@/components/site/Eyebrow'
import Logo from '@/components/site/Logo'

import { requireSession } from '@/lib/auth/session'
import { getLayoutSource } from '@/lib/editor'
import { EVENT_TYPE_LABELS } from '@/shared/blocks'
import { THEMES } from '@/shared/themes'
import { coverTemplateLocked, getEntitlements } from '@/shared/entitlements'
import { newInvitationPlan } from '@/lib/plan'
import { isChristmasSeason, seasonNow } from '@/shared/season'

import EventTypePicker, { StartFromDesign } from './EventTypePicker'
import styles from './page.module.scss'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: '새 초대장 — dearday', robots: { index: false } }

export default async function NewInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; type?: string }>
}) {
  const { from, type } = await searchParams
  const fromSlug = typeof from === 'string' && /^[a-z0-9]{8}$/.test(from) ? from : null
  await requireSession(
    fromSlug ? `/new?from=${fromSlug}` : type === 'christmas' ? '/new?type=christmas' : '/new',
  )
  // 지금 새로 만드는 결혼 초대장의 플랜 → 프리미엄이 필요한 표지 안(결제 전에는 모두 열려 있어 빈 배열)
  const ent = getEntitlements({ plan: newInvitationPlan('wedding') })
  const lockedCoverKeys = (['a', 'b', 'c'] as const).filter((k) => coverTemplateLocked(k, ent))
  const source = fromSlug ? await getLayoutSource(fromSlug) : null
  return (
    <main className={styles.page}>
      <div className={styles.top}>
        <Logo />
      </div>
      <BackLink href="/dashboard" label="내 초대장으로" />
      <Eyebrow>NEW INVITATION</Eyebrow>
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
      <EventTypePicker
        lockedCoverKeys={lockedCoverKeys}
        showChristmas={isChristmasSeason(seasonNow()) || type === 'christmas'}
      />
    </main>
  )
}
