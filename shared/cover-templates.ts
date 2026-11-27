import type { CoverConfig, CoverTemplateKey } from './blocks'
import { formatEnParts } from './date'

/**
 * 결혼 표지 템플릿 1 · 2 · 3안 (dearday/P4-COVERS.md). 표지에 들어가는 글자를 만든다.
 * 날짜 · 요일 · 시간 · 이니셜은 예식 일시와 영문 이름에서 자동으로 만들고, 영문 이름은 사용자가 직접 넣는다(로마자 변환 없음).
 * 한국어 이름 · 예식장은 표지에 넣지 않는다(본문에 있음).
 */
export const COVER_TEMPLATES: readonly {
  key: CoverTemplateKey
  /** 편집기 · 표지 고르기에 보이는 이름 */
  name: string
  /** 한 줄 설명 */
  note: string
}[] = [
  { key: 'a', name: '1안', note: '작약 두 송이 · 큰 날짜' },
  { key: 'b', name: '2안', note: '금박 이름 · 작약 한 송이' },
  { key: 'c', name: '3안', note: '이중 테두리 · 필기체' },
  { key: 'x', name: '금박', note: 'MERRY CHRISTMAS · 큰 날짜' },
]

/** 결혼 초대장이 고르는 표지 안 / 크리스마스 초대장이 고르는 표지 안 */
export const WEDDING_TEMPLATE_KEYS: readonly CoverTemplateKey[] = ['a', 'b', 'c']
export const CHRISTMAS_TEMPLATE_KEYS: readonly CoverTemplateKey[] = ['x']

export function templateName(key: CoverTemplateKey): string {
  return COVER_TEMPLATES.find((t) => t.key === key)?.name ?? ''
}

export type CoverTemplateText = {
  /** 크리스마스 금박 표지에 들어가는 한글 제목 */
  title: string
  groom: string
  bride: string
  /** 두 이름이 다 있을 때만 이니셜 · 이름 줄을 보여 준다 */
  hasNames: boolean
  initialG: string
  initialB: string
  /** 예식 일시가 있을 때만 */
  date: null | {
    day: string // 26
    monthShort: string // DEC
    monthLong: string // December
    year: string // 2027
    yy: string // 27
    month2: string // 12
    day2: string // 26
    weekday: string // SUNDAY
    weekdayTitle: string // Sunday
    time: string // 5:30 PM
  }
  venue: string
  address: string
}

const up = (s: string) => s.trim().replace(/\s+/g, ' ').toUpperCase()

/** config + 예식 일시(ISO) → 표지 글자. 날짜 투표 중이면 날짜를 비운다 */
export function coverTemplateText(
  config: Pick<CoverConfig, 'groomEn' | 'brideEn' | 'venueEn' | 'addressEn'> & { title?: string },
  eventAt: string | null,
  dateVoting = false,
): CoverTemplateText {
  const groom = up(config.groomEn)
  const bride = up(config.brideEn)
  let date: CoverTemplateText['date'] = null
  if (eventAt && !dateVoting) {
    const p = formatEnParts(eventAt)
    date = {
      day: p.day,
      monthShort: p.monthShort,
      monthLong: p.monthLong,
      year: p.year,
      yy: p.year.slice(2),
      month2: p.month,
      day2: p.day.padStart(2, '0'),
      weekday: p.weekdayLong.toUpperCase(),
      weekdayTitle: p.weekdayLong,
      time: p.time,
    }
  }
  return {
    title: (config.title ?? '').trim(),
    groom,
    bride,
    hasNames: Boolean(groom && bride),
    initialG: groom.slice(0, 1),
    initialB: bride.slice(0, 1),
    date,
    venue: up(config.venueEn),
    address: up(config.addressEn),
  }
}

/**
 * 글자 수에 맞춘 글자 크기(디자인 px, 390 기준). 서체별 평균 글자 폭 배수(em)로 가로 여유에 들어오게 줄인다.
 * factor: 대문자 한 글자 폭 + 자간(em). Cinzel ≈ 0.86, Bodoni 대문자 ≈ 0.78
 */
export function fitSize(text: string, avail: number, max: number, factor: number, min = 14): number {
  const n = Math.max(text.length, 1)
  return Math.max(min, Math.min(max, avail / (n * factor)))
}

/** 공개 레포에 넣는 예시(가상의 이름 · 장소). 표지 고르기 · 편집기 썸네일용 */
export const SAMPLE_COVER = {
  groomEn: 'HANUL',
  brideEn: 'BORAM',
  venueEn: 'THE GARDEN HALL',
  addressEn: '12 SAMPLE-RO, SEOUL',
  eventAt: '2027-12-26T17:30:00+09:00',
} as const

/** 크리스마스 금박 표지 예시(가상의 이름) */
export const SAMPLE_CHRISTMAS_COVER = {
  groomEn: '',
  brideEn: '',
  venueEn: '',
  addressEn: '',
  title: '다솜네 크리스마스 홈파티',
  eventAt: '2026-12-24T19:00:00+09:00',
} as const
