'use client'

import type { MediaRef } from '@/shared/blocks'

import { api } from '../ui/api'

const MAX_SIDE = 1600

type Resized = { blob: Blob; width: number; height: number; type: 'image/webp' | 'image/jpeg' }

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

    const webp = await toBlob(canvas, 'image/webp', 0.8)
    if (webp && webp.type === 'image/webp') return { blob: webp, width, height, type: 'image/webp' }
    const jpeg = await toBlob(canvas, 'image/jpeg', 0.85)
    if (!jpeg) throw new Error('사진을 처리하지 못했어요.')
    return { blob: jpeg, width, height, type: 'image/jpeg' }
  } finally {
    URL.revokeObjectURL(url)
  }
}

type Presign = { uploadUrl: string; token: string }

/** 리사이즈 → 업로드 주소 받기 → 저장소에 직접 PUT → 완료 등록 */
export async function uploadImage(invitationId: string, file: File): Promise<MediaRef> {
  const { blob, width, height, type } = await resizeImage(file)
  const { uploadUrl, token } = await api<Presign>('/api/uploads/presign', {
    body: { invitationId, contentType: type, size: blob.size },
  })
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': type },
    body: blob,
  })
  if (!put.ok) throw new Error('사진을 올리지 못했어요. 잠시 후 다시 시도해 주세요.')
  return api<MediaRef>('/api/uploads/complete', { body: { token, width, height } })
}
