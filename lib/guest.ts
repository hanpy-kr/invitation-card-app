import 'server-only'

import bcrypt from 'bcryptjs'
import { and, desc, eq, lt } from 'drizzle-orm'

import { parseBlockConfig, type BlockConfigMap, type BlockType } from '@/shared/blocks'
import {
  isPastDeadline,
  type GuestbookEntryView,
  type GuestbookInput,
  type RsvpInput,
} from '@/shared/guest'

import { ApiError } from './api'
import { signPayload, verifyPayload } from './auth/token'
import { getDb, schema } from './db/client'

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

type EditToken = { rid: string; inv: string; exp: number }

export async function submitRsvp(slug: string, input: RsvpInput): Promise<{ editToken: string }> {
  const { invitationId, config } = await getTarget(slug, 'rsvp')
  if (isPastDeadline(config.deadline)) throw new ApiError(403, '응답 마감일이 지났어요.')
  if (input.attending && input.partySize > config.maxPartySize) {
    throw new ApiError(400, `한 번에 ${config.maxPartySize}명까지 알려 주실 수 있어요.`)
  }
  const values = {
    name: input.name,
    attending: input.attending,
    partySize: input.attending ? input.partySize : 0,
    meal: input.attending && config.askMeal ? input.meal : null,
  }

  const db = getDb()
  const prev = verifyPayload<EditToken>(input.editToken)
  let id: string | undefined
  if (prev && prev.inv === invitationId) {
    const [row] = await db
      .update(schema.rsvps)
      .set(values)
      .where(and(eq(schema.rsvps.id, prev.rid), eq(schema.rsvps.invitationId, invitationId)))
      .returning({ id: schema.rsvps.id })
    id = row?.id
  }
  if (!id) {
    const [row] = await db
      .insert(schema.rsvps)
      .values({ invitationId, ...values })
      .returning({ id: schema.rsvps.id })
    id = row.id
  }
  const exp = Math.floor(Date.now() / 1000) + 180 * 24 * 60 * 60
  return { editToken: signPayload({ rid: id, inv: invitationId, exp } satisfies EditToken) }
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
