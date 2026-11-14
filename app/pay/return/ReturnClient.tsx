'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import styles from '../pay.module.scss'

const INTERVAL_MS = 2000
const MAX_TRIES = 15

/** 그로블 '이동 페이지': 웹훅이 도착할 때까지 2초 간격 최대 15번 확인 → 결제 완료면 편집기로 */
export default function ReturnClient() {
  const [gaveUp, setGaveUp] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      for (let i = 0; i < MAX_TRIES && !cancelled; i++) {
        try {
          const res = await fetch('/api/pay/status', { cache: 'no-store' })
          if (res.ok) {
            const d = (await res.json()) as { status: string; invitationId: string | null }
            if (d.status === 'paid' && d.invitationId) {
              window.location.href = `/edit/${d.invitationId}`
              return
            }
          }
        } catch {
          // 잠깐 끊겨도 다음 번에 다시 확인
        }
        await new Promise((r) => setTimeout(r, INTERVAL_MS))
      }
      if (!cancelled) setGaveUp(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return gaveUp ? (
    <>
      <h1>결제 확인 중이에요</h1>
      <p className={styles.note} role="status">
        결제 확인 중이에요. 잠시 뒤 대시보드에서 확인해 주세요.
      </p>
      <Link className={styles.btn} href="/dashboard#orders">
        대시보드로
      </Link>
    </>
  ) : (
    <>
      <h1>결제를 확인하고 있어요</h1>
      <p className={styles.note} role="status">
        잠시만 기다려 주세요. 결제가 확인되면 편집 화면으로 이동해요.
      </p>
    </>
  )
}
