/**
 * 디자인 수정 5 확인(로컬): 결혼 표지 모양에서 디자인 빼기 · 테마 = 포인트 색만 · 표지/본문 같은 종이.
 * 실행: 앱 하나(3001, DEV_LOGIN=1) 띄운 뒤 pnpm exec tsx scripts/e2e-p11.ts (E2E_SHOT_DIR 이 있으면 캡처 저장)
 */
import { execFileSync } from 'node:child_process'

import { chromium, type Page } from 'playwright'

const BASE = process.env.E2E_BASE ?? 'http://localhost:3001'
const DB = 'postgres://dearday:dearday@localhost:5432/dearday'
const sql = (q: string) => execFileSync('psql', [DB, '-tAc', q]).toString().trim()
const SHOT = process.env.E2E_SHOT_DIR

let failures = 0
function check(ok: unknown, label: string) {
  console.log(`${ok ? '✅' : '❌'} ${label}`)
  if (!ok) failures++
}
const api = (page: Page, path: string, body: unknown) =>
  page.evaluate(
    async ([p, b]) => {
      const r = await fetch(p as string, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: b as string })
      return (await r.json()) as { id: string }
    },
    [path, JSON.stringify(body)],
  )

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ko-KR' })
  const errors: string[] = []
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('dialog', (d) => d.accept())
  await page.route(/t1\.kakaocdn\.net|dapi\.kakao\.com/, (r) => r.abort())
  await page.goto(`${BASE}/api/auth/kakao/login?dev=1&as=8&next=/dashboard`)
  await page.waitForURL(/\/dashboard/)
  const uid = sql(`select id from users where kakao_id='dev-8'`)
  sql(`delete from invitations where owner_id='${uid}'`)

  // 결혼 1 · 2 · 3안
  const ids: Record<string, string> = {}
  for (const k of ['a', 'b', 'c']) {
    const { id } = await api(page, '/api/invitations', { eventType: 'wedding', coverTemplate: k })
    ids[k] = id
    // 1안 · 3안은 프리미엄 표지: 결제한 초대장처럼 보이게 이용권 캐시를 켠다
    sql(`update invitations set premium_hub=true, premium_checked_at=now() where id='${id}'`)
    sql(`update invitations set status='published', title='하늘 ♥ 보람 결혼합니다', event_at='2027-12-26T17:30:00+09:00' where id='${id}'`)
    sql(`update blocks set config = config || '{"groomEn":"HANUL","brideEn":"BORAM"}'::jsonb where invitation_id='${id}' and type='cover'`)
  }
  // 고르지 않고 만든 결혼(API 직접) → 2안 템플릿
  const none = await api(page, '/api/invitations', { eventType: 'wedding' })
  check(sql(`select config->>'layout' || '/' || (config->>'template') from blocks where invitation_id='${none.id}' and type='cover'`) === 'template/b', '고르지 않고 만든 결혼 초대장 → 2안 템플릿으로 시작')
  // 예전 방식: 결혼 + 디자인 표지
  const legacy = await api(page, '/api/invitations', { eventType: 'wedding', coverTemplate: 'b' })
  sql(`update blocks set config = config || '{"layout":"design","designKey":"wedding-peony"}'::jsonb where invitation_id='${legacy.id}' and type='cover'`)
  sql(`update invitations set status='published', event_at='2027-12-26T17:30:00+09:00' where id='${legacy.id}'`)
  // 돌잔치(디자인 표지 유지)
  const dol = await api(page, '/api/invitations', { eventType: 'dol' })

  const slugOf = (id: string) => sql(`select slug from invitations where id='${id}'`)

  // ① 편집기 표지 모양
  const openStyle = async () => {
    const tab = page.getByRole('tab', { name: /꾸미기/ }).or(page.getByRole('button', { name: /꾸미기/ })).first()
    if (await tab.count()) await tab.click().catch(() => {})
  }
  await page.goto(`${BASE}/edit/${ids.b}`, { waitUntil: 'networkidle' })
  await openStyle()
  const seg = page.locator('[role=group][aria-label="표지 모양"]')
  check((await seg.count()) === 1, '표지 모양 버튼 묶음이 보임(결혼)')
  const wLabels = (await seg.first().locator('button').allInnerTexts()).map((t) => t.trim())
  check(JSON.stringify(wLabels) === JSON.stringify(['템플릿', '사진', '글자만']), `결혼: 표지 모양 = [템플릿][사진][글자만] (${wLabels.join(',')})`)
  if (SHOT) {
    await seg.first().scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${SHOT}/p11-shape-wedding.png` })
  }
  // 돌잔치는 그대로 디자인 포함
  await page.goto(`${BASE}/edit/${dol.id}`, { waitUntil: 'networkidle' })
  await openStyle()
  const dLabels = (await page.locator('[role=group][aria-label="표지 모양"] button').allInnerTexts()).map((t) => t.trim())
  check(dLabels.includes('디자인') && dLabels.length === 3, `돌잔치: 디자인 표지 유지 (${dLabels.join(',')})`)
  // 예전 결혼 + 디자인: 디자인이 현재 선택 + 안내 한 줄, 다른 모양을 고르면 사라짐
  await page.goto(`${BASE}/edit/${legacy.id}`, { waitUntil: 'networkidle' })
  await openStyle()
  const lLabels = (await page.locator('[role=group][aria-label="표지 모양"] button').allInnerTexts()).map((t) => t.trim())
  check(lLabels.includes('디자인'), `예전 결혼 + 디자인: 현재 선택이 '디자인'으로 보임 (${lLabels.join(',')})`)
  check((await page.getByTestId('design-cover-retire').count()) === 1, '되돌아갈 수 없다는 안내 한 줄')
  if (SHOT) {
    await page.locator('[role=group][aria-label="표지 모양"]').scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${SHOT}/p11-shape-legacy.png` })
  }
  await page.locator('[role=group][aria-label="표지 모양"]').getByRole('button', { name: '글자만' }).click()
  await page.waitForTimeout(400)
  const after = (await page.locator('[role=group][aria-label="표지 모양"] button').allInnerTexts()).map((t) => t.trim())
  check(!after.includes('디자인') && (await page.getByTestId('design-cover-retire').count()) === 0, `다른 모양을 고르면 디자인 선택지가 사라짐 (${after.join(',')})`)
  // 공개 화면은 데이터 변경 없이 그대로(디자인 표지)
  await page.waitForTimeout(3000) // 자동 저장이 끝난 뒤에 되돌려 놓기
  sql(`update blocks set config = config || '{"layout":"design","designKey":"wedding-peony"}'::jsonb where invitation_id='${legacy.id}' and type='cover'`)
  await page.goto(`${BASE}/i/${slugOf(legacy.id)}`, { waitUntil: 'networkidle' })
  check((await page.locator('img[src*="wedding-peony"]').count()) >= 1, '예전 결혼 + 디자인 표지는 공개 화면에서 그대로 보임')

  // ③ 표지 · 본문 같은 종이 + ② 색
  const bgOf = (sel: string) =>
    page.evaluate((s) => {
      const el = document.querySelector(s) as HTMLElement | null
      if (!el) return null
      const c = getComputedStyle(el)
      return { color: c.backgroundColor, image: c.backgroundImage }
    }, sel)
  const vars = (names: string[]) =>
    page.evaluate((ns) => {
      const el = document.querySelector('[class*=column]') as HTMLElement
      const c = getComputedStyle(el)
      return Object.fromEntries(ns.map((n) => [n, c.getPropertyValue(n).trim()]))
    }, names)
  const sets: Record<string, Record<string, string>> = {}
  for (const k of ['a', 'b', 'c']) {
    await page.goto(`${BASE}/i/${slugOf(ids[k])}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)
    const cv = await bgOf('[data-cover-template]')
    check(cv && cv.color === 'rgba(0, 0, 0, 0)' && cv.image === 'none', `${k}안 표지: 자기 바탕 없음(투명) ${JSON.stringify(cv)}`)
    if (SHOT) {
      // 표지 전체 + 본문 첫 섹션까지 한 장
      const box = await page.evaluate(() => {
        const c = document.querySelector('[data-cover-template]') as HTMLElement
        const r = c.getBoundingClientRect()
        return { top: Math.round(r.top + window.scrollY), h: Math.round(r.height) }
      })
      await page.screenshot({ path: `${SHOT}/p11-seam-${k}.png`, fullPage: true, clip: { x: 0, y: box.top, width: 390, height: box.h + 520 } })
    }
  }
  // 색 3개(기본 · 블라썸 · 네이비) — 같은 초대장(2안)
  for (const th of ['classic', 'blossom', 'navy']) {
    sql(`update invitations set theme='${th}' where id='${ids.b}'`)
    await page.goto(`${BASE}/i/${slugOf(ids.b)}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    sets[th] = await vars(['--bg', '--surface', '--text', '--muted', '--btn', '--line', '--foil', '--accent'])
    if (SHOT) {
      const box = await page.evaluate(() => {
        const c = document.querySelector('[data-cover-template]') as HTMLElement
        const r = c.getBoundingClientRect()
        return { top: Math.round(r.top + window.scrollY), h: Math.round(r.height) }
      })
      // 표지 아래쪽 + 본문 첫 섹션 + 달력까지(영문 소제목 · 별 · 하트 · 26일 동그라미 색이 보이게)
      await page.screenshot({ path: `${SHOT}/p11-theme-${th}.png`, fullPage: true, clip: { x: 0, y: box.top + box.h - 200, width: 390, height: 1500 } })
    }
  }
  const same = (k: string) => sets.classic[k] === sets.blossom[k] && sets.classic[k] === sets.navy[k]
  check(['--bg', '--surface', '--text', '--muted', '--btn', '--line'].every(same), '테마가 바뀌어도 바탕 · 면 · 글자 · 보조 글자 · 버튼 · 선은 그대로')
  check(sets.blossom['--foil'] !== sets.classic['--foil'] && sets.navy['--foil'] !== sets.blossom['--foil'], `포인트(영문 소제목 · 하트 · 별)는 테마 색을 따름 (${sets.classic['--foil']} / ${sets.blossom['--foil']} / ${sets.navy['--foil']})`)
  sql(`update invitations set theme='classic' where id='${ids.b}'`)

  // 편집기 미리보기 틀: 표지 바탕 투명 + 틀에 종이 결
  await page.goto(`${BASE}/edit/${ids.b}`, { waitUntil: 'networkidle' })
  const pv = await page.evaluate(() => {
    const scr = document.querySelector('[class*=previewScreen]') as HTMLElement | null
    const cov = document.querySelector('[class*=previewScreen] [data-cover-template]') as HTMLElement | null
    if (!scr || !cov) return null
    return { screen: getComputedStyle(scr).backgroundImage, cover: getComputedStyle(cov).backgroundColor }
  })
  check(pv && pv.screen.includes('paper-cover') && pv.cover === 'rgba(0, 0, 0, 0)', `편집기 미리보기 틀: 종이 결 + 표지 투명 ${JSON.stringify(pv)}`)

  check(!errors.length, `브라우저 오류 없음 ${errors.join(' | ')}`)
  await browser.close()
  console.log(failures ? `\n실패 ${failures}건` : '\n모두 통과')
  process.exit(failures ? 1 : 0)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
