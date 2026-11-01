import { EVENT_TYPE_LABELS, type EventType } from './blocks'
import { formatEventDateTime } from './date'
import { mediaSrc } from './media'

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

/** 표지 사진 → 사진첩 첫 장 → 행사 종류별 기본 이미지. 상대 경로일 수 있음 */
export function shareImagePath(inv: ShareInput, mediaBaseUrl: string): string {
  for (const b of inv.blocks) {
    if (!b.visible) continue
    const c = b.config as {
      layout?: string
      image?: { key: string } | null
      images?: { key: string }[]
    }
    if (b.type === 'cover' && c.layout === 'photo' && c.image)
      return mediaSrc(mediaBaseUrl, c.image.key)
  }
  for (const b of inv.blocks) {
    const images = (b.config as { images?: { key: string }[] }).images
    if (b.type === 'gallery' && b.visible && images?.[0])
      return mediaSrc(mediaBaseUrl, images[0].key)
  }
  return `/og/${inv.eventType}`
}

export function absolute(siteUrl: string, pathOrUrl: string): string {
  return /^https?:\/\//.test(pathOrUrl) ? pathOrUrl : `${siteUrl.replace(/\/+$/, '')}${pathOrUrl}`
}
