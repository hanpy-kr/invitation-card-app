import 'server-only'

import { eq } from 'drizzle-orm'

import { getDb, schema } from './db/client'
import { deleteStored } from './storage'

/** 회원 탈퇴: 사용자 · 초대장 · 블록 · 응답 · 방명록 · 사진 기록을 지우고(외래키 cascade) 사진 파일도 지운다 */
export async function deleteAccount(userId: string): Promise<void> {
  const db = getDb()
  const keys = await db
    .select({ key: schema.media.storageKey })
    .from(schema.media)
    .where(eq(schema.media.ownerId, userId))
  await db.delete(schema.users).where(eq(schema.users.id, userId))
  await deleteStored(keys.map((k) => k.key))
}
