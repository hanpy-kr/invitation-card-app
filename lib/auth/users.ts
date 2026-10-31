import 'server-only'

import { sql } from 'drizzle-orm'

import { getDb, schema } from '../db/client'
import type { Session } from './session'

/** 카카오 id로 사용자를 찾거나 만든다. 닉네임은 로그인할 때마다 갱신 */
export async function upsertKakaoUser(kakaoId: string, nickname: string): Promise<Session> {
  const [user] = await getDb()
    .insert(schema.users)
    .values({ kakaoId, nickname })
    .onConflictDoUpdate({
      target: schema.users.kakaoId,
      // 닉네임 동의를 안 해서 빈 값이 오면 기존 닉네임 유지
      set: { nickname: sql`coalesce(nullif(excluded.nickname, ''), ${schema.users.nickname})` },
    })
    .returning({ id: schema.users.id, nickname: schema.users.nickname })
  return { userId: user.id, nickname: user.nickname }
}
