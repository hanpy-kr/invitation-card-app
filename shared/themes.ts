import type { CSSProperties } from 'react'

import { DEFAULT_FONT, FONTS, isFontKey, type FontKey } from './fonts'

/** 초대장 테마. CSS 변수로 블록 색을 바꾼다. */
export const THEMES = {
  // 기본 테마 = 종이 편지 팔레트 (styles/global.scss 토큰과 같은 값). 옛 초대장의 'classic'도 이 모양으로 보임
  classic: {
    label: '종이 편지',
    font: 'gowun-batang',
    events: [
      'wedding',
      'dol',
      'etc',
      'thanks',
      'meetup',
      'yearend',
      'prewedding',
      'birthday',
      'housewarming',
    ],
    vars: {
      accent: '#8a6a43',
      text: '#4a4239',
      muted: '#6b6156',
      surface: '#f7f2e9',
      bg: '#f3ede2',
      line: '#d9ccb8',
      btn: '#6e5a44',
      btnText: '#f7f2e9',
      btnLine: '#cbb89c',
      deco: '#b79a74',
      photo: '#e6dccc',
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
      line: '#ecd5da',
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
      line: '#d3e2dc',
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
      line: '#d5d9e4',
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
      line: '#e4d9c6',
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
      line: '#d9e2d6',
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
      line: '#efe2bd',
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
      line: '#d3e2ef',
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
      line: '#ebd3d7',
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
      line: '#d0e0d9',
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

type ThemeVars = {
  accent: string
  text: string
  muted: string
  surface: string
  bg: string
  line?: string
  btn?: string
  btnText?: string
  btnLine?: string
  deco?: string
  photo?: string
}

export function themeStyle(theme: string, font?: string | null): CSSProperties {
  const t: ThemeVars = THEMES[isThemeKey(theme) ? theme : 'classic'].vars
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
    // 종이 팔레트가 아닌 테마는 글자색 · 면 색에서 버튼 · 선 색을 만든다
    '--line': t.line ?? `color-mix(in srgb, ${t.text} 14%, ${t.bg})`,
    '--btn': t.btn ?? t.text,
    '--btn-text': t.btnText ?? t.surface,
    '--btn-line': t.btnLine ?? `color-mix(in srgb, ${t.text} 28%, ${t.bg})`,
    '--deco': t.deco ?? `color-mix(in srgb, ${t.accent} 65%, ${t.bg})`,
    '--photo': t.photo ?? `color-mix(in srgb, ${t.text} 10%, ${t.bg})`,
  } as CSSProperties
}
