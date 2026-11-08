import type { Block } from '@/shared/blocks'
import { firstPlace } from '@/shared/calendar'
import { isDateVoting } from '@/shared/vote'
import { mediaSrc, thumbKey } from '@/shared/media'

import Account from './account/Account'
import Calendar from './calendar/Calendar'
import Contact from './contact/Contact'
import Cover from './Cover'
import Album from './album/Album'
import Music from './music/Music'
import Video from './video/Video'
import Vote from './vote/Vote'
import Gallery from './gallery/Gallery'
import Greeting from './Greeting'
import Guestbook from './guestbook/Guestbook'
import Location from './location/Location'
import Notice from './notice/Notice'
import Rsvp from './rsvp/Rsvp'
import type { BlockContext } from './types'

/** 블록 하나를 타입에 맞는 컴포넌트로. 숨김 블록은 그리지 않는다. */
export function BlockView({
  block,
  ctx,
  place = '',
}: {
  block: Block
  ctx: BlockContext
  /** 캘린더 블록용: 첫 장소 */
  place?: string
}) {
  if (!block.visible) return null
  switch (block.type) {
    case 'cover':
      return <Cover config={block.config} ctx={ctx} />
    case 'greeting':
      return <Greeting config={block.config} ctx={ctx} />
    case 'gallery':
      return (
        <Gallery
          title={block.config.title}
          layout={block.config.layout}
          images={block.config.images.map((m) => ({
            src: mediaSrc(ctx.mediaBaseUrl, m.key),
            // 바둑판은 썸네일, 크게 보기는 원본. 썸네일 표시가 없는 예전 사진은 원본
            thumbSrc: mediaSrc(ctx.mediaBaseUrl, m.thumb ? thumbKey(m.key) : m.key),
            w: m.w,
            h: m.h,
          }))}
        />
      )
    case 'location':
      return <Location config={block.config} kakaoJsKey={ctx.kakaoJsKey} />
    case 'rsvp':
      return <Rsvp config={block.config} ctx={ctx} />
    case 'guestbook':
      return <Guestbook config={block.config} ctx={ctx} />
    case 'account':
      return <Account config={block.config} />
    case 'notice':
      return <Notice config={block.config} ctx={ctx} />
    case 'calendar':
      return <Calendar config={block.config} ctx={ctx} place={place} />
    case 'contact':
      return <Contact config={block.config} />
    case 'vote':
      return <Vote config={block.config} ctx={ctx} />
    case 'video':
      return <Video config={block.config} />
    case 'music':
      return <Music config={block.config} ctx={ctx} />
    case 'album':
      return <Album config={block.config} ctx={ctx} />
  }
}

export default function BlockRenderer({ blocks, ctx }: { blocks: Block[]; ctx: BlockContext }) {
  const place = firstPlace(blocks)
  // 날짜 투표 중이면 아직 날짜가 없는 것처럼 (캘린더 · 인사말 날짜 숨김)
  const view = isDateVoting(blocks) ? { ...ctx, eventAt: null, dateVoting: true } : ctx
  return (
    <>
      {[...blocks]
        .sort((a, b) => a.position - b.position)
        .map((block) => (
          <BlockView key={block.id} block={block} ctx={view} place={place} />
        ))}
    </>
  )
}
