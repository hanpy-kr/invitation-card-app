import { getPublishedInvitation } from '@/lib/invitations'
import { siteUrl } from '@/lib/site'
import { buildIcs, firstPlace } from '@/shared/calendar'
import { shareTitle } from '@/shared/share'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 하객: 내 캘린더에 저장 (iOS · 안드로이드 기본 캘린더가 여는 .ics) */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const inv = await getPublishedInvitation(slug)
  if (!inv || !inv.eventAt) return new Response('초대장을 찾을 수 없어요.', { status: 404 })
  const ics = buildIcs({
    uid: `${inv.slug}@thedearday.com`,
    title: shareTitle({ ...inv, share: undefined }),
    start: inv.eventAt,
    place: firstPlace(inv.blocks),
    url: `${siteUrl()}/i/${inv.slug}`,
  })
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="dearday-${inv.slug}.ics"`,
      'Cache-Control': 'no-store',
    },
  })
}
