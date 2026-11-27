/**
 * 크리스마스 파티 확인(로컬). 실행: pnpm exec tsx scripts/e2e-p13.ts  (앱 1개: 3001, DEV_LOGIN=1)
 * 만들기 → 템플릿 프리셋 → 하객 5명 응답 · 가져올 것 → 짝 뽑기 → 각자 자기 짝만 / 다른 폰 403 / 공개 HTML에 짝 없음 → 다시 뽑기 → 스위치 끄면 숨김.
 */
import { execFileSync } from 'node:child_process'

import { chromium, type Browser, type BrowserContext } from 'playwright'

const BASE = process.env.E2E_BASE ?? 'http://localhost:3001'
const DB = 'postgres://dearday:dearday@localhost:5432/dearday'
const sql = (q: string) => execFileSync('psql', [DB, '-tAc', q]).toString().trim()
const SHOT = process.env.E2E_SHOT_DIR

let failures = 0
function check(ok: unknown, label: string) {
  console.log(`${ok ? '✅' : '❌'} ${label}`)
  if (!ok) failures++
}

const GUESTS = [
  { name: '가온', gift: '참여', bring: 'cake01' },
  { name: '나래', gift: '참여', bring: 'chick1' },
  { name: '다솜', gift: '참여', bring: 'wine01' },
  { name: '라온', gift: '참여', bring: 'game01' },
  { name: '마루', gift: '이번엔 빠질게요', bring: 'dess01' },
]

