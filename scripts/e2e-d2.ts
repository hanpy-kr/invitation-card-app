/**
 * D2 완료 기준 확인: 로그인 → 생성 → 사진 3장 이상 업로드 → 발행 → 공개 링크에서 확인
 *
 * 카카오 키 없이도 돌도록 카카오 SDK(지도 · 공유)와 주소 검색 응답을 가짜로 바꿔 끼운다.
 * 그래서 우리 코드가 SDK를 어떻게 부르는지(지도 좌표, 공유 카드 내용)까지 확인한다.
 *
 * 준비: 서버가 E2E_BASE(기본 http://localhost:3001)에 떠 있고, 빌드 때
 *   NEXT_PUBLIC_KAKAO_JS_KEY=e2e-js-key, KAKAO_REST_API_KEY=e2e, DEV_LOGIN=1, NEXT_PUBLIC_SITE_URL=E2E_BASE
 * 사진: E2E_PHOTOS 폴더의 jpg 4장 이상. 없으면 2400×1600 테스트 사진 4장을 만들어 쓴다
 * 실행: pnpm exec tsx scripts/e2e-d2.ts
 */
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { chromium, type Page } from 'playwright'

const BASE = process.env.E2E_BASE ?? 'http://localhost:3001'
const PHOTOS = process.env.E2E_PHOTOS ?? '.local/e2e-photos'
const OUT = 'screenshots/e2e'

const FAKE_KAKAO_SDK = `
window.Kakao = {
  _key: null,
  isInitialized() { return !!this._key },
  init(k) { this._key = k },
  Share: { sendDefault(o) { window.__kakaoShare = o } },
}`

const FAKE_KAKAO_MAPS = `
window.kakao = { maps: {
  load(cb) { cb() },
  LatLng: function (lat, lng) { this.lat = lat; this.lng = lng },
  Map: function (el, opt) {
    el.dataset.lat = opt.center.lat; el.dataset.lng = opt.center.lng; el.dataset.draggable = String(opt.draggable)
    el.style.background = '#cfe3d8'
    this.setZoomable = function (z) { el.dataset.zoomable = String(z) }
  },
  Marker: function () { this.setMap = function () {} },
} }`

let failures = 0
function check(ok: unknown, label: string) {
  console.log(`${ok ? '✅' : '❌'} ${label}`)
  if (!ok) failures++
}

async function stubKakao(page: Page) {
  await page.route('https://t1.kakaocdn.net/kakao_js_sdk/**', (r) =>
    r.fulfill({ contentType: 'text/javascript', body: FAKE_KAKAO_SDK }),
  )
  await page.route('https://dapi.kakao.com/v2/maps/sdk.js**', (r) =>
    r.fulfill({ contentType: 'text/javascript', body: FAKE_KAKAO_MAPS }),
  )
  await page.route('**/api/geo/search**', (r) =>
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        results: [
          { name: '디어홀 웨딩', address: '서울 중구 세종대로 110', lat: 37.5663, lng: 126.9779 },
          { name: '디어홀 별관', address: '서울 중구 세종대로 112', lat: 37.567, lng: 126.978 },
        ],
      }),
    }),
  )
}

async function waitSaved(page: Page) {
  await page.getByRole('status').filter({ hasText: '저장됨' }).waitFor({ timeout: 15000 })
}

