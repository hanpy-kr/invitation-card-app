import 'server-only'

import { and, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'

import { parseBlockConfig } from '@/shared/blocks'
import { parseInvitees } from '@/shared/invitees'
import {
  computeSettlement,
  MAX_EXPENSE_AMOUNT,
  MAX_EXPENSES,
  settlementText,
  type Expense,
} from '@/shared/settlement'

import { getAccess } from './access'
import { ApiError } from './api'
import { getResponses } from './dashboard'
import { getDb, schema } from './db/client'
import { isUuid } from './editor'

/**
 * 주최자 전용 도구(초대 명단 체크 · 회비 정산). 하객 화면 · 공개 API · OG에는 어떤 값도 싣지 않는다.
 * (단, 정산 내역을 하객 화면에 보이기를 켠 경우에만 '안내' 블록 하나로 문구를 내보낸다)
 */
const { inviteeLists, settlements, blocks, invitations } = schema

async function requireEditable(invitationId: string, userId: string) {
  if (!isUuid(invitationId)) throw new ApiError(404, '초대장을 찾을 수 없어요.')
  const access = await getAccess(invitationId, userId)
  if (!access) throw new ApiError(404, '초대장을 찾을 수 없어요.')
}

export const expenseSchema = z.object({
  name: z.string().trim().max(30),
  amount: z.number().int().min(0).max(MAX_EXPENSE_AMOUNT),
})
export const settlementInputSchema = z.object({
  items: z.array(expenseSchema).max(MAX_EXPENSES),
  showGuests: z.boolean(),
})
export type SettlementInput = z.infer<typeof settlementInputSchema>

/** 대시보드 화면용: 초대 명단 + 정산 입력값 (쿼리 2개, 병렬) */
export async function loadHostTools(invitationId: string) {
  const db = getDb()
  const [[list], [settle]] = await Promise.all([
    db.select().from(inviteeLists).where(eq(inviteeLists.invitationId, invitationId)),
    db.select().from(settlements).where(eq(settlements.invitationId, invitationId)),
  ])
  const names = Array.isArray(list?.names) ? (list.names as unknown[]).map(String) : []
  const items: Expense[] = Array.isArray(settle?.items)
    ? (settle.items as { name?: unknown; amount?: unknown }[]).map((e) => ({
        name: String(e.name ?? ''),
        amount: Number(e.amount) || 0,
      }))
    : []
  return { invitees: names, expenses: items, showGuests: Boolean(settle?.showGuests) }
}

export async function saveInvitees(invitationId: string, userId: string, text: string) {
  await requireEditable(invitationId, userId)
  const parsed = parseInvitees(text)
  if (!parsed.ok) throw new ApiError(400, parsed.error)
  await getDb()
    .insert(inviteeLists)
    .values({ invitationId, names: parsed.names })
    .onConflictDoUpdate({
      target: inviteeLists.invitationId,
      set: { names: parsed.names, updatedAt: sql`now()` },
    })
  return { names: parsed.names, duplicates: parsed.duplicates }
}

/** 정산 저장. 하객 화면에 보이기가 켜져 있으면 '안내' 블록(source=settlement)을 만들거나 고치고, 꺼져 있으면 지운다 */
export async function saveSettlement(invitationId: string, userId: string, input: SettlementInput) {
  await requireEditable(invitationId, userId)
  const db = getDb()
  const items = input.items.filter((e) => e.name || e.amount > 0)
  await db
    .insert(settlements)
    .values({ invitationId, items, showGuests: input.showGuests })
    .onConflictDoUpdate({
      target: settlements.invitationId,
      set: { items, showGuests: input.showGuests, updatedAt: sql`now()` },
    })

  const existing = await db
    .select({ id: blocks.id })
    .from(blocks)
    .where(
      and(
        eq(blocks.invitationId, invitationId),
        eq(blocks.type, 'notice'),
        sql`${blocks.config}->>'source' = 'settlement'`,
      ),
    )
  if (!input.showGuests) {
    if (existing.length > 0)
      await db.delete(blocks).where(
        and(
          eq(blocks.invitationId, invitationId),
          inArray(
            blocks.id,
            existing.map((b) => b.id),
          ),
        ),
      )
    return { ok: true, shown: false }
  }

  const data = await getResponses(invitationId, userId)
  if (!data?.dues) throw new ApiError(400, '1인 회비가 있는 초대장에서만 보일 수 있어요.')
  const result = computeSettlement({
    perPerson: data.dues.perPerson,
    paidPeople: data.dues.paidPeople,
    attendees: data.summary.attendees,
    expenses: items,
  })
  const body = settlementText({
    title: data.title,
    perPerson: data.dues.perPerson,
    expenses: items,
    result,
  })
    .split('\n')
    .slice(1) // 제목 줄은 블록 제목이 대신함
    .join('\n')
  const config = parseBlockConfig('notice', {
    title: '정산 내역',
    items: [{ title: '정산', body: body.length > 1000 ? `${body.slice(0, 999)}…` : body }],
    source: 'settlement',
  })
  await db.transaction(async (tx) => {
    if (existing[0]) {
      await tx.update(blocks).set({ config, visible: true }).where(eq(blocks.id, existing[0].id))
    } else {
      const [{ max }] = await tx
        .select({ max: sql<number | null>`max(${blocks.position})` })
        .from(blocks)
        .where(eq(blocks.invitationId, invitationId))
      await tx
        .insert(blocks)
        .values({ invitationId, type: 'notice', position: (max ?? 0) + 100, config })
    }
    await tx
      .update(invitations)
      .set({ updatedAt: new Date() })
      .where(eq(invitations.id, invitationId))
  })
  return { ok: true, shown: true }
}
