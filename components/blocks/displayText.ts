import type { Block } from '@/shared/blocks'
import { formatShortDate } from '@/shared/date'

/**
 * 블록이 손글씨 폰트(@include display-font)로 그리는 글자들. 서버가 필요한 폰트 조각을 미리 받게 할 때 쓴다.
 * 블록 scss에서 display-font를 쓰는 자리를 바꾸면 여기도 같이 고칠 것:
 *  - Section 제목 (사진첩 · 오시는 길 · 참석 여부 · 방명록 · 계좌 · 안내)
 *  - Cover 날짜 · 큰 제목
 *  - Greeting 제목 · 인사말 · 보내는 사람(가운뎃점 포함)
 */
export function displayTextOf(blocks: Block[], eventAt: string | null): string {
  const parts: string[] = []
  for (const b of blocks) {
    if (!b.visible) continue
    switch (b.type) {
      case 'cover':
        if (b.config.showDate && eventAt) parts.push(formatShortDate(eventAt))
        parts.push(b.config.title)
        break
      case 'greeting':
        parts.push(b.config.title, b.config.message, ...b.config.hosts)
        if (b.config.hostSeparator === 'dot') parts.push('·')
        break
      case 'gallery':
        if (b.config.images.length > 0) parts.push(b.config.title)
        break
      case 'location':
        if (b.config.placeName || b.config.address) parts.push(b.config.title)
        break
      case 'account':
        if (b.config.perPerson || b.config.groups.some((g) => g.accounts.some((a) => a.number)))
          parts.push(b.config.title)
        break
      case 'notice':
        if (b.config.items.some((it) => it.title || it.body)) parts.push(b.config.title)
        break
      case 'rsvp':
      case 'guestbook':
        parts.push(b.config.title)
        break
    }
  }
  return parts.join('')
}
