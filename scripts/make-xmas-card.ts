/** 크리스마스 금박 표지를 줄여 찍어 봉투(리본 카드 · 책 표지) 안 그림으로 쓸 정적 이미지를 만든다. 실행 뒤 public/covers/templates/xmas-card-560.webp 를 커밋 */
import { execFileSync } from 'node:child_process'
import { chromium } from 'playwright'

const BASE = process.env.E2E_BASE ?? 'http://localhost:3001'
const DB = 'postgres://dearday:dearday@localhost:5432/dearday'
const sql = (q: string) => execFileSync('psql', [DB, '-tAc', q]).toString().trim()

async function main() {
  const browser = await chromium.launch()
  const owner = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ko-KR' })
  const page = await owner.newPage()
  await page.goto(`${BASE}/api/auth/kakao/login?dev=1&as=14&next=/dashboard`)
  await page.waitForURL(/\/dashboard/)
  const { id } = (await (await owner.request.post(`${BASE}/api/invitations`, { data: { eventType: 'christmas' } })).json()) as { id: string }
  sql(`update invitations set event_at='2026-12-24T19:00:00+09:00' where id='${id}'`)
  sql(`update blocks set config = config || '{"title":"다솜네 크리스마스 홈파티","effect":"none","intro":"none"}'::jsonb where invitation_id='${id}' and type='cover'`)
  const { slug } = (await (await owner.request.post(`${BASE}/api/invitations/${id}/publish`, { data: { published: true } })).json()) as { slug: string }
  const g = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ko-KR' })
  const p = await g.newPage()
  await p.goto(`${BASE}/i/${slug}`)
  await p.waitForTimeout(1800)
  await p.screenshot({ path: '/tmp/xmas-card-raw.png', clip: { x: 0, y: 170, width: 390, height: 487.5 } })
  sql(`delete from invitations where id='${id}'`)
  await browser.close()
}
main()
