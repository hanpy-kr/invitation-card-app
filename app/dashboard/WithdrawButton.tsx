'use client'

import { api } from '@/components/ui/api'

export default function WithdrawButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        if (
          !window.confirm(
            '탈퇴할까요? 만든 초대장 · 사진 · 받은 응답 · 방명록이 모두 지워지고 되돌릴 수 없어요.',
          )
        )
          return
        try {
          await api('/api/account/delete', { body: {} })
          window.location.href = '/'
        } catch (err) {
          window.alert((err as Error).message)
        }
      }}
    >
      회원 탈퇴
    </button>
  )
}
