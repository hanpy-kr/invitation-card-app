'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { api } from '@/components/ui/api'

/** 환불 요청: 결제 후 7일 이내 · 발행 전이면 전액 취소 (서버가 다시 확인함) */
export default function RefundButton({ invitationId }: { invitationId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (
            !window.confirm(
              '환불을 요청할까요? 결제 금액이 전액 취소되고 프리미엄이 해제돼요. 되돌릴 수 없어요.',
            )
          )
            return
          setBusy(true)
          setError('')
          try {
            await api(`/api/invitations/${invitationId}/refund`, { body: {} })
            router.refresh()
          } catch (err) {
            setError((err as Error).message)
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? '환불 중…' : '환불 요청'}
      </button>
      {error ? <span role="alert">{error}</span> : null}
    </>
  )
}
