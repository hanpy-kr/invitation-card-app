'use client'

import type { MediaRef } from '@/shared/blocks'

import { api } from '../ui/api'

const MAX_SIDE = 1600
/** 카톡 미리보기용 JPEG: 카카오가 800×400으로 스마트 크롭하므로 긴 변 1200px이면 충분 */
const SHARE_SIDE = 1200
/** 사진첩 바둑판 썸네일: 3열 × 480px 컬럼 × 레티나를 감안한 긴 변 */
const THUMB_SIDE = 480

type Resized = {
  blob: Blob
  width: number
  height: number
  type: 'image/webp' | 'image/jpeg'
  /** 공유용 JPEG 사본 */
  share: Blob
  /** 사진첩 썸네일(webp). webp 인코딩을 못 하는 브라우저면 null */
  thumb: Blob | null
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/** 긴 변 1600px · webp(q 0.8)로 줄임. webp 인코딩을 못 하는 브라우저는 jpeg로 */
export async function resizeImage(file: File): Promise<Resized> {
  if (!file.type.startsWith('image/')) throw new Error('사진 파일만 올릴 수 있어요.')
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    try {
      await img.decode()
    } catch {
      throw new Error('이 사진 형식은 열 수 없어요. JPG · PNG로 바꿔서 올려 주세요.')
    }
    // 브라우저가 EXIF 회전을 반영한 크기를 준다
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const width = Math.max(1, Math.round(img.naturalWidth * scale))
    const height = Math.max(1, Math.round(img.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('사진을 처리하지 못했어요.')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, width, height)

    const share = await shareJpeg(img)
    const thumb = await thumbWebp(img)
    const webp = await toBlob(canvas, 'image/webp', 0.8)
    if (webp && webp.type === 'image/webp') {
      return { blob: webp, width, height, type: 'image/webp', share, thumb }
    }
    const jpeg = await toBlob(canvas, 'image/jpeg', 0.85)
    if (!jpeg) throw new Error('사진을 처리하지 못했어요.')
    return { blob: jpeg, width, height, type: 'image/jpeg', share, thumb: null }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** 긴 변 maxSide로 줄인 캔버스 */
function scaledCanvas(img: HTMLImageElement, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('사진을 처리하지 못했어요.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas
}

/** 사진첩 썸네일: 긴 변 480px webp. webp를 못 만들면 null (바둑판에 원본을 씀) */
async function thumbWebp(img: HTMLImageElement): Promise<Blob | null> {
  const blob = await toBlob(scaledCanvas(img, THUMB_SIDE), 'image/webp', 0.75)
  return blob && blob.type === 'image/webp' ? blob : null
}

async function shareJpeg(img: HTMLImageElement): Promise<Blob> {
  const scale = Math.min(1, SHARE_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('사진을 처리하지 못했어요.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const blob = await toBlob(canvas, 'image/jpeg', 0.8)
  if (!blob) throw new Error('사진을 처리하지 못했어요.')
  return blob
}

type Presign = {
  uploadUrl: string
  shareUploadUrl: string
  thumbUploadUrl: string | null
  token: string
}

async function put(url: string, type: string, body: Blob) {
  const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': type }, body })
  if (!res.ok) throw new Error('사진을 올리지 못했어요. 잠시 후 다시 시도해 주세요.')
}

/** 리사이즈 → 업로드 주소 받기 → 저장소에 직접 PUT → 완료 등록 */
export async function uploadImage(invitationId: string, file: File): Promise<MediaRef> {
  const { blob, width, height, type, share, thumb } = await resizeImage(file)
  const { uploadUrl, shareUploadUrl, thumbUploadUrl, token } = await api<Presign>(
    '/api/uploads/presign',
    {
      body: {
        invitationId,
        contentType: type,
        size: blob.size,
        shareSize: share.size,
        ...(thumb ? { thumbSize: thumb.size } : {}),
      },
    },
  )
  // 원본(webp) · 카톡 미리보기용 JPEG 사본 · 사진첩 썸네일을 저장소에 직접 올림
  await Promise.all([
    put(uploadUrl, type, blob),
    put(shareUploadUrl, 'image/jpeg', share),
    thumb && thumbUploadUrl ? put(thumbUploadUrl, 'image/webp', thumb) : null,
  ])
  return api<MediaRef>('/api/uploads/complete', { body: { token, width, height } })
}

const AUDIO_BY_EXT: Record<string, 'audio/mpeg' | 'audio/mp4'> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
}
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024

/** 배경음악(mp3 · m4a, 10MB 이하) 올리기 — 사진과 달리 줄이지 않고 그대로 올림 */
export async function uploadAudio(invitationId: string, file: File): Promise<MediaRef> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const type = AUDIO_BY_EXT[ext]
  if (!type) throw new Error('mp3 또는 m4a 파일만 올릴 수 있어요.')
  if (file.size > MAX_AUDIO_BYTES) throw new Error('음악 파일은 10MB까지 올릴 수 있어요.')
  const { uploadUrl, token } = await api<{ uploadUrl: string; token: string }>(
    '/api/uploads/audio',
    { body: { invitationId, contentType: type, size: file.size } },
  )
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': type },
    body: file,
  })
  if (!res.ok) throw new Error('음악을 올리지 못했어요. 잠시 후 다시 시도해 주세요.')
  return api<MediaRef>('/api/uploads/complete', { body: { token, width: 1, height: 1 } })
}
