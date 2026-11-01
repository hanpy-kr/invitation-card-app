'use client'

import { useState } from 'react'

import type { EditorBlock, InvitationMeta } from '@/shared/invitation'

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
  const { id, slug, status, siteUrl, flush, onStatus, onClose } = props
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
            <div className={styles.shareRow}>
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
