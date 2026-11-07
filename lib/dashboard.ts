import 'server-only'

import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'

import { parseBlockConfig, parseShareOverride } from '@/shared/blocks'
import { choiceOptions, type Answers, type RsvpQuestion } from '@/shared/rsvp-questions'
import { usableOptions } from '@/shared/vote'

import { getDb, schema } from './db/client'
import { isUuid } from './editor'
import { tallyVotes } from './vote'

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
    columns: {
      id: true,
      slug: true,
      title: true,
      eventType: true,
      eventAt: true,
      status: true,
      share: true,
    },
    with: {
      rsvps: { orderBy: [desc(rsvps.createdAt)] },
      guestbookEntries: {
        columns: { id: true, name: true, message: true, hidden: true, createdAt: true },
        orderBy: [desc(gb.createdAt)],
      },
      // 집계(참석 · 투표 · 계좌)와 다시 보내기 카드(표지 사진 · 장소)에 씀
      blocks: {
        columns: { type: true, config: true, visible: true },
        orderBy: [asc(schema.blocks.position)],
      },
      pollVotes: {
        columns: { name: true, choices: true },
        orderBy: [asc(schema.pollVotes.createdAt)],
      },
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
  const rsvpRow = row.blocks.find((b) => b.type === 'rsvp')
  const rsvpBlock = rsvpRow ? parseBlockConfig('rsvp', rsvpRow.config) : null
  const accountRow = row.blocks.find((b) => b.type === 'account' && b.visible)
  const perPerson = accountRow ? parseBlockConfig('account', accountRow.config).perPerson : null
  // 회비: 예상 = 참석 인원 × 1인 회비, 입금 = 입금 체크한 응답의 인원
  const dues =
    perPerson && perPerson > 0
      ? (() => {
          const going = row.rsvps.filter((r) => r.attending)
          const paidRows = going.filter((r) => r.paid)
          const paidPeople = paidRows.reduce((n, r) => n + r.partySize, 0)
          return {
            perPerson,
            expected: summary.attendees * perPerson,
            paidResponses: paidRows.length,
            paidPeople,
            paidAmount: paidPeople * perPerson,
          }
        })()
      : null
  const voteRow = row.blocks.find((b) => b.type === 'vote')
  const voteConfig = voteRow ? parseBlockConfig('vote', voteRow.config) : null
  const vote = voteConfig
    ? {
        config: voteConfig,
        visible: voteRow!.visible,
        options: usableOptions(voteConfig),
        ...tallyVotes(voteConfig, row.pollVotes),
      }
    : null
  const askMeal = Boolean(rsvpBlock?.askMeal)
  const questions: RsvpQuestion[] = (rsvpBlock?.questions ?? []).filter((q) => q.label.trim())
  // 선택형 질문: 보기별 응답 수 (보기 문구를 나중에 바꾸면 예전 답은 '기타'로)
  const choiceStats = questions
    .filter((q) => q.kind === 'choice')
    .map((q) => {
      const opts = choiceOptions(q)
      const counts = new Map<string, number>(opts.map((o) => [o, 0]))
      let other = 0
      for (const r of row.rsvps) {
        const v = (r.answers as Answers | null)?.[q.id]
        if (typeof v !== 'string') continue
        if (counts.has(v)) counts.set(v, counts.get(v)! + 1)
        else other++
      }
      const rows = [...counts].map(([label, count]) => ({ label, count }))
      if (other > 0) rows.push({ label: '기타(바뀐 보기)', count: other })
      return { id: q.id, label: q.label, rows }
    })
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    eventType: row.eventType,
    eventAt: row.eventAt?.toISOString() ?? null,
    status: row.status,
    askMeal,
    dues,
    shareInput: {
      title: row.title,
      eventType: row.eventType,
      eventAt: row.eventAt?.toISOString() ?? null,
      blocks: row.blocks,
      share: parseShareOverride(row.share),
    },
    rsvpDeadline: rsvpBlock?.deadline ?? null,
    vote,
    questions,
    choiceStats,
    summary,
    rsvps: row.rsvps.map((r) => ({
      id: r.id,
      name: r.name,
      attending: r.attending,
      partySize: r.partySize,
      meal: r.meal,
      answers: (r.answers ?? {}) as Answers,
      paid: r.paid,
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

/** 주최자: 회비 입금 체크 */
export async function setRsvpPaid(
  invitationId: string,
  rsvpId: string,
  userId: string,
  paid: boolean,
) {
  if (!isUuid(invitationId) || !isUuid(rsvpId)) return false
  const rows = await getDb()
    .update(rsvps)
    .set({ paid })
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
