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
  reducedMotion: 'reduce' as const, // 봉투 · 효과 없이 바로 표지 (봉투 · 효과는 e2e-p3에서 따로)
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
  await host.getByRole('button', { name: '갤러리', exact: true }).click()
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
  await h2.getByRole('button', { name: '갤러리', exact: true }).click()
  await uploadPhotos(h2, 3)
  await waitSaved(h2)
  await h2.getByRole('button', { name: '원본 비율' }).click()
  await waitSaved(h2)
  const url2 = await publish(h2)
  const g2 = await guest(browser)
  await g2.goto(url2, { waitUntil: 'networkidle' })
  check(
    (await g2.locator('link[rel=stylesheet][href*="/fonts/gowun-batang"]').count()) === 1 &&
      (await g2
        .locator('link[rel=stylesheet][href*="/fonts/"]:not([href*="gowun-batang"])')
        .count()) === 0,
    '기본 글씨체(고운바탕) CSS 한 번만, 다른 글씨체 CSS 없음',
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
  await host.getByRole('button', { name: '사진', exact: true }).click() // 결혼 템플릿은 디자인 표지로 시작
  await host.locator('input[type=file]').first().setInputFiles(`${PHOTOS}/photo_1.jpg`)
  await host.getByAltText('표지 사진 미리보기').waitFor({ timeout: 30000 })
  const srcCover = await host.getByAltText('표지 사진 미리보기').getAttribute('src')
  await host.getByRole('button', { name: '인사말', exact: true }).click()
  await host.getByRole('textbox', { name: '보내는 사람 1' }).fill('태윤')
  await host.getByRole('textbox', { name: '보내는 사람 2' }).fill('하은')
  await host.getByRole('button', { name: '갤러리', exact: true }).click()
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
  check(
    (await host
      .getByRole('button', { name: '디자인', exact: true })
      .getAttribute('aria-pressed')) === 'true',
    '감사장: 표지는 디자인으로 시작',
  )
  await host.getByRole('button', { name: '사진', exact: true }).click() // 사진 표지로 바꾸면 복사된 사진이 있음
  const newCover = await host.getByAltText('표지 사진 미리보기').getAttribute('src')
  check(
    newCover && srcCover && newCover !== srcCover && newCover.includes(`/inv/${thanksId}/`),
    '감사장: 표지 사진은 새 key로 복사',
  )
  await host.getByRole('button', { name: '갤러리', exact: true }).click()
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

  // 개인정보처리방침: 11/15 전에는 11/7 판이 현재, 위에 개정 예정 안내, 개정안은 /privacy/next
  const pg = await guest(browser)
  await pg.goto(`${BASE}/privacy`, { waitUntil: 'networkidle' })
  const txt = await pg.locator('main').innerText()
  check(
    txt.includes('시행일 2026년 11월 7일') && !txt.includes('하객이 올린 사진 파일'),
    '방침: 11/15 전에는 11/7 판이 현재',
  )
  check(
    txt.includes('11/15 시행 개정 예정') &&
      (await pg.getByRole('link', { name: '개정안 보기' }).count()) === 1,
    '방침: 맨 위 개정 예정 안내 · 개정안 링크',
  )
  check(await pg.getByText('개정 안내').first().isVisible(), '푸터: 개정 안내 표시')
  await pg.goto(`${BASE}/privacy/next`, { waitUntil: 'networkidle' })
  const nx = await pg.locator('main').innerText()
  check(
    nx.includes('하객이 올린 사진 파일') && nx.includes('카카오톡 메시지 전송용 접속 정보'),
    '/privacy/next: 개정안 본문(하객 사진 · 알림 항목)',
  )
  await pg.goto(`${BASE}/privacy/v2`, { waitUntil: 'networkidle' })
  check(new URL(pg.url()).pathname === '/privacy', '/privacy/v2: 개정 시행 전에는 /privacy로')
  check((await pg.request.get(`${BASE}/privacy/v1`)).status() === 200, '/privacy/v1 보관')
  void readFileSync
}

