/**
 * 2차 P2 확인(로컬): 글씨체 · 테마 · 사진첩 · 영상/음악 · 감사장 · 하객 앨범 · 돌잡이 · 참석자 전용 안내 · 카톡 알림
 * 준비는 e2e-p1.ts와 같음(깨끗한 상태에서 시작: 시드 외 초대장 삭제 후 pnpm db:seed) (운영 빌드, DEV_LOGIN=1, 서버 E2E_BASE) + 시드 새로(pnpm db:seed). 실행: pnpm e2e:p2
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, statSync } from 'node:fs'

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

/** ③ 감사장: 결혼 초대장 → [감사장 만들기] */
async function thanksFlow(browser: Browser) {
  const { page: host } = await createInvitation(browser, /결혼식/)
  await host.getByLabel('초대장 제목').fill('E2E 감사장 원본 결혼')
  await host.getByRole('button', { name: '표지', exact: true }).click()
  await host.locator('input[type=file]').first().setInputFiles(`${PHOTOS}/photo_1.jpg`)
  await host.getByAltText('표지 사진 미리보기').waitFor({ timeout: 30000 })
  const srcCover = await host.getByAltText('표지 사진 미리보기').getAttribute('src')
  await host.getByRole('button', { name: '인사말', exact: true }).click()
  await host.getByRole('textbox', { name: '보내는 사람 1' }).fill('태윤')
  await host.getByRole('textbox', { name: '보내는 사람 2' }).fill('하은')
  await host.getByRole('button', { name: '사진첩', exact: true }).click()
  await uploadPhotos(host, 3)
  await host.getByText(/3장 ·/).waitFor({ timeout: 30000 })
  await waitSaved(host)

  await host.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
  const card = host.locator('li').filter({ hasText: 'E2E 감사장 원본 결혼' })
  await card.getByRole('button', { name: '감사장 만들기' }).click()
  await host.waitForURL(/\/edit\//)
  const thanksId = host.url().split('/').pop()!
  check(
    (await host.getByLabel('초대장 제목').inputValue()) === '태윤 · 하은 감사 인사',
    '감사장: 이름이 채워진 제목',
  )
  check((await host.getByLabel('행사 종류').inputValue()) === 'thanks', '감사장: 행사 종류 thanks')
  await host.getByRole('button', { name: '표지', exact: true }).click()
  const newCover = await host.getByAltText('표지 사진 미리보기').getAttribute('src')
  check(
    newCover && srcCover && newCover !== srcCover && newCover.includes(`/inv/${thanksId}/`),
    '감사장: 표지 사진은 새 key로 복사',
  )
  await host.getByRole('button', { name: '사진첩', exact: true }).click()
  check((await host.getByText(/3장 ·/).count()) >= 1, '감사장: 사진첩 사진 3장 복사')
  check(
    (await host.getByRole('button', { name: '+ 참석 여부' }).count()) === 1,
    '감사장에는 참석 블록이 처음부터 없음(추가 목록에만 있음)',
  )
  const url = await publish(host)
  const g = await guest(browser)
  await g.goto(url, { waitUntil: 'networkidle' })
  check(
    (await g.getByText('태윤').count()) >= 1 && (await g.getByText('하은').count()) >= 1,
    '감사장 공개 화면: 보내는 사람',
  )
  check((await g.getByText('함께한 순간').count()) === 1, '감사장 공개 화면: 사진첩')
  check((await g.getByText('참석 의사 전달').count()) === 0, '감사장 공개 화면: 참석 응답 없음')
  await g.screenshot({ path: `${OUT}/p2-thanks.png`, fullPage: true })
}

const DB_URL = process.env.DATABASE_URL ?? 'postgres://dearday:dearday@localhost:5432/dearday'
const sql = (q: string) => execFileSync('psql', [DB_URL, '-tAc', q], { encoding: 'utf8' }).trim()

/** ④ 하객 앨범 + 개인정보처리방침 */
async function albumFlow(browser: Browser) {
  const { page: host, id } = await createInvitation(browser, /송년회/)
  await host.getByLabel('초대장 제목').fill('E2E 하객 앨범')
  await host.getByRole('button', { name: '+ 하객 앨범' }).click()
  check(
    (await host.getByText('링크를 받은 누구나 볼 수 있고').count()) === 1,
    '편집기: 앨범 공개 범위 안내',
  )
  await waitSaved(host)
  const url = await publish(host)
  const slug = url.split('/i/')[1]

  // 하객 A: 사진 2장 올리기
  const ga = await guest(browser)
  await ga.goto(url, { waitUntil: 'networkidle' })
  await ga.getByRole('heading', { name: '하객 앨범' }).scrollIntoViewIfNeeded()
  await ga.getByText('아직 올라온 사진이 없어요').waitFor({ timeout: 10000 })
  await ga
    .locator('input[type=file]')
    .last()
    .setInputFiles([`${PHOTOS}/photo_1.jpg`, `${PHOTOS}/photo_2.jpg`])
  await ga.getByRole('button', { name: '내 사진 지우기' }).nth(1).waitFor({ timeout: 40000 })
  check(
    (await ga.getByRole('button', { name: '내 사진 지우기' }).count()) === 2,
    '하객 A: 2장 올림 · 내 사진 지우기 2개',
  )
  const rows = sql(
    `select storage_key, size_bytes, token_hash from album_photos where invitation_id='${id}'`,
  ).split('\n')
  check(
    rows.length === 2 && rows.every((r) => r.startsWith('album/' + id + '/')),
    '파일은 album/{초대장}/ 아래',
  )
  const tokens = await ga.evaluate(
    (sl) => JSON.parse(localStorage.getItem('dd-album-' + sl) ?? '{}'),
    slug,
  )
  const tokenValues = Object.values(tokens) as string[]
  check(
    tokenValues.length === 2 && tokenValues.every((t) => t.length === 43),
    '삭제 토큰 원문은 하객 브라우저 localStorage에만',
  )
  check(
    tokenValues.every((t) => !rows.join('\n').includes(t)) &&
      rows.every((r) => r.split('|')[2].length === 43),
    'DB에는 토큰 해시만(원문 없음)',
  )
  const webp = sql(
    `select count(*) from album_photos where invitation_id='${id}' and storage_key like '%.webp'`,
  )
  check(webp === '2', '올린 사진은 브라우저에서 줄인 webp')
  const maxW = sql(
    `select max(greatest(width,height)) from album_photos where invitation_id='${id}'`,
  )
  check(Number(maxW) <= 1600, `긴 변 1600px 이하 (${maxW}px)`)

  // 하객 B: 다른 기기 — A의 사진이 보이고, 지우기 버튼은 없음. 1장 올림
  const gb = await guest(browser)
  await gb.goto(url, { waitUntil: 'networkidle' })
  await gb.getByRole('heading', { name: '하객 앨범' }).scrollIntoViewIfNeeded()
  await gb.locator('ul[class*=grid] li').nth(1).waitFor({ timeout: 10000 })
  check((await gb.locator('ul[class*=grid] li').count()) === 2, '하객 B: A가 올린 2장이 보임')
  check(
    (await gb.getByRole('button', { name: '내 사진 지우기' }).count()) === 0,
    '하객 B: 남의 사진에는 지우기 없음',
  )
  const aPhotoId = sql(
    `select id from album_photos where invitation_id='${id}' order by created_at limit 1`,
  )
  const bad = await gb.request.delete(`${BASE}/api/i/${slug}/album/${aPhotoId}`, {
    data: { deleteToken: 'x'.repeat(43) },
  })
  check(bad.status() === 404, '엉뚱한 토큰으로는 삭제 불가(404)')
  await gb.locator('input[type=file]').last().setInputFiles(`${PHOTOS}/photo_3.jpg`)
  await gb.getByRole('button', { name: '내 사진 지우기' }).waitFor({ timeout: 30000 })
  check(
    sql(`select count(*) from album_photos where invitation_id='${id}'`) === '3',
    'B가 1장 올려 총 3장',
  )

  // A가 자기 사진 1장 지움
  await ga.getByRole('button', { name: '내 사진 지우기' }).first().click()
  await ga
    .locator('ul[class*=grid] li')
    .nth(2)
    .waitFor({ state: 'detached', timeout: 10000 })
    .catch(() => {})
  await ga.waitForTimeout(500)
  check(
    sql(`select count(*) from album_photos where invitation_id='${id}'`) === '2',
    'A가 자기 사진 삭제 → 2장',
  )

  // 주최자: 대시보드 숨기기 · 삭제 · 전체 받기
  await host.goto(`${BASE}/dashboard/${id}`, { waitUntil: 'networkidle' })
  const panel = host.getByRole('region', { name: '하객 앨범' })
  await panel.getByText('2장').first().waitFor({ timeout: 10000 })
  await panel.getByRole('button', { name: '숨기기' }).first().click()
  await panel.getByText('숨김 1장').waitFor()
  const hiddenList = await (await ga.request.get(`${BASE}/api/i/${slug}/album`)).json()
  check(hiddenList.photos.length === 1, '숨기면 하객 목록에서 빠짐')
  const [download] = await Promise.all([
    host.waitForEvent('download', { timeout: 30000 }),
    panel.getByRole('button', { name: /전체 받기/ }).click(),
  ])
  const zipPath = `${OUT}/p2-album.zip`
  await download.saveAs(zipPath)
  const listing = execFileSync('unzip', ['-l', zipPath], { encoding: 'utf8' })
  check(
    / 2 files/.test(listing) && statSync(zipPath).size > 1000,
    '전체 받기: 숨긴 사진 포함 2장 zip',
  )
  await panel.getByRole('button', { name: '지우기' }).first().click()
  await panel.getByText('1장').first().waitFor()
  check(
    sql(`select count(*) from album_photos where invitation_id='${id}'`) === '1',
    '주최자 삭제 → 1장',
  )
  await host.screenshot({ path: `${OUT}/p2-album-dashboard.png`, fullPage: true })
  const noAuth = await ga.request.get(`${BASE}/api/invitations/${id}/album`)
  check(noAuth.status() === 401, '주최자 API는 로그인 필요(하객 401)')

  // 한도: IP당 하루 30장 · 초대장당 200장
  sql('delete from rate_limits')
  let accepted = 0
  let status = 0
  for (let i = 0; i < 40; i++) {
    const r = await ga.request.post(`${BASE}/api/i/${slug}/album/presign`, {
      data: { contentType: 'image/webp', size: 1000 },
    })
    status = r.status()
    if (status !== 200) break
    accepted++
  }
  check(accepted === 30 && status === 429, `IP당 하루 30장 (허용 ${accepted}, 다음 ${status})`)
  sql('delete from rate_limits')
  sql(`insert into album_photos (invitation_id, storage_key, width, height, size_bytes, token_hash)
       select '${id}', 'album/${id}/fill' || g || '.webp', 10, 10, 10, 'h' || g from generate_series(1, 199) g`)
  const full = await ga.request.post(`${BASE}/api/i/${slug}/album/presign`, {
    data: { contentType: 'image/webp', size: 1000 },
  })
  check(full.status() === 409, '초대장당 200장 가득 차면 409')

  // 앨범 블록을 숨기면 읽기 · 쓰기 모두 막힘
  sql(`update blocks set visible=false where invitation_id='${id}' and type='album'`)
  sql('delete from rate_limits')
  check(
    (await ga.request.get(`${BASE}/api/i/${slug}/album`)).status() === 404,
    '앨범 블록을 숨기면 목록 404',
  )
  check(
    (
      await ga.request.post(`${BASE}/api/i/${slug}/album/presign`, {
        data: { contentType: 'image/webp', size: 1000 },
      })
    ).status() === 404,
    '앨범 블록을 숨기면 업로드 404',
  )
  sql(`delete from album_photos where invitation_id='${id}'`)

  // 개인정보처리방침: 새 항목 · 시행일 · 이전 방침 보관
  const pg = await guest(browser)
  await pg.goto(`${BASE}/privacy`, { waitUntil: 'networkidle' })
  const txt = await pg.locator('main').innerText()
  check(
    txt.includes('하객이 올린 사진 파일') && txt.includes('시행일 2026년 11월 8일'),
    '방침: 하객 사진 항목 · 시행일 11/8',
  )
  check(
    (await pg.getByRole('link', { name: /2026-11-07 시행/ }).count()) === 1,
    '방침: 11/7 판 링크',
  )
  await pg.goto(`${BASE}/privacy/v2`, { waitUntil: 'networkidle' })
  const v2 = await pg.locator('main').innerText()
  check(
    v2.includes('2026년 11월 7일') && !v2.includes('하객이 올린 사진 파일'),
    '/privacy/v2: 11/7 판 원문(하객 사진 항목 없음)',
  )
  check((await pg.request.get(`${BASE}/privacy/v1`)).status() === 200, '/privacy/v1 보관')
  void readFileSync
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROME || undefined,
  })
  const run = (name: string) => !ONLY || ONLY.includes(name)

  if (run('design')) await designFlow(browser)
  if (run('media')) await mediaFlow(browser)
  if (run('thanks')) await thanksFlow(browser)
  if (run('album')) await albumFlow(browser)

  check(errors.length === 0, `브라우저 에러 없음 ${errors.length ? JSON.stringify(errors) : ''}`)
  await browser.close()
  console.log(failures === 0 ? '\nP2 E2E 통과' : `\nP2 E2E 실패 ${failures}건`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
