'use client'

import { useState } from 'react'

import { formatWon } from '@/shared/pricing'

import styles from '../pay.module.scss'

/** 그로블 결제: 결제 시작 API가 주문을 만들고, 이 버튼이 그로블 결제창 링크(?ref=주문번호)로 보낸다 */
export default function GroblePayClient({
  invitationId,
  amount,
  refundNotice,
}: {
  invitationId: string
  amount: number
  refundNotice: string
}) {
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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
      if (data.provider !== 'groble' || typeof data.redirectUrl !== 'string')
        throw new Error('결제 방식이 맞지 않아요. 새로고침한 뒤 다시 시도해 주세요.')
      window.location.href = data.redirectUrl
    } catch (err) {
      setError((err as Error).message || '결제를 진행하지 못했어요.')
      setBusy(false)
    }
  }

  return (
    <>
      <p className={styles.note}>
        결제는 그로블(통신판매중개) 결제창에서 진행해요. 결제가 끝나면 이 사이트로 돌아와 자동으로
        확인해요.
      </p>
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
          <br />
          그로블 결제는 그로블 표준 환불 규정이 함께 적용돼요.
        </span>
      </label>
      <button type="button" className={styles.btn} disabled={!agreed || busy} onClick={pay}>
        {busy ? '결제창으로 이동 중…' : `${formatWon(amount)} 결제하기`}
      </button>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </>
  )
}
