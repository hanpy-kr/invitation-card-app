import 'server-only'

import { inArray } from 'drizzle-orm'

import { getDb, schema } from './db/client'
import { hanpy } from './hanpy'
import { hubConfigured } from './plan'

/** 주인이 여는 화면에서 이 시간보다 오래된 캐시는 허브에 다시 묻는다 (Amplify에는 정기 실행이 없어 이걸로 하루 대조를 대신함) */
export const PREMIUM_STALE_MS = 10 * 60 * 1000

/**
 * 허브에 다시 물어 premium_hub · premium_checked_at을 갱신한다. 알림 본문 값이 아니라 허브 조회 결과만 저장.
 * 허브가 응답하지 않으면 캐시를 그대로 두고(false 반환) 유료 기능을 새로 열지 않는다.
 */
export async function refreshPremium(ids: readonly string[]): Promise<boolean> {
  const unique = [...new Set(ids)]
  if (unique.length === 0 || !hubConfigured()) return false
  const db = getDb()
  try {
    const now = new Date()
    for (let i = 0; i < unique.length; i += 100) {
      const chunk = unique.slice(i, i + 100)
      const ents = await hanpy.getSubjectEntitlements('invitation', chunk)
      const on = new Set(ents.filter((e) => e.key === 'premium' && e.subject).map((e) => e.subject!.id))
      const yes = chunk.filter((id) => on.has(id))
      const no = chunk.filter((id) => !on.has(id))
      if (yes.length)
        await db
          .update(schema.invitations)
          .set({ premiumHub: true, premiumCheckedAt: now })
          .where(inArray(schema.invitations.id, yes))
      if (no.length)
        await db
          .update(schema.invitations)
          .set({ premiumHub: false, premiumCheckedAt: now })
          .where(inArray(schema.invitations.id, no))
    }
    return true
  } catch {
    return false
  }
}

/** 주인 화면용: 캐시가 오래됐거나 없는 초대장만 다시 조회. 갱신했으면 true */
export async function refreshIfStale(
  rows: readonly { id: string; premiumCheckedAt: Date | string | null }[],
): Promise<boolean> {
  const cutoff = Date.now() - PREMIUM_STALE_MS
  const stale = rows
    .filter((r) => !r.premiumCheckedAt || new Date(r.premiumCheckedAt).getTime() < cutoff)
    .map((r) => r.id)
  if (stale.length === 0) return false
  return refreshPremium(stale)
}

