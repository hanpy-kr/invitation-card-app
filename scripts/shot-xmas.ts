/** 크리스마스 금박 표지 캡처(로컬, 임시 확인용). 실행: pnpm exec tsx scripts/shot-xmas.ts */
import { execFileSync } from 'node:child_process'
import { chromium } from 'playwright'

const BASE = process.env.E2E_BASE ?? 'http://localhost:3001'
const DB = 'postgres://dearday:dearday@localhost:5432/dearday'
const sql = (q: string) => execFileSync('psql', [DB, '-tAc', q]).toString().trim()
const OUT = process.env.E2E_SHOT_DIR ?? '/tmp/shots'

async function main() {
  const browser = await chromium.launch()
  const owner = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ko-KR' })
  const page = await owner.newPage()
  await page.goto(`${BASE}/api/auth/kakao/login?dev=1&as=14&next=/dashboard`)
  await page.waitForURL(/\/dashboard/)
  sql(`delete from invitations where owner_id=(select id from users where kakao_id='dev-14')`)
  const mk = async (at: string | null, tag: string) => {
    const { id } = (await (await owner.request.post(`${BASE}/api/invitations`, { data: { eventType: 'christmas' } })).json()) as { id: string }
    sql(`update invitations set title='다솜네 크리스마스 홈파티', event_at=${at ? `'${at}'` : 'null'} where id='${id}'`)
    sql(`update blocks set config = jsonb_set(config,'{title}','"다솜네 크리스마스 홈파티"') where invitation_id='${id}' and type='cover'`)
    const pub = await owner.request.post(`${BASE}/api/invitations/${id}/publish`, { data: { published: true } })
    const { slug } = (await pub.json()) as { slug: string }
    return { id, slug, tag }
  }
  const a = await mk('2026-12-24T19:00:00+09:00', 'date')
  const b = await mk(null, 'dec')
  for (const x of [a, b]) {
    const g = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ko-KR' })
    const p = await g.newPage()
    await p.goto(`${BASE}/i/${x.slug}?go=cover`) // go= → 봉투 건너뜀
    await p.waitForTimeout(1800)
    await p.screenshot({ path: `${OUT}/xmas-cover-${x.tag}.png` })
    await g.close()
  }
  // 봉투(리본 카드) 첫 화면
  const g2 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ko-KR' })
  const p2 = await g2.newPage()
  await p2.goto(`${BASE}/i/${a.slug}`)
  await p2.waitForTimeout(1500)
  await p2.screenshot({ path: `${OUT}/xmas-intro.png` })
  console.log(a.slug, b.slug)
  await browser.close()
}
main()
