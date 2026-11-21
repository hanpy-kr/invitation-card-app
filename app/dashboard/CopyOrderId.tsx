'use client'

import { useState } from 'react'

/** 허브 주문번호 복사 (환불 · 결제 문의 이메일에 붙여 넣기용) */
export default function CopyOrderId({ orderId }: { orderId: string }) {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle')
  async function copy() {
    try {
      await navigator.clipboard.writeText(orderId)
      setState('ok')
    } catch {
      setState('fail')
    }
    setTimeout(() => setState('idle'), 2000)
  }
  return (
    <button type="button" onClick={copy} data-testid="copy-order-id">
      {state === 'ok' ? '복사했어요' : state === 'fail' ? '복사할 수 없어요' : '주문번호 복사'}
    </button>
  )
}
