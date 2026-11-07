import 'server-only'

import { and, asc, eq } from 'drizzle-orm'

import { ApiError } from './api'
import { signPayload, verifyPayload } from './auth/token'
import { getDb, schema } from './db/client'
import { isUuid } from './editor'

const { invitations: inv, invitationEditors: editors, users } = schema

const INVITE_DAYS = 7
type InviteToken = { k: 'editor'; inv: string; exp: number }

async function assertOwner(invitationId: string, userId: string) {
  if (!isUuid(invitationId)) throw new ApiError(404, '초대장을 찾을 수 없어요.')
  const [row] = await getDb()
    .select({ id: inv.id })
    .from(inv)
    .where(and(eq(inv.id, invitationId), eq(inv.ownerId, userId)))
  if (!row) throw new ApiError(403, '초대장 주인만 할 수 있어요.')
}

/** 소유자: 공동 편집 초대 링크 (7일 뒤 만료). DB에 저장하지 않는 서명 토큰 */
export async function createEditorInvite(invitationId: string, userId: string) {
  await assertOwner(invitationId, userId)
  const [u] = await getDb()
    .select({ anonymous: users.anonymous })
    .from(users)
    .where(eq(users.id, userId))
  if (u?.anonymous)
    throw new ApiError(403, '카카오로 로그인하면 함께 편집할 사람을 초대할 수 있어요.')
  const exp = Math.floor(Date.now() / 1000) + INVITE_DAYS * 24 * 60 * 60
  return {
    token: signPayload({ k: 'editor', inv: invitationId, exp } satisfies InviteToken),
    expiresAt: new Date(exp * 1000).toISOString(),
  }
}

/** 초대 링크를 연 사람을 편집자로 → 초대장 id. 소유자 본인이 열면 그냥 통과 */
export async function acceptEditorInvite(token: string, userId: string): Promise<string | null> {
  const payload = verifyPayload<InviteToken>(token)
  if (!payload || payload.k !== 'editor' || !isUuid(payload.inv)) return null
  const db = getDb()
  const [row] = await db.select({ ownerId: inv.ownerId }).from(inv).where(eq(inv.id, payload.inv))
  if (!row) return null
  if (row.ownerId !== userId) {
    await db.insert(editors).values({ invitationId: payload.inv, userId }).onConflictDoNothing()
  }
  return payload.inv
}

export async function listEditors(invitationId: string) {
  return getDb()
    .select({ userId: editors.userId, nickname: users.nickname, createdAt: editors.createdAt })
    .from(editors)
    .innerJoin(users, eq(users.id, editors.userId))
    .where(eq(editors.invitationId, invitationId))
    .orderBy(asc(editors.createdAt))
}

/** 소유자: 편집자 빼기 */
export async function removeEditor(invitationId: string, ownerId: string, editorId: string) {
  await assertOwner(invitationId, ownerId)
  if (!isUuid(editorId)) throw new ApiError(404, '편집자를 찾을 수 없어요.')
  await getDb()
    .delete(editors)
    .where(and(eq(editors.invitationId, invitationId), eq(editors.userId, editorId)))
}
