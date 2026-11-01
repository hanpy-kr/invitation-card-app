'use client'

import { useState } from 'react'

import type { EditorBlock, InvitationMeta } from '@/shared/invitation'
import { loadKakaoSdk } from '@/shared/kakao-sdk'
import { absolute, shareDescription, shareImagePath, shareTitle } from '@/shared/share'
import { hasPlaceholder } from '@/shared/templates'

import { api } from '../ui/api'
import styles from './Editor.module.scss'

type Props = {
  id: string
  slug: string
  status: 'draft' | 'published'
  meta: InvitationMeta
  blocks: EditorBlock[]
  siteUrl: string
  mediaBaseUrl: string
  kakaoJsKey: string
  flush: () => Promise<boolean>
  onStatus: (s: 'draft' | 'published') => void
  onClose: () => void
}

/** 발행 · 링크 복사 · 공유 시트 */
export default function PublishPanel(props: Props) {
  const { id, slug, status, siteUrl, flush, onStatus, onClose, kakaoJsKey } = props
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const url = `${siteUrl}/i/${slug}`

  async function setPublished(published: boolean) {
    setBusy(true)
    setMessage('')
    try {
      if (!(await flush()))
        throw new Error('저장하지 못해서 발행할 수 없어요. 잠시 후 다시 시도해 주세요.')
      const res = await api<{ status: 'draft' | 'published' }>(`/api/invitations/${id}/publish`, {
        body: { published },
      })
      onStatus(res.status)
    } catch (err) {
      setMessage((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const card = { ...props.meta, blocks: props.blocks }
  const title = shareTitle(card)
  const description = shareDescription(card)
  const warnings = checkBeforePublish(props.meta, props.blocks)
  const canWebShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  async function shareKakao() {
    setMessage('')
    try {
      const Kakao = await loadKakaoSdk(kakaoJsKey)
      const link = { mobileWebUrl: url, webUrl: url }
      Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title,
          description,
          imageUrl: absolute(siteUrl, shareImagePath(card, props.mediaBaseUrl)),
          link,
        },
        buttons: [{ title: '초대장 보기', link }],
      })
    } catch {
      setMessage('카카오톡 공유를 열지 못했어요. 링크를 복사해서 보내 주세요.')
    }
  }

  async function shareSystem() {
    try {
      await navigator.share({ title, text: description, url })
    } catch {
      // 사용자가 닫은 경우 등은 무시
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setMessage('링크를 복사했어요.')
    } catch {
      window.prompt('아래 링크를 복사하세요.', url)
    }
  }

  return (
    <div className={styles.sheetDim} onClick={onClose}>
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={status === 'published' ? '공유하기' : '발행하기'}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className={styles.sheetClose} aria-label="닫기" onClick={onClose}>
          ✕
        </button>
        {status === 'draft' ? (
          <>
            <h2>초대장을 발행할까요?</h2>
            <p className={styles.sheetDesc}>
              발행하면 링크를 받은 누구나 볼 수 있어요. 발행한 뒤에도 고친 내용은 바로 반영돼요.
            </p>
            {warnings.length > 0 ? (
              <ul className={styles.warnings} aria-label="발행 전에 확인해 보세요">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}
            <button
              type="button"
              className={styles.primary}
              disabled={busy}
              onClick={() => setPublished(true)}
            >
              {busy ? '발행하는 중…' : '발행하기'}
            </button>
          </>
        ) : (
          <>
            <h2>초대장이 발행됐어요</h2>
            <div className={styles.linkBox}>
              <input
                readOnly
                value={url}
                aria-label="초대장 주소"
                onFocus={(e) => e.target.select()}
              />
              <button type="button" onClick={copy}>
                복사
              </button>
            </div>
            {kakaoJsKey ? (
              <button type="button" className={styles.kakaoBtn} onClick={shareKakao}>
                카카오톡으로 보내기
              </button>
            ) : null}
            <div className={styles.shareRow}>
              {canWebShare ? (
                <button type="button" className={styles.secondary} onClick={shareSystem}>
                  다른 앱으로 공유
                </button>
              ) : null}
              <a href={url} target="_blank" rel="noopener noreferrer" className={styles.secondary}>
                초대장 열어 보기
              </a>
            </div>
            <button
              type="button"
              className={styles.textBtn}
              disabled={busy}
              onClick={() => {
                if (window.confirm('발행을 취소할까요? 링크로 들어와도 초대장이 보이지 않아요.')) {
                  void setPublished(false)
                }
              }}
            >
              발행 취소
            </button>
          </>
        )}
        {message ? (
          <p className={styles.sheetMsg} role="status">
            {message}
          </p>
        ) : null}
      </div>
    </div>
  )
}

/** 발행 전에 빠뜨리기 쉬운 것들 (발행은 막지 않음) */
function checkBeforePublish(meta: InvitationMeta, blocks: EditorBlock[]): string[] {
  const out: string[] = []
  const texts = [meta.title, ...blocks.filter((b) => b.visible).flatMap((b) => stringsIn(b.config))]
  if (texts.some(hasPlaceholder)) out.push('[신랑 이름] 같은 예시 문구가 아직 남아 있어요.')
  if (!meta.eventAt) out.push('행사 날짜를 아직 정하지 않았어요.')
  for (const b of blocks) {
    if (!b.visible) continue
    if (b.type === 'cover' && b.config.layout === 'photo' && !b.config.image) {
      out.push('표지 사진이 비어 있어요.')
    }
    if (b.type === 'location' && !b.config.address) out.push('오시는 길에 주소가 비어 있어요.')
    if (b.type === 'gallery' && b.config.images.length === 0)
      out.push('사진첩에 사진이 없어요 (빈 블록은 안 보여요).')
  }
  return out
}

function stringsIn(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(stringsIn)
  if (value && typeof value === 'object') return Object.values(value).flatMap(stringsIn)
  return []
}
