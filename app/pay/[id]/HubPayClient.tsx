'use client'

import { useMemo, useState } from 'react'

import { formatWon } from '@/shared/pricing'

import MinorNotice from '@/components/ui/MinorNotice'
import styles from '../pay.module.scss'

/**
 * 한피 결제 허브 결제: 결제 시작 API가 허브 checkout을 부르고, 돌려준 url(그로블 결제창)로 이동한다.
 * 그로블 링크는 화면 코드에 없다. 돌아올 때 주문번호를 잃지 않게 이동 전에 sessionStorage에 저장한다.
 */
export default function HubPayClient({
  invitationId,
  amount,
  openNote,
  refundNotice,
}: {
  invitationId: string
  /** 허브 가격. null이면 못 불러온 것 → 결제 버튼 비활성 */
  amount: number | null
  openNote: string | null
  refundNotice: string
}) {
  const attemptId = useMemo(() => crypto.randomUUID(), [])
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
        body: JSON.stringify({ attemptId, agreedRefund: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '지금은 결제를 시작할 수 없어요')
      if (typeof data.url !== 'string' || typeof data.orderId !== 'string')
        throw new Error('지금은 결제를 시작할 수 없어요')
      try {
        sessionStorage.setItem('hanpy:lastOrderId', data.orderId)
        sessionStorage.setItem('hanpy:lastInvitationId', invitationId)
      } catch {
        // 저장이 막혀도 돌아오기 화면이 사용자 기준으로 다시 찾는다
      }
      window.location.href = data.url
    } catch (err) {
      setError((err as Error).message || '지금은 결제를 시작할 수 없어요')
      setBusy(false)
    }
  }

  return (
    <>
      {openNote ? <p className={styles.note}>{openNote}</p> : null}
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
        </span>
      </label>
      <button
        type="button"
        className={styles.btn}
        disabled={!agreed || busy || amount === null}
        onClick={pay}
      >
        {amount === null
          ? '가격을 불러오지 못했어요'
          : busy
            ? '결제창으로 이동 중…'
            : `${formatWon(amount)} 결제하기`}
      </button>
      <MinorNotice />
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </>
  )
}
