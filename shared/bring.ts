/**
 * 나눠 맡기 도우미 — zod 없이 (하객 번들 · 서버 공용).
 */
export type BringItemLike = { id: string; name: string; need: number }

/** 이름이 있는 항목만 하객에게 보임 */
export function usableBringItems<T extends BringItemLike>(items: T[]): T[] {
  return items.filter((it) => it.name.trim() !== '')
}

export type BringItemResult = { id: string; count: number; names: string[] }
export type BringResults = { items: BringItemResult[] }

/** 맡은 수 · 이름 모으기 (지금 있는 항목만, 항목을 지운 뒤 남은 맡기는 무시) */
export function tallyBring(
  items: BringItemLike[],
  claims: { itemId: string; name: string }[],
): BringResults {
  const out = usableBringItems(items).map((it) => ({ id: it.id, count: 0, names: [] as string[] }))
  const byId = new Map(out.map((r) => [r.id, r]))
  for (const c of claims) {
    const r = byId.get(c.itemId)
    if (r) {
      r.count++
      r.names.push(c.name)
    }
  }
  return { items: out }
}

export const isBringFull = (need: number, count: number) => count >= need
