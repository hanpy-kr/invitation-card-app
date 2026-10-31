import type { CSSProperties } from 'react'

/** 초대장 테마. CSS 변수로 블록 색을 바꾼다. */
export const THEMES = {
  classic: {
    label: '클래식',
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
    vars: {
      accent: '#3d5a98',
      text: '#2f3442',
      muted: '#737a8c',
      surface: '#f0f2f7',
      bg: '#ffffff',
    },
  },
} as const

export type ThemeKey = keyof typeof THEMES
export const THEME_KEYS = Object.keys(THEMES) as ThemeKey[]

export function isThemeKey(value: unknown): value is ThemeKey {
  return typeof value === 'string' && value in THEMES
}

export function themeStyle(theme: string): CSSProperties {
  const t = THEMES[isThemeKey(theme) ? theme : 'classic'].vars
  return {
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
