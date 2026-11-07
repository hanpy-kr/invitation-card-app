import type { Block } from '@/shared/blocks'
import { mediaSrc, thumbKey } from '@/shared/media'

import Account from './account/Account'
import Cover from './Cover'
import Gallery from './gallery/Gallery'
import Greeting from './Greeting'
import Guestbook from './guestbook/Guestbook'
import Location from './location/Location'
import Rsvp from './rsvp/Rsvp'
import type { BlockContext } from './types'

/** 블록 하나를 타입에 맞는 컴포넌트로. 숨김 블록은 그리지 않는다. */
export function BlockView({ block, ctx }: { block: Block; ctx: BlockContext }) {
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
  }
}

export default function BlockRenderer({ blocks, ctx }: { blocks: Block[]; ctx: BlockContext }) {
  return (
    <>
      {[...blocks]
        .sort((a, b) => a.position - b.position)
        .map((block) => (
          <BlockView key={block.id} block={block} ctx={ctx} />
        ))}
    </>
  )
}