/** ⑤ 돌잡이 예측: 돌잔치 템플릿의 vote 프리셋 */
async function doljabiFlow(browser: Browser) {
  const { page: host } = await createInvitation(browser, /돌잔치/)
  await host.getByLabel('초대장 제목').fill('E2E 돌잡이')
  await waitSaved(host)
  const url = await publish(host)
  const g = await guest(browser)
  await g.goto(url, { waitUntil: 'networkidle' })
  check(
    (await g.getByRole('heading', { name: '돌잡이 예측' }).count()) === 1,
    '돌잔치 초대장에 돌잡이 예측 블록',
  )
  await g.getByRole('button', { name: '투표하기' }).click()
  const names = ['실', '돈', '연필', '판사봉', '마이크', '청진기']
  for (const n of names)
    check(
      (await g.getByRole('button', { name: new RegExp(`[☐☑] ${n} ·`) }).count()) === 1,
      `후보: ${n}`,
    )
  await g.getByLabel('이름', { exact: true }).fill('김하객')
  await g.getByRole('button', { name: /[☐☑] 돈 ·/ }).click()
  await g.getByRole('button', { name: /[☐☑] 연필 ·/ }).click()
  await g.getByRole('button', { name: '투표하기', exact: true }).click()
  await g.getByText('김하객님, 투표했어요.').waitFor()
  const slug = url.split('/i/')[1]
  const res = await (await g.request.get(`${BASE}/api/i/${slug}/vote`)).json()
  const counts = (res.results as { id: string; count: number }[]).filter((r) => r.count > 0)
  check(
    counts.length === 1 && counts[0].id === 'pencil',
    '하나만 고르기: 마지막으로 고른 연필만 1표',
  )
  await g.screenshot({ path: `${OUT}/p2-doljabi.png`, fullPage: true })
}

