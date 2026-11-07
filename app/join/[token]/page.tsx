import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { requireKakaoSession } from '@/lib/auth/session'
import { acceptEditorInvite } from '@/lib/editors'

import styles from '../../new/page.module.scss'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: '함께 편집하기 — dearday', robots: { index: false } }

/** 공동 편집 초대 링크: 로그인 → 편집자로 등록 → 편집기로 */
export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const session = await requireKakaoSession(`/join/${encodeURIComponent(token)}`)
  const invitationId = await acceptEditorInvite(token, session.userId)
  if (invitationId) redirect(`/edit/${invitationId}`)
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>초대 링크가 만료됐어요</h1>
      <p className={styles.desc}>
        공동 편집 링크는 만든 지 7일이 지나면 쓸 수 없어요. 초대장 주인에게 새 링크를 받아 주세요.
      </p>
      <Link href="/dashboard">내 초대장으로</Link>
    </main>
  )
}
