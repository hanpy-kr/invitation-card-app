'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import styles from '../pay.module.scss'

const INTERVAL_MS = 2000
const MAX_TRIES = 15 // 2초 × 15 = 30초

type Status = 'paid' | 'pending' | 'expired' | 'canceled' | 'refunded' | 'cancel_requested' | 'partially_refunded' | 'none'
type Reply = {
  status: Status
  invitationId: string | null
  orderId?: string | null
  refundedAmount?: number
}

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

/**
 * 결제 후 돌아오기: 2초마다 최대 30초 확인. 주문번호가 있으면 그 주문을, 없으면(다른 기기 · 새 창) 내 최근 주문을 본다.
 * 판단은 서버(허브)가 알려 준 상태만 쓴다 — 브라우저 값은 어느 주문을 물을지에만 쓴다.
 */
export default function ReturnClient() {
  const [last, setLast] = useState<Reply | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const orderId = read('hanpy:lastOrderId')
      const url = orderId ? `/api/pay/orders/${encodeURIComponent(orderId)}` : '/api/pay/status'
      for (let i = 0; i < MAX_TRIES && !cancelled; i++) {
        try {
          const res = await fetch(url, { cache: 'no-store' })
          if (res.ok) {
            const d = (await res.json()) as Reply
            const invitationId = d.invitationId ?? read('hanpy:lastInvitationId')
            if (d.status === 'paid' && invitationId) {
              window.location.href = `/edit/${invitationId}?paid=1`
              return
            }
            if (!cancelled) setLast({ ...d, invitationId })
            if (d.status !== 'pending' && d.status !== 'none') break // 끝난 상태면 더 기다리지 않음
          }
        } catch {
          // 잠깐 끊겨도 다음 번에 다시 확인
        }
        await new Promise((r) => setTimeout(r, INTERVAL_MS))
      }
      if (!cancelled) setDone(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const status = last?.status
  const retry = last?.invitationId ? `/pay/${last.invitationId}` : '/dashboard'

  if (status === 'cancel_requested')
    return (
      <>
        <h1>환불을 신청했어요</h1>
        <p className={styles.note} role="status">
          환불 신청이 접수됐어요. 처리가 끝나기 전까지 프리미엄은 유지돼요.
        </p>
        <Link className={styles.btn} href="/dashboard#orders">
          결제 내역 보기
        </Link>
      </>
    )
  if (status === 'partially_refunded')
    return (
      <>
        <h1>일부 환불된 결제예요</h1>
        <p className={styles.note} role="status">
          {last?.refundedAmount ? `${last.refundedAmount.toLocaleString('ko-KR')}원이 환불됐어요. ` : ''}
          프리미엄은 그대로 유지돼요.
        </p>
        <Link className={styles.btn} href="/dashboard#orders">
          결제 내역 보기
        </Link>
      </>
    )
  if (status === 'expired' || status === 'canceled' || status === 'refunded')
    return (
      <>
        <h1>결제가 완료되지 않았어요</h1>
        <p className={styles.note} role="status">
          {status === 'refunded' ? '환불된 결제예요.' : '결제가 취소되었거나 시간이 지났어요.'} 필요하면
          다시 결제해 주세요.
        </p>
        <Link className={styles.btn} href={retry}>
          다시 결제하기
        </Link>
      </>
    )
  if (done)
    return (
      <>
        <h1>결제를 확인하고 있어요</h1>
        <p className={styles.note} role="status">
          결제를 확인하고 있어요. 잠시 후 자동으로 반영돼요. 대시보드에서도 확인할 수 있어요.
        </p>
        <Link className={styles.btn} href="/dashboard#orders">
          대시보드로
        </Link>
      </>
    )
  return (
    <>
      <h1>결제를 확인하고 있어요</h1>
      <p className={styles.note} role="status">
        잠시만 기다려 주세요. 결제가 확인되면 편집 화면으로 이동해요.
      </p>
    </>
  )
}