/** ⑥ 참석자 전용 안내: 서버 HTML · RSC · OG · 공유 카드 어디에도 새지 않음 */
async function memberNoticeFlow(browser: Browser) {
  const SECRET_TITLE = '입장 비밀번호'
  const SECRET_BODY = 'SECRET-4821-PASS'
  const { page: host, id } = await createInvitation(browser, /송년회/)
  await host.getByLabel('초대장 제목').fill('E2E 참석자 전용')
  await host.getByRole('button', { name: '안내', exact: true }).click()
  await host.getByRole('button', { name: '안내 항목 추가' }).click()
  await host.getByRole('textbox', { name: '안내 3 제목' }).fill(SECRET_TITLE)
  await host.getByRole('textbox', { name: '안내 3 내용' }).fill(SECRET_BODY)
  await host.getByRole('switch', { name: '참석한 분에게만 보이기' }).last().check()
  await waitSaved(host)
  const url = await publish(host)
  const slug = url.split('/i/')[1]

  // 1) 서버가 내려주는 모든 것에 내용이 없어야 함
  const bare = await browser.newContext(mobile)
  const leaks: string[] = []
  const probe = async (label: string, res: { text(): Promise<string> }) => {
    const t = await res.text()
    if (t.includes(SECRET_BODY) || t.includes(SECRET_TITLE)) leaks.push(label)
    return t
  }
  const html = await probe('HTML', await bare.request.get(url))
  await probe('RSC', await bare.request.get(url, { headers: { RSC: '1' } }))
  await probe('ics', await bare.request.get(`${url}/event.ics`))
  await probe('attendees', await bare.request.get(`${BASE}/api/i/${slug}/attendees`))
  check(
    html.includes('og:title') && html.includes('og:description'),
    'OG 메타가 있는 HTML을 검사함',
  )
  check(
    leaks.length === 0,
    `서버 HTML · RSC · OG · ics · API 어디에도 내용 없음 ${leaks.join(',')}`,
  )
  check(
    html.includes('참석 응답을 보내신 분께만') || html.includes('참석자 전용'),
    '서버 HTML에는 잠금 안내만',
  )
  // 카톡 공유 카드(Kakao.Share 인자)에도 없음
  const g1 = await guest(browser)
  await g1.goto(url, { waitUntil: 'networkidle' })
  await g1.getByRole('button', { name: '친구에게 공유' }).click()
  await g1.waitForFunction(
    () => (window as unknown as { __kakaoShare?: unknown }).__kakaoShare,
    null,
    {
      timeout: 8000,
    },
  )
  const shared = await g1.evaluate(() =>
    JSON.stringify((window as unknown as { __kakaoShare?: unknown }).__kakaoShare ?? {}),
  )
  check(
    shared.length > 5 && !shared.includes(SECRET_BODY) && !shared.includes(SECRET_TITLE),
    '공유 카드에 내용 없음',
  )

  // 2) 참석 응답 전: 잠금 안내만
  await g1.getByRole('heading', { name: '안내', exact: true }).scrollIntoViewIfNeeded()
  check((await g1.getByText('참석자 전용').count()) >= 1, '응답 전: 잠금 안내 표시')
  check((await g1.getByText(SECRET_BODY).count()) === 0, '응답 전: 내용 안 보임')

  // 3) 참석 응답 → 내용 열림
  await g1.getByRole('button', { name: '참석 의사 전달하기' }).click()
  await g1.getByLabel('성함').fill('김참석')
  await g1.getByRole('button', { name: '참석할게요' }).click()
  await g1.getByRole('button', { name: '고기', exact: true }).click()
  await g1.getByRole('button', { name: '보내기', exact: true }).click()
  await g1.getByText('김참석님, 응답을 보냈어요.').waitFor()
  // 항목이 3개 이상이면 탭 — 열린 탭 이름이 바뀌면 내용이 열린 것
  await g1.getByRole('tab', { name: /입장 비밀번호/ }).click({ timeout: 10000 })
  await g1.getByText(SECRET_BODY).waitFor({ timeout: 10000 })
  check(true, '참석 응답 후: 참석자 전용 안내 내용 보임')
  await g1.screenshot({ path: `${OUT}/p2-member-notice.png`, fullPage: true })
  const tokenData = await g1.evaluate((sl) => localStorage.getItem('dearday:rsvp:' + sl), slug)
  const attendToken = JSON.parse(tokenData ?? '{}').editToken as string

  // 4) 다른 기기 · 불참 응답 · 가짜 토큰은 안 열림
  const g2 = await guest(browser)
  await g2.goto(url, { waitUntil: 'networkidle' })
  await g2.getByRole('heading', { name: '안내', exact: true }).scrollIntoViewIfNeeded()
  await g2.waitForTimeout(800)
  check((await g2.getByText(SECRET_BODY).count()) === 0, '응답하지 않은 기기에는 안 보임')
  await g2.getByRole('button', { name: '참석 의사 전달하기' }).click()
  await g2.getByLabel('성함').fill('최불참')
  await g2.getByRole('button', { name: '못 가요' }).click()
  await g2.getByRole('button', { name: '보내기', exact: true }).click()
  await g2.getByText('최불참님, 응답을 보냈어요.').waitFor()
  await g2.waitForTimeout(800)
  check((await g2.getByText(SECRET_BODY).count()) === 0, '불참으로 응답한 분에게는 안 보임')
  const declinedToken = JSON.parse(
    (await g2.evaluate((sl) => localStorage.getItem('dearday:rsvp:' + sl), slug)) ?? '{}',
  ).editToken as string
  const call = (tok: string) =>
    bare.request.post(`${BASE}/api/i/${slug}/member-notice`, { data: { editToken: tok } })
  const bogus = await call('x'.repeat(43))
  const declined = await call(declinedToken)
  check(bogus.status() === 403 && declined.status() === 403, '가짜 토큰 · 불참 토큰은 API 403')
  const ok = await call(attendToken)
  check(
    ok.status() === 200 && (await ok.text()).includes(SECRET_BODY),
    '참석 토큰은 API 200 + 내용',
  )
  check(
    (await ok.headers()['cache-control'])?.includes('no-store') === true,
    'API 응답은 캐시 금지',
  )

  // 5) 응답 취소 → 다시 잠김
  await g1.getByRole('button', { name: '응답 취소' }).click()
  await g1.getByRole('button', { name: '참석 의사 전달하기' }).waitFor()
  await g1.waitForTimeout(500)
  check((await g1.getByText(SECRET_BODY).count()) === 0, '응답 취소 후 다시 잠김')
  void id
}

