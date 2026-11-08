/**
 * 초대장 제목 · 인사말에 쓰는 글씨체. 모두 상업적 사용이 가능한 SIL OFL 1.1.
 * 출처와 라이선스는 docs/PLAN.md '글씨체' 표, 파일은 public/fonts/<id>/LICENSE.txt.
 * `css`가 있는 글씨체는 그걸 고른 초대장만 그 CSS를 불러온다 (기본 글씨체는 전역 CSS에 들어 있음).
 */
export const FONTS = {
  geumeunbohwa: {
    label: '금은보화',
    note: '손글씨',
    family: 'NanumGeumEunBoHwa',
    css: null,
  },
  'gowun-batang': {
    label: '고운바탕',
    note: '단정한 명조',
    family: 'Gowun Batang',
    css: '/fonts/gowun-batang/v1/font.css',
  },
  'gowun-dodum': {
    label: '고운돋움',
    note: '부드러운 고딕',
    family: 'Gowun Dodum',
    css: '/fonts/gowun-dodum/v1/font.css',
  },
  'song-myung': {
    label: '송명',
    note: '우아한 붓글씨',
    family: 'Song Myung',
    css: '/fonts/song-myung/v1/font.css',
  },
  gaegu: {
    label: '개구',
    note: '귀여운 손글씨',
    family: 'Gaegu',
    css: '/fonts/gaegu/v1/font.css',
  },
} as const

export type FontKey = keyof typeof FONTS
export const FONT_KEYS = Object.keys(FONTS) as FontKey[]
export const DEFAULT_FONT: FontKey = 'geumeunbohwa'

export function isFontKey(v: unknown): v is FontKey {
  return typeof v === 'string' && v in FONTS
}
