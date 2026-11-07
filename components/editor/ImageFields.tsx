'use client'

import { useState } from 'react'

import { MAX_GALLERY_IMAGES, type MediaRef } from '@/shared/blocks'
import { getEntitlements } from '@/shared/entitlements'

const PHOTO_LIMIT = getEntitlements().photoLimit
import { mediaSrc, thumbKey } from '@/shared/media'

import { useEditorEnv } from './context'
import styles from './ImageFields.module.scss'
import { uploadImage } from './upload'

function useUploader() {
  const env = useEditorEnv()
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const remaining = Math.max(0, PHOTO_LIMIT - env.photoCount)

  async function run(files: File[], onEach: (ref: MediaRef) => void) {
    setError('')
    if (!env.uploadEnabled) {
      setError('사진 저장소가 아직 연결되지 않았어요.')
      return
    }
    if (files.length > remaining) {
      setError(`사진은 초대장당 ${PHOTO_LIMIT}장까지예요. ${remaining}장 더 올릴 수 있어요.`)
      files = files.slice(0, remaining)
    }
    for (let i = 0; i < files.length; i++) {
      setStatus(files.length > 1 ? `사진 올리는 중… (${i + 1}/${files.length})` : '사진 올리는 중…')
      try {
        onEach(await uploadImage(env.invitationId, files[i]))
      } catch (err) {
        setError((err as Error).message)
        break
      }
    }
    setStatus('')
  }

  return { env, status, error, remaining, run, busy: status !== '' }
}

function PickButton({
  label,
  multiple,
  disabled,
  onFiles,
}: {
  label: string
  multiple?: boolean
  disabled?: boolean
  onFiles: (files: File[]) => void
}) {
  return (
    <label className={styles.btn} aria-disabled={disabled}>
      {label}
      <input
        type="file"
        accept="image/*"
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          if (files.length) onFiles(files)
        }}
      />
    </label>
  )
}

export function SingleImageField({
  label,
  value,
  onChange,
}: {
  label: string
  value: MediaRef | null
  onChange: (ref: MediaRef | null) => void
}) {
  const { env, status, error, remaining, run, busy } = useUploader()
  return (
    <div className={styles.single}>
      <span className={styles.label}>{label}</span>
      {value ? (
        <div className={styles.preview}>
          <img src={mediaSrc(env.mediaBaseUrl, value.key)} alt="표지 사진 미리보기" />
        </div>
      ) : null}
      <div className={styles.buttons}>
        <PickButton
          label={value ? '사진 바꾸기' : '+ 사진 올리기'}
          disabled={busy || (!value && remaining === 0)}
          onFiles={(files) => run(files.slice(0, 1), onChange)}
        />
        {value ? (
          <button
            type="button"
            className={`${styles.btn} ${styles.solid}`}
            onClick={() => onChange(null)}
          >
            사진 빼기
          </button>
        ) : null}
      </div>
      {status ? <p className={styles.status}>{status}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  )
}

export function GalleryField({
  images,
  onChange,
}: {
  images: MediaRef[]
  /** 업로드가 여러 장 이어지므로 항상 최신 값 기준으로 바꾼다 */
  onChange: (fn: (images: MediaRef[]) => MediaRef[]) => void
}) {
  const { env, status, error, remaining, run, busy } = useUploader()
  const room = Math.min(remaining, MAX_GALLERY_IMAGES - images.length)

  const move = (idx: number, dir: -1 | 1) =>
    onChange((list) => {
      const next = [...list]
      const target = idx + dir
      if (target < 0 || target >= next.length) return list
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })

  return (
    <div>
      <span className={styles.label}>
        사진{' '}
        <em>
          {images.length}장 · 초대장 전체 {env.photoCount}/{PHOTO_LIMIT}장
        </em>
      </span>
      {images.length > 0 ? (
        <ul className={styles.grid}>
          {images.map((img, idx) => (
            <li key={img.id}>
              <img
                src={mediaSrc(env.mediaBaseUrl, img.thumb ? thumbKey(img.key) : img.key)}
                alt={`사진 ${idx + 1}`}
              />
              <div className={styles.tools}>
                <button
                  type="button"
                  aria-label="앞으로"
                  disabled={idx === 0}
                  onClick={() => move(idx, -1)}
                >
                  ←
                </button>
                <button
                  type="button"
                  aria-label="사진 빼기"
                  onClick={() => onChange((list) => list.filter((m) => m.id !== img.id))}
                >
                  ✕
                </button>
                <button
                  type="button"
                  aria-label="뒤로"
                  disabled={idx === images.length - 1}
                  onClick={() => move(idx, 1)}
                >
                  →
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      <PickButton
        label={room > 0 ? '+ 사진 추가 (여러 장 선택 가능)' : '사진을 더 올릴 수 없어요'}
        multiple
        disabled={busy || room <= 0}
        onFiles={(files) =>
          run(files.slice(0, MAX_GALLERY_IMAGES - images.length), (ref) =>
            onChange((list) => (list.length >= MAX_GALLERY_IMAGES ? list : [...list, ref])),
          )
        }
      />
      {status ? <p className={styles.status}>{status}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  )
}
