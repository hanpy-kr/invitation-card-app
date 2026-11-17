import 'server-only'

import { preload } from 'react-dom'

import { FONTS, type FontKey } from '@/shared/fonts'

import geumeunbohwa from './display-font-slices.json'
import gaegu from './slices/gaegu.json'
import gowunBatang from './slices/gowun-batang.json'
import gowunDodum from './slices/gowun-dodum.json'
import notoSans from './slices/noto-sans-kr.json'
import notoSerif from './slices/noto-serif-kr.json'
import songMyung from './slices/song-myung.json'

/**
 * 제목 · 인사말 글씨체(빈도 슬라이스 · unicode-range) 중 이 텍스트를 그리는 데 필요한 조각만 미리 받게 한다.
 * 브라우저는 보통 CSS를 읽고 → 화면을 배치하고 → 글자를 발견한 뒤에야 폰트를 요청하므로,
 * HTML <head>의 preload로 그 대기를 없앤다. 주소 · crossOrigin이 @font-face와 정확히 같아야 재사용된다.
 */
type Slice = { url: string; ranges: [number, number][] }

const SLICES: Record<FontKey, Slice[]> = {
  'noto-serif': notoSerif as Slice[],
  'noto-sans': notoSans as Slice[],
  geumeunbohwa: geumeunbohwa as Slice[],
  'gowun-batang': gowunBatang as Slice[],
  'gowun-dodum': gowunDodum as Slice[],
  'song-myung': songMyung as Slice[],
  gaegu: gaegu as Slice[],
}

function sliceFor(slices: Slice[], cp: number): string | null {
  for (const s of slices) {
    for (const [a, b] of s.ranges) if (cp >= a && cp <= b) return s.url
  }
  return null
}

/** 텍스트에 필요한 조각 주소 (자주 쓰는 글자 조각 먼저) */
export function displayFontSlices(text: string, font: FontKey = 'geumeunbohwa'): string[] {
  const slices = SLICES[font]
  const urls = new Set<string>()
  const seen = new Set<number>()
  for (const ch of text) {
    const cp = ch.codePointAt(0)!
    if (seen.has(cp) || cp <= 0x20) continue
    seen.add(cp)
    const url = sliceFor(slices, cp)
    if (url) urls.add(url)
  }
  // slices는 빈도 높은 조각부터 정렬돼 있음
  return slices.map((s) => s.url).filter((u) => urls.has(u))
}

/** 서버 컴포넌트 렌더 중에 호출 → <head>에 <link rel="preload" as="font"> */
export function preloadDisplayFont(
  text: string,
  font: FontKey = 'geumeunbohwa',
  max = 12,
): string[] {
  const urls = displayFontSlices(text, font).slice(0, max)
  for (const href of urls)
    preload(href, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' })
  return urls
}

/** 기본이 아닌 글씨체의 CSS 주소 (기본 글씨체는 전역 CSS에 들어 있어 null) */
export function fontCssHref(font: FontKey): string | null {
  return FONTS[font].css
}
