import 'server-only'

import { manitoEnabled } from './manito'
import { asc, eq } from 'drizzle-orm'
import { cache } from 'react'

import {
  parseShareOverride,
  redactMemberOnly,
  toBlock,
  type Block,
  type EventType,
  type ShareOverride,
} from '@/shared/blocks'

import { getDb, schema } from './db/client'
import { derivedPremiumSql, planOf } from './plan'
import type { Plan } from '@/shared/entitlements'

export type PublicInvitation = {
  id: string
  slug: string
  eventType: EventType
  title: string
  eventAt: string | null
  theme: string
  font: string | null
  share: ShareOverride
  /** 결제 플랜 (봉투 · 효과, 하단 문구 숨김 판단) */
  plan: Plan
  blocks: Block[]
}

/**
 * 공개 초대장: invitation + blocks를 쿼리 1회로 읽는다 (Drizzle 관계 쿼리 → SQL 1개).
 * generateMetadata와 page가 같은 요청 안에서 결과를 공유하도록 cache로 감쌈.
 */
export const getPublishedInvitation = cache(
  async (slug: string): Promise<PublicInvitation | null> => {
    if (!/^[a-z0-9]{8}$/.test(slug)) return null
    const row = await getDb().query.invitations.findFirst({
      where: eq(schema.invitations.slug, slug),
      columns: {
        id: true,
        slug: true,
        eventType: true,
        title: true,
        eventAt: true,
        theme: true,
        font: true,
        status: true,
        share: true,
        createdAt: true,
        premiumOrderId: true,
        premiumHub: true,
      },
      extras: { derivedPremium: derivedPremiumSql().as('derived_premium') },
      with: {
        blocks: {
          columns: { id: true, type: true, position: true, visible: true, config: true },
          orderBy: [asc(schema.blocks.position)],
        },
      },
    })
    if (!row || row.status !== 'published') return null
    return {
      id: row.id,
      slug: row.slug,
      eventType: row.eventType,
      title: row.title,
      eventAt: row.eventAt ? row.eventAt.toISOString() : null,
      theme: row.theme,
      font: row.font,
      share: parseShareOverride(row.share),
      plan: planOf(row),
      blocks: row.blocks
        .map(toBlock)
        .filter((b): b is Block => b !== null)
        // 참석자 전용 안내는 공개 데이터에 싣지 않음
        .map(redactMemberOnly)
        // 마니또 스위치가 꺼져 있으면 하객 화면에서 버튼이 사라지게 (설정은 그대로 둠)
        .map((b) =>
          b.type === 'rsvp' && b.config.manito && !manitoEnabled()
            ? { ...b, config: { ...b.config, manito: false } }
            : b,
        ),
    }
  },
)
