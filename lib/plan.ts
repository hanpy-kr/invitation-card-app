import 'server-only'

import { sql } from 'drizzle-orm'

import type { EventType } from '@/shared/blocks'
import { resolvePlan, type Plan } from '@/shared/entitlements'
import { isFamilyEvent, PAYMENTS_LIVE_AT, PREMIUM_DERIVED_EVENTS, PREMIUM_PARENT_EVENTS } from '@/shared/pricing'

import { schema } from './db/client'
import { isAdmin } from './stats'

/**
 * 플랜 판단에 쓰는 '결제 시작 시각'. 고정 상수(shared/pricing.ts PAYMENTS_LIVE_AT)이며 환경변수가 아니다.
 * (로컬 e2e 전용: DEV_LOGIN=1일 때만 PAYMENTS_LIVE_AT_DEV로 바꿀 수 있다. 운영에서는 DEV_LOGIN이 비어 있다.)
 */
export function paymentsLiveAt(): Date | null {
  const raw =
    process.env.DEV_LOGIN === '1' && process.env.PAYMENTS_LIVE_AT_DEV
      ? process.env.PAYMENTS_LIVE_AT_DEV
      : PAYMENTS_LIVE_AT
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * PAYMENTS_LIVE = 결제 버튼 · 결제 화면을 여는 스위치(ISO 8601 시각). 비었거나 읽을 수 없으면 닫힘.
 * 플랜 판단에는 쓰지 않는다(그건 paymentsLiveAt).
 */
function paymentsSwitchSince(): Date | null {
  const raw = process.env.PAYMENTS_LIVE?.trim()
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

/** 허브 연결 설정(서버 전용 환경변수 3개)이 다 있는가 */
export function hubConfigured(): boolean {
  return Boolean(
    process.env.HANPY_API_ORIGIN?.trim() &&
      process.env.HANPY_SERVICE_TOKEN?.trim() &&
      process.env.HANPY_NOTIFY_SECRET?.trim(),
  )
}

/** 결제 버튼 · 결제 화면을 열어도 되는 상태 (스위치 시각이 지났고 허브 설정이 다 있음) */
export function paymentsOpen(now = new Date()): boolean {
  const since = paymentsSwitchSince()
  return Boolean(since && now.getTime() >= since.getTime() && hubConfigured())
}

/**
 * 이 사용자가 결제 버튼 · 결제 화면을 쓸 수 있는가.
 * 결제가 열려 있으면 모두, 꺼져 있으면(관리자 미리 보기) 결제 수단 설정이 있을 때 ADMIN_KAKAO_IDS 회원만.
 */
export async function canCheckout(userId: string): Promise<boolean> {
  if (paymentsOpen()) return true
  if (!hubConfigured()) return false
  return isAdmin(userId)
}

/** 실제로 결제(또는 결제된 원본)로 프리미엄을 얻었는가 — 결제가 꺼져 있어 '모두 프리미엄'인 것과 구분 */
export function hasPaidPremium(row: {
  premiumHub?: boolean | null
  premiumOrderId: string | null
  derivedPremium: boolean | null | undefined
}): boolean {
  return Boolean(row.premiumHub || row.premiumOrderId || row.derivedPremium)
}

const list = (xs: readonly string[]) =>
  sql.join(
    xs.map((x) => sql`${x}`),
    sql`, `,
  )

/**
 * SQL 한 조각(extras · select 공용): 이 초대장이 '결제된 결혼 · 돌에서 파생된 청첩장 모임 · 감사장'인가.
 * 원본 행은 서브쿼리로 읽어 추가 쿼리가 들지 않는다.
 */
export function derivedPremiumSql() {
  return sql<boolean>`(${schema.invitations.eventType}::text in (${list(PREMIUM_DERIVED_EVENTS)}) and exists (select 1 from invitations src where src.id = ${schema.invitations.derivedFromId} and (src.premium_hub or src.premium_order_id is not null) and src.event_type::text in (${list(PREMIUM_PARENT_EVENTS)})))`
}

export function planOf(row: {
  createdAt: Date | string
  eventType: EventType
  premiumHub: boolean | null | undefined
  premiumOrderId: string | null
  derivedPremium: boolean | null | undefined
}): Plan {
  return resolvePlan({
    liveAt: paymentsLiveAt(),
    createdAt: row.createdAt,
    premiumHub: Boolean(row.premiumHub),
    premiumOrderId: row.premiumOrderId,
    derivedPremium: Boolean(row.derivedPremium),
    isMeetup: !isFamilyEvent(row.eventType),
  })
}

/** 지금 새로 만드는 초대장이 받을 플랜 (허브 이용권 없음, 만든 시각 = 지금). 새 초대장 화면의 표시용 */
export function newInvitationPlan(eventType: EventType): Plan {
  return resolvePlan({
    liveAt: paymentsLiveAt(),
    createdAt: new Date(),
    premiumHub: false,
    premiumOrderId: null,
    derivedPremium: false,
    isMeetup: !isFamilyEvent(eventType),
  })
}

export type { EventType }
