import 'server-only'

import { and, eq, sql } from 'drizzle-orm'

import { toKstDateString } from '@/shared/date'

import { getDb, schema } from './db/client'

const { invitations: inv, invitationViewsDaily: views, users } = schema

/**
 * 하객 화면 열람 1회 (브라우저가 하루 한 번 sendBeacon으로 보냄). 페이지 렌더링에는 DB 쓰기를 넣지 않는다.
 * 발행된 초대장만 센다.
 */
export async function recordView(slug: string): Promise<void> {
  if (!/^[a-z0-9]{8}$/.test(slug)) return
  const db = getDb()
  const [row] = await db
    .select({ id: inv.id })
    .from(inv)
    .where(and(eq(inv.slug, slug), eq(inv.status, 'published')))
  if (!row) return
  await db
    .insert(views)
    .values({ invitationId: row.id, day: toKstDateString(new Date()), views: 1 })
    .onConflictDoUpdate({
      target: [views.invitationId, views.day],
      set: { views: sql`${views.views} + 1` },
    })
}

/** ADMIN_KAKAO_IDS(쉼표 구분)에 있는 사용자만. 비어 있으면 아무도 아님 */
export async function isAdmin(userId: string): Promise<boolean> {
  const ids = (process.env.ADMIN_KAKAO_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (ids.length === 0) return false
  const [u] = await getDb()
    .select({ kakaoId: users.kakaoId })
    .from(users)
    .where(eq(users.id, userId))
  return Boolean(u?.kakaoId && ids.includes(u.kakaoId))
}

type Row = Record<string, unknown>

/** 운영 지표 (최근 8주, 한국 시간 월요일 시작 주) — 쿼리 3개, 관리자 화면에서만 */
export async function adminStats() {
  const db = getDb()
  const weeks = sql`generate_series(date_trunc('week', (now() at time zone 'Asia/Seoul')) - interval '7 weeks', date_trunc('week', (now() at time zone 'Asia/Seoul')), interval '1 week')`

  // 주간 발행 수 (행사 종류별). 발행 시각이 없는 1차 초대장은 만든 시각으로
  const published = await db.execute(sql`
    select to_char(date_trunc('week', coalesce(published_at, created_at) at time zone 'Asia/Seoul'), 'YYYY-MM-DD') as week,
           event_type, count(*)::int as n
    from invitations
    where status = 'published'
      and coalesce(published_at, created_at) >= (date_trunc('week', now() at time zone 'Asia/Seoul') - interval '7 weeks') at time zone 'Asia/Seoul'
    group by 1, 2 order by 1, 2`)

  // 열람 → 응답 전환 (주별 합계)
  const funnel = await db.execute(sql`
    select to_char(w, 'YYYY-MM-DD') as week,
      (select coalesce(sum(views), 0)::int from invitation_views_daily
        where day >= w::date and day < (w + interval '1 week')::date) as views,
      (select count(*)::int from rsvps
        where created_at >= w at time zone 'Asia/Seoul' and created_at < (w + interval '1 week') at time zone 'Asia/Seoul') as responses,
      (select count(*)::int from invitations
        where created_from is not null
          and created_at >= w at time zone 'Asia/Seoul' and created_at < (w + interval '1 week') at time zone 'Asia/Seoul') as from_guest,
      (select count(*)::int from invitations
        where created_from is not null and status = 'published'
          and created_at >= w at time zone 'Asia/Seoul' and created_at < (w + interval '1 week') at time zone 'Asia/Seoul') as from_guest_published
    from ${weeks} as w order by 1`)

  // 하객 → 주최자 전환을 많이 만든 원본 초대장
  const sources = await db.execute(sql`
    select created_from as slug, count(*)::int as n,
      count(*) filter (where status = 'published')::int as published
    from invitations where created_from is not null
    group by 1 order by 2 desc limit 10`)

  const rows = (r: unknown) => ((r as { rows?: Row[] }).rows ?? (r as Row[])) as Row[]
  return {
    published: rows(published) as { week: string; event_type: string; n: number }[],
    funnel: rows(funnel) as {
      week: string
      views: number
      responses: number
      from_guest: number
      from_guest_published: number
    }[],
    sources: rows(sources) as { slug: string; n: number; published: number }[],
  }
}
