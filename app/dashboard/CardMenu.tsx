'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { api } from '@/components/ui/api'

import DuplicateButtons from './DuplicateButtons'
import QrButton from './QrButton'
import styles from './CardMenu.module.scss'

type Props = {
  id: string
  slug: string
  title: string
  dateLabel: string | null
  eventType: string
  published: boolean
  isOwner: boolean
  paid: boolean
  /** 가로형 카드: 줄 오른쪽 끝(절대 위치 없이 흐름 안에) */
  inline?: boolean
}

/** 카드 오른쪽 위 '⋯' 메뉴: 초대장 보기 · QR 저장 · 복제 · 청첩장 모임 · 감사장 · 삭제(소유자만) */
export default function CardMenu({
  id,
  slug,
  title,
  dateLabel,
  eventType,
  published,
  isOwner,
  paid,
  inline,
}: Props) {
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
    <div className={inline ? `${styles.menu} ${styles.inline}` : styles.menu} ref={box}>
      <button
        type="button"
        className={styles.trigger}
        aria-label="더 보기"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open ? (
        <div className={styles.pop} role="menu">
          {published ? (
            <Link href={`/i/${slug}`} target="_blank" role="menuitem">
              초대장 보기
            </Link>
          ) : null}
          {published ? <QrButton slug={slug} title={title} dateLabel={dateLabel} /> : null}
          {isOwner ? <DuplicateButtons id={id} eventType={eventType} /> : null}
          {isOwner ? (
            <button type="button" role="menuitem" className={styles.danger} onClick={remove}>
              삭제
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
