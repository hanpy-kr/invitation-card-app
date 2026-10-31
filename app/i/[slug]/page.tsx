import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import BlockRenderer from '@/components/blocks/BlockRenderer'
import type { BlockContext } from '@/components/blocks/types'
import { getPublishedInvitation, type PublicInvitation } from '@/lib/invitations'
import { getMediaBaseUrl } from '@/lib/media'
import { EVENT_TYPE_LABELS } from '@/shared/blocks'
import { formatEventDateTime } from '@/shared/date'
import { mediaSrc } from '@/shared/media'
import { themeStyle } from '@/shared/themes'

import styles from './page.module.scss'

// 발행 직후 수정이 바로 보여야 하므로 항상 동적 렌더링
export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

function describe(inv: PublicInvitation): string {
  const location = inv.blocks.find((b) => b.type === 'location')
  const place = location?.type === 'location' ? location.config.placeName : ''
  const when = inv.eventAt ? formatEventDateTime(inv.eventAt) : ''
  const text = [when, place].filter(Boolean).join(' · ')
  return text || `${EVENT_TYPE_LABELS[inv.eventType]}에 초대합니다.`
}

function ogImage(inv: PublicInvitation): string {
  const base = getMediaBaseUrl()
  for (const b of inv.blocks) {
    if (!b.visible) continue
    if (b.type === 'cover' && b.config.layout === 'photo' && b.config.image) {
      return mediaSrc(base, b.config.image.key)
    }
  }
  const gallery = inv.blocks.find((b) => b.type === 'gallery' && b.visible)
  if (gallery?.type === 'gallery' && gallery.config.images[0]) {
    return mediaSrc(base, gallery.config.images[0].key)
  }
  return `/og/${inv.eventType}`
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const inv = await getPublishedInvitation(slug)
  if (!inv) return { title: '초대장을 찾을 수 없어요', robots: { index: false } }

  const title = inv.title || EVENT_TYPE_LABELS[inv.eventType]
  const description = describe(inv)
  const image = ogImage(inv)
  return {
    title,
    description,
    // 개인 행사 정보이므로 검색 노출 안 함
    robots: { index: false, follow: false },
    openGraph: {
      type: 'website',
      siteName: 'dearday',
      locale: 'ko_KR',
      url: `/i/${inv.slug}`,
      title,
      description,
      images: [{ url: image }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  }
}

export default async function InvitationPage({ params }: Props) {
  const { slug } = await params
  const inv = await getPublishedInvitation(slug)
  if (!inv) notFound()

  const ctx: BlockContext = {
    slug: inv.slug,
    eventType: inv.eventType,
    title: inv.title,
    eventAt: inv.eventAt,
    mediaBaseUrl: getMediaBaseUrl(),
  }

  return (
    <div className={styles.page} style={themeStyle(inv.theme)}>
      <main className={styles.column}>
        <BlockRenderer blocks={inv.blocks} ctx={ctx} />
        <footer className={styles.footer}>
          <Link href="/">dearday</Link>로 만든 초대장
        </footer>
      </main>
    </div>
  )
}
