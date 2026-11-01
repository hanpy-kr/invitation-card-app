import 'server-only'

import { and, desc, eq, inArray, sql } from 'drizzle-orm'

import { getDb, schema } from './db/client'
import { isUuid } from './editor'

const { invitations: inv, rsvps, guestbookEntries: gb } = schema

/** 소유자 확인용 서브쿼리: 이 사용자의 초대장 id들 */
const ownedInvitationIds = (userId: string) =>
  getDb().select({ id: inv.id }).from(inv).where(eq(inv.ownerId, userId))

/**
 * 내 초대장 목록 + 응답 수 (쿼리 1회: invitations LEFT JOIN rsvps GROUP BY).
 * 주의: 단일 테이블 select에서 sql`${inv.id}`는 테이블 이름 없이 "id"로 렌더링된다.
 * 상관 서브쿼리 안에 넣으면 안쪽 테이블의 id로 해석되므로 join으로 집계한다.
 */
export async function listMyInvitations(userId: string) {
  return getDb()
    .select({
      id: inv.id,
      slug: inv.slug,
      title: inv.title,
      eventType: inv.eventType,
      eventAt: inv.eventAt,
      status: inv.status,
      updatedAt: inv.updatedAt,
      responses: sql<number>`count(${rsvps.id})::int`,
      attendees: sql<number>`coalesce(sum(${rsvps.partySize}) filter (where ${rsvps.attending}), 0)::int`,
    })
    .from(inv)
    .leftJoin(rsvps, eq(rsvps.invitationId, inv.id))
    .where(eq(inv.ownerId, userId))
    .groupBy(inv.id)
    .orderBy(desc(inv.updatedAt))
}

export type ResponseSummary = {
  attendingResponses: number
  attendees: number
  declined: number
  mealYes: number
  mealNo: number
  mealUndecided: number
}

/** 응답 집계 화면: 초대장 + 참석 응답 + 방명록 (쿼리 1회) */
export async function getResponses(id: string, userId: string) {
  if (!isUuid(id)) return null
  const row = await getDb().query.invitations.findFirst({
    where: and(eq(inv.id, id), eq(inv.ownerId, userId)),
    columns: { id: true, slug: true, title: true, eventType: true, eventAt: true, status: true },
    with: {
      rsvps: { orderBy: [desc(rsvps.createdAt)] },
      guestbookEntries: {
        columns: { id: true, name: true, message: true, hidden: true, createdAt: true },
        orderBy: [desc(gb.createdAt)],
      },
      blocks: { columns: { type: true, config: true }, where: eq(schema.blocks.type, 'rsvp') },
    },
  })
  if (!row) return null

  const summary: ResponseSummary = {
    attendingResponses: 0,
    attendees: 0,
    declined: 0,
    mealYes: 0,
    mealNo: 0,
    mealUndecided: 0,
  }
  for (const r of row.rsvps) {
    if (!r.attending) {
      summary.declined++
      continue
    }
    summary.attendingResponses++
    summary.attendees += r.partySize
    if (r.meal === true) summary.mealYes += r.partySize
    else if (r.meal === false) summary.mealNo += r.partySize
    else summary.mealUndecided += r.partySize
  }
  const askMeal = Boolean((row.blocks[0]?.config as { askMeal?: boolean } | undefined)?.askMeal)
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    eventType: row.eventType,
    eventAt: row.eventAt?.toISOString() ?? null,
    status: row.status,
    askMeal,
    summary,
    rsvps: row.rsvps.map((r) => ({
      id: r.id,
      name: r.name,
      attending: r.attending,
      partySize: r.partySize,
      meal: r.meal,
      createdAt: r.createdAt.toISOString(),
    })),
    guestbook: row.guestbookEntries.map((g) => ({ ...g, createdAt: g.createdAt.toISOString() })),
  }
}

export type ResponsesData = NonNullable<Awaited<ReturnType<typeof getResponses>>>

/** 주최자: 방명록 글 숨김 / 다시 보이기 */
export async function setGuestbookHidden(
  invitationId: string,
  entryId: string,
  userId: string,
  hidden: boolean,
) {
  if (!isUuid(invitationId) || !isUuid(entryId)) return false
  const rows = await getDb()
    .update(gb)
    .set({ hidden })
    .where(
      and(
        eq(gb.id, entryId),
        eq(gb.invitationId, invitationId),
        inArray(gb.invitationId, ownedInvitationIds(userId)),
      ),
    )
    .returning({ id: gb.id })
  return rows.length > 0
}

/** 주최자: 잘못 들어온 참석 응답 지우기 */
export async function deleteRsvp(invitationId: string, rsvpId: string, userId: string) {
  if (!isUuid(invitationId) || !isUuid(rsvpId)) return false
  const rows = await getDb()
    .delete(rsvps)
    .where(
      and(
        eq(rsvps.id, rsvpId),
        eq(rsvps.invitationId, invitationId),
        inArray(rsvps.invitationId, ownedInvitationIds(userId)),
      ),
    )
    .returning({ id: rsvps.id })
  return rows.length > 0
}
