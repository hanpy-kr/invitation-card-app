import 'server-only'

import bcrypt from 'bcryptjs'
import { and, asc, desc, eq, lt } from 'drizzle-orm'

import { parseBlockConfig, type BlockConfigMap, type BlockType } from '@/shared/blocks'
import {
  isPastDeadline,
  type GuestbookEntryView,
  type GuestbookInput,
  type RsvpInput,
} from '@/shared/guest'
import { cleanAnswers } from '@/shared/rsvp-questions'

import { ApiError } from './api'
import { notifyNewRsvp } from './notify'
import { verifyPayload } from './auth/token'
import { getDb, schema } from './db/client'
import { hashGuestToken, isGuestToken, newGuestToken } from './guest-token'

/** 발행된 초대장 + 보이는 해당 블록 설정 (쿼리 1회). 없으면 404 */
async function getTarget<K extends BlockType>(slug: string, type: K) {
  if (!/^[a-z0-9]{8}$/.test(slug)) throw new ApiError(404, '초대장을 찾을 수 없어요.')
  const row = await getDb().query.invitations.findFirst({
    where: eq(schema.invitations.slug, slug),
    columns: { id: true, status: true },
    with: {
      blocks: {
        columns: { config: true },
        where: and(eq(schema.blocks.type, type), eq(schema.blocks.visible, true)),
        limit: 1,
      },
    },
  })
  if (!row || row.status !== 'published') throw new ApiError(404, '초대장을 찾을 수 없어요.')
  const block = row.blocks[0]
  if (!block) throw new ApiError(404, '이 초대장은 지금 받지 않아요.')
  return { invitationId: row.id, config: parseBlockConfig(type, block.config) as BlockConfigMap[K] }
}

/** 1차에서 내려준 서명 토큰 (응답 id를 담음). 다음 수정 때 새 무작위 토큰으로 바꿔 줌 */
type LegacyEditToken = { rid: string; inv: string; exp: number }

/** 하객 수정 토큰으로 내 응답 찾기 (새 토큰: 해시 비교, 1차 토큰: 서명 확인) */
async function findOwnRsvp(invitationId: string, editToken: string | undefined) {
  if (!editToken) return null
  const db = getDb()
  if (isGuestToken(editToken)) {
    const [row] = await db
      .select({ id: schema.rsvps.id })
      .from(schema.rsvps)
      .where(
        and(
          eq(schema.rsvps.invitationId, invitationId),
          eq(schema.rsvps.editTokenHash, hashGuestToken(editToken)),
        ),
      )
    return row?.id ?? null
  }
  const legacy = verifyPayload<LegacyEditToken>(editToken)
  return legacy && legacy.inv === invitationId ? legacy.rid : null
}

export async function submitRsvp(slug: string, input: RsvpInput): Promise<{ editToken: string }> {
  const { invitationId, config } = await getTarget(slug, 'rsvp')
  if (isPastDeadline(config.deadline)) throw new ApiError(403, '응답 마감일이 지났어요.')
  if (input.attending && input.partySize > config.maxPartySize) {
    throw new ApiError(400, `한 번에 ${config.maxPartySize}명까지 알려 주실 수 있어요.`)
  }
  const cleaned = cleanAnswers(config.questions, input.attending, input.answers)
  if ('error' in cleaned) throw new ApiError(400, cleaned.error)
  // 보낼 때마다 토큰을 새로 발급 (이전 토큰은 무효)
  const { token, hash } = newGuestToken()
  const values = {
    name: input.name,
    attending: input.attending,
    partySize: input.attending ? input.partySize : 0,
    meal: input.attending && config.askMeal ? input.meal : null,
    answers: cleaned.answers,
    editTokenHash: hash,
  }

  const db = getDb()
  const prevId = await findOwnRsvp(invitationId, input.editToken)
  let id: string | undefined
  if (prevId) {
    const [row] = await db
      .update(schema.rsvps)
      .set(values)
      .where(and(eq(schema.rsvps.id, prevId), eq(schema.rsvps.invitationId, invitationId)))
      .returning({ id: schema.rsvps.id })
    id = row?.id
  }
  if (!id) {
    await db.insert(schema.rsvps).values({ invitationId, ...values })
    // 새 응답 카톡 알림 (주최자가 켠 경우만). 실패해도 응답은 성공 — 3초 안에 끝나지 않으면 건너뜀
    await notifyNewRsvp(invitationId, {
      name: values.name,
      attending: values.attending,
      partySize: values.partySize,
    })
  }
  return { editToken: token }
}