async function notifyFlow(browser: Browser) {
  // 서버를 KAKAO_TOKEN_KEY(hex 64자)와 함께 띄워야 함. 실제 카카오는 부르지 않음(샌드박스에서는 연결 실패 → 조용히 건너뜀)
  const key = process.env.KAKAO_TOKEN_KEY
  if (!key)
    return console.log('  (건너뜀) KAKAO_TOKEN_KEY 없이 실행 — 알림 흐름은 키가 있어야 확인 가능')

  // 1) 알림 켜기는 talk_message 동의를 추가로 요청, 일반 로그인은 요청하지 않음
  const bare = await browser.newContext(mobile)
  const on = await bare.request.get(`${BASE}/api/auth/kakao/login?notify=1&next=/dashboard`, {
    maxRedirects: 0,
  })
  check(
    (on.headers().location ?? '').includes('scope=talk_message'),
    '알림 켜기 로그인은 talk_message 동의를 요청',
  )
  const plain = await bare.request.get(`${BASE}/api/auth/kakao/login?next=/dashboard`, {
    maxRedirects: 0,
  })
  check(!(plain.headers().location ?? '').includes('scope='), '일반 로그인은 추가 동의 없음')

  // 2) 대시보드에 알림 버튼이 보임
  const { page: host, id } = await createInvitation(browser, /송년회/)
  await host.getByLabel('초대장 제목').fill('E2E 알림')
  await waitSaved(host)
  const url = await publish(host)
  const slug = url.split('/i/')[1]
  await host.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
  check(await host.getByText('알림 켜기').isVisible(), '대시보드에 [알림 켜기]')

  // 3) 토큰이 있는 주최자: 응답이 와도 응답 저장은 성공(카카오 호출 실패는 삼킴), 3초 안팎에 끝남
  const enc = execFileSync(
    'node',
    [
      '--conditions=react-server',
      '--import',
      'tsx',
      '-e',
      "import('./lib/crypto.ts').then((m) => process.stdout.write(m.encryptSecret('fake-refresh-token')))",
    ],
    { encoding: 'utf8', env: process.env },
  )
  execFileSync('psql', [
    process.env.DATABASE_URL ?? 'postgres://dearday:dearday@localhost:5432/dearday',
    '-c',
    `update users set kakao_refresh_enc='${enc}', notify_rsvp=true where id=(select owner_id from invitations where id='${id}')`,
  ])
  await host.reload({ waitUntil: 'networkidle' })
  check(
    await host.getByRole('button', { name: '알림 끄기' }).isVisible(),
    '켜진 상태면 [알림 끄기]',
  )
  const t0 = Date.now()
  const res = await bare.request.post(`${BASE}/api/i/${slug}/rsvp`, {
    data: { name: '알림테스트', attending: false, partySize: 1, meal: null, answers: {} },
  })
  check(res.status() < 300, `토큰이 있어도 응답 저장 성공 (${res.status()}, ${Date.now() - t0}ms)`)
  check(Date.now() - t0 < 7000, '알림 때문에 응답이 오래 막히지 않음')

  // 4) 끄면 토큰이 지워짐
  await host.getByRole('button', { name: '알림 끄기' }).click()
  await host.getByText('알림을 받을 수 있어요').waitFor()
  const left = execFileSync('psql', [
    process.env.DATABASE_URL ?? 'postgres://dearday:dearday@localhost:5432/dearday',
    '-tAc',
    `select count(*) from users where kakao_refresh_enc is not null and id=(select owner_id from invitations where id='${id}')`,
  ])
    .toString()
    .trim()
  check(left === '0', '알림을 끄면 암호화된 토큰도 지워짐')
}

