import type { Block } from '@/shared/blocks'
import { mediaSrc } from '@/shared/media'

import Cover from './Cover'
import Gallery from './gallery/Gallery'
import Greeting from './Greeting'
import Location from './location/Location'
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
            w: m.w,
            h: m.h,
          }))}
        />
      )
    case 'location':
      return <Location config={block.config} kakaoJsKey={ctx.kakaoJsKey} />
    case 'rsvp':
    case 'guestbook':
      // D3에서 구현
      return null
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
