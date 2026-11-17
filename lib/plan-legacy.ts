import 'server-only'

/**
 * 옛 자체 결제(토스 · 그로블 직접 연결) 전용 설정 읽기. 허브 전환 뒤 정리 대상(PLAN.md).
 * 새 코드는 쓰지 않는다 — 결제는 항상 허브(lib/hanpy.ts)로 간다.
 */
export type PaymentProvider = 'toss' | 'groble'

export function paymentProvider(): PaymentProvider {
  return process.env.PAYMENT_PROVIDER?.trim().toLowerCase() === 'groble' ? 'groble' : 'toss'
}

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
