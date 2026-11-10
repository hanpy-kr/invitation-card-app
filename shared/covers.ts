import type { EventType } from './blocks'

/**
 * 디자인 표지 목록. 새 표지는 아래 배열에 한 줄을 더하고,
 * public/covers/ 에 이미지 2개를 넣으면 끝:
 *   {key}-800.webp · {key}-1200.webp  (4:5 비율, 장당 160KB 이하)
 * 카톡 공유 카드용 JPEG(카카오는 webp를 못 읽음)는 빌드할 때 scripts/cover-share.mjs 가 자동으로 만든다.
 * key는 저장된 초대장이 가리키므로 한 번 정하면 바꾸지 말 것
 * (이름을 꼭 바꿔야 하면 LEGACY_KEYS 에 옛 key → 새 key를 적는다. 목록에서 그냥 빼면 그 초대장은 '글자만'으로 보임).
 */
export type CoverTone = 'dark' | 'light'

export type CoverDef = {
  key: string
  name: string
  /** 어울리는 행사 (앞에 오는 행사일수록 먼저 추천) */
  events: readonly EventType[]
  /** 그림 위 글자 톤: dark = 밝은 그림 위 어두운 글자, light = 어두운 그림 위 흰 글자 */
  tone: CoverTone
  /** 날짜 · 포인트 색 (그림 색에서 고름) */
  accent: string
  /** 그림 양옆 장식을 피해 글자를 둘 수 있는 가운데 폭을 정하는 좌우 여백(%). 기본 24 — 가운데가 좁은 그림은 크게 */
  padX: number
  src: string
}

const cover = (
  key: string,
  name: string,
  events: readonly EventType[],
  tone: CoverTone,
  accent: string,
  padX = 24,
): CoverDef => ({ key, name, events, tone, accent, padX, src: `/covers/${key}` })

export const COVERS: readonly CoverDef[] = [
  cover('wedding-poppy', '양귀비', ['wedding'], 'dark', '#a8715f'),
  cover('wedding-rose', '장미', ['wedding'], 'dark', '#a76a64', 26),
  cover('wedding-peony', '모란', ['wedding'], 'dark', '#b5706f', 25),
  cover('thanks-wildflower', '들꽃', ['thanks'], 'dark', '#9b6f78', 25),
  cover('dol-cloud', '구름', ['dol'], 'dark', '#a5788a', 22),
  cover('yearend-snow', '눈꽃', ['yearend'], 'light', '#d4af6a', 22),
  cover('prewedding-cheers', '건배', ['prewedding'], 'dark', '#a37b3c', 26),
  cover('birthday-balloon', '풍선', ['birthday'], 'dark', '#bf6a4c', 28),
  cover('housewarming-eucalyptus', '유칼립투스', ['housewarming'], 'dark', '#55724f', 22),
]

/** 처음 만든 표지 key(11/9)의 새 이름 */
const LEGACY_KEYS: Record<string, string> = {
  rose: 'wedding-rose',
  poppy: 'wedding-poppy',
}

export const COVER_WIDTHS = [800, 1200] as const
/** 그림 비율 (가로:세로 = 4:5) */
export const COVER_RATIO = { w: 4, h: 5 } as const

export function findCover(key: string | null | undefined): CoverDef | undefined {
  if (!key) return undefined
  const k = LEGACY_KEYS[key] ?? key
  return COVERS.find((c) => c.key === k)
}

const fitRank = (c: CoverDef, eventType: string) => {
  const i = (c.events as readonly string[]).indexOf(eventType)
  return i === -1 ? 99 : i
}

/** 이 행사에 어울리는 표지를 앞으로 (나머지도 뒤에 그대로 있음, 같은 순위끼리는 목록 순서) */
export function coversForEvent(eventType: string): CoverDef[] {
  return [...COVERS].sort((a, b) => fitRank(a, eventType) - fitRank(b, eventType))
}

export function coverFits(c: CoverDef, eventType: string): boolean {
  return fitRank(c, eventType) !== 99
}

/** 새 초대장이 처음 쓰는 표지: 행사에 어울리는 첫 표지, 없으면 null(글자만) */
export function defaultCoverKey(eventType: string): string | null {
  const first = coversForEvent(eventType)[0]
  return first && coverFits(first, eventType) ? first.key : null
}

export function coverSrc(c: CoverDef, width: (typeof COVER_WIDTHS)[number]): string {
  return `${c.src}-${width}.webp`
}

export function coverSrcSet(c: CoverDef): string {
  return COVER_WIDTHS.map((w) => `${coverSrc(c, w)} ${w}w`).join(', ')
}

/** 카톡 공유 카드 · og:image용 JPEG (상대 경로, 빌드 때 자동 생성) */
export function coverShareSrc(c: CoverDef): string {
  return `/covers/share/${c.key}.jpg`
}
