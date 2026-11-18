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
  introEffects,
  published,
  coverLock,
}: {
  meta: InvitationMeta
  blocks: EditorBlock[]
  slug: string
  mediaBaseUrl: string
  kakaoJsKey: string
  introEffects: boolean
  /** 발행 전이면 옅은 SAMPLE 표시를 깔아 캡처본이 진짜 초대장으로 쓰이지 않게 함 */
  published: boolean
  /** 프리미엄이 아닌데 1안 · 3안 표지를 고른 경우: 미리보기는 보여 주되 SAMPLE 표시 + 안내 */
  coverLock: { label: string; payHref: string | null; onUseFree: () => void } | null
}) {
  const ctx: BlockContext = {
    slug,
    eventType: meta.eventType,
    title: meta.title,
    eventAt: meta.eventAt,
    mediaBaseUrl,
    kakaoJsKey,
    introEffects,
    // 미리보기는 누구나 볼 수 있다 (발행할 때만 프리미엄 필요)
    coverTemplates: true,
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
      {published && !coverLock ? null : <div className={styles.sampleMark} aria-hidden="true" />}
      {coverLock ? (
        <div className={styles.coverLock} role="status">
          <strong>{coverLock.label} 표지는 발행하려면 프리미엄이 필요해요</strong>
          <span>미리보기는 누구나 볼 수 있어요. 2안 표지는 무료예요.</span>
          <div>
            {coverLock.payHref ? <a href={coverLock.payHref}>프리미엄 결제하기</a> : null}
            <button type="button" onClick={coverLock.onUseFree}>
              2안으로 바꾸기
            </button>
          </div>
        </div>
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
