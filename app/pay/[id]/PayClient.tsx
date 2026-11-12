'use client'

import { useEffect, useRef, useState } from 'react'

import { formatWon } from '@/shared/pricing'

import styles from '../pay.module.scss'

const SDK = 'https://js.tosspayments.com/v2/standard'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Widgets = any

function loadSdk(): Promise<void> {
  if ((window as any).TossPayments) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SDK
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('결제 화면을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'))
    document.head.appendChild(s)
  })
}

/** 결제 화면에서만 토스 결제위젯 SDK를 불러온다 (하객 화면 · 편집기 번들에는 들어가지 않음) */
export default function PayClient({
  invitationId,
  amount,
  clientKey,
  customerKey,
  refundNotice,
}: {
  invitationId: string
  amount: number
  clientKey: string
  customerKey: string
  refundNotice: string
}) {
  const [agreed, setAgreed] = useState(false)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const widgets = useRef<Widgets>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await loadSdk()
        const w = (window as any).TossPayments(clientKey).widgets({ customerKey })
        // 화면에 보이는 금액은 서버가 계산해 내려 준 값. 실제 주문 금액도 결제 시작 API가 서버에서 다시 계산한다
        await w.setAmount({ currency: 'KRW', value: amount })
        await Promise.all([
          w.renderPaymentMethods({ selector: '#payment-method', variantKey: 'DEFAULT' }),
          w.renderAgreement({ selector: '#agreement', variantKey: 'AGREEMENT' }),
        ])
        if (cancelled) return
        widgets.current = w
        setReady(true)
      } catch (err) {
        if (!cancelled) setError((err as Error).message || '결제 화면을 불러오지 못했어요.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [clientKey, customerKey, amount])

  async function pay() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/invitations/${invitationId}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agreedRefund: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '결제를 시작하지 못했어요.')
      await widgets.current.requestPayment({
        orderId: data.orderId,
        orderName: data.orderName,
        successUrl: `${window.location.origin}/pay/${invitationId}/success`,
        failUrl: `${window.location.origin}/pay/${invitationId}/fail?orderId=${data.orderId}`,
      })
    } catch (err) {
      setError((err as Error).message || '결제를 진행하지 못했어요.')
      setBusy(false)
    }
  }

  return (
    <>
      <div id="payment-method" className={styles.widget} />
      <div id="agreement" className={styles.widget} />
      <label className={styles.agree}>
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          aria-describedby="refund-notice"
        />
        <span id="refund-notice">
          <strong>환불 규정에 동의합니다.</strong>
          <br />
          {refundNotice}
        </span>
      </label>
      <button
        type="button"
        className={styles.btn}
        disabled={!agreed || !ready || busy}
        onClick={pay}
      >
        {busy ? '결제창을 여는 중…' : `${formatWon(amount)} 결제하기`}
      </button>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </>
  )
}
