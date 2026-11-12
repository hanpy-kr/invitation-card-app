import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import BlockRenderer from '@/components/blocks/BlockRenderer'
import { displayTextOf } from '@/components/blocks/displayText'
import type { BlockContext } from '@/components/blocks/types'
import { fontCssHref, preloadDisplayFont } from '@/lib/fonts/display-font'
import { getPublishedInvitation } from '@/lib/invitations'
import { getMediaBaseUrl } from '@/lib/media'
import { getEntitlements } from '@/shared/entitlements'
import { siteUrl } from '@/lib/site'
import {
  absolute,
  acceptsRsvp,
  kakaoFeed,
  shareDescription,
  shareImagePath,
  shareTitle,
} from '@/shared/share'
import { designCoverOf } from '@/shared/covers'
import { resolveFont, themeStyle } from '@/shared/themes'

import GuestFooter from './GuestFooter'
import LargeTextToggle from './LargeTextToggle'
import ViewBeacon from './ViewBeacon'
import styles from './page.module.scss'

// 발행 직후 수정이 바로 보여야 하므로 항상 동적 렌더링
export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const inv = await getPublishedInvitation(slug)
  if (!inv) return { title: '초대장을 찾을 수 없어요', robots: { index: false } }

  const title = shareTitle(inv)
  const description = shareDescription(inv)
  const image = shareImagePath(inv, getMediaBaseUrl())
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

  // 손글씨로 그려질 글자에 필요한 폰트 조각만 HTML에서 바로 받기 시작
  const font = resolveFont(inv.theme, inv.font)
  const fontCss = fontCssHref(font)
  preloadDisplayFont(displayTextOf(inv.blocks, inv.eventAt), font)

  const ent = getEntitlements({ plan: inv.plan })
  const ctx: BlockContext = {
    slug: inv.slug,
    eventType: inv.eventType,
    title: inv.title,
    eventAt: inv.eventAt,
    mediaBaseUrl: getMediaBaseUrl(),
    kakaoJsKey: process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? '',
    introEffects: ent.introEffects,
  }

  const pageUrl = `${siteUrl()}/i/${inv.slug}`

  return (
    <div className={styles.page} style={themeStyle(inv.theme, inv.font, designCoverOf(inv.blocks))}>
      {fontCss ? <link rel="stylesheet" href={fontCss} precedence="font" /> : null}
      <main className={styles.column} data-guest-column>
        <BlockRenderer blocks={inv.blocks} ctx={ctx} />
        <ViewBeacon slug={inv.slug} />
        <LargeTextToggle />
        <GuestFooter
          slug={inv.slug}
          url={pageUrl}
          kakaoJsKey={ctx.kakaoJsKey}
          showMadeWith={!(ent.canHideMadeWith && inv.share.hideMadeWith)}
          feed={kakaoFeed({
            url: pageUrl,
            title: shareTitle(inv),
            description: shareDescription(inv),
            imageUrl: absolute(siteUrl(), shareImagePath(inv, ctx.mediaBaseUrl)),
            rsvp: acceptsRsvp(inv.blocks),
          })}
        />
      </main>
    </div>
  )
}