/** 디자인 표지: 화면 · 편집기 · 공유 카드 · 나도 만들기 · 제목 자동 줄이기 */
async function coverFlow(browser: Browser) {
  const KEYS = [
    'wedding-poppy',
    'wedding-rose',
    'wedding-peony',
    'thanks-wildflower',
    'dol-cloud',
    'yearend-snow',
    'prewedding-cheers',
    'birthday-balloon',
    'housewarming-eucalyptus',
    'meetup-ginkgo',
  ]
  // 파일: 9종 × (800 · 1200) 모두 열리고 장당 160KB 이하, 공유용 JPEG는 빌드 때 자동 생성
  const anon = await guest(browser)
  for (const k of KEYS) {
    for (const f of [`${k}-800.webp`, `${k}-1200.webp`]) {
      const r = await anon.request.get(`${BASE}/covers/${f}`)
      const size = (await r.body()).length
      check(r.ok() && size <= 160 * 1024, `${f} ${Math.round(size / 1024)}KB (160KB 이하)`)
    }
    const j = await anon.request.get(`${BASE}/covers/share/${k}.jpg`)
    check(
      j.ok() && (j.headers()['content-type'] ?? '').includes('image/jpeg'),
      `${k} 공유용 JPEG 자동 생성`,
    )
  }

  const { page: host } = await createInvitation(browser, /결혼식/)
  await host.getByLabel('초대장 제목').fill('E2E 디자인 표지')
  await host.getByRole('button', { name: '표지', exact: true }).click()
  check(
    (await host
      .getByRole('button', { name: '디자인', exact: true })
      .getAttribute('aria-pressed')) === 'true',
    '결혼 템플릿: 표지는 디자인으로 시작',
  )
  const thumbs = host.getByRole('group', { name: '표지 디자인' }).getByRole('button')
  check((await thumbs.count()) === 10, `표지 썸네일 바둑판 10개 (${await thumbs.count()}개)`)
  check(
    (await thumbs.nth(0).getAttribute('aria-label')) === '양귀비 표지' &&
      (await thumbs.nth(0).getAttribute('aria-pressed')) === 'true',
    '결혼: 어울리는 양귀비가 맨 앞이고 선택돼 있음',
  )
  const order = await thumbs.evaluateAll((els) =>
    els.slice(0, 3).map((e) => e.getAttribute('aria-label')),
  )
  check(
    order.join() === '양귀비 표지,장미 표지,모란 표지',
    `결혼 표지 3종이 먼저 (${order.join(' · ')})`,
  )
  check(
    (await host.getByText('이 행사에 어울리는 표지').count()) === 1 &&
      (await host.getByText('다른 표지', { exact: true }).count()) === 1,
    '어울리는 표지 / 다른 표지 묶음',
  )
  await host.getByRole('button', { name: '장미 표지' }).click()
  await host.getByLabel('큰 제목').fill('민준 · 서연')
  await host.getByLabel('작은 제목').fill('우리 결혼합니다')
  await waitSaved(host)
  const url = await publish(host)
  const slug = url.split('/i/')[1]

  const g = await guest(browser)
  await g.goto(url, { waitUntil: 'networkidle' })
  const img = g.locator('img[src^="/covers/wedding-rose-"]').first()
  check((await img.count()) === 1, '공개 화면: 장미 표지 그림')
  check((await img.getAttribute('fetchpriority')) === 'high', '표지 그림 fetchPriority high')
  const srcset = (await img.getAttribute('srcset')) ?? ''
  check(
    srcset.includes('wedding-rose-800.webp 800w') &&
      srcset.includes('wedding-rose-1200.webp 1200w'),
    '표지 그림 srcset 800w · 1200w',
  )
  const over = await g.locator('h1', { hasText: '민준 · 서연' }).boundingBox()
  const box = await img.boundingBox()
  check(
    !!over &&
      !!box &&
      over.y > box.y &&
      over.y < box.y + box.height &&
      Math.abs(over.x + over.width / 2 - (box.x + box.width / 2)) < 6,
    '제목이 그림 위 가운데에 올라감',
  )
  check(
    Math.abs((box?.height ?? 0) / (box?.width ?? 1) - 1.25) < 0.02,
    `그림 비율 4:5 (${box?.width}x${box?.height})`,
  )
  await g.screenshot({ path: `${OUT}/p2-design-cover.png` })

  // 카톡 공유 카드 · OG: 사진이 없으면 디자인 표지 JPEG
  const html = await (await g.request.get(url)).text()
  check(html.includes('/covers/share/wedding-rose.jpg'), 'OG 이미지: 디자인 표지 JPEG')

  // 나도 만들기: 디자인 표지 선택만 가져옴 (제목 · 글은 템플릿 문구)
  const maker = await login(browser, `/new?from=${slug}`, '2')
  await maker.page.getByRole('button', { name: '이 구성으로 만들기' }).click()
  await maker.page.waitForURL(/\/edit\//)
  await maker.page.getByRole('button', { name: '표지', exact: true }).click()
  check(
    (await maker.page.getByRole('button', { name: '장미 표지' }).getAttribute('aria-pressed')) ===
      'true',
    '나도 만들기: 디자인 표지 선택을 가져옴',
  )
  check(
    (await maker.page.getByLabel('큰 제목').inputValue()) !== '민준 · 서연',
    '나도 만들기: 원본 제목은 안 가져옴',
  )

  // 처음 만든 표지 key(rose · poppy)로 저장된 초대장도 새 표지로 보임
  sql(
    `update blocks set config=jsonb_set(config,'{designKey}','"poppy"') where type='cover' and invitation_id=(select id from invitations where slug='${slug}')`,
  )
  await g.goto(url, { waitUntil: 'networkidle' })
  check(
    (await g.locator('img[src^="/covers/wedding-poppy-"]').count()) === 1,
    '옛 key(poppy)는 wedding-poppy로 보임',
  )

  // 제목 자동 줄이기: 짧은 제목 vs 긴 제목 (생일 표지는 가운데가 좁음)
  sql(
    `update blocks set config=jsonb_set(jsonb_set(config,'{designKey}','"birthday-balloon"'),'{title}','"세상에서 제일 사랑스러운 김하늘 공주님의 첫 번째 생일 파티"') where type='cover' and invitation_id=(select id from invitations where slug='${slug}')`,
  )
  await g.goto(url, { waitUntil: 'networkidle' })
  const long = g.locator('h1').first()
  const fs = parseFloat(await long.evaluate((e) => getComputedStyle(e).fontSize))
  const lines = Math.round(((await long.boundingBox())?.height ?? 0) / (fs * 1.35))
  const wrapBox = await g.locator('img[src^="/covers/birthday-balloon-"]').first().boundingBox()
  const tb = await long.boundingBox()
  check(fs < 20 && lines >= 2, `긴 제목: 글자가 줄고 두 줄 이상 (${fs.toFixed(1)}px · ${lines}줄)`)
  check(
    !!tb &&
      !!wrapBox &&
      tb.x >= wrapBox.x + wrapBox.width * 0.26 &&
      tb.x + tb.width <= wrapBox.x + wrapBox.width * 0.74,
    '긴 제목이 생일 표지 가운데 안에 머묾',
  )
  await g.screenshot({ path: `${OUT}/p2-design-cover-long.png` })

  // 글자만 · 사진 전환, 돌잔치는 구름이 맨 앞
  await host.getByRole('button', { name: '글자만', exact: true }).click()
  const g2 = await guest(browser)
  let covers = 1
  for (let i = 0; i < 20 && covers > 0; i++) {
    await host.waitForTimeout(700) // 자동 저장(디바운스) 기다림
    await g2.goto(url, { waitUntil: 'networkidle' })
    covers = await g2.locator('img[src^="/covers/"]').count()
  }
  check(covers === 0, '글자만으로 바꾸면 그림 없음')
  for (const [name, label, key] of [
    [/돌잔치/, '구름 표지', 'dol'],
    [/송년회/, '눈꽃 표지', 'yearend'],
    [/생일 파티/, '풍선 표지', 'birthday'],
    [/집들이/, '유칼립투스 표지', 'housewarming'],
    [/회식/, '은행잎 표지', 'meetup'],
  ] as const) {
    const inv = await createInvitation(browser, name, '3')
    await inv.page.getByRole('button', { name: '표지', exact: true }).click()
    check(
      (await inv.page.getByRole('button', { name: label }).getAttribute('aria-pressed')) === 'true',
      `${key}: ${label}로 시작`,
    )
  }
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
  if (run('doljabi')) await doljabiFlow(browser)
  if (run('member')) await memberNoticeFlow(browser)
  if (run('notify')) await notifyFlow(browser)
  if (run('cover')) await coverFlow(browser)

  check(errors.length === 0, `브라우저 에러 없음 ${errors.length ? JSON.stringify(errors) : ''}`)
  await browser.close()
  console.log(failures === 0 ? '\nP2 E2E 통과' : `\nP2 E2E 실패 ${failures}건`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
