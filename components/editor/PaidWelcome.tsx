'use client'

import { useEffect, useRef, useState } from 'react'

import styles from './Editor.module.scss'

/**
 * 결제 직후 안내 모달. 서버가 '실제 프리미엄'이라고 확인했을 때만 마운트된다(주소의 paid=1만으로는 안 뜸).
 * 닫으면 주소에서 paid를 지운다.
 */
export default function PaidWelcome({ photoLimit, wedding }: { photoLimit: number; wedding: boolean }) {
  const [open, setOpen] = useState(true)
  const ok = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    ok.current?.focus()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [])

  function close() {
    setOpen(false)
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('paid')
      window.history.replaceState(null, '', url.pathname + (url.search || '') + url.hash)
    } catch {
      // 주소 정리에 실패해도 모달은 닫힌다
    }
  }

  if (!open) return null
  return (
    <div className={styles.dialogBack} role="presentation">
      <div
        className={`${styles.dialog} ${styles.paidWelcome}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="paid-title"
        data-testid="paid-welcome"
      >
        <h2 id="paid-title">결제가 완료됐어요</h2>
        <p>
          프리미엄이 켜졌어요. 사진 {photoLimit}장 · 봉투 · 효과{wedding ? ' · 1안 · 3안 표지' : ''}를 쓸 수
          있어요.
        </p>
        <div className={styles.dialogActions}>
          <button type="button" ref={ok} data-primary onClick={close}>
            확인
          </button>
        </div>
        <p className={styles.paidWelcomeNote}>결제 내역은 내 초대장에서 볼 수 있어요.</p>
      </div>
    </div>
  )
}
