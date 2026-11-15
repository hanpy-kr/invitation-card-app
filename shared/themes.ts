import type { CoverDef } from './covers'
import type { CSSProperties } from 'react'

import { DEFAULT_FONT, FONTS, isFontKey, type FontKey } from './fonts'

/** 초대장 테마. CSS 변수로 블록 색을 바꾼다. */
export const THEMES = {
  // 기본 테마 = 종이 편지 팔레트 (styles/global.scss 토큰과 같은 값). 옛 초대장의 'classic'도 이 모양으로 보임
  classic: {
    label: '종이 편지',
    font: 'noto-serif',
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
    // 홈 시안 E9와 같은 결: 흰 코튼지(무늬 없이 옅은 결만, 본문이 잘 읽히게), 글자 음각, 먹색 테두리.
    // 와인색은 빼고 포인트는 금박 계열(샴페인 골드)
    vars: {
      accent: '#8a7350',
      text: '#2f2a26',
      muted: '#6e655d',
      surface: '#f8f7f3',
      bg: '#f3f1ec',
      line: '#d9d4cb',
      btn: '#2f2a26',
      btnText: '#f3eadb',
      btnLine: 'rgba(47, 42, 38, 0.45)',
      deco: '#c9b48a',
      photo: '#e6e2da',
      paper: "url('/landing/paper-cover.webp')",
      deboss: '0 1px 0 rgba(255, 255, 255, 0.85), 0 -1px 0 rgba(60, 40, 20, 0.14)',
    },
  },
  blossom: {
    label: '블라썸',
    font: 'noto-serif',
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
    font: 'noto-serif',
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
    font: 'noto-serif',
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
  /** 종이 무늬 이미지(CSS url). 없으면 단색 */
  paper?: string
  /** 글자 음각 text-shadow. 없으면 평평한 글자 */
  deboss?: string
}

export function themeStyle(theme: string, font?: string | null, cover?: CoverDef): CSSProperties {
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
    '--paper-img': t.paper ?? 'none',
    '--deboss': t.deboss ?? 'none',
    '--cover-flower': t.deboss ? 'block' : 'none',
    '--section-rule': t.deboss ? 'block' : 'none',
    // 종이 편지 본문 2안 정리(영문 소제목 · 금박 · 서체 · 여백). 다른 테마는 이 변수가 없어 기존 모양
    ...(t.deboss && !cover?.dark ? CLASSIC_BODY_VARS : {}),
    ...(cover ? coverPaperVars(cover) : {}),
  } as CSSProperties
}

/** 디자인 표지를 쓰면 본문 종이를 그 표지 색에 맞춘다. 어두운 표지는 글자 · 포인트 · 버튼도 함께 */
function coverPaperVars(c: CoverDef): Record<string, string> {
  const v: Record<string, string> = {
    '--bg': c.paper,
    '--surface': c.surface,
    '--beige': c.surface,
    '--line': c.line,
    '--photo': `color-mix(in srgb, ${c.dark?.ink ?? '#4a4239'} 10%, ${c.paper})`,
    '--muted': c.sub,
    '--brown': c.sub,
    '--accent': c.point,
    '--red': c.point,
    // 디자인 표지는 표지 종이 색을 따르므로 작약 무늬는 끈다
    '--paper-img': 'none',
  }
  if (c.dark) {
    Object.assign(v, {
      '--deboss': 'none',
      '--text': c.dark.ink,
      '--black': c.dark.ink,
      '--muted': c.dark.sub,
      '--brown': c.dark.sub,
      '--accent': c.dark.point,
      '--red': c.dark.point,
      '--deco': c.dark.point,
      '--btn': c.dark.btn,
      '--btn-text': c.dark.btnText,
      '--btn-line': c.dark.btnLine,
    })
  }
  return v
}

/**
 * 종이 편지(classic) 본문 2안 정리 — 블록 스타일은 `var(--이름, 기존 값)`으로 읽으므로
 * 이 변수가 있을 때만 새 모양이 되고, 다른 테마에서는 기존 값으로 돌아간다.
 * (--cl-on: classic에서만 켜지는 요소의 display, --cl-off: classic에서 대신 끄는 기존 요소의 display)
 */
