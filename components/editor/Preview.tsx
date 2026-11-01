'use client'

import BlockRenderer from '@/components/blocks/BlockRenderer'
import type { BlockContext } from '@/components/blocks/types'
import type { Block } from '@/shared/blocks'
import type { EditorBlock, InvitationMeta } from '@/shared/invitation'
import { themeStyle } from '@/shared/themes'

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
  }
  const view = blocks.map((b, position) => ({ ...b, position }) as Block)
  return (
    <div className={styles.previewScreen} style={themeStyle(meta.theme)}>
      <BlockRenderer blocks={view} ctx={ctx} />
      {view.every((b) => !b.visible) ? (
        <p className={styles.previewEmpty}>보이는 블록이 없어요.</p>
      ) : null}
    </div>
  )
}
