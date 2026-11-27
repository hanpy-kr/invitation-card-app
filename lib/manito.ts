import 'server-only'

import { randomInt } from 'node:crypto'

import { and, asc, eq, inArray } from 'drizzle-orm'

import { parseBlockConfig } from '@/shared/blocks'
import {
  changedCount,
  drawCycle,
  findGiftQuestion,
  joinsGift,
  MANITO_MIN_PEOPLE,
} from '@/shared/manito'

import { ApiError } from './api'
import { getDb, schema } from './db/client'

/** 기능 스위치 (MANITO_ENABLED=0이면 끔) */
export const manitoEnabled = () => process.env.MANITO_ENABLED !== '0'

const rand = () => randomInt(0, 2 ** 31) / 2 ** 31

/** 참석 응답 + 선물 교환 질문 설정 (명단 · 짝 계산용) */
async function loadPeople(invitationId: string) {
  const db = getDb()
  const [rsvpBlock] = await db
    .select({ config: schema.blocks.config })
    .from(schema.blocks)
    .where(and(eq(schema.blocks.invitationId, invitationId), eq(schema.blocks.type, 'rsvp')))
    .limit(1)
  const config = parseBlockConfig('rsvp', rsvpBlock?.config ?? {})
  const question = findGiftQuestion(config.questions)
  const rows = await db
    .select({
      id: schema.rsvps.id,
      name: schema.rsvps.name,
      attending: schema.rsvps.attending,
      answers: schema.rsvps.answers,
    })
    .from(schema.rsvps)
    .where(eq(schema.rsvps.invitationId, invitationId))
    .orderBy(asc(schema.rsvps.createdAt))
  return { config, people: rows.filter((r) => joinsGift(question, r)) }
}

export type GiftStatus = {
  enabled: boolean
  /** 대상 인원 */
  count: number
  min: number
  drawn: boolean
  /** 뽑은 뒤 바뀐 응답 수 (0이면 최신) */
  changed: number
}

/** 주최자 패널용 상태 — 짝 이름은 싣지 않음 */
export async function giftStatus(invitationId: string): Promise<GiftStatus> {
  const { people } = await loadPeople(invitationId)
  const pairs = await getDb()
    .select({ giver: schema.giftPairs.giverRsvpId })
    .from(schema.giftPairs)
    .where(eq(schema.giftPairs.invitationId, invitationId))
  const drawn = pairs.length > 0
  return {
    enabled: true,
    count: people.length,
    min: MANITO_MIN_PEOPLE,
    drawn,
    changed: drawn
      ? changedCount(
          people.map((p) => p.id),
          pairs.map((p) => p.giver),
        )
      : 0,
  }
}

/** 짝 뽑기 · 다시 뽑기 (기존 짝은 지우고 새로) */
export async function drawGiftPairs(invitationId: string): Promise<GiftStatus> {
  const { people } = await loadPeople(invitationId)
  if (people.length < MANITO_MIN_PEOPLE)
    throw new ApiError(400, `${MANITO_MIN_PEOPLE}명 이상 참여해야 뽑을 수 있어요.`)
  const pairs = drawCycle(
    people.map((p) => p.id),
    rand,
  )
  await getDb().transaction(async (tx) => {
    await tx.delete(schema.giftPairs).where(eq(schema.giftPairs.invitationId, invitationId))
    await tx.insert(schema.giftPairs).values(
      pairs.map(([giverRsvpId, receiverRsvpId]) => ({
        invitationId,
        giverRsvpId,
        receiverRsvpId,
      })),
    )
  })
  return giftStatus(invitationId)
}

/** 주최자가 '열어 보기'를 눌렀을 때만 — 누가 누구에게 */
export async function listGiftPairs(invitationId: string) {
  const g = schema.rsvps
  const rows = await getDb()
    .select({ giver: g.name, receiverId: schema.giftPairs.receiverRsvpId })
    .from(schema.giftPairs)
    .innerJoin(g, eq(g.id, schema.giftPairs.giverRsvpId))
    .where(eq(schema.giftPairs.invitationId, invitationId))
  const receivers = rows.length
    ? await getDb()
        .select({ id: g.id, name: g.name })
        .from(g)
        .where(
          inArray(
            g.id,
            rows.map((r) => r.receiverId),
          ),
        )
    : []
  const nameOf = new Map(receivers.map((r) => [r.id, r.name]))
  return rows.map((r) => ({ giver: r.giver, receiver: nameOf.get(r.receiverId) ?? '' }))
}

export type MyManito =
  | { state: 'before' }
  | { state: 'result'; receiver: string }

/**
 * 하객 본인의 마니또. 응답 토큰으로 확인한 '참석' 응답에게만, 그 사람의 짝 이름 하나만 준다.
 * 대상이 아니거나 토큰이 틀리면 403 (명단 · 다른 사람 짝은 어떤 경우에도 내려주지 않음)
 */
export async function myManito(
  invitationId: string,
  rsvpId: string,
): Promise<MyManito> {
  const db = getDb()
  const { people } = await loadPeople(invitationId)
  if (!people.some((p) => p.id === rsvpId)) throw new ApiError(403, '선물 교환에 참여한 분에게만 보여요.')
  const [pair] = await db
    .select({ receiverId: schema.giftPairs.receiverRsvpId })
    .from(schema.giftPairs)
    .where(
      and(
        eq(schema.giftPairs.invitationId, invitationId),
        eq(schema.giftPairs.giverRsvpId, rsvpId),
      ),
    )
  if (!pair) return { state: 'before' }
  const [r] = await db
    .select({ name: schema.rsvps.name })
    .from(schema.rsvps)
    .where(eq(schema.rsvps.id, pair.receiverId))
  return r ? { state: 'result', receiver: r.name } : { state: 'before' }
}
