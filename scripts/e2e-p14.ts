/**
 * 크리스마스 시즌 화면 확인(로컬). 실행: E2E_SEASON=in|after pnpm exec tsx scripts/e2e-p14.ts
 * 앱을 SEASON_NOW=2026-12-03T12:00:00+09:00(in) 또는 2026-12-26T12:00:00+09:00(after)로 띄워 둔다. 포트 3001, DEV_LOGIN=1.
 * 홈 띠 · 시즌 카드 / /new 노출 / 나도 만들기 문구 / 공유 카드 설명 / 관리자 지표 / 금박 표지 · 봉투.
 */
import { execFileSync } from 'node:child_process'

import { chromium } from 'playwright'

const BASE = process.env.E2E_BASE ?? 'http://localhost:3001'
const DB = 'postgres://dearday:dearday@localhost:5432/dearday'
const sql = (q: string) => execFileSync('psql', [DB, '-tAc', q]).toString().trim()
const SHOT = process.env.E2E_SHOT_DIR
const IN = (process.env.E2E_SEASON ?? 'in') === 'in'

let failures = 0
function check(ok: unknown, label: string) {
  console.log(`${ok ? '✅' : '❌'} ${label}`)
  if (!ok) failures++
}

async function main() {
  const browser = await chromium.launch()
  const mkctx = () => browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ko-KR' })
  const owner = await mkctx()
  const page = await owner.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  console.log(`— 시즌: ${IN ? '안(12/3)' : '지남(12/26)'}`)

  // ── 홈 (로그인 전)
  const anon = await mkctx()
  const hp = await anon.newPage()
  await hp.goto(`${BASE}/`)
  const band = (await hp.locator('b').first().innerText()).trim()
  check(IN ? band === 'MERRY CHRISTMAS' : band === 'HAPPY DAY', `홈 띠지: ${band}`)
  check((await hp.getByTestId('season-card').count()) === (IN ? 1 : 0), `홈 시즌 카드 ${IN ? '있음' : '없음'}`)
  if (IN) {
    const card = hp.getByTestId('season-card')
    check(/1월 31일까지 만들면 무료/.test(await card.innerText()), '시즌 카드 문구')
    const href = await card.getByRole('link', { name: '만들기' }).getAttribute('href')
    check(/new%3Ftype%3Dchristmas/.test(href ?? ''), `[만들기] → 로그인 뒤 /new?type=christmas (${href})`)
    check((await card.getByRole('link', { name: '예시 보기' }).count()) === 0, '[예시 보기]는 예시 slug 상수가 비어 있으면 숨김')
    if (SHOT) await hp.screenshot({ path: `${SHOT}/p14-home-in.png`, fullPage: true })
  } else if (SHOT) await hp.screenshot({ path: `${SHOT}/p14-home-after.png`, fullPage: true })

  // ── /new
  await page.goto(`${BASE}/api/auth/kakao/login?dev=1&as=15&next=/new`)
  await page.waitForURL(/\/new/)
  sql(`delete from invitations where owner_id=(select id from users where kakao_id='dev-15')`)
  await page.waitForSelector('[data-type=yearend]')
  const gathering = await page.locator('[data-type]').evaluateAll((els) => els.map((e) => e.getAttribute('data-type')))
  check(IN ? gathering[3] === 'christmas' && gathering.indexOf('christmas') < gathering.indexOf('yearend') : !gathering.includes('christmas'), `/new 모임 목록: ${gathering.join(', ')}`)
  if (IN) check((await page.locator('[data-type=christmas]').innerText()).includes('크리스마스 파티'), '/new 라벨 크리스마스 파티')
  if (SHOT) await page.screenshot({ path: `${SHOT}/p14-new-${IN ? 'in' : 'after'}.png`, fullPage: true })
  await page.goto(`${BASE}/new?type=christmas`)
  await page.waitForSelector('[data-type=yearend]')
  check((await page.locator('[data-type=christmas]').count()) === 1, '/new?type=christmas 는 기간과 상관없이 보임')

  // ── 만들기(클릭) → 편집기, 금박 표지 · 시작값
  await page.locator('[data-type=christmas]').click()
  await page.waitForURL(/\/edit\//)
  const id = page.url().split('/edit/')[1].split(/[?#]/)[0]
  check(true, '크리스마스 파티 만들기 → 편집기')
  const cover = JSON.parse(sql(`select config from blocks where invitation_id='${id}' and type='cover'`))
  check(cover.layout === 'template' && cover.template === 'x', '표지: 금박 템플릿(x)')
  check(cover.effect === 'snow' && cover.effectDensity === 'low' && cover.intro === 'door', '표지: 눈 조금 · 리본 봉투')
  check(sql(`select theme from invitations where id='${id}'`) === 'pine', '포인트 색 파인')
  await page.waitForSelector('text=표지')
  const editorText = await page.locator('body').innerText()
  check(/크리스마스 파티/.test(editorText), '편집기 열림')

  // 장소 편집기 안내(크리스마스만)
  await page.getByText('오시는 길', { exact: false }).first().click().catch(() => {})
  await page.waitForTimeout(500)
  const hint = page.getByTestId('christmas-address-hint')
  if (await hint.count()) check(/동 · 호수는 ‘오시는 길 상세’\(참석자 전용\)/.test(await hint.innerText()), '장소 편집기 안내 문구')
  else check(false, '장소 편집기 안내 문구(블록을 열지 못함)')

  // ── 발행 · 공유 카드 설명 · 나도 만들기 문구
  sql(`update invitations set title='다솜네 크리스마스 홈파티', event_at='2026-12-24T19:00:00+09:00' where id='${id}'`)
  sql(`update blocks set config = config || '{"title":"다솜네 크리스마스 홈파티"}'::jsonb where invitation_id='${id}' and type='cover'`)
  const pub = await owner.request.post(`${BASE}/api/invitations/${id}/publish`, { data: { published: true } })
  const { slug } = (await pub.json()) as { slug: string }
  const meta = async (s: string, prop: string) => {
    const html = await (await anon.request.get(`${BASE}/i/${s}`)).text()
    return html.match(new RegExp(`<meta[^>]+property="${prop}"[^>]+content="([^"]*)"`))?.[1] ?? html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+property="${prop}"`))?.[1] ?? ''
  }
  const dec = (await meta(slug, 'og:description')).replace(/&amp;/g, '&')
  check(dec === '12월 24일 (목) 오후 7시 · 참석 여부와 가져올 것을 알려 주세요', `공유 설명: ${dec}`)
  const og = await meta(slug, 'og:image')
  check(/\/og\/christmas$/.test(og), `og:image 기본 이미지 ${og}`)
  const ogRes = await anon.request.get(`${BASE}/og/christmas`)
  check(ogRes.ok() && /image\/png/.test(ogRes.headers()['content-type'] ?? ''), '/og/christmas PNG 응답')
  // 나눠 맡기를 숨기면 '가져올 것' 빠짐
  sql(`update blocks set visible=false where invitation_id='${id}' and type='bring'`)
  const dec2 = (await meta(slug, 'og:description')).replace(/&amp;/g, '&')
  check(dec2 === '12월 24일 (목) 오후 7시 · 참석 여부를 알려 주세요', `나눠 맡기 숨김: ${dec2}`)
  sql(`update blocks set visible=true where invitation_id='${id}' and type='bring'`)
  // 날짜 없음
  sql(`update invitations set event_at=null where id='${id}'`)
  const dec3 = (await meta(slug, 'og:description')).replace(/&amp;/g, '&')
  check(dec3 === '참석 여부와 가져올 것을 알려 주세요', `날짜 없음: ${dec3}`)
  sql(`update invitations set event_at='2026-12-24T19:00:00+09:00' where id='${id}'`)

  const guest = await mkctx()
  const gp = await guest.newPage()
  await gp.goto(`${BASE}/i/${slug}?go=x`)
  await gp.getByText('이 디자인으로 나도 만들기').waitFor()
  const note = IN ? '우리 모임도 크리스마스 파티 열기' : '신년회 초대장도 무료로 만들어 보세요'
  check((await gp.getByText(note).count()) === 1, `나도 만들기 부제: ${note}`)
  check((await gp.getByText(IN ? '신년회 초대장도' : '우리 모임도 크리스마스').count()) === 0, '다른 시즌 문구는 안 보임')
  // 일반 모임에는 부제 없음
  const other = await owner.request.post(`${BASE}/api/invitations`, { data: { eventType: 'yearend' } })
  const { id: oid } = (await other.json()) as { id: string }
  const op = await owner.request.post(`${BASE}/api/invitations/${oid}/publish`, { data: { published: true } })
  const oslug = ((await op.json()) as { slug: string }).slug
  const gp2 = await guest.newPage()
  await gp2.goto(`${BASE}/i/${oslug}?go=x`)
  await gp2.getByText('이 디자인으로 나도 만들기').waitFor()
  check((await gp2.getByText(/크리스마스 파티 열기|신년회 초대장도/).count()) === 0, '송년회 초대장에는 시즌 부제 없음')

  // 금박 표지(날짜 있음 / DECEMBER) 글자
  const g3 = await guest.newPage()
  await g3.goto(`${BASE}/i/${slug}?go=x`)
  await g3.waitForTimeout(1500)
  check((await g3.locator('[data-cover-template=x]').count()) === 1, '금박 표지 렌더')
  const txt = await g3.locator('[data-cover-template=x]').innerText()
  check(/MERRY/.test(txt) && /CHRISTMAS/.test(txt) && /with love/.test(txt) && /DEC · THURSDAY/.test(txt) && /7 : 00 PM/.test(txt), `표지 글자(날짜 있음): ${txt.replace(/\s+/g, ' ')}`)
  check((await g3.locator('[data-cover-template=x] svg text').first().innerHTML()) === '24', '큰 음각 날짜 24')
  if (SHOT) await g3.screenshot({ path: `${SHOT}/p14-cover-date.png` })
  sql(`update invitations set event_at=null where id='${id}'`)
  await g3.reload()
  await g3.waitForTimeout(1500)
  const svgTxt = await g3.locator('[data-cover-template=x] svg text').evaluateAll((els) => els.map((e) => e.textContent ?? ''))
  check(svgTxt.join('') === 'DECEMBER', `날짜 없으면 DECEMBER만 (${svgTxt.join('')})`)
  check(!/PM|THURSDAY/.test(await g3.locator('[data-cover-template=x]').innerText()), '날짜 없으면 요일 · 시간 줄 없음')
  if (SHOT) await g3.screenshot({ path: `${SHOT}/p14-cover-december.png` })
  sql(`update invitations set event_at='2026-12-24T19:00:00+09:00' where id='${id}'`)
  // 봉투(리본) → 열기
  const g4 = await (await mkctx()).newPage()
  await g4.goto(`${BASE}/i/${slug}`)
  await g4.getByRole('button', { name: '리본 카드 열기' }).waitFor()
  check(true, '템플릿 표지에서 리본 봉투가 뜸')
  await g4.getByRole('button', { name: '리본 카드 열기' }).click()
  await g4.getByRole('button', { name: '다시 보기' }).waitFor({ timeout: 5000 })
  check((await g4.locator('[data-cover-template=x]').count()) === 1, '봉투를 열면 금박 표지')
  check((await g4.locator('[class*="fx"]').count()) >= 1, '눈 효과 층이 있음')

  // 템플릿 기본 화면 캡처 (풀페이지)
  if (SHOT) {
    const g5 = await (await mkctx()).newPage()
    await g5.goto(`${BASE}/i/${slug}?go=x`)
    await g5.waitForLoadState('networkidle')
    await g5.waitForTimeout(1200)
    await g5.screenshot({ path: `${SHOT}/p14-template-full.png`, fullPage: true })
  }

  // ── 기존 초대장 · 대시보드 라벨은 기간이 지나도 그대로
  await page.goto(`${BASE}/dashboard`)
  await page.waitForSelector('text=다솜네 크리스마스 홈파티')
  check(/크리스마스 파티/.test(await page.locator('body').innerText()), '대시보드: 행사 종류 라벨 유지')
  await page.goto(`${BASE}/dashboard/${id}`)
  await page.waitForSelector('h1')
  check(/크리스마스 파티/.test(await page.locator('body').innerText()), '응답 확인 화면: 라벨 유지')

  // ── 관리자 지표: 행사 종류 칸에 크리스마스 파티
  const adm = await mkctx()
  const ap = await adm.newPage()
  await ap.goto(`${BASE}/api/auth/kakao/login?dev=1&as=1&next=/admin/stats`)
  await ap.waitForURL(/admin\/stats/)
  check(/크리스마스 파티/.test(await ap.locator('body').innerText()), '/admin/stats 행사 종류별 집계에 크리스마스 파티')

  // 나도 만들기로 새로 만들면(복제 아님) 짝 · 응답이 따라오지 않고 크리스마스 구성만
  const from = await adm.request.post(`${BASE}/api/invitations`, { data: { eventType: 'christmas', from: slug } })
  check(from.status() === 201, '나도 만들기(christmas) 생성')
  check(errors.length === 0, `페이지 오류 없음 ${errors.join(' | ')}`)
  await browser.close()
  console.log(failures === 0 ? '\n전부 통과' : `\n실패 ${failures}건`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
