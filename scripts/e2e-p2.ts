/**
 * 2차 P2 확인(로컬): 글씨체 · 테마 · 사진첩 · 영상/음악 · 감사장 · 하객 앨범 · 돌잡이 · 참석자 전용 안내 · 카톡 알림
 * 준비는 e2e-p1.ts와 같음 (운영 빌드, DEV_LOGIN=1, 서버 E2E_BASE) + 시드 새로(pnpm db:seed). 실행: pnpm e2e:p2
 */
import { mkdirSync } from 'node:fs'

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'

const BASE = process.env.E2E_BASE ?? 'http://localhost:3001'
const OUT = 'screenshots/e2e'
const PHOTOS = process.env.E2E_PHOTOS ?? '.local/e2e-photos'
const ONLY = process.env.ONLY?.split(',')

let failures = 0
function check(ok: unknown, label: string) {
  console.log(`${ok ? '✅' : '❌'} ${label}`)
  if (!ok) failures++
}

const mobile = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'ko-KR',
}

const FAKE_KAKAO_SDK = `
window.Kakao = {
  _key: null,
  isInitialized() { return !!this._key },
  init(k) { this._key = k },
  Share: { sendDefault(o) { window.__kakaoShare = o } },
}`

const errors: string[] = []

async function newPage(ctx: BrowserContext): Promise<Page> {
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('dialog', (d) => d.accept())
  await page.route('https://t1.kakaocdn.net/kakao_js_sdk/**', (r) =>
    r.fulfill({ contentType: 'text/javascript', body: FAKE_KAKAO_SDK }),
  )
  await page.route(/dapi\.kakao\.com/, (r) => r.abort())
  return page
}

async function guest(browser: Browser) {
  return newPage(await browser.newContext(mobile))
}

async function waitSaved(page: Page) {
  await page.getByRole('status').filter({ hasText: '저장됨' }).waitFor({ timeout: 15000 })
}

async function login(browser: Browser, next: string, as = '') {
  const ctx = await browser.newContext(mobile)
  const page = await newPage(ctx)
  await page.goto(
    `${BASE}/api/auth/kakao/login?dev=1${as ? `&as=${as}` : ''}&next=${encodeURIComponent(next)}`,
  )
  return { ctx, page }
}

async function publish(page: Page): Promise<string> {
  await page.getByRole('button', { name: /^(발행하기|공유하기)$/ }).click()
  const sheet = page.getByRole('dialog')
  const pub = sheet.getByRole('button', { name: '발행하기' })
  if (await pub.count()) await pub.click()
  await sheet.getByRole('heading', { name: '초대장이 발행됐어요' }).waitFor()
  const url = await sheet.getByLabel('초대장 주소').inputValue()
  await sheet.getByRole('button', { name: '닫기' }).click()
  return url
}

/** 새 초대장 만들기 → 편집기 */
async function createInvitation(browser: Browser, nameMatch: RegExp, as = '') {
  const { ctx, page } = await login(browser, '/new', as)
  await page.getByRole('button', { name: nameMatch }).first().click()
  await page.waitForURL(/\/edit\//)
  return { ctx, page, id: page.url().split('/').pop()! }
}

async function uploadPhotos(page: Page, n: number) {
  const files = Array.from({ length: n }, (_, i) => `${PHOTOS}/photo_${(i % 3) + 1}.jpg`)
  await page.locator('input[type=file]').first().setInputFiles(files)
}

/** ① 글씨체 · 테마 · 사진첩 레이아웃 */
async function designFlow(browser: Browser) {
  const { page: host } = await createInvitation(browser, /결혼식/)
  await host.getByLabel('초대장 제목').fill('E2E 디자인 확인')
  // 글씨체: 고운바탕 선택 → 미리보기 글씨체 변수 바뀜
  await host.getByRole('radio', { name: /고운바탕/ }).click()
  await waitSaved(host)
  const fam = await host
    .locator('[class*=previewScreen]')
    .first()
    .evaluate((el) => (el as HTMLElement).style.getPropertyValue('--font-display'))
  check(fam.includes('Gowun Batang'), '편집기 미리보기에 선택한 글씨체 적용')

  // 사진첩 3장 + 레이아웃 3종
  await host.getByRole('button', { name: '사진첩', exact: true }).click()
  await uploadPhotos(host, 3)
  await host
    .getByRole('button', { name: /사진 3장|3장/ })
    .first()
    .waitFor({ timeout: 5000 })
    .catch(() => {})
  await waitSaved(host)
  await host.getByRole('button', { name: '넘겨 보기' }).click()
  await waitSaved(host)
  const url = await publish(host)
  const slug = url.split('/i/')[1]

  const g = await guest(browser)
  await g.goto(`${BASE}/i/${slug}`, { waitUntil: 'networkidle' })
  const fontLink = await g.locator('link[rel=stylesheet][href*="/fonts/gowun-batang/"]').count()
  check(fontLink === 1, '공개 초대장: 고운바탕 CSS 한 번 불러옴')
  const fontUsed = await g.evaluate(async () => {
    await document.fonts.ready
    return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family)
  })
  check(
    fontUsed.some((f) => f.includes('Gowun Batang')),
    '공개 초대장: 고운바탕 실제로 로드됨',
  )
  const slideStrip = g.locator('ul[class*=slide]')
  check((await slideStrip.count()) === 1, '사진첩 넘겨 보기 렌더')
  check((await g.getByText('1 / 3').count()) === 1, '사진첩 넘겨 보기 번호 표시')
  await g.screenshot({ path: `${OUT}/p2-design-slide.png`, fullPage: true })

  // 기본 글씨체(금은보화)는 추가 CSS 없음
  const { page: h2 } = await createInvitation(browser, /결혼식/)
  await h2.getByRole('button', { name: '사진첩', exact: true }).click()
  await uploadPhotos(h2, 3)
  await waitSaved(h2)
  await h2.getByRole('button', { name: '원본 비율' }).click()
  await waitSaved(h2)
  const url2 = await publish(h2)
  const g2 = await guest(browser)
  await g2.goto(url2, { waitUntil: 'networkidle' })
  check(
    (await g2.locator('link[rel=stylesheet][href*="/fonts/gowun"]').count()) === 0,
    '기본 글씨체는 추가 글씨체 CSS 없음',
  )
  check((await g2.locator('ul[class*=ratio]').count()) === 1, '사진첩 원본 비율 렌더')
  await g2.screenshot({ path: `${OUT}/p2-design-ratio.png`, fullPage: true })
}

