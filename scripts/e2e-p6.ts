/**
 * 연말 2차 기능 확인(로컬): 나눠 맡기 · 초대 명단 체크 · 회비 정산. 실행: pnpm e2e:p6
 * 준비는 e2e-p2.ts와 같음 (DEV_LOGIN=1 서버, PAYMENTS_LIVE 비움).
 */
import { execFileSync } from 'node:child_process'

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'

const BASE = process.env.E2E_BASE ?? 'http://localhost:3001'
const DB = 'postgres://dearday:dearday@localhost:5432/dearday'
const sql = (q: string) => execFileSync('psql', [DB, '-tAc', q]).toString().trim()

let failures = 0
function check(ok: unknown, label: string) {
  console.log(`${ok ? '✅' : '❌'} ${label}`)
  if (!ok) failures++
}

const mobile = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  locale: 'ko-KR',
  reducedMotion: 'reduce' as const,
}
const errors: string[] = []

async function newPage(ctx: BrowserContext): Promise<Page> {
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('dialog', (d) => d.accept())
  await page.route(/t1\.kakaocdn\.net|dapi\.kakao\.com/, (r) => r.abort())
  return page
}

async function waitSaved(page: Page) {
  await page.getByRole('status').filter({ hasText: '저장됨' }).waitFor({ timeout: 15000 })
}

const row = (p: Page, name: RegExp) =>
  p.locator('li', { has: p.getByRole('button', { name }) }).first()
const openBlock = async (p: Page, name: RegExp) => {
  const r = row(p, name)
  const head = r.getByRole('button', { name }).first()
  if ((await head.getAttribute('aria-expanded')) !== 'true') await head.click()
  return r
}

let ipSeq = 10
const post = (slug: string, body: unknown, method = 'POST', ip = `10.9.0.${ipSeq++}`) =>
  fetch(`${BASE}/api/i/${slug}/bring`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
    body: JSON.stringify(body),
  })

