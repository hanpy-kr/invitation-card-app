'use client'

import { useEffect } from 'react'

import styles from './Toast.module.scss'

/** 화면 아래 먹색 띠. 2초 뒤 스스로 사라짐(onDone으로 부모 상태 비움) */
export default function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDone, 2000)
    return () => clearTimeout(t)
  }, [message, onDone])
  if (!message) return null
  return (
    <div className={styles.toast} role="status" aria-live="polite">
      {message}
    </div>
  )
}

/** 복사 확인 같은 가벼운 안내는 띠로, 오류 같은 긴 안내는 그 자리에 둠 */
export const isToastMessage = (m: string) => m.includes('복사했어요')
