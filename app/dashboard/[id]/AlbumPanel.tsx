'use client'

import { useEffect, useState } from 'react'

import { api } from '@/components/ui/api'
import { mediaSrc, thumbKey } from '@/shared/media'

import styles from './page.module.scss'

type Photo = {
  id: string
  key: string
  thumb: boolean
  hidden: boolean
  createdAt: string
  size: number
}

/** 주최자: 하객 앨범 — 숨기기 · 지우기 · 전체 받기(브라우저에서 한 장씩 받아 zip) */
export default function AlbumPanel({
  invitationId,
  mediaBaseUrl,
  title,
}: {
  invitationId: string
  mediaBaseUrl: string
  title: string
}) {
  const [photos, setPhotos] = useState<Photo[] | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api<{ photos: Photo[] }>(`/api/invitations/${invitationId}/album`)
      .then((d) => setPhotos(d.photos))
      .catch((e: Error) => setError(e.message))
  }, [invitationId])

  async function toggle(p: Photo) {
    try {
      await api(`/api/invitations/${invitationId}/album/${p.id}`, {
        method: 'PATCH',
        body: { hidden: !p.hidden },
      })
      setPhotos((l) => (l ?? []).map((x) => (x.id === p.id ? { ...x, hidden: !x.hidden } : x)))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function remove(p: Photo) {
    if (!window.confirm('이 사진을 지울까요? 되돌릴 수 없어요.')) return
    try {
      await api(`/api/invitations/${invitationId}/album/${p.id}`, { method: 'DELETE' })
      setPhotos((l) => (l ?? []).filter((x) => x.id !== p.id))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function downloadAll() {
    if (!photos?.length) return
    setError('')
    try {
      // zip 라이브러리는 이 버튼을 눌렀을 때만 내려받는다
      const { zipSync } = await import('fflate')
      const files: Record<string, Uint8Array> = {}
      for (let i = 0; i < photos.length; i++) {
        setBusy(`받는 중… (${i + 1}/${photos.length})`)
        const res = await fetch(`/api/invitations/${invitationId}/album/${photos[i].id}/file`)
        if (!res.ok) throw new Error('사진을 받지 못했어요. 잠시 후 다시 시도해 주세요.')
        const ext = photos[i].key.split('.').pop() ?? 'webp'
        files[`${String(i + 1).padStart(3, '0')}.${ext}`] = new Uint8Array(await res.arrayBuffer())
      }
      setBusy('묶는 중…')
      // 사진은 이미 압축돼 있어 zip은 묶기만(level 0)
      const zip = zipSync(files, { level: 0 })
      const url = URL.createObjectURL(new Blob([new Uint8Array(zip)], { type: 'application/zip' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `${(title || 'dearday').replace(/[\\/:*?"<>|]/g, '')}-하객앨범.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch (e) {
      setError((e as Error).message)
    }
    setBusy('')
  }

  const hidden = photos?.filter((p) => p.hidden).length ?? 0
  return (
    <section className={styles.album} aria-label="하객 앨범">
      <h2>
        하객 앨범{' '}
        <small>{photos ? `${photos.length}장${hidden ? ` · 숨김 ${hidden}장` : ''}` : ''}</small>
      </h2>
      {error ? <p className={styles.albumError}>{error}</p> : null}
      {photos === null ? (
        <p>불러오는 중…</p>
      ) : photos.length === 0 ? (
        <p>아직 하객이 올린 사진이 없어요.</p>
      ) : (
        <>
          <button
            type="button"
            className={styles.albumDownload}
            disabled={busy !== ''}
            onClick={downloadAll}
          >
            {busy || '전체 받기 (zip)'}
          </button>
          <ul>
            {photos.map((p) => (
              <li key={p.id} data-hidden={p.hidden}>
                <img
                  src={mediaSrc(mediaBaseUrl, p.thumb ? thumbKey(p.key) : p.key)}
                  alt=""
                  loading="lazy"
                />
                <div>
                  <button type="button" onClick={() => toggle(p)}>
                    {p.hidden ? '다시 보이기' : '숨기기'}
                  </button>
                  <button type="button" onClick={() => remove(p)}>
                    지우기
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
