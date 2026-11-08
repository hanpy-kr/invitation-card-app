import type { CSSProperties } from 'react'

import { DEFAULT_FONT, FONTS, isFontKey, type FontKey } from './fonts'

/** 초대장 테마. CSS 변수로 블록 색을 바꾼다. */
export const THEMES = {
  classic: {
    label: '클래식',
    font: 'geumeunbohwa',
    events: ['wedding', 'dol', 'etc'],
    vars: {
      accent: '#ea7664',
      text: '#544f4f',
      muted: '#89757a',
      surface: '#f6f5f5',
      bg: '#ffffff',
    },
  },
  blossom: {
    label: '블라썸',
    font: 'geumeunbohwa',
    events: ['wedding', 'dol', 'birthday'],
    vars: {
      accent: '#e88ea6',
      text: '#5b4a50',
      muted: '#9a8088',
      surface: '#fbf1f3',
      bg: '#fffdfd',
    },
  },
  mint: {
    label: '민트',
    font: 'geumeunbohwa',
    events: ['housewarming', 'meetup', 'etc'],
    vars: {
      accent: '#4fa58f',
      text: '#3f4d49',
      muted: '#7a8c87',
      surface: '#eff6f3',
      bg: '#ffffff',
    },
  },
  navy: {
    label: '네이비',
    font: 'geumeunbohwa',
    events: ['yearend', 'meetup', 'prewedding'],
    vars: {
      accent: '#3d5a98',
      text: '#2f3442',
      muted: '#737a8c',
      surface: '#f0f2f7',
      bg: '#ffffff',
    },
  },
  ivory: {
    label: '아이보리',
    font: 'gowun-batang',
    events: ['wedding', 'thanks'],
    vars: {
      accent: '#a9865b',
      text: '#4a443c',
      muted: '#8d8478',
      surface: '#f7f3ec',
      bg: '#fffdf9',
    },
  },
  sage: {
    label: '세이지',
    font: 'gowun-batang',
    events: ['wedding', 'thanks', 'housewarming'],
    vars: {
      accent: '#7a9a7e',
      text: '#3f4a41',
      muted: '#7f8c80',
      surface: '#f0f4ee',
      bg: '#fdfefc',
    },
  },
  sunny: {
    label: '써니',
    font: 'gowun-dodum',
    events: ['dol', 'birthday'],
    vars: {
      accent: '#e0a526',
      text: '#524a3a',
      muted: '#8f8570',
      surface: '#fdf6e3',
      bg: '#fffefa',
    },
  },
  sky: {
    label: '스카이',
    font: 'gaegu',
    events: ['dol', 'birthday', 'thanks'],
    vars: {
      accent: '#5b9fd6',
      text: '#3b4856',
      muted: '#7a8896',
      surface: '#eef5fb',
      bg: '#fdfeff',
    },
  },
  wine: {
    label: '와인',
    font: 'song-myung',
    events: ['yearend', 'prewedding', 'meetup'],
    vars: {
      accent: '#a23b4f',
      text: '#4b3a3e',
      muted: '#8a7378',
      surface: '#f8eff0',
      bg: '#fffdfd',
    },
  },
  pine: {
    label: '파인',
    font: 'gowun-dodum',
    events: ['yearend', 'housewarming', 'meetup'],
    vars: {
      accent: '#2f6b57',
      text: '#33403b',
      muted: '#71847c',
      surface: '#edf4f1',
      bg: '#fcfefd',
    },
  },
} as const

export type ThemeKey = keyof typeof THEMES
export const THEME_KEYS = Object.keys(THEMES) as ThemeKey[]

export function isThemeKey(value: unknown): value is ThemeKey {
  return typeof value === 'string' && value in THEMES
}

/** 이 행사에 잘 어울리는 테마를 앞으로 */
export function themesForEvent(eventType: string): ThemeKey[] {
  const fit = (k: ThemeKey) => (THEMES[k].events as readonly string[]).includes(eventType)
  return [...THEME_KEYS.filter(fit), ...THEME_KEYS.filter((k) => !fit(k))]
}

/** 글씨체를 따로 고르지 않았으면(null) 테마의 기본 글씨체 */
export function resolveFont(theme: string, font: string | null | undefined): FontKey {
  if (isFontKey(font)) return font
  const t = THEMES[isThemeKey(theme) ? theme : 'classic'].font
  return isFontKey(t) ? t : DEFAULT_FONT
}

export function themeStyle(theme: string, font?: string | null): CSSProperties {
  const t = THEMES[isThemeKey(theme) ? theme : 'classic'].vars
  const family = FONTS[resolveFont(theme, font)].family
  return {
    '--font-display': `'${family}'`,
    '--accent': t.accent,
    '--red': t.accent,
    '--text': t.text,
    '--black': t.text,
    '--muted': t.muted,
    '--brown': t.muted,
    '--surface': t.surface,
    '--beige': t.surface,
    '--bg': t.bg,
  } as CSSProperties
}
