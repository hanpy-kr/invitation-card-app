import 'server-only'

import { sql } from 'drizzle-orm'

import type { EventType } from '@/shared/blocks'
import { resolvePlan, type Plan } from '@/shared/entitlements'
import { PREMIUM_DERIVED_EVENTS, PREMIUM_PARENT_EVENTS } from '@/shared/pricing'

import { schema } from './db/client'
import { isAdmin } from './stats'

/**
 * PAYMENTS_LIVE = 결제를 시작하는 시각(ISO 8601, 예: 2026-12-01T00:00:00+09:00). 비었거나 읽을 수 없으면 꺼짐.
 * 그 시각 이후에만 결제 버튼이 보이고, 그 전에 만든 초대장은 소급하지 않는다(legacy).
 */
export function paymentsLiveSince(): Date | null {
  const raw = process.env.PAYMENTS_LIVE?.trim()
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

export type PaymentProvider = 'toss' | 'groble'

/** PAYMENT_PROVIDER=toss|groble (기본 toss). 알 수 없는 값은 toss */
export function paymentProvider(): PaymentProvider {
  return process.env.PAYMENT_PROVIDER?.trim().toLowerCase() === 'groble' ? 'groble' : 'toss'
}

/** 그로블 결제 링크 (금액으로 고름). 맞는 링크가 없으면 null → 결제를 막는다 */
export function grobleLinkFor(amount: number): string | null {
  const link =
    amount === 14900
      ? process.env.GROBLE_LINK_14900
      : amount === 3900
        ? process.env.GROBLE_LINK_3900
        : undefined
  const v = link?.trim()
  return v && /^https:\/\//.test(v) ? v : null
}

/** 선택된 결제 수단의 설정이 다 있는가 (토스: 키 2개 / 그로블: 링크 2개 + 웹훅 시크릿) */
export function providerConfigured(): boolean {
  if (paymentProvider() === 'groble')
    return Boolean(
      grobleLinkFor(14900) && grobleLinkFor(3900) && process.env.GROBLE_WEBHOOK_SECRET?.trim(),
    )
  return Boolean(process.env.TOSS_SECRET_KEY && process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY)
}

/** 결제 버튼 · 결제 화면을 열어도 되는 상태 (시작 시각이 지났고 선택된 결제 수단 설정이 다 있음) */
export function paymentsOpen(now = new Date()): boolean {
  const since = paymentsLiveSince()
  return Boolean(since && now.getTime() >= since.getTime() && providerConfigured())
}

/**
 * 이 사용자가 결제 버튼 · 결제 화면을 쓸 수 있는가.
 * 결제가 열려 있으면 모두, 꺼져 있으면(관리자 미리 보기) 결제 수단 설정이 있을 때 ADMIN_KAKAO_IDS 회원만.
 */
export async function canCheckout(userId: string): Promise<boolean> {
  if (paymentsOpen()) return true
  if (!providerConfigured()) return false
  return isAdmin(userId)
}

/** 실제로 결제(또는 결제된 원본)로 프리미엄을 얻었는가 — 결제가 꺼져 있어 '모두 프리미엄'인 것과 구분 */
export function hasPaidPremium(row: {
  premiumOrderId: string | null
  derivedPremium: boolean | null | undefined
}): boolean {
  return Boolean(row.premiumOrderId || row.derivedPremium)
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
  return sql<boolean>`(${schema.invitations.eventType}::text in (${list(PREMIUM_DERIVED_EVENTS)}) and exists (select 1 from invitations src where src.id = ${schema.invitations.derivedFromId} and src.premium_order_id is not null and src.event_type::text in (${list(PREMIUM_PARENT_EVENTS)})))`
}

export function planOf(row: {
  createdAt: Date | string
  premiumOrderId: string | null
  derivedPremium: boolean | null | undefined
}): Plan {
  return resolvePlan({
    liveSince: paymentsLiveSince(),
    createdAt: row.createdAt,
    premiumOrderId: row.premiumOrderId,
    derivedPremium: Boolean(row.derivedPremium),
  })
}

export type { EventType }
