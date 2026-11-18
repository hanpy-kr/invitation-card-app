'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { api } from '@/components/ui/api'

import styles from './CardMenu.module.scss'

/** 카드 오른쪽 위 '⋯' 메뉴: [삭제] (소유자만). 확인 창 뒤 기존 삭제 API 사용 */
export default function CardMenu({ id, paid }: { id: string; paid: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  async function remove() {
    setOpen(false)
    const msg =
      '정말 삭제할까요? 응답 · 방명록도 함께 지워져요.' +
      (paid ? '\n\n결제한 초대장이에요. 삭제해도 환불은 그로블 주문조회에서 따로 해야 해요.' : '')
    if (!window.confirm(msg)) return
    setBusy(true)
    try {
      await api(`/api/invitations/${id}`, { method: 'DELETE' })
      router.refresh()
    } catch (err) {
      window.alert((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className={styles.menu} ref={box}>
      <button
        type="button"
        className={styles.trigger}
        aria-label="더 보기"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>
      {open ? (
        <div className={styles.pop} role="menu">
          <button type="button" role="menuitem" className={styles.danger} onClick={remove}>
            삭제
          </button>
        </div>
      ) : null}
    </div>
  )
}