/** 테스트 사진 만들기: 큰 그라데이션 페이지를 jpg로 찍는다 */
async function makePhotos(browser: Awaited<ReturnType<typeof chromium.launch>>) {
  mkdirSync(PHOTOS, { recursive: true })
  const page = await browser.newPage({ viewport: { width: 2400, height: 1600 } })
  const colors = [
    ['#f6d5c9', '#8a5a6b'],
    ['#cde6d4', '#3d6b58'],
    ['#d6dcf2', '#3d4f8a'],
    ['#f3e6c4', '#8a6b2d'],
  ]
  for (const [i, [a, b]] of colors.entries()) {
    await page.setContent(
      `<body style="margin:0;height:100vh;background:linear-gradient(135deg,${a},${b});display:flex;align-items:center;justify-content:center;font:bold 260px sans-serif;color:#fff">${i + 1}</body>`,
    )
    await page.screenshot({
      path: path.join(PHOTOS, `photo_${i + 1}.jpg`),
      type: 'jpeg',
      quality: 95,
    })
  }
  await page.close()
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROME || undefined,
  })
  if (!existsSync(PHOTOS)) await makePhotos(browser)
  const photos = readdirSync(PHOTOS)
    .filter((f) => /\.jpe?g$/i.test(f))
    .map((f) => path.join(PHOTOS, f))
  if (photos.length < 4) throw new Error(`${PHOTOS}에 jpg가 4장 이상 필요합니다.`)

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'ko-KR',
    permissions: ['clipboard-read', 'clipboard-write'],
  })
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('dialog', (d) => d.accept())
  await stubKakao(page)

  // 1. 로그인 → 대시보드 → 새로 만들기
  await page.goto(`${BASE}/api/auth/kakao/login?dev=1&next=/dashboard`)
  await page.getByRole('link', { name: '+ 새 초대장 만들기' }).click()
  await page.getByRole('button', { name: /결혼식/ }).click()
  await page.waitForURL(/\/edit\//)
  check(true, '로그인 → 새 초대장(결혼식) 생성 → 편집기 열림')

  // 2. 기본 정보
  await page.getByLabel('초대장 제목').fill('E2E 박도윤 ♥ 한지우 결혼합니다')
  await page.getByLabel('날짜').fill('2026-12-05')
  await page.getByLabel('시간').fill('13:00')

  // 3. 표지 사진 1장
  await page.getByRole('button', { name: '표지', exact: true }).click()
  await page.locator('input[type=file]').first().setInputFiles(photos[0])
  await page.getByAltText('표지 사진 미리보기').waitFor({ timeout: 30000 })
  await page.getByLabel('큰 제목').fill('박도윤 · 한지우')

  // 4. 인사말 이름
  await page.getByRole('button', { name: '인사말', exact: true }).click()
  await page.getByRole('textbox', { name: '보내는 사람 1' }).fill('박도윤')
  await page.getByRole('textbox', { name: '보내는 사람 2' }).fill('한지우')

  // 5. 사진첩 3장
  await page.getByRole('button', { name: '사진첩', exact: true }).click()
  await page.locator('input[type=file][multiple]').setInputFiles(photos.slice(1, 4))
  await page.getByAltText('사진 3').waitFor({ timeout: 60000 })
  check(
    (await page.getByText(/초대장 전체 4\/10장/).count()) === 1,
    '사진 4장 업로드 (표지 1 + 사진첩 3), 한도 표시 4/10',
  )

  // 6. 오시는 길: 주소 검색 → 선택
  await page.getByRole('button', { name: '오시는 길', exact: true }).click()
  await page.getByLabel('장소 검색어').fill('디어홀')
  await page.getByRole('button', { name: '검색', exact: true }).click()
  await page.getByRole('button', { name: /디어홀 웨딩/ }).click()
  check(
    (await page.getByRole('textbox', { name: /^주소/ }).inputValue()) === '서울 중구 세종대로 110',
    '주소 검색 결과 선택 → 장소 · 주소 채워짐',
  )
  await page.getByLabel('지하철').fill('1 · 2호선 시청역 5번 출구')

  // 6-1. 계좌 (2차): 신랑 측 계좌번호 넣기 — 신부 측은 비워 둬도 빈 계좌는 안 보임
  await page.getByRole('button', { name: '계좌 · 회비', exact: true }).click()
  await page.getByLabel('그룹 1 계좌 1 은행').fill('카카오뱅크')
  await page.getByLabel('그룹 1 계좌 1 계좌번호').fill('3333-01-2345678')
  await page.getByLabel('예금주').first().fill('박도윤')

  // 6-2. 안내 (2차): 자리 표시 문구 바꾸기
  await page.getByRole('button', { name: '안내', exact: true }).click()
  await page.getByLabel('안내 2 내용').fill('지하 주차장 2시간 무료')

  // 6-3. 연락하기 (2차)
  await page.getByRole('button', { name: '연락하기', exact: true }).click()
  await page.getByLabel('연락처 1 전화번호').fill('010-1234-5678')
  await page.getByLabel('연락처 2 전화번호').fill('010-8765-4321')
  await waitSaved(page)
  check(true, '자동 저장 완료')
  await page.screenshot({ path: `${OUT}/1-editor.png`, fullPage: true })

  // 7. 발행
  await page.getByRole('button', { name: '발행하기' }).click()
  const sheet = page.getByRole('dialog')
  check(
    (await sheet.getByLabel('발행 전에 확인해 보세요').count()) === 0,
    '발행 전 확인 항목 없음 (다 채움)',
  )
  await sheet.getByRole('button', { name: '발행하기' }).click()
  await sheet.getByRole('heading', { name: '초대장이 발행됐어요' }).waitFor()
  const url = await sheet.getByLabel('초대장 주소').inputValue()
  check(/\/i\/[a-z0-9]{8}$/.test(url), `발행 → 공개 주소 ${url}`)
  await sheet.getByRole('button', { name: '복사' }).click()
  check((await page.evaluate(() => navigator.clipboard.readText())) === url, '링크 복사')
  await page.screenshot({ path: `${OUT}/2-publish.png` })

  await sheet.getByRole('button', { name: '카카오톡으로 보내기' }).click()
  await page.waitForFunction(() => (window as unknown as { __kakaoShare?: unknown }).__kakaoShare)
  const share = await page.evaluate(
    () =>
      (
        window as unknown as {
          __kakaoShare: { content: Record<string, unknown> & { link: Record<string, string> } }
        }
      ).__kakaoShare,
  )
  check(share.content.title === 'E2E 박도윤 ♥ 한지우 결혼합니다', '카카오 공유: 제목')
  check(
    String(share.content.description).startsWith('2026년 12월 5일 토요일 오후 1시 · 디어홀 웨딩'),
    `카카오 공유: 설명 "${share.content.description}"`,
  )
  check(
    /^https?:\/\/.+\.share\.jpg$/.test(String(share.content.imageUrl)),
    '카카오 공유: 표지 사진 JPEG 사본 절대 주소',
  )
  check(share.content.link.mobileWebUrl === url, '카카오 공유: 링크')
  const buttons = (
    share as unknown as { buttons: { title: string; link: { mobileWebUrl: string } }[] }
  ).buttons
  check(
    buttons.length === 2 &&
      buttons[1].title === '참석 여부 알리기' &&
      buttons[1].link.mobileWebUrl === `${url}?go=rsvp`,
    '카카오 공유: [초대장 보기] [참석 여부 알리기 → ?go=rsvp]',
  )

  // 8. 하객 화면 (로그인 안 한 새 브라우저)
  const guest = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  const gp = await guest.newPage()
  gp.on('pageerror', (e) => errors.push(e.message))
  await stubKakao(gp)
  // 지도 SDK · 방명록 목록은 화면에 가까워질 때만 불러와야 함
  const lazy = { map: 0, guestbook: 0 }
  gp.on('request', (r) => {
    if (r.url().includes('dapi.kakao.com/v2/maps/sdk.js')) lazy.map++
    if (r.url().includes('/guestbook')) lazy.guestbook++
  })
  const res = await gp.goto(url, { waitUntil: 'networkidle' })
  check(res?.status() === 200, '하객: 공개 링크 200')
  check(
    lazy.map === 0 && lazy.guestbook === 0,
    '하객: 첫 화면에서는 지도 SDK · 방명록 목록을 안 불러옴',
  )
  check(
    (await gp.getByRole('heading', { name: '박도윤 · 한지우' }).count()) === 1,
    '하객: 표지 제목',
  )
  check((await gp.getByText('SATURDAY').count()) === 1, '하객: 요일 계산 (12/5 토)')
  check((await gp.getByRole('button', { name: /크게 보기/ }).count()) === 3, '하객: 사진첩 3장')
  const gridSrcs = await gp
    .getByRole('button', { name: /크게 보기/ })
    .locator('img')
    .evaluateAll((imgs) => imgs.map((i) => (i as HTMLImageElement).getAttribute('src') ?? ''))
  check(
    gridSrcs.every((src) => src.endsWith('.thumb.webp')),
    '하객: 사진첩 바둑판은 썸네일(.thumb.webp)',
  )
  await gp.getByRole('button', { name: /사진 1 크게 보기/ }).click()
  const viewerSrc = await gp.getByRole('dialog').locator('img').first().getAttribute('src')
  check(viewerSrc !== null && !viewerSrc.includes('.thumb.'), '하객: 크게 보기는 원본')
  await gp.keyboard.press('Escape')
  const map = gp.getByRole('img', { name: '행사 장소 지도' })
  await map.scrollIntoViewIfNeeded()
  await gp.waitForFunction(() =>
    document.querySelector('[aria-label="행사 장소 지도"]')?.getAttribute('data-lat'),
  )
  check(lazy.map === 1, '하객: 지도 근처로 스크롤하면 지도 SDK를 그때 한 번 불러옴')
  check(
    (await map.getAttribute('data-lat')) === '37.5663' &&
      (await map.getAttribute('data-draggable')) === 'false',
    '하객: 카카오맵이 선택한 좌표로, 끌기 꺼진 채 그려짐',
  )
  check((await gp.getByRole('link', { name: '티맵' }).count()) === 1, '하객: 티맵 링크 (좌표 있음)')
  const guestbookLoaded = gp
    .waitForResponse((r) => r.url().includes('/guestbook'), { timeout: 10000 })
    .catch(() => null)
  await gp.getByRole('button', { name: '축하 글 남기기' }).scrollIntoViewIfNeeded()
  await guestbookLoaded
  check(lazy.guestbook >= 1, '하객: 방명록 근처로 스크롤하면 목록을 불러옴')
  const html = await (await fetch(url)).text()
  check(html.includes('property="og:title" content="E2E 박도윤 ♥ 한지우 결혼합니다"'), 'OG: 제목')
  const ogImage = html.match(/property="og:image" content="([^"]+)"/)?.[1] ?? ''
  check(/\.share\.jpg$/.test(ogImage), `OG: 표지 사진이 JPEG 사본 (${ogImage.split('/').pop()})`)
  const ogRes = await fetch(ogImage)
  check(
    ogRes.ok && ogRes.headers.get('content-type') === 'image/jpeg',
    `OG 이미지가 실제로 열림 (${ogRes.status} ${ogRes.headers.get('content-type')})`,
  )
  await gp.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 60))
    }
    window.scrollTo(0, 0)
  })
  await gp.waitForLoadState('networkidle')
  await gp.screenshot({ path: `${OUT}/3-guest.png`, fullPage: true })

  // 9. 발행 취소 → 하객 404
  await sheet.getByRole('button', { name: '발행 취소' }).click()
  await sheet.getByRole('heading', { name: '초대장을 발행할까요?' }).waitFor()
  check((await fetch(url)).status === 404, '발행 취소 → 공개 링크 404')
  await sheet.getByRole('button', { name: '발행하기' }).click()
  await sheet.getByRole('heading', { name: '초대장이 발행됐어요' }).waitFor()

  check(errors.length === 0, `브라우저 에러 없음 ${errors.length ? JSON.stringify(errors) : ''}`)
  await browser.close()
  console.log(failures === 0 ? '\nD2 E2E 통과' : `\nD2 E2E 실패 ${failures}건`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