async function main() {
  const browser: Browser = await chromium.launch()
  const ctx = await browser.newContext({ ...mobile, acceptDownloads: true })
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
  const host = await newPage(ctx)
  await host.goto(`${BASE}/api/auth/kakao/login?dev=1&next=${encodeURIComponent('/new')}`)
  await host.getByRole('button', { name: /송년회/ }).first().click()
  await host.waitForURL(/\/edit\//)
  const id = host.url().split('/edit/')[1].split(/[?#]/)[0]
  await host.getByLabel('초대장 제목').fill('E2E 모임')
  await waitSaved(host)

  // ───────── ① 나눠 맡기 ─────────
  const br = row(host, /^나눠 맡기/)
  check(await br.getByText('숨김').count(), '① 송년회 템플릿에 나눠 맡기가 숨김으로 들어 있음')
  await br.getByRole('button', { name: '보이기' }).click()
  await openBlock(host, /^나눠 맡기/)
  check((await host.getByLabel(/준비물 \d 이름/).count()) === 3, '① 예시 3개(케이크 · 음료 · 과일)')
  await host.getByRole('button', { name: '준비물 추가' }).click()
  await host.getByLabel('준비물 4 이름').fill('얼음')
  await host.getByLabel('준비물 4 필요 수').fill('2')
  // 1인 회비 (정산용)
  await openBlock(host, /^계좌/)
  await host.getByLabel('1인 회비(원)').fill('30000')
  await waitSaved(host)
  await host.getByRole('button', { name: /^(발행하기|공유하기)$/ }).click()
  const sheet = host.getByRole('dialog')
  await sheet.getByRole('button', { name: '발행하기' }).click()
  await sheet.getByRole('heading', { name: '초대장이 발행됐어요' }).waitFor()
  const url = await sheet.getByLabel('초대장 주소').inputValue()
  await sheet.getByRole('button', { name: '닫기' }).click()
  const slug = url.split('/i/')[1].split(/[?#]/)[0]

  const item = (p: Page, name: string) => p.locator('li[data-item]').filter({ hasText: name }).first()
  const guestA = await newPage(await browser.newContext(mobile))
  await guestA.goto(`${BASE}/i/${slug}`)
  const sec = guestA.locator('#bring')
  await sec.scrollIntoViewIfNeeded()
  await sec.getByText('1/1').or(sec.getByText('0/1')).first().waitFor()
  check(await sec.getByText('맡은 분의 이름은 초대장을 받은 분 모두에게 보여요').count(), '① 이름 공개 안내 문구')
  await item(guestA, '케이크').getByRole('button', { name: '맡기' }).click()
  await guestA.getByLabel('이름').fill('민수')
  await guestA.getByRole('button', { name: '케이크 맡을게요' }).click()
  await item(guestA, '케이크').getByText('민수님이 맡았어요').waitFor()
  await item(guestA, '케이크').getByText('1/1 · 마감').waitFor({ timeout: 8000 }).catch(() => {})
  check(await item(guestA, '케이크').getByText('1/1 · 마감').count(), '① 정원이 차면 마감 표시')
  check((await item(guestA, '케이크').getByRole('button', { name: '맡기' }).count()) === 0, '① 마감 항목엔 맡기 버튼 없음')
  const token = await guestA.evaluate(
    (k) => (JSON.parse(localStorage.getItem(k) ?? '[]') as { editToken: string }[])[0]?.editToken,
    `dearday:bring:${slug}`,
  )
  const hash = sql(`select edit_token_hash from bring_claims where invitation_id='${id}' and item_id <> ''`)
  check(token && hash && token !== hash && hash.length === 43, '① 취소 토큰 원문은 브라우저에만, DB에는 해시만')

  const guestB = await newPage(await browser.newContext(mobile))
  await guestB.goto(`${BASE}/i/${slug}`)
  await guestB.locator('#bring').scrollIntoViewIfNeeded()
  await item(guestB, '케이크').getByText('1/1 · 마감').waitFor()
  check(await item(guestB, '케이크').getByText('민수').count(), '① 다른 하객에게도 맡은 사람 이름이 보임')
  const itemId = (n: string) =>
    // 항목 id는 편집기가 만든 값이라 DB 블록 설정에서 읽는다
    sql(`select e->>'id' from blocks b, jsonb_array_elements(b.config->'items') e where b.invitation_id='${id}' and b.type='bring' and e->>'name'='${n}'`)
  const cake = itemId('케이크')
  let r = await post(slug, { name: '영희', itemId: cake })
  check(r.status === 409, '① 다 찬 항목은 API도 409')
  r = await post(slug, { editToken: 'x'.repeat(43) }, 'DELETE')
  check(r.status === 404, '① 남의 토큰(모르는 토큰)으로는 취소 불가')

  await item(guestA, '케이크').getByRole('button', { name: '취소' }).click()
  await item(guestA, '케이크').getByRole('button', { name: '맡기' }).waitFor()
  check(sql(`select count(*) from bring_claims where invitation_id='${id}'`) === '0', '① 본인 취소: 행 삭제')
  check(await item(guestA, '케이크').getByText('0/1').count(), '① 취소하면 다시 0/1')

  // 정원 3: 3명 맡고 4번째는 막힘
  const drink = itemId('음료')
  for (const n of ['가', '나', '다']) check((await post(slug, { name: n, itemId: drink })).status === 201, `① 음료 ${n} 맡기`)
  r = await post(slug, { name: '라', itemId: drink })
  check(r.status === 409, '① 음료 4번째는 409(정원 3)')
  // 같은 이름 같은 항목 두 번
  const ice = itemId('얼음')
  check((await post(slug, { name: '철수', itemId: ice })).status === 201, '① 얼음 철수')
  check((await post(slug, { name: '철수', itemId: ice })).status === 409, '① 같은 이름이 같은 항목 두 번은 막음')
  // 동시에 5명이 정원 2짜리를 누르면 정확히 2명만
  const fruit = itemId('과일')
  const rs = await Promise.all(['a', 'b', 'c', 'd', 'e'].map((n) => post(slug, { name: n, itemId: fruit })))
  const ok = rs.filter((x) => x.status === 201).length
  check(ok === 2 && rs.filter((x) => x.status === 409).length === 3, `① 동시에 눌러도 정원 2 (성공 ${ok})`)
  check(sql(`select count(*) from bring_claims where invitation_id='${id}' and item_id='${fruit}'`) === '2', '① DB에도 정확히 2행')
  // 토큰으로 그 한 건만 취소
  const one = await post(slug, { name: '마', itemId: ice })
  const tk = ((await one.json()) as { editToken: string }).editToken
  check((await post(slug, { editToken: tk }, 'DELETE')).status === 200, '① 토큰으로 취소 200')
  check(sql(`select count(*) from bring_claims where invitation_id='${id}' and item_id='${ice}'`) === '1', '① 그 건만 지워짐')
  // 길이 제한 · rate limit
  check((await post(slug, { name: 'ㅁ'.repeat(21), itemId: ice })).status === 400, '① 이름 21자는 400')
  const sameIp = '10.9.9.9'
  const codes: number[] = []
  for (let i = 0; i < 12; i++) codes.push((await post(slug, { name: '스팸', itemId: 'zzzz' }, 'POST', sameIp)).status)
  check(codes.at(-1) === 429, `① 같은 IP 연타는 429 (${codes.join(',')})`)

  // 대시보드 + CSV
  await host.goto(`${BASE}/dashboard/${id}`)
  const panel = host.getByRole('region', { name: '나눠 맡기' })
  await panel.waitFor()
  check(await panel.getByText('가, 나, 다').count(), '① 대시보드: 음료 맡은 사람')
  check(await panel.getByText('3/3 · 마감').count(), '① 대시보드: 마감 표시')
  const csv = await host.request.get(`${BASE}/api/invitations/${id}/bring.csv`)
  const csvText = await csv.text()
  check(csv.status() === 200 && csvText.startsWith('﻿준비물,필요,맡은 수,맡은 사람') && csvText.includes('"가, 나, 다"'), '① CSV: BOM + 항목별 맡은 사람')
  // 숨기면 API도 막음
  sql(`update blocks set visible=false where invitation_id='${id}' and type='bring'`)
  check((await post(slug, { name: '바', itemId: ice })).status === 404, '① 숨긴 블록은 API도 404')
  sql(`update blocks set visible=true where invitation_id='${id}' and type='bring'`)

  // ───────── ② 초대 명단 체크 ─────────
  const rsvp = (name: string, attending: boolean, size: number, paid: boolean) =>
    sql(`insert into rsvps (invitation_id, name, attending, party_size, paid) values ('${id}', '${name}', ${attending}, ${size}, ${paid})`)
  rsvp('김민준', true, 2, true)
  rsvp('이서연', false, 1, false)
  rsvp('박 지호', true, 1, true)
  rsvp('모르는사람', true, 1, false)
  await host.goto(`${BASE}/dashboard/${id}`)
  const inv = host.getByRole('region', { name: '초대 명단 체크' })
  await inv.waitFor()
  check(await inv.getByText('나만 볼 수 있고').count(), '② 하객에게 보이지 않는다는 안내')
  await inv.getByLabel('초대 명단').fill('김민준, 이서연\n박지호\n최유나\n  한소영 \n김  민준')
  check(await inv.getByText('5명').count(), '② 동명이인 · 공백 차이는 같은 이름으로 (5명)')
  await inv.getByRole('button', { name: '명단 저장' }).click()
  await inv.getByText('응답함 3명 · 아직 2명').waitFor()
  check(await inv.getByText('명단에 없는 응답 1건').count(), '② 명단에 없는 응답 수')
  check(await inv.locator('[data-kind=pending]').getByText('최유나, 한소영').count(), '② 아직: 최유나, 한소영')
  check(await inv.locator('[data-kind=responded]').getByText('이서연(불참)').count(), '② 응답함: 불참 표시')
  check(await inv.locator('[data-kind=responded]').getByText('박지호').count(), '② "박 지호" 응답이 "박지호"와 맞춰짐')
  await inv.getByRole('button', { name: /문구 복사/ }).click()
  await inv.getByText('문구를 복사했어요').waitFor()
  const clip = await host.evaluate(() => navigator.clipboard.readText())
  check(clip.includes(url) && !clip.includes('최유나') && !clip.includes('한소영'), '② 복사 문구: 링크 포함 · 이름 없음')
  await host.reload()
  const kept = host.getByRole('region', { name: '초대 명단 체크' }).getByText('응답함 3명 · 아직 2명')
  await kept.waitFor({ timeout: 8000 }).catch(() => {})
  check(await kept.count(), '② 새로고침해도 명단 유지')
  // 하객 화면 · 공개 API 어디에도 명단이 없음
  const html = await (await fetch(`${BASE}/i/${slug}`)).text()
  const apis = await Promise.all(
    ['attendees', 'bring', 'guestbook'].map(async (p) => (await fetch(`${BASE}/api/i/${slug}/${p}`)).text()),
  )
  check(!html.includes('최유나') && !html.includes('한소영') && apis.every((t) => !t.includes('최유나')), '② 하객 HTML · 공개 API에 명단이 없음')
  // 제한
  const put = (text: string) => host.request.put(`${BASE}/api/invitations/${id}/invitees`, { data: { text } })
  const many = Array.from({ length: 301 }, (_, i) => `사람${i}`).join('\n')
  check((await put(many)).status() === 400, '② 301명은 400')
  check((await put('가'.repeat(21))).status() === 400, '② 이름 21자는 400')
  check((await put(Array.from({ length: 300 }, (_, i) => `사람${i}`).join(','))).status() === 200, '② 300명은 저장됨')
  const other = await browser.newContext(mobile)
  const op = await newPage(other)
  await op.goto(`${BASE}/api/auth/kakao/login?dev=1&as=2&next=${encodeURIComponent('/dashboard')}`)
  check((await other.request.put(`${BASE}/api/invitations/${id}/invitees`, { data: { text: '해킹' } })).status() === 404, '② 다른 회원은 명단을 못 고침')
  await put('김민준, 이서연\n박지호\n최유나\n한소영')

  // ───────── ③ 회비 정산 ─────────
  await host.goto(`${BASE}/dashboard/${id}`)
  const st = host.getByRole('region', { name: '회비 정산' })
  await st.waitFor()
  await st.getByLabel('지출 1 항목').fill('식비')
  await st.getByLabel('지출 1 금액').fill('70000')
  await st.getByRole('button', { name: '+ 지출 추가' }).click()
  await st.getByLabel('지출 2 항목').fill('케이크')
  await st.getByLabel('지출 2 금액').fill('10000')
  check(await st.getByText('입금 3명 × 30,000원').count(), '③ 걷은 회비 = 입금 체크 3명 × 30,000원')
  check(await st.getByText('90,000원').first().count(), '③ 걷은 회비 90,000원')
  check(await st.getByText('80,000원').count(), '③ 쓴 돈 80,000원')
  check(await st.getByText('남은 돈').count() && (await st.getByRole('status').filter({ hasText: '10,000원' }).count()) > 0, '③ 남은 돈 10,000원')
  check(await st.getByText('입금한 3명께 1인당 3,333원').count(), '③ 돌려줄 금액: 1인당 3,333원(내림)')
  await st.getByRole('button', { name: '+ 지출 추가' }).click()
  await st.getByLabel('지출 3 항목').fill('2차')
  await st.getByLabel('지출 3 금액').fill('30000')
  check(await st.getByText('부족한 돈').count(), '③ 모자라면 "부족한 돈"')
  check(await st.getByText('참석 4명이 1인당 5,000원').count(), '③ 1인당 더 낼 금액: 20,000 ÷ 참석 4명 = 5,000원')
  await st.getByRole('button', { name: '정산 내역 복사' }).click()
  const text = await host.evaluate(() => navigator.clipboard.readText())
  check(
    text.includes('[E2E 모임] 정산 내역') && text.includes('걷은 회비 90,000원') && text.includes('- 식비 70,000원') && text.includes('1인당 5,000원'),
    '③ 복사 문구에 걷은 회비 · 항목 · 1인당',
  )
  check(!/\d{2,3}-\d{3,4}-\d{4}/.test(text), '③ 복사 문구에 연락처 없음')
  await st.getByRole('button', { name: '저장', exact: true }).click()
  await st.getByText('저장했어요').first().waitFor()
  await host.reload()
  const st2 = host.getByRole('region', { name: '회비 정산' })
  check((await st2.getByLabel('지출 2 항목').inputValue()) === '케이크', '③ 저장한 지출이 유지됨')
  // 하객 화면에 보이기 (기본 꺼짐)
  const g3 = await newPage(await browser.newContext(mobile))
  await g3.goto(`${BASE}/i/${slug}`)
  check((await g3.getByText('정산 내역').count()) === 0, '③ 기본값: 하객 화면에 정산 안 보임')
  await st2.getByLabel('정산 내역을 하객 화면에도 보이기').check()
  await st2.getByText('하객 화면에도 정산 내역이 보여요').waitFor()
  await g3.goto(`${BASE}/i/${slug}`)
  check(await g3.getByText('걷은 회비 90,000원').count(), '③ 켜면 하객 화면(안내)에 정산 내역')
  check((await g3.getByText('E2E 모임] 정산 내역').count()) === 0, '③ 하객 화면엔 제목 줄 중복 없음')
  // 복제에는 정산 안내를 가져가지 않음
  const dupId = await host.evaluate(
    async (src) =>
      (await (await fetch(`/api/invitations/${src}/duplicate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'copy' }) })).json()).id,
    id,
  )
  check(sql(`select count(*) from blocks where invitation_id='${dupId}' and config->>'source'='settlement'`) === '0', '③ 복제본에는 정산 안내가 없음')
  check(sql(`select count(*) from bring_claims where invitation_id='${dupId}'`) === '0', '③ 복제본에는 맡은 사람이 없음')
  await st2.getByLabel('정산 내역을 하객 화면에도 보이기').uncheck()
  await st2.getByText('저장했어요').first().waitFor()
  await g3.goto(`${BASE}/i/${slug}`)
  check((await g3.getByText('걷은 회비 90,000원').count()) === 0, '③ 끄면 하객 화면에서 사라짐')
  check(sql(`select count(*) from blocks where invitation_id='${id}' and config->>'source'='settlement'`) === '0', '③ 끄면 안내 블록 삭제')
  const edit = await host.request.put(`${BASE}/api/invitations/${id}/settlement`, { data: { items: [{ name: 'x', amount: -1 }], showGuests: false } })
  check(edit.status() === 400, '③ 음수 금액은 400')

  check(errors.length === 0, `페이지 오류 없음 ${errors.join(' | ')}`)
  await browser.close()
  console.log(failures ? `\n❌ ${failures}개 실패` : '\n✅ 모두 통과')
  process.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
