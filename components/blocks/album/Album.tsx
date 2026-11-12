'use client'

import classNames from 'classnames/bind'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'

import { api } from '@/components/ui/api'
import type { AlbumConfig } from '@/shared/blocks'
import { mediaSrc, thumbKey } from '@/shared/media'

import Section from '../common/Section'
import { useNearViewport } from '../common/useNearViewport'
import type { BlockContext } from '../types'
import styles from './Album.module.scss'

const cx = classNames.bind(styles)
const ImageViewer = lazy(() => import('../gallery/ImageViewer'))

type Photo = { id: string; key: string; thumb: boolean; w: number; h: number }

/** 하객이 올린 사진의 삭제 토큰: 이 브라우저(localStorage)에만 있고 DB에는 해시만 있다 */
const tokenKey = (slug: string) => `dd-album-${slug}`
function readTokens(slug: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(tokenKey(slug)) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}
function writeTokens(slug: string, t: Record<string, string>) {
  try {
    localStorage.setItem(tokenKey(slug), JSON.stringify(t))
  } catch {
    // 저장이 막힌 브라우저에서는 올린 직후 화면에서만 지울 수 있음
  }
}

async function put(url: string, type: string, body: Blob) {
  const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': type }, body })
  if (!res.ok) throw new Error('사진을 올리지 못했어요. 잠시 후 다시 시도해 주세요.')
}

/** 하객 앨범: 사진 올리기(브라우저에서 긴 변 1600px webp로 줄인 뒤 저장소로 직접) + 모두 보기 + 내 사진 지우기 */
export default function Album({ config, ctx }: { config: AlbumConfig; ctx: BlockContext }) {
  const [ref, near] = useNearViewport<HTMLDivElement>('300px')
  const [photos, setPhotos] = useState<Photo[] | null>(null)
  const [mine, setMine] = useState<Record<string, string>>({})
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [viewer, setViewer] = useState(-1)
  const tokens = useRef<Record<string, string>>({})
  const closeViewer = useCallback(() => setViewer(-1), [])

  useEffect(() => {
    tokens.current = readTokens(ctx.slug)
    setMine(tokens.current)
  }, [ctx.slug])

  useEffect(() => {
    if (!near || ctx.preview) return
    let cancelled = false
    fetch(`/api/i/${ctx.slug}/album`)
      .then((r) => (r.ok ? r.json() : { photos: [] }))
      .then((d: { photos: Photo[] }) => !cancelled && setPhotos(d.photos))
      .catch(() => !cancelled && setPhotos([]))
    return () => {
      cancelled = true
    }
  }, [near, ctx.slug, ctx.preview])

  async function upload(files: File[]) {
    setError('')
    // 사진 줄이기 코드는 올리기를 누를 때에만 내려받는다
    const { resizeImage } = await import('@/components/editor/upload')
    for (let i = 0; i < files.length; i++) {
      setStatus(files.length > 1 ? `올리는 중… (${i + 1}/${files.length})` : '올리는 중…')
      try {
        const r = await resizeImage(files[i])
        const p = await api<{ uploadUrl: string; thumbUploadUrl: string | null; token: string }>(
          `/api/i/${ctx.slug}/album/presign`,
          {
            body: {
              contentType: r.type,
              size: r.blob.size,
              ...(r.thumb ? { thumbSize: r.thumb.size } : {}),
            },
          },
        )
        await Promise.all([
          put(p.uploadUrl, r.type, r.blob),
          r.thumb && p.thumbUploadUrl ? put(p.thumbUploadUrl, 'image/webp', r.thumb) : null,
        ])
        const done = await api<{ photo: Photo; deleteToken: string }>(
          `/api/i/${ctx.slug}/album/complete`,
          { body: { token: p.token, width: r.width, height: r.height } },
        )
        tokens.current = { ...tokens.current, [done.photo.id]: done.deleteToken }
        writeTokens(ctx.slug, tokens.current)
        setMine(tokens.current)
        setPhotos((list) => [done.photo, ...(list ?? [])])
      } catch (err) {
        setError((err as Error).message)
        break
      }
    }
    setStatus('')
  }

  async function removeMine(id: string) {
    if (!window.confirm('이 사진을 지울까요?')) return
    try {
      await api(`/api/i/${ctx.slug}/album/${id}`, {
        method: 'DELETE',
        body: { deleteToken: tokens.current[id] },
      })
      const next = { ...tokens.current }
      delete next[id]
      tokens.current = next
      writeTokens(ctx.slug, next)
      setMine(next)
      setPhotos((list) => (list ?? []).filter((p) => p.id !== id))
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const list = photos ?? []
  const viewerImages = list.map((p) => ({ src: mediaSrc(ctx.mediaBaseUrl, p.key), w: p.w, h: p.h }))

  return (
    <Section eyebrow="GUEST ALBUM" title={config.title}>
      <div ref={ref} className={cx('album')}>
        {config.message ? <p className={cx('message')}>{config.message}</p> : null}
        <p className={cx('notice')}>
          올린 사진은 이 초대장 링크를 받은 누구나 볼 수 있어요. 주최자가 숨기거나 지울 수 있고,
          내가 올린 사진은 이 기기에서 직접 지울 수 있어요.
        </p>
        <label className={cx('upload', { busy: status !== '' || ctx.preview })}>
          {status || '+ 사진 올리기'}
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={status !== '' || ctx.preview}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? [])
              e.target.value = ''
              if (files.length) void upload(files)
            }}
          />
        </label>
        {error ? (
          <p className={cx('error')} role="alert">
            {error}
          </p>
        ) : null}
        {ctx.preview ? (
          <p className={cx('empty')}>하객이 올린 사진이 여기에 모여요.</p>
        ) : photos === null ? null : list.length === 0 ? (
          <p className={cx('empty')}>아직 올라온 사진이 없어요. 첫 사진을 올려 주세요!</p>
        ) : (
          <ul className={cx('grid')}>
            {list.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={cx('thumb')}
                  onClick={() => setViewer(i)}
                  aria-label={`사진 ${i + 1} 크게 보기`}
                >
                  <img
                    src={mediaSrc(ctx.mediaBaseUrl, p.thumb ? thumbKey(p.key) : p.key)}
                    width={p.w}
                    height={p.h}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                </button>
                {mine[p.id] ? (
                  <button type="button" className={cx('del')} onClick={() => removeMine(p.id)}>
                    내 사진 지우기
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      {viewer > -1 ? (
        <Suspense fallback={null}>
          <ImageViewer images={viewerImages} initialIndex={viewer} onClose={closeViewer} />
        </Suspense>
      ) : null}
    </Section>
  )
}
