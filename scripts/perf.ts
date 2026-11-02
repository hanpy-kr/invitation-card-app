/**
 * 공개 초대장 로딩 측정: 모바일 390×844, 네트워크 Fast 4G, CPU 4배 느리게 (Chrome DevTools 조건).
 * 스크롤 없이 첫 화면만 열고, 네트워크가 잠잠해질 때까지의 수치를 잰다.
 *
 * 사용: pnpm perf /i/demowed1 [반복 횟수=3]   (서버가 PERF_BASE, 기본 http://localhost:3001에 떠 있어야 함)
 * 크롬: PLAYWRIGHT_CHROME=/usr/bin/google-chrome
 *
 * 지표
 * - fontSwap: 첫 화면 손글씨 폰트 조각이 모두 도착한 시점(ms, 탐색 시작 기준) = 시스템 글꼴 → 손글씨로 바뀌는 시점
 * - fcp / lcp: First / Largest Contentful Paint
 * - bytes: 첫 화면까지 받은 전송량(압축 후). 문서 · JS · CSS · 폰트 · 이미지별
 */
import { chromium, type CDPSession } from 'playwright'

const BASE = process.env.PERF_BASE ?? 'http://localhost:3001'
const PATH = process.argv[2] ?? '/i/demowed1'
const RUNS = Number(process.argv[3] ?? 3)

// Chrome DevTools 'Fast 4G' 프리셋과 같은 값 (다운 9Mbps · 업 1.5Mbps에 0.9 보정, 지연 60ms × 2.75)
const FAST_4G = {
  offline: false,
  downloadThroughput: ((9 * 1000 * 1000) / 8) * 0.9,
  uploadThroughput: ((1.5 * 1000 * 1000) / 8) * 0.9,
  latency: 60 * 2.75,
}

type Kind = 'document' | 'js' | 'css' | 'font' | 'image' | 'other'
function kindOf(url: string, mime: string): Kind {
  if (mime.includes('html')) return 'document'
  if (/\.woff2?(\?|$)/.test(url) || mime.includes('font')) return 'font'
  if (mime.includes('javascript') || /\.js(\?|$)/.test(url)) return 'js'
  if (mime.includes('css') || /\.css(\?|$)/.test(url)) return 'css'
  if (mime.startsWith('image/')) return 'image'
  return 'other'
}

type Run = {
  fontSwap: number | null
  fcp: number | null
  lcp: number | null
  bytes: Record<Kind | 'total', number>
  fontFiles: number
  requests: number
}

async function measure(): Promise<Run> {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROME || undefined,
  })
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: 'ko-KR',
  })
  const page = await context.newPage()
  // 카카오 SDK는 이 환경에서 닿지 않으므로 막아 둠 (전후 똑같이)
  await page.route(/kakao(cdn)?\.(com|net)/, (r) => r.abort())
  const cdp: CDPSession = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  await cdp.send('Network.emulateNetworkConditions', FAST_4G)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })

  const meta = new Map<string, { url: string; mime: string }>()
  const bytes: Run['bytes'] = { document: 0, js: 0, css: 0, font: 0, image: 0, other: 0, total: 0 }
  let fontFiles = 0
  let requests = 0
  cdp.on('Network.responseReceived', (e) =>
    meta.set(e.requestId, { url: e.response.url, mime: e.response.mimeType }),
  )
  cdp.on('Network.loadingFinished', (e) => {
    const m = meta.get(e.requestId)
    if (!m || m.url.startsWith('data:')) return
    const k = kindOf(m.url, m.mime)
    bytes[k] += e.encodedDataLength
    bytes.total += e.encodedDataLength
    requests++
    if (k === 'font') fontFiles++
  })

  await page.addInitScript(() => {
    const w = window as unknown as { __lcp: number }
    w.__lcp = 0
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__lcp = e.startTime
    }).observe({ type: 'largest-contentful-paint', buffered: true })
  })

  await page.goto(BASE + PATH, { waitUntil: 'networkidle', timeout: 120_000 })
  await page.waitForTimeout(500)

  const timings = await page.evaluate(() => {
    const fonts = performance
      .getEntriesByType('resource')
      .filter((e) => /\.woff2(\?|$)/.test(e.name)) as PerformanceResourceTiming[]
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null
    return {
      fontSwap: fonts.length ? Math.max(...fonts.map((f) => f.responseEnd)) : null,
      fcp,
      lcp: (window as unknown as { __lcp: number }).__lcp || null,
    }
  })
  await browser.close()
  return { ...timings, bytes, fontFiles, requests }
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

async function main() {
  const runs: Run[] = []
  for (let i = 0; i < RUNS; i++) runs.push(await measure())
  const pick = (f: (r: Run) => number | null) => {
    const xs = runs.map(f).filter((x): x is number => x !== null)
    return xs.length ? Math.round(median(xs)) : null
  }
  const kb = (n: number | null) => (n === null ? '-' : `${Math.round(n / 1024)}KB`)
  const result = {
    path: PATH,
    runs: RUNS,
    fontSwapMs: pick((r) => r.fontSwap),
    fcpMs: pick((r) => r.fcp),
    lcpMs: pick((r) => r.lcp),
    fontFiles: pick((r) => r.fontFiles),
    requests: pick((r) => r.requests),
    bytes: Object.fromEntries(
      (['total', 'document', 'js', 'css', 'font', 'image', 'other'] as const).map((k) => [
        k,
        pick((r) => r.bytes[k]),
      ]),
    ),
  }
  console.log(JSON.stringify(result))
  console.log(
    `${PATH} (중앙값 ${RUNS}회) 폰트 바뀜 ${result.fontSwapMs}ms · FCP ${result.fcpMs}ms · LCP ${result.lcpMs}ms · ` +
      `첫 화면 ${kb(result.bytes.total)} (폰트 ${kb(result.bytes.font)} ${result.fontFiles}개, 이미지 ${kb(result.bytes.image)}, JS ${kb(result.bytes.js)}, CSS ${kb(result.bytes.css)}, 문서 ${kb(result.bytes.document)})`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
