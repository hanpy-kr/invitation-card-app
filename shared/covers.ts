import type { EventType } from './blocks'

/**
 * 디자인 표지 목록. 새 표지는 아래 배열에 한 줄을 더하고,
 * public/covers/ 에 이미지 파일을 넣으면 끝 (scripts/make-cover.py <key> <원본그림> 이 파일을 만들어 줌):
 *   {key}-800.webp · {key}-1200.webp  (4:5 비율, q80, 각 120KB 이하)
 *   {key}-share.jpg                   (카톡 공유 카드용. 카카오는 webp를 못 읽어서 JPEG 사본이 필요)
 * key는 저장된 초대장이 가리키므로 한 번 정하면 바꾸지 말 것 (목록에서 빼면 그 초대장은 '글자만'으로 보임).
 */
export type CoverTone = 'dark' | 'light'

export type CoverDef = {
  key: string
  name: string
  /** 어울리는 행사 (앞에 오는 행사일수록 먼저 추천) */
  events: readonly EventType[]
  /** 그림 위 글자 톤: dark = 밝은 그림 위 어두운 글자, light = 어두운 그림 위 흰 글자 */
  tone: CoverTone
  src: string
}

const cover = (
  key: string,
  name: string,
  events: readonly EventType[],
  tone: CoverTone,
): CoverDef => ({ key, name, events, tone, src: `/covers/${key}` })

export const COVERS: readonly CoverDef[] = [
  cover('rose', '장미 부조', ['wedding', 'prewedding', 'thanks'], 'dark'),
  cover('poppy', '양귀비 부조', ['dol', 'thanks', 'wedding', 'birthday', 'housewarming'], 'dark'),
]

export const COVER_WIDTHS = [800, 1200] as const
/** 그림 비율 (가로:세로 = 4:5) */
export const COVER_RATIO = { w: 4, h: 5 } as const

export function findCover(key: string | null | undefined): CoverDef | undefined {
  return key ? COVERS.find((c) => c.key === key) : undefined
}

/** 이 행사에 어울리는 표지를 앞으로 (어울리는 것끼리는 목록 순서) */
export function coversForEvent(eventType: string): CoverDef[] {
  const rank = (c: CoverDef) => {
    const i = (c.events as readonly string[]).indexOf(eventType)
    return i === -1 ? 99 : i
  }
  return [...COVERS].sort((a, b) => rank(a) - rank(b))
}

/** 템플릿이 처음부터 쓰는 표지 */
export function defaultCoverKey(eventType: string): string | null {
  const first = coversForEvent(eventType)[0]
  return first && (first.events as readonly string[]).includes(eventType) ? first.key : null
}

export function coverSrc(c: CoverDef, width: (typeof COVER_WIDTHS)[number]): string {
  return `${c.src}-${width}.webp`
}

export function coverSrcSet(c: CoverDef): string {
  return COVER_WIDTHS.map((w) => `${coverSrc(c, w)} ${w}w`).join(', ')
}

/** 카톡 공유 카드 · og:image용 JPEG (상대 경로) */
export function coverShareSrc(c: CoverDef): string {
  return `${c.src}-share.jpg`
}