const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

/** ② 영상 · 배경음악 */
async function mediaFlow(browser: Browser) {
  const { page: host } = await createInvitation(browser, /송년회/)
  await host.getByLabel('초대장 제목').fill('E2E 영상 음악')
  await host.getByRole('button', { name: '+ 영상' }).click()
  await host.getByLabel('유튜브 주소').fill('https://youtu.be/dQw4w9WgXcQ?si=abc')
  await host.getByRole('button', { name: '+ 배경음악' }).click()
  check(
    (await host.getByText('저작권이 있는 음악은 올리지 마세요').count()) === 1,
    '음악 업로드 화면에 저작권 안내',
  )
  await host.locator('input[accept*=".mp3"]').setInputFiles(`${PHOTOS}/tone.mp3`)
  await host.locator('audio[controls]').waitFor({ timeout: 15000 })
  await host.getByLabel('곡 이름 (재생 버튼 옆에 보여요)').fill('E2E 테스트 음')
  await waitSaved(host)
  const url = await publish(host)

  const ctx = await browser.newContext(mobile)
  const g = await newPage(ctx)
  const hits: string[] = []
  g.on('request', (r) => hits.push(r.url()))
  await g.route(/i\.ytimg\.com/, (r) => r.fulfill({ contentType: 'image/gif', body: PIXEL }))
  await g.route(/youtube-nocookie\.com/, (r) =>
    r.fulfill({ contentType: 'text/html', body: '<html><body>yt</body></html>' }),
  )
  await g.goto(url, { waitUntil: 'networkidle' })
  const pre = (re: RegExp) => hits.filter((u) => re.test(u)).length
  check(pre(/youtube-nocookie\.com/) === 0, '누르기 전에는 유튜브 iframe 요청 없음')
  check((await g.locator('iframe').count()) === 0, '누르기 전에는 iframe이 DOM에 없음')
  check(pre(/i\.ytimg\.com\/vi\/dQw4w9WgXcQ/) === 1, '썸네일 이미지가 먼저 나옴')
  check(pre(/\.mp3/) === 0, '누르기 전에는 음악 파일 요청 없음')
  check((await g.locator('audio').count()) === 0, '자동 재생 없음(audio 요소 · 요청 없음)')
  await g.getByRole('button', { name: '영상 재생' }).click()
  const src = await g.locator('iframe').getAttribute('src')
  check(
    src?.startsWith('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ') === true,
    '누르면 youtube-nocookie iframe',
  )
  await g.getByRole('button', { name: '배경음악 재생' }).click()
  await g.getByRole('button', { name: '배경음악 멈추기' }).waitFor({ timeout: 8000 })
  check(pre(/\.mp3/) >= 1, '버튼을 누르면 그때 음악 파일 요청')
  await g.getByRole('button', { name: '배경음악 멈추기' }).click()
  await g.getByRole('button', { name: '배경음악 재생' }).waitFor()
  check(
    (await g.getByText('음악을 재생하지 못했어요').count()) === 0,
    '재생 · 멈춤 토글 (오류 문구 없음)',
  )
  await g.screenshot({ path: `${OUT}/p2-media.png` })
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROME || undefined,
  })
  const run = (name: string) => !ONLY || ONLY.includes(name)

  if (run('design')) await designFlow(browser)
  if (run('media')) await mediaFlow(browser)

  check(errors.length === 0, `브라우저 에러 없음 ${errors.length ? JSON.stringify(errors) : ''}`)
  await browser.close()
  console.log(failures === 0 ? '\nP2 E2E 통과' : `\nP2 E2E 실패 ${failures}건`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