async function main() {
  const browser: Browser = await chromium.launch()
  const owner = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ko-KR' })
  const page = await owner.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${BASE}/api/auth/kakao/login?dev=1&as=13&next=/dashboard`)
  await page.waitForURL(/\/dashboard/)
  sql(`delete from invitations where owner_id=(select id from users where kakao_id='dev-13')`)

  // ── 만들기 · 프리셋
  const created = await owner.request.post(`${BASE}/api/invitations`, { data: { eventType: 'christmas' } })
  check(created.status() === 201, '크리스마스 초대장 만들기(201)')
  const { id } = (await created.json()) as { id: string }
  const blocks = sql(`select type||':'||visible from blocks where invitation_id='${id}' order by position`).split('\n')
  for (const t of ['cover:true', 'greeting:true', 'calendar:true', 'location:true', 'rsvp:true', 'notice:true', 'bring:true', 'guestbook:true'])
    check(blocks.includes(t), `보이는 블록: ${t.split(':')[0]}`)
  for (const t of ['timeline:false', 'vote:false', 'account:false', 'album:false'])
    check(blocks.includes(t), `숨긴 블록: ${t.split(':')[0]}`)
  const rsvpCfg = JSON.parse(sql(`select config from blocks where invitation_id='${id}' and type='rsvp'`))
  check(rsvpCfg.showAttendees === true, '명단 공개 기본 켜짐(모임 묶음)')
  check(rsvpCfg.manito === true, '마니또 켜짐')
  check(rsvpCfg.questions.some((q: { label: string; options: string[] }) => q.label === '선물 교환 참여할래요?' && q.options[0] === '참여'), "질문 '선물 교환 참여할래요?'")
  check(rsvpCfg.questions.some((q: { label: string; options: string[] }) => q.label === '마실 것' && q.options.length === 3), "질문 '마실 것'")
  const noticeCfg = JSON.parse(sql(`select config from blocks where invitation_id='${id}' and type='notice'`))
  check(noticeCfg.items.some((i: { title: string; attendeesOnly: boolean }) => i.title === '오시는 길 상세' && i.attendeesOnly), "안내 '오시는 길 상세'는 참석자 전용")
  const bringCfg = JSON.parse(sql(`select config from blocks where invitation_id='${id}' and type='bring'`))
  check(bringCfg.items.length === 7, `가져올 것 프리셋 ${bringCfg.items.length}개`)
  check(sql(`select event_type from invitations where id='${id}'`) === 'christmas', '행사 종류 christmas')

  const pub = await owner.request.post(`${BASE}/api/invitations/${id}/publish`, { data: { published: true } })
  const { slug } = (await pub.json()) as { slug: string }
  check(pub.ok() && /^[a-z0-9]{8}$/.test(slug), `발행 slug=${slug}`)

  // ── 하객 5명 응답 + 가져올 것 (각자 다른 브라우저)
  const guestCtx: { ctx: BrowserContext; token: string; name: string }[] = []
  for (const g of GUESTS) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' })
    const r = await ctx.request.post(`${BASE}/api/i/${slug}/rsvp`, {
      data: { name: g.name, attending: true, partySize: 1, meal: null, answers: { gift01: g.gift } },
    })
    const { editToken } = (await r.json()) as { editToken: string }
    check(r.ok() && editToken, `${g.name} 응답`)
    const b = await ctx.request.post(`${BASE}/api/i/${slug}/bring`, { data: { name: g.name, itemId: g.bring, editToken } })
    check(b.ok(), `${g.name} 가져올 것 맡기 (${g.bring})`)
    await ctx.addInitScript(
      ([key, val]) => window.localStorage.setItem(key, val),
      [`dearday:rsvp:${slug}`, JSON.stringify({ editToken, name: g.name, attending: true, partySize: 1, meal: null, answers: { gift01: g.gift } })],
    )
    guestCtx.push({ ctx, token: editToken, name: g.name })
  }

  // ── 하객 화면 3상태: 뽑기 전
  const gp = await guestCtx[0].ctx.newPage()
  await gp.goto(`${BASE}/i/${slug}`)
  await gp.getByRole('button', { name: '내 마니또 보기' }).waitFor()
  await gp.getByRole('button', { name: '내 마니또 보기' }).click()
  await gp.locator('[data-state=before]').waitFor()
  check(true, '하객: 뽑기 전 → "아직 짝을 뽑지 않았어요"')
  if (SHOT) { await gp.locator('[data-state=before]').scrollIntoViewIfNeeded(); await gp.screenshot({ path: `${SHOT}/p13-manito-before.png` }) }

  // ── 주최자 패널: 뽑기
  await page.goto(`${BASE}/dashboard/${id}`)
  const panel = page.getByTestId('gift-panel')
  await panel.waitFor()
  await panel.getByRole('button', { name: '짝 뽑기' }).waitFor()
  check(/참여하는 사람\s*4명/.test(await panel.innerText()), '패널: 참여자 4명(빠진 1명 제외)')
  const html0 = await page.content()
  check(!/가온\s*→/.test(html0), '대시보드 HTML에 짝 목록 없음(열기 전)')
  await panel.getByRole('button', { name: '짝 뽑기' }).click()
  await panel.getByRole('button', { name: '다시 뽑기' }).waitFor()
  const rows = sql(`select count(*) from gift_pairs where invitation_id='${id}'`)
  check(rows === '4', `짝 4쌍 저장 (${rows})`)
  const pairsSql = sql(`select g.name||'>'||r.name from gift_pairs p join rsvps g on g.id=p.giver_rsvp_id join rsvps r on r.id=p.receiver_rsvp_id where p.invitation_id='${id}'`).split('\n')
  const map = new Map(pairsSql.map((s) => s.split('>') as [string, string]))
  check([...map].every(([a, b]) => a !== b), '자기 자신 없음')
  check([...map].every(([a, b]) => map.get(b) !== a), '서로 맞교환 없음')
  let walk = '가온'; const seen = new Set<string>()
  while (!seen.has(walk)) { seen.add(walk); walk = map.get(walk) ?? '' }
  check(seen.size === 4 && walk === '가온', '한 바퀴(단일 순환)')
  check(!map.has('마루') && ![...map.values()].includes('마루'), '빠진 사람(마루)은 짝에 없음')

  // 짝 목록은 경고 뒤에만
  check((await panel.getByText(/→/).count()) === 0, '열기 전에는 짝 목록 안 보임')
  await panel.getByRole('button', { name: '짝 목록 열어 보기' }).click()
  check((await panel.getByText(/보지 마세요/).count()) === 1, '경고: 본인도 참여자면 보지 마세요')
  check((await panel.getByText(/→/).count()) === 0, '경고 단계에서도 짝 안 보임')
  await panel.getByRole('button', { name: '그래도 볼게요' }).click()
  await panel.getByText(/→/).first().waitFor()
  check((await panel.getByText(/→/).count()) === 4, '확인 뒤 짝 4줄')
  if (SHOT) { await panel.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${SHOT}/p13-gift-panel.png` }) }

  // ── 각자 자기 짝만
  for (const gc of guestCtx.slice(0, 4)) {
    const res = await gc.ctx.request.post(`${BASE}/api/i/${slug}/manito`, { data: { editToken: gc.token } })
    const body = await res.json()
    check(res.ok() && body.state === 'result' && body.receiver === map.get(gc.name), `${gc.name}의 마니또 = ${body.receiver}`)
    check(JSON.stringify(Object.keys(body).sort()) === JSON.stringify(['receiver', 'state']), `${gc.name}: 응답에 내 짝 말고 다른 정보 없음`)
    check(/no-store/.test(res.headers()['cache-control'] ?? ''), `${gc.name}: no-store`)
  }
  const gp2 = await guestCtx[0].ctx.newPage()
  await gp2.goto(`${BASE}/i/${slug}`)
  await gp2.getByRole('button', { name: '내 마니또 보기' }).click()
  await gp2.getByTestId('manito-receiver').waitFor()
  check((await gp2.getByTestId('manito-receiver').innerText()) === map.get('가온'), '하객 화면: 내 짝 이름 표시')
  if (SHOT) { await gp2.getByTestId('manito-receiver').scrollIntoViewIfNeeded(); await gp2.screenshot({ path: `${SHOT}/p13-manito-result.png` }) }

  // 불참 의사(빠질게요) · 가짜 토큰 · 토큰 없음 · 다른 초대장
  const anon = await browser.newContext()
  const skip = await guestCtx[4].ctx.request.post(`${BASE}/api/i/${slug}/manito`, { data: { editToken: guestCtx[4].token } })
  check(skip.status() === 403, '선물 교환에 빠진 하객 → 403')
  const fake = await anon.request.post(`${BASE}/api/i/${slug}/manito`, { data: { editToken: 'x'.repeat(40) } })
  check(fake.status() === 403, '가짜 토큰 → 403')
  const none = await anon.request.post(`${BASE}/api/i/${slug}/manito`, { data: {} })
  check(none.status() === 400 || none.status() === 403, `토큰 없음 → ${none.status()}`)
  check(!/가온|나래|다솜|라온/.test(await fake.text()), '403 응답에 이름 없음')
  const otherSlug = sql(`select slug from invitations where status='published' and slug<>'${slug}' limit 1`)
  if (otherSlug) {
    const o = await anon.request.post(`${BASE}/api/i/${otherSlug}/manito`, { data: { editToken: guestCtx[0].token } })
    check([403, 404].includes(o.status()), `다른 초대장에 내 토큰 → ${o.status()}`)
  }
  // 다른 폰(토큰 없는 브라우저) 화면
  const op = await anon.newPage()
  await op.goto(`${BASE}/i/${slug}`)
  await op.getByText('응답한 폰에서 열어 주세요').waitFor()
  check(true, '다른 폰: "응답한 폰에서 열어 주세요 · 주최자에게 물어보세요"')
  if (SHOT) { await op.getByText('응답한 폰에서 열어 주세요').scrollIntoViewIfNeeded(); await op.screenshot({ path: `${SHOT}/p13-manito-other.png` }) }

  // ── 비밀: 공개 HTML · RSC · .ics · 명단 API · OG에 짝 정보 없음
  const rsvpIds = sql(`select id from rsvps where invitation_id='${id}'`).split('\n')
  const pub1 = await anon.request.get(`${BASE}/i/${slug}`)
  const rsc = await anon.request.get(`${BASE}/i/${slug}`, { headers: { RSC: '1' } })
  const ics = await anon.request.get(`${BASE}/i/${slug}/event.ics`)
  const att = await anon.request.get(`${BASE}/api/i/${slug}/attendees`)
  const texts = { 'HTML': await pub1.text(), 'RSC': await rsc.text(), '.ics': await ics.text(), '명단 API': await att.text() }
  for (const [k, t] of Object.entries(texts)) {
    check(!/giver|receiver|gift_pairs|giftPairs|manito-receiver/i.test(t.replace(/data-testid="manito-receiver"/g, '')), `${k}: 짝 관련 키 없음`)
    check(!rsvpIds.some((r) => t.includes(r)), `${k}: 응답 id 없음`)
  }
  // 짝을 이름 순서쌍으로 쓰는 글(예: '가온 → 나래')도 없음
  for (const [k, t] of Object.entries(texts))
    check(![...map].some(([a, b]) => new RegExp(`${a}\\s*(→|->|>)\\s*${b}`).test(t)), `${k}: 이름 순서쌍 없음`)
  const ogMeta = (texts.HTML.match(/<meta[^>]+(og:|twitter:)[^>]+>/g) ?? []).join(' ')
  check(ogMeta.length > 0 && !/마니또|giver|receiver/.test(ogMeta), 'OG · 공유 카드 메타에 짝 없음')

  // ── 다시 뽑기 · 바뀐 응답 안내
  const before = JSON.stringify([...map])
  let changed = false
  page.on('dialog', (d) => d.accept())
  for (let i = 0; i < 6 && !changed; i++) {
    await panel.getByRole('button', { name: '다시 뽑기' }).click()
    await page.waitForTimeout(500)
    const m2 = new Map(sql(`select g.name||'>'||r.name from gift_pairs p join rsvps g on g.id=p.giver_rsvp_id join rsvps r on r.id=p.receiver_rsvp_id where p.invitation_id='${id}'`).split('\n').map((s) => s.split('>') as [string, string]))
    changed = JSON.stringify([...m2]) !== before
    if (changed) map.clear(), m2.forEach((v, k) => map.set(k, v))
  }
  check(changed, '다시 뽑기로 짝이 바뀜')
  check(sql(`select count(*) from gift_pairs where invitation_id='${id}'`) === '4', '다시 뽑아도 4쌍')
  const again = await guestCtx[0].ctx.request.post(`${BASE}/api/i/${slug}/manito`, { data: { editToken: guestCtx[0].token } })
  check((await again.json()).receiver === map.get('가온'), '다시 뽑은 뒤 가온의 새 짝이 보임')

  // 응답이 바뀌면 자동 반영 안 됨 + 안내
  const late = await anon.request.post(`${BASE}/api/i/${slug}/rsvp`, { data: { name: '바다', attending: true, partySize: 1, meal: null, answers: { gift01: '참여' } } })
  check(late.ok(), '뽑은 뒤 새 응답(바다)')
  await page.reload()
  await page.getByTestId('gift-panel').getByText(/뽑은 뒤 바뀐 응답 1건 — 다시 뽑기 필요/).waitFor()
  check(sql(`select count(*) from gift_pairs where invitation_id='${id}'`) === '4', '새 응답은 자동 반영되지 않음(짝 4쌍 그대로)')
  check(true, '안내: 뽑은 뒤 바뀐 응답 1건 — 다시 뽑기 필요')
  if (SHOT) { await page.getByTestId('gift-panel').scrollIntoViewIfNeeded(); await page.screenshot({ path: `${SHOT}/p13-gift-changed.png` }) }

  // 복제 · 나도 만들기로 짝이 따라가지 않음
  const dup = await owner.request.post(`${BASE}/api/invitations/${id}/duplicate`, { data: {} })
  if (dup.ok()) {
    const { id: nid } = (await dup.json()) as { id: string }
    check(sql(`select count(*) from gift_pairs where invitation_id='${nid}'`) === '0', '복제본에 짝 없음')
  }

  check(errors.length === 0, `페이지 오류 없음 ${errors.join(' | ')}`)
  await browser.close()
  console.log(failures === 0 ? '\n전부 통과' : `\n실패 ${failures}건`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