/** 하객: 내 응답 취소 (같은 브라우저의 토큰으로만). 마감 뒤에는 못 함 */
export async function cancelRsvp(slug: string, editToken: string): Promise<void> {
  const { invitationId, config } = await getTarget(slug, 'rsvp')
  if (isPastDeadline(config.deadline)) throw new ApiError(403, '응답 마감일이 지났어요.')
  const id = await findOwnRsvp(invitationId, editToken)
  if (!id) throw new ApiError(404, '취소할 응답을 찾지 못했어요.')
  await getDb()
    .delete(schema.rsvps)
    .where(and(eq(schema.rsvps.id, id), eq(schema.rsvps.invitationId, invitationId)))
}

/** 참석자 명단 (이름만, 응답 순). 주최자가 명단 공개를 켰을 때만 */
export async function listAttendees(slug: string): Promise<{ names: string[] }> {
  const { invitationId, config } = await getTarget(slug, 'rsvp')
  if (!config.showAttendees) throw new ApiError(404, '명단을 공개하지 않는 초대장이에요.')
  const rows = await getDb()
    .select({ name: schema.rsvps.name })
    .from(schema.rsvps)
    .where(and(eq(schema.rsvps.invitationId, invitationId), eq(schema.rsvps.attending, true)))
    .orderBy(asc(schema.rsvps.createdAt))
    .limit(500)
  return { names: rows.map((r) => r.name) }
}

const PAGE = 20

export async function listGuestbook(
  slug: string,
  before?: string,
): Promise<{ entries: GuestbookEntryView[]; next: string | null }> {
  const { invitationId } = await getTarget(slug, 'guestbook')
  const beforeDate = before ? new Date(before) : null
  const rows = await getDb()
    .select({
      id: schema.guestbookEntries.id,
      name: schema.guestbookEntries.name,
      message: schema.guestbookEntries.message,
      createdAt: schema.guestbookEntries.createdAt,
    })
    .from(schema.guestbookEntries)
    .where(
      and(
        eq(schema.guestbookEntries.invitationId, invitationId),
        eq(schema.guestbookEntries.hidden, false),
        beforeDate && !isNaN(beforeDate.getTime())
          ? lt(schema.guestbookEntries.createdAt, beforeDate)
          : undefined,
      ),
    )
    .orderBy(desc(schema.guestbookEntries.createdAt))
    .limit(PAGE + 1)
  const page = rows.slice(0, PAGE)
  return {
    entries: page.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    next: rows.length > PAGE ? page[page.length - 1].createdAt.toISOString() : null,
  }
}

export async function createGuestbookEntry(
  slug: string,
  input: GuestbookInput,
): Promise<GuestbookEntryView> {
  const { invitationId } = await getTarget(slug, 'guestbook')
  const passwordHash = await bcrypt.hash(input.password, 10)
  const [row] = await getDb()
    .insert(schema.guestbookEntries)
    .values({ invitationId, name: input.name, message: input.message, passwordHash })
    .returning()
  return {
    id: row.id,
    name: row.name,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
  }
}

/** 작성자 본인 삭제 (비밀번호 확인) */
export async function deleteGuestbookEntry(
  slug: string,
  entryId: string,
  password: string,
): Promise<void> {
  const { invitationId } = await getTarget(slug, 'guestbook')
  const db = getDb()
  const [row] = await db
    .select({ id: schema.guestbookEntries.id, hash: schema.guestbookEntries.passwordHash })
    .from(schema.guestbookEntries)
    .where(
      and(
        eq(schema.guestbookEntries.id, entryId),
        eq(schema.guestbookEntries.invitationId, invitationId),
      ),
    )
  if (!row) throw new ApiError(404, '이미 지워진 글이에요.')
  if (!(await bcrypt.compare(password, row.hash)))
    throw new ApiError(403, '비밀번호가 맞지 않아요.')
  await db.delete(schema.guestbookEntries).where(eq(schema.guestbookEntries.id, row.id))
}

/**
 * 참석자 전용 안내: 참석 응답 토큰(하객 브라우저 localStorage)으로 '참석'이라고 응답한 사람임을 확인한 뒤에만 내용을 준다.
 * 공개 초대장 데이터에는 이 내용이 없다(redactMemberOnly).
 */
export async function memberNotices(
  slug: string,
  editToken: string | undefined,
): Promise<{ items: { index: number; title: string; body: string }[] }> {
  const { invitationId, config } = await getTarget(slug, 'notice')
  const rid = await findOwnRsvp(invitationId, editToken)
  if (!rid) throw new ApiError(403, '참석 응답을 보낸 분에게만 보여요.')
  const [r] = await getDb()
    .select({ attending: schema.rsvps.attending })
    .from(schema.rsvps)
    .where(and(eq(schema.rsvps.id, rid), eq(schema.rsvps.invitationId, invitationId)))
  if (!r?.attending) throw new ApiError(403, '참석 응답을 보낸 분에게만 보여요.')
  return {
    items: config.items
      .map((it, index) => ({ index, title: it.title, body: it.body, only: it.attendeesOnly }))
      .filter((it) => it.only && (it.title || it.body))
      .map(({ index, title, body }) => ({ index, title, body })),
  }
}
