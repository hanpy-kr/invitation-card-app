import 'server-only'

import type { EventType } from '@/shared/blocks'
import { skuFor } from '@/shared/pricing'

import { hanpy } from './hanpy'
import { hubConfigured } from './plan'

/**
 * 화면에 보일 가격: 허브 listProducts()의 amount (메모리 캐시 5분). 가격 숫자를 코드에 두지 않는다.
 * 허브가 응답하지 않으면 null → 화면은 "가격을 불러오지 못했어요"를 보이고 결제 버튼을 끈다.
 */
const TTL_MS = 5 * 60 * 1000
let cache: { at: number; amounts: Map<string, { amount: number; onSale: boolean }> } | null = null

async function load() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.amounts
  if (!hubConfigured()) return null
  try {
    const items = await hanpy.listProducts()
    const amounts = new Map(items.map((p) => [p.sku, { amount: p.amount, onSale: p.onSale }]))
    cache = { at: Date.now(), amounts }
    return amounts
  } catch {
    return cache?.amounts ?? null
  }
}

/** SKU → 원. 못 읽으면 null */
export async function priceOfSku(sku: string): Promise<number | null> {
  return (await load())?.get(sku)?.amount ?? null
}

/** 행사 종류 → 화면 가격 */
export async function priceOfEvent(eventType: EventType): Promise<number | null> {
  return priceOfSku(skuFor(eventType))
}

/** 가격 안내 페이지용: 가족 행사 · 모임 두 가격 */
export async function priceTable(): Promise<{ family: number | null; meetup: number | null }> {
  const { FAMILY_SKU, MEETUP_SKU } = await import('@/shared/pricing')
  return { family: await priceOfSku(FAMILY_SKU), meetup: await priceOfSku(MEETUP_SKU) }
}

/** 테스트용: 캐시 비우기 */
export function resetPriceCache() {
  cache = null
}
