import 'server-only'

import { and, asc, eq, inArray, sql } from 'drizzle-orm'

import { parseBlockConfig, type VoteConfig } from '@/shared/blocks'
import type { VoteCancelInput, VoteInput } from '@/shared/guest'
import { usableOptions, type VoteResults } from '@/shared/vote'

import { ApiError } from './api'
import { editableInvitationIds } from './access'
import { getDb, schema } from './db/client'
import { hashGuestToken, isGuestToken, newGuestToken } from './guest-token'

const { pollVotes, blocks, invitations } = schema

/** 발행된 초대장의 보이는 투표 블록 */
async function getVoteTarget(slug: string) {
  if (!/^[a-z0-9]{8}$/.test(slug)) throw new ApiError(404, '초대장을 찾을 수 없어요.')
  const row = await getDb().query.invitations.findFirst({
    where: eq(invitations.slug, slug),
    columns: { id: true, status: true },
    with: {
      blocks: {
        columns: { config: true },
        where: and(eq(blocks.type, 'vote'), eq(blocks.visible, true)),
        limit: 1,
      },
    },
  })
  if (!row || row.status !== 'published') throw new ApiError(404, '초대장을 찾을 수 없어요.')
  if (!row.blocks[0]) throw new ApiError(404, '이 초대장은 투표를 받지 않아요.')
  return { invitationId: row.id, config: parseBlockConfig('vote', row.blocks[0].config) }
}

async function findOwnVote(invitationId: string, editToken: string | undefined) {
  if (!isGuestToken(editToken)) return null
  const [row] = await getDb()
    .select({ id: pollVotes.id })
    .from(pollVotes)
    .where(
      and(
        eq(pollVotes.invitationId, invitationId),
        eq(pollVotes.editTokenHash, hashGuestToken(editToken)),
      ),
    )
  return row?.id ?? null
}

function checkChoices(config: VoteConfig, choices: string[]): string[] {
  const valid = new Set(usableOptions(config).map((o) => o.id))
  const picked = [...new Set(choices)].filter((c) => valid.has(c))
  if (picked.length === 0) throw new ApiError(400, '후보를 하나 이상 골라 주세요.')
  if (!config.multiple && picked.length > 1) throw new ApiError(400, '하나만 고를 수 있어요.')
  return picked
}

export async function submitVote(slug: string, input: VoteInput): Promise<{ editToken: string }> {
  const { invitationId, config } = await getVoteTarget(slug)
  if (config.status !== 'open') throw new ApiError(403, '투표가 끝났어요.')
  const choices = checkChoices(config, input.choices)
  const { token, hash } = newGuestToken()
  const values = { name: input.name, choices, editTokenHash: hash }
  const db = getDb()
  const prevId = await findOwnVote(invitationId, input.editToken)
  let updated = false
  if (prevId) {
    const rows = await db
      .update(pollVotes)
      .set(values)
      .where(and(eq(pollVotes.id, prevId), eq(pollVotes.invitationId, invitationId)))
      .returning({ id: pollVotes.id })
    updated = rows.length > 0
  }
  if (!updated) await db.insert(pollVotes).values({ invitationId, ...values })
  return { editToken: token }
}

export async function cancelVote(slug: string, input: VoteCancelInput): Promise<void> {
  const { invitationId, config } = await getVoteTarget(slug)
  if (config.status !== 'open') throw new ApiError(403, '투표가 끝났어요.')
  const id = await findOwnVote(invitationId, input.editToken)
  if (!id) throw new ApiError(404, '취소할 투표를 찾지 못했어요.')
  await getDb()
    .delete(pollVotes)
    .where(and(eq(pollVotes.id, id), eq(pollVotes.invitationId, invitationId)))
}

/** 후보별 표 수 · 투표한 이름 (지금 있는 후보만) */
export function tallyVotes(
  config: VoteConfig,
  votes: { name: string; choices: unknown }[],
): VoteResults {
  const results = usableOptions(config).map((o) => ({ id: o.id, count: 0, names: [] as string[] }))
  const byId = new Map(results.map((r) => [r.id, r]))
  for (const v of votes) {
    for (const c of Array.isArray(v.choices) ? v.choices : []) {
      const r = byId.get(String(c))
      if (r) {
        r.count++
        r.names.push(v.name)
      }
    }
  }
  return { results, voters: votes.length }
}

