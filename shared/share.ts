import { EVENT_TYPE_LABELS, type EventType } from './blocks'
import { formatEventDateTime } from './date'
import { mediaSrc, shareKey } from './media'

/** OG 태그와 카카오 공유 카드가 같은 제목 · 설명 · 이미지를 쓰도록 한 곳에서 만든다 */
type ShareBlock = { type: string; visible: boolean; config: unknown }

export type ShareInput = {
  title: string
  eventType: EventType
  eventAt: string | null
  blocks: ShareBlock[]
}

export function shareTitle(inv: ShareInput): string {
  return inv.title || EVENT_TYPE_LABELS[inv.eventType]
}

export function shareDescription(inv: ShareInput): string {
  const location = inv.blocks.find((b) => b.type === 'location' && b.visible)
  const place = location ? (location.config as { placeName?: string }).placeName : ''
  const when = inv.eventAt ? formatEventDateTime(inv.eventAt) : ''
  const text = [when, place].filter(Boolean).join(' · ')
  return text || `${EVENT_TYPE_LABELS[inv.eventType]}에 초대합니다.`
}

type PhotoRef = { key: string; share?: boolean }

/** 카카오 스크랩은 JPG/JPEG/PNG만 읽는다 */
const KAKAO_READABLE = /\.(jpe?g|png)$/i

/**
 * 공유 카드에 쓸 사진 주소. 없으면 null.
 * - JPEG 사본이 있으면 사본
 * - 사본이 없는 예전 사진: 원본이 JPG/PNG면 원본, webp면 쓸 수 없음(카톡 카드가 비어 보임)
 */
function sharePhoto(ref: PhotoRef, mediaBaseUrl: string): string | null {
  if (ref.share) return mediaSrc(mediaBaseUrl, shareKey(ref.key))
  if (KAKAO_READABLE.test(ref.key)) return mediaSrc(mediaBaseUrl, ref.key)
  return null
}

/**
 * 공유 카드 · og:image: 표지 사진 → 사진첩 사진 순서로 카톡에서 보이는 첫 사진,
 * 없으면 행사 종류별 기본 이미지(PNG). 상대 경로일 수 있음
 */
export function shareImagePath(inv: ShareInput, mediaBaseUrl: string): string {
  const candidates: PhotoRef[] = []
  for (const b of inv.blocks) {
    if (!b.visible) continue
    const c = b.config as { layout?: string; image?: PhotoRef | null }
    if (b.type === 'cover' && c.layout === 'photo' && c.image) candidates.push(c.image)
  }
  for (const b of inv.blocks) {
    if (!b.visible || b.type !== 'gallery') continue
    candidates.push(...((b.config as { images?: PhotoRef[] }).images ?? []))
  }
  for (const ref of candidates) {
    const src = sharePhoto(ref, mediaBaseUrl)
    if (src) return src
  }
  return `/og/${inv.eventType}`
}

export function absolute(siteUrl: string, pathOrUrl: string): string {
  return /^https?:\/\//.test(pathOrUrl) ? pathOrUrl : `${siteUrl.replace(/\/+$/, '')}${pathOrUrl}`
}
