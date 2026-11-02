import 'server-only'

import { preload } from 'react-dom'

import slices from './display-font-slices.json'

/**
 * 손글씨 폰트(빈도 슬라이스 · unicode-range) 중 이 텍스트를 그리는 데 필요한 조각만 미리 받게 한다.
 * 브라우저는 보통 CSS를 읽고 → 화면을 배치하고 → 글자를 발견한 뒤에야 폰트를 요청하므로,
 * HTML <head>의 preload로 그 대기를 없앤다. 주소 · crossOrigin이 @font-face와 정확히 같아야 재사용된다.
 */
type Slice = { url: string; ranges: [number, number][] }

const SLICES = slices as Slice[]

function sliceFor(cp: number): string | null {
  for (const s of SLICES) {
    for (const [a, b] of s.ranges) if (cp >= a && cp <= b) return s.url
  }
  return null
}

/** 텍스트에 필요한 조각 주소 (자주 쓰는 글자 조각 먼저) */
export function displayFontSlices(text: string): string[] {
  const urls = new Set<string>()
  const seen = new Set<number>()
  for (const ch of text) {
    const cp = ch.codePointAt(0)!
    if (seen.has(cp) || cp <= 0x20) continue
    seen.add(cp)
    const url = sliceFor(cp)
    if (url) urls.add(url)
  }
  // SLICES는 빈도 높은 조각부터 정렬돼 있음
  return SLICES.map((s) => s.url).filter((u) => urls.has(u))
}

/** 서버 컴포넌트 렌더 중에 호출 → <head>에 <link rel="preload" as="font"> */
export function preloadDisplayFont(text: string, max = 12): string[] {
  const urls = displayFontSlices(text).slice(0, max)
  for (const href of urls)
    preload(href, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' })
  return urls
}
