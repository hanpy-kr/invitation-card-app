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

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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
    />
  )
}
