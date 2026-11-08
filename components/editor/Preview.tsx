'use client'

import BlockRenderer from '@/components/blocks/BlockRenderer'
import type { BlockContext } from '@/components/blocks/types'
import type { Block } from '@/shared/blocks'
import type { EditorBlock, InvitationMeta } from '@/shared/invitation'
import { FONTS } from '@/shared/fonts'
import { resolveFont, themeStyle } from '@/shared/themes'

import styles from './Editor.module.scss'

export default function Preview({
  meta,
  blocks,
  slug,
  mediaBaseUrl,
  kakaoJsKey,
}: {
  meta: InvitationMeta
  blocks: EditorBlock[]
  slug: string
  mediaBaseUrl: string
  kakaoJsKey: string
}) {
  const ctx: BlockContext = {
    slug,
    eventType: meta.eventType,
    title: meta.title,
    eventAt: meta.eventAt,
    mediaBaseUrl,
    kakaoJsKey,
    preview: true,
  }
  const fontCss = FONTS[resolveFont(meta.theme, meta.font)].css
  const view = blocks.map((b, position) => ({ ...b, position }) as Block)
  return (
    <div className={styles.previewScreen} style={themeStyle(meta.theme, meta.font)}>
      {fontCss ? <link rel="stylesheet" href={fontCss} precedence="font" /> : null}
      <BlockRenderer blocks={view} ctx={ctx} />
      {view.every((b) => !b.visible) ? (
        <p className={styles.previewEmpty}>보이는 블록이 없어요.</p>
      ) : null}
    </div>
  )
}
