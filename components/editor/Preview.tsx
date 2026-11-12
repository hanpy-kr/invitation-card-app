'use client'

import { useState } from 'react'

import BlockRenderer from '@/components/blocks/BlockRenderer'
import type { BlockContext } from '@/components/blocks/types'
import type { Block } from '@/shared/blocks'
import type { EditorBlock, InvitationMeta } from '@/shared/invitation'
import { FONTS } from '@/shared/fonts'
import { designCoverOf } from '@/shared/covers'
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
  // 봉투 · 효과를 처음부터 다시 보기 (표지 블록을 새로 그림)
  const [play, setPlay] = useState(0)
  const cover = view.find((b) => b.type === 'cover' && b.visible)
  const hasIntro =
    cover?.type === 'cover' &&
    cover.config.layout === 'design' &&
    (cover.config.intro !== 'none' || cover.config.effect !== 'none')
  return (
    <div
      className={styles.previewScreen}
      style={themeStyle(meta.theme, meta.font, designCoverOf(view))}
    >
      {fontCss ? <link rel="stylesheet" href={fontCss} precedence="font" /> : null}
      {hasIntro ? (
        <button
          type="button"
          className={styles.replayPreview}
          onClick={() => setPlay((n) => n + 1)}
        >
          ↻ 다시 재생
        </button>
      ) : null}
      <div key={play}>
        <BlockRenderer blocks={view} ctx={ctx} />
      </div>
      {view.every((b) => !b.visible) ? (
        <p className={styles.previewEmpty}>보이는 블록이 없어요.</p>
      ) : null}
    </div>
  )
}
