'use client'

import { useState } from 'react'

import type { ShareOverride } from '@/shared/blocks'
import type { EditorBlock, InvitationMeta } from '@/shared/invitation'
import { acceptsRsvp, shareDescription, shareImagePath, shareTitle } from '@/shared/share'

import { TextField } from './fields'
import { SingleImageField } from './ImageFields'
import styles from './ShareCard.module.scss'

/** 카톡 공유 카드 미리보기 + 직접 지정 (제목 · 설명 · 사진, 비우면 자동) */
export default function ShareCard({
  meta,
  blocks,
  mediaBaseUrl,
  onShare,
}: {
  meta: InvitationMeta
  blocks: EditorBlock[]
  mediaBaseUrl: string
  onShare: (fn: (s: ShareOverride) => ShareOverride) => void
}) {
  const [open, setOpen] = useState(false)
  const card = { ...meta, blocks }
  const set = (patch: Partial<ShareOverride>) => onShare((s) => ({ ...s, ...patch }))
  // 직접 지정 칸을 비웠을 때 쓰일 자동 값 (안내용)
  const auto = { ...meta, share: undefined, blocks }

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <strong>카톡 미리보기</strong>
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? '닫기' : '카드 바꾸기'}
        </button>
      </div>
      <figure className={styles.card} aria-label="카카오톡 공유 카드 미리보기">
        <img src={shareImagePath(card, mediaBaseUrl)} alt="" />
        <figcaption>
          <b>{shareTitle(card)}</b>
          <span>{shareDescription(card)}</span>
        </figcaption>
        <div className={styles.buttons}>
          <span>초대장 보기</span>
          {acceptsRsvp(blocks) ? <span>참석 여부 알리기</span> : null}
        </div>
      </figure>
      {open ? (
        <div className={styles.form}>
          <TextField
            label="카드 제목"
            hint="비우면 초대장 제목"
            value={meta.share.title}
            maxLength={60}
            placeholder={shareTitle(auto)}
            onChange={(title) => set({ title })}
          />
          <TextField
            label="카드 설명"
            hint="비우면 날짜 · 장소"
            value={meta.share.description}
            maxLength={100}
            placeholder={shareDescription(auto)}
            onChange={(description) => set({ description })}
          />
          <SingleImageField
            label="카드 사진 (비우면 표지 사진)"
            value={meta.share.image}
            onChange={(image) => set({ image })}
          />
        </div>
      ) : null}
    </div>
  )
}
