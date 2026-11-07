import 'server-only'

import { and, eq, inArray, lt } from 'drizzle-orm'

import { getDb, schema } from '../db/client'
import { deleteStored } from '../storage'
import type { Session } from './session'

const { users, invitations, media, invitationSeen } = schema
const ANON_DAYS = 7

/** 로그인 없이 시작: 임시 사용자 행을 만든다 (kakao_id 없음, anonymous) */
export async function createAnonymousUser(): Promise<Session> {
  const [u] = await getDb()
    .insert(users)
    .values({ anonymous: true, nickname: '' })
    .returning({ id: users.id })
  return { userId: u.id, nickname: '', anonymous: true }
}

/** 카카오로 로그인하면 임시 사용자의 초대장 · 사진을 실제 계정으로 옮기고 임시 사용자는 지움 */
export async function mergeAnonymousInto(anonId: string, userId: string): Promise<void> {
  if (anonId === userId) return
  await getDb().transaction(async (tx) => {
    const [anon] = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, anonId), eq(users.anonymous, true)))
    if (!anon) return
    await tx.update(invitations).set({ ownerId: userId }).where(eq(invitations.ownerId, anonId))
    await tx.update(media).set({ ownerId: userId }).where(eq(media.ownerId, anonId))
    await tx.delete(invitationSeen).where(eq(invitationSeen.userId, anonId))
    await tx.delete(users).where(eq(users.id, anonId))
  })
}

/** 7일 지난 임시 사용자 정리 (초대장 · 사진 기록은 외래키로 함께, 사진 파일도 지움). 실패해도 무시 */
export async function cleanupStaleAnonymous(): Promise<number> {
  try {
    const db = getDb()
    const stale = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.anonymous, true),
          lt(users.createdAt, new Date(Date.now() - ANON_DAYS * 24 * 60 * 60 * 1000)),
        ),
      )
      .limit(50)
    if (stale.length === 0) return 0
    const ids = stale.map((u) => u.id)
    const keys = await db
      .select({ key: media.storageKey })
      .from(media)
      .where(inArray(media.ownerId, ids))
    await db.delete(users).where(and(inArray(users.id, ids), eq(users.anonymous, true)))
    await deleteStored(keys.map((k) => k.key))
    return ids.length
  } catch (err) {
    console.error('[anonymous cleanup]', err)
    return 0
  }
}
