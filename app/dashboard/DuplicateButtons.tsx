'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { api } from '@/components/ui/api'

/** 대시보드 카드: [복제] (결혼이면 [청첩장 모임 만들기]도) */
export default function DuplicateButtons({ id, wedding }: { id: string; wedding: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState<'copy' | 'prewedding' | null>(null)

  async function run(mode: 'copy' | 'prewedding', question: string) {
    if (!window.confirm(question)) return
    setBusy(mode)
    try {
      const { id: newId } = await api<{ id: string }>(`/api/invitations/${id}/duplicate`, {
        body: { mode },
      })
      router.push(`/edit/${newId}`)
    } catch (err) {
      window.alert((err as Error).message)
      setBusy(null)
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() =>
          run('copy', '이 초대장을 복제할까요? 글 · 사진은 그대로, 응답 · 방명록은 빼고 만들어요.')
        }
      >
        {busy === 'copy' ? '복제 중…' : '복제'}
      </button>
      {wedding ? (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() =>
            run('prewedding', '청첩장 모임 초대장을 만들까요? 표지 사진 · 이름 · 테마를 가져와요.')
          }
        >
          {busy === 'prewedding' ? '만드는 중…' : '청첩장 모임 만들기'}
        </button>
      ) : null}
    </>
  )
}