export async function voteResults(slug: string): Promise<VoteResults> {
  const { invitationId, config } = await getVoteTarget(slug)
  const votes = await getDb()
    .select({ name: pollVotes.name, choices: pollVotes.choices })
    .from(pollVotes)
    .where(eq(pollVotes.invitationId, invitationId))
    .orderBy(asc(pollVotes.createdAt))
    .limit(1000)
  return tallyVotes(config, votes)
}

/**
 * 주최자: 투표 확정 → 날짜 투표는 초대장 날짜, 장소 투표는 첫 번째 장소 블록에 반영.
 * 투표 블록은 결과만 남기거나(after='result') 숨김(after='hide'). slug는 그대로라 같은 링크 유지
 */
export async function confirmVote(
  invitationId: string,
  ownedIds: ReturnType<typeof ownedFilter>,
  optionId: string,
  after: 'result' | 'hide',
): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [vote] = await tx
      .select({ id: blocks.id, config: blocks.config })
      .from(blocks)
      .where(
        and(
          eq(blocks.invitationId, invitationId),
          eq(blocks.type, 'vote'),
          inArray(blocks.invitationId, ownedIds),
        ),
      )
      .limit(1)
    if (!vote) throw new ApiError(404, '투표를 찾을 수 없어요.')
    const config = parseBlockConfig('vote', vote.config)
    const option = usableOptions(config).find((o) => o.id === optionId)
    if (!option) throw new ApiError(400, '없는 후보예요.')

    if (config.kind === 'date' && option.at) {
      await tx
        .update(invitations)
        .set({ eventAt: new Date(option.at) })
        .where(eq(invitations.id, invitationId))
    } else if (config.kind === 'place') {
      const [loc] = await tx
        .select({ id: blocks.id, config: blocks.config })
        .from(blocks)
        .where(and(eq(blocks.invitationId, invitationId), eq(blocks.type, 'location')))
        .orderBy(asc(blocks.position))
        .limit(1)
      const place = { placeName: option.label, address: option.address, lat: null, lng: null }
      if (loc) {
        const next = parseBlockConfig('location', { ...(loc.config as object), ...place })
        await tx.update(blocks).set({ config: next }).where(eq(blocks.id, loc.id))
      } else {
        const [{ max }] = await tx
          .select({ max: sql<number | null>`max(${blocks.position})` })
          .from(blocks)
          .where(eq(blocks.invitationId, invitationId))
        await tx.insert(blocks).values({
          invitationId,
          type: 'location',
          position: (max ?? 0) + 100,
          config: parseBlockConfig('location', place),
        })
      }
    }
    await tx
      .update(blocks)
      .set({
        config: { ...config, status: 'closed', confirmedId: option.id },
        visible: after !== 'hide',
      })
      .where(eq(blocks.id, vote.id))
    await tx
      .update(invitations)
      .set({ updatedAt: new Date() })
      .where(eq(invitations.id, invitationId))
  })
}

/** 주최자: 확정 취소 → 다시 투표 받기 (이미 바꾼 날짜 · 장소는 그대로) */
export async function reopenVote(
  invitationId: string,
  ownedIds: ReturnType<typeof ownedFilter>,
): Promise<void> {
  const db = getDb()
  const [vote] = await db
    .select({ id: blocks.id, config: blocks.config })
    .from(blocks)
    .where(
      and(
        eq(blocks.invitationId, invitationId),
        eq(blocks.type, 'vote'),
        inArray(blocks.invitationId, ownedIds),
      ),
    )
    .limit(1)
  if (!vote) throw new ApiError(404, '투표를 찾을 수 없어요.')
  const config = parseBlockConfig('vote', vote.config)
  await db
    .update(blocks)
    .set({ config: { ...config, status: 'open', confirmedId: null }, visible: true })
    .where(eq(blocks.id, vote.id))
}

/** 소유자 또는 편집자 확인용 서브쿼리 */
export const ownedFilter = editableInvitationIds
