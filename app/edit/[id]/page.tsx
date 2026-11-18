import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import Editor from '@/components/editor/Editor'
import { requireSession } from '@/lib/auth/session'
import { getEditableInvitation } from '@/lib/editor'
import { kakaoConfigured } from '@/lib/auth/kakao'
import { getMediaBaseUrl } from '@/lib/media'
import { siteUrl } from '@/lib/site'
import { storageMode } from '@/lib/storage'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: '초대장 편집 — dearday', robots: { index: false } }

export default async function EditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ paid?: string }>
}) {
  const { id } = await params
  const { paid: paidParam } = await searchParams
  const session = await requireSession(`/edit/${id}`)
  const inv = await getEditableInvitation(id, session.userId)
  if (!inv) notFound()

  return (
    <Editor
      id={inv.id}
      slug={inv.slug}
      status={inv.status}
      meta={inv.meta}
      blocks={inv.blocks}
      mediaBaseUrl={getMediaBaseUrl()}
      kakaoJsKey={process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? ''}
      siteUrl={siteUrl()}
      uploadEnabled={storageMode() !== 'none'}
      geoSearchEnabled={kakaoConfigured()}
      isOwner={inv.isOwner}
      photoLimit={inv.photoLimit}
      ownerAnonymous={inv.ownerAnonymous}
      introEffects={inv.introEffects}
      coverTemplates={inv.coverTemplates}
      canHideMadeWith={inv.canHideMadeWith}
      upsell={inv.upsell}
      adminHub={inv.adminHub}
      paid={inv.paid}
      // 주소의 paid=1은 '어느 안내를 띄울지'만 정한다. 실제 프리미엄인지는 서버 플랜으로 확인
      paidWelcome={paidParam === '1' && inv.plan === 'premium'}
    />
  )
}