export const CLASSIC_BODY_VARS: Record<string, string> = {
  '--cl-on': 'block',
  '--cl-off': 'none',
  // 금박 글자 · 먹색 제목 · 보조 글자
  '--foil': '#a8915f',
  '--foil-deep': '#8c7546',
  '--foil-shadow': '0 1px 0 rgba(255,255,255,0.9), 0 -1px 0 rgba(90,68,30,0.22)',
  '--ink-strong': '#35291f',
  '--text': '#4a3f35',
  '--sub-1': '#5e5246',
  '--sub-2': '#8a7d6b',
  '--sub-3': '#6e5f4c',
  // 서체 (영문 대문자 · 숫자만 담은 woff2)
  '--font-cap': "'Cinzel', 'Times New Roman', serif",
  '--font-num': "'Bodoni Moda', 'Times New Roman', serif",
  // 섹션 여백 · 사이 구분선
  '--sec-pad': '76px 28px',
  '--eyebrow-display': 'block',
  '--cap-weight': '500',
  '--eyebrow-size': '10.5px',
  '--eyebrow-ls': '0.34em',
  '--eyebrow-gap': '10px',
  '--title-size': '19px',
  '--title-ls': '-0.01em',
  // 테두리 버튼 · 꽉 찬 먹색 버튼
  '--ghost-border': 'rgba(53,41,31,0.42)',
  '--ghost-bg': 'rgba(255,253,248,0.45)',
  '--ghost-h': '48px',
  '--ghost-bd-w': '1px',
  '--solid-bg': '#35291f',
  '--solid-text': '#f1e8d8',
  '--solid-shadow': '0 1px 0 rgba(255,255,255,0.18) inset, 0 6px 14px rgba(47,42,38,0.2)',
  '--solid-h': '52px',
  '--open-size': '15px',
  '--note-size': '12.5px',
  // 인사말
  '--msg-size': '14.5px',
  '--msg-lh': '1.95',
  '--para-gap': '18px',
  '--host-size': '17px',
  '--host-ls': '0.06em',
  '--star-size': '22px',
  '--star-gap': '18px',
  '--greet-head-gap': '10px',
  '--fam-mt': '30px',
  '--fam-pt': '0',
  '--fam-border': '0',
  '--fam-shadow': 'none',
  '--fam-size': '14px',
  '--fam-lh': '2.1',
  '--fam-rel': '12px',
  '--fam-b': '600',
  // 달력
  '--month-border': '0',
  '--cal-circle': '34px',
  '--cal-row': '46px',
  '--num-size': '15px',
  '--sun': '#a8915f',
  '--sat-color': '#4a3f35',
  '--today-bg': 'transparent',
  '--today-border': '1px solid #a8915f',
  '--today-ink': '#8c7546',
  '--today-size': '16px',
  '--today-shadow': '0 1px 0 rgba(255,255,255,0.9)',
  '--save-mt': '28px',
  '--save-gap': '22px',
  // 사진첩 · 오시는 길 · 연락하기 · 마음 전하실 곳
  '--quiet-head': 'none',
  '--gal-cols': '2',
  '--place-size': '18px',
  '--detail-size': '13.5px',
  '--addr-size': '13.5px',
  '--tmap-span': '1 / -1',
  '--way-line': 'rgba(110,85,55,0.16)',
  '--way-bt': '1px solid rgba(110,85,55,0.16)',
  '--way-pad': '16px 0',
  '--way-indent': '30px',
  '--way-weight': '600',
  '--link-cols': '2',
  '--way-gap': '12px',
  '--way-size': '14px',
  '--way-ico': '18px',
  '--contact-pad': '10px 4px',
  '--rel-w': '40px',
  '--rel-size': '12.5px',
  '--list-line': 'rgba(110,85,55,0.18)',
  '--grp-h': '0',
  '--grp-gap': '0',
  '--list-bg': 'transparent',
  '--contact-gap': '6px',
  '--contact-bb': '1px solid rgba(110,85,55,0.18)',
  '--rel-mr': '0',
  '--call-ico': '19px',
  '--grp-pad': '16px 4px',
  '--grp-size': '14.5px',
  '--grp-bb': '1px solid rgba(110,85,55,0.18)',
  '--grp-top': '1px solid rgba(110,85,55,0.18)',
  // 하단
  '--share-bd': '0',
  '--share-deco': 'underline',
  '--share-justify': 'center',
  '--share-flex': '0 0 auto',
  '--share-px': '6px',
  '--kakao-bg': 'transparent',
  '--kakao-bd': 'transparent',
  '--kakao-ink': '#35291f',
  '--brand-gap': '0',
  '--wm-h': '0',
  '--wm-weight': '600',
  '--wm-ls': '0.34em',
  '--wm-pl': '0.34em',
  '--copy-mt': '12px',
  '--copy-size': '11px',
  '--copy-ink': '#9a8f80',
  '--make-mt': '4px',
  '--make-h': '28px',
  '--make-size': '12.5px',
  '--make-opacity': '0.5',
  '--make-deco': 'none',
  '--share-gap': '180px',
  '--foot-pb': '56px',
}
