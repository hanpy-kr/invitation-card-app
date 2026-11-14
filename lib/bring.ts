import 'server-only'

import { and, asc, eq, sql } from 'drizzle-orm'

import { parseBlockConfig } from '@/shared/blocks'
import { isBringFull, tallyBring, usableBringItems, type BringResults } from '@/shared/bring'
import type { BringCancelInput, BringInput } from '@/shared/guest'

import { ApiError } from './api'
import { getDb, schema } from './db/client'
import { hashGuestToken, isGuestToken, newGuestToken } from './guest-token'

const { bringClaims, blocks, invitations } = schema

/** 발행된 초대장의 보이는 나눠 맡기 블록 */
async function getBringTarget(slug: string) {
  if (!/^[a-z0-9]{8}$/.test(slug)) throw new ApiError(404, '초대장을 찾을 수 없어요.')
  const row = await getDb().query.invitations.findFirst({
    where: eq(invitations.slug, slug),
    columns: { id: true, status: true },
    with: {
      blocks: {
        columns: { config: true },
        where: and(eq(blocks.type, 'bring'), eq(blocks.visible, true)),
        limit: 1,
      },
    },
  })
  if (!row || row.status !== 'published') throw new ApiError(404, '초대장을 찾을 수 없어요.')
  if (!row.blocks[0]) throw new ApiError(404, '이 초대장은 나눠 맡기를 받지 않아요.')
  return { invitationId: row.id, config: parseBlockConfig('bring', row.blocks[0].config) }
}

export async function bringResults(slug: string): Promise<BringResults> {
  const { invitationId, config } = await getBringTarget(slug)
  const claims = await getDb()
    .select({ itemId: bringClaims.itemId, name: bringClaims.name })
    .from(bringClaims)
    .where(eq(bringClaims.invitationId, invitationId))
    .orderBy(asc(bringClaims.createdAt))
    .limit(1000)
  return tallyBring(config.items, claims)
}

/** 항목 하나 맡기. 정원이 찼으면 막고, 동시에 눌러도 정원을 넘기지 않는다(항목별 잠금) */
export async function claimBring(slug: string, input: BringInput): Promise<{ editToken: string }> {
  const { invitationId, config } = await getBringTarget(slug)
  const item = usableBringItems(config.items).find((it) => it.id === input.itemId)
  if (!item) throw new ApiError(404, '없는 항목이에요.')
  const { token, hash } = newGuestToken()
  await getDb().transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`bring:${invitationId}:${item.id}`}))`,
    )
    const rows = await tx
      .select({ name: bringClaims.name })
      .from(bringClaims)
      .where(and(eq(bringClaims.invitationId, invitationId), eq(bringClaims.itemId, item.id)))
    if (isBringFull(item.need, rows.length)) throw new ApiError(409, '이미 다 채워진 항목이에요.')
    if (rows.some((r) => r.name === input.name))
      throw new ApiError(409, '같은 이름으로 이미 이 항목을 맡았어요.')
    await tx
      .insert(bringClaims)
      .values({ invitationId, itemId: item.id, name: input.name, editTokenHash: hash })
  })
  return { editToken: token }
}

/** 내가 맡은 것 취소 (그 맡기를 만든 브라우저의 토큰으로만) */
export async function cancelBring(slug: string, input: BringCancelInput): Promise<void> {
  const { invitationId } = await getBringTarget(slug)
  if (!isGuestToken(input.editToken)) throw new ApiError(404, '취소할 항목을 찾지 못했어요.')
  const rows = await getDb()
    .delete(bringClaims)
    .where(
      and(
        eq(bringClaims.invitationId, invitationId),
        eq(bringClaims.editTokenHash, hashGuestToken(input.editToken)),
      ),
    )
    .returning({ id: bringClaims.id })
  if (rows.length === 0) throw new ApiError(404, '취소할 항목을 찾지 못했어요.')
}
