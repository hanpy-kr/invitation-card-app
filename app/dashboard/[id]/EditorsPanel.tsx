'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { api } from '@/components/ui/api'

import styles from './page.module.scss'

/** 소유자: 공동 편집자 초대 링크 · 목록 · 빼기 */
export default function EditorsPanel({
  invitationId,
  editors,
}: {
  invitationId: string
  editors: { userId: string; nickname: string }[]
}) {
  const router = useRouter()
  const [link, setLink] = useState('')
  const [msg, setMsg] = useState('')

  async function makeLink() {
    setMsg('')
    try {
      const { url } = await api<{ url: string }>(`/api/invitations/${invitationId}/editors`, {
        body: {},
      })
      setLink(url)
      try {
        await navigator.clipboard.writeText(url)
        setMsg('링크를 복사했어요. 함께 준비하는 분께 보내 주세요 (7일 동안 쓸 수 있어요).')
      } catch {
        setMsg('아래 링크를 복사해서 보내 주세요 (7일 동안 쓸 수 있어요).')
      }
    } catch (err) {
      setMsg((err as Error).message)
    }
  }

  return (
    <section className={styles.section}>
      <h2>함께 편집 {editors.length > 0 ? `${editors.length}명` : ''}</h2>
      <p className={styles.hint}>
        링크를 받은 사람이 카카오로 로그인하면 이 초대장을 같이 고치고 응답을 볼 수 있어요. 삭제와
        편집자 관리는 주인만 할 수 있어요.
      </p>
      {editors.length > 0 ? (
        <ul className={styles.rows}>
          {editors.map((e) => (
            <li key={e.userId}>
              <span className={styles.name}>{e.nickname || '이름 없음'}</span>
              <button
                type="button"
                aria-label={`${e.nickname} 편집자 빼기`}
                onClick={async () => {
                  if (!window.confirm(`${e.nickname}님을 편집자에서 뺄까요?`)) return
                  await api(`/api/invitations/${invitationId}/editors/${e.userId}`, {
                    method: 'DELETE',
                  })
                  router.refresh()
                }}
              >
                빼기
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button type="button" className={styles.csv} onClick={() => void makeLink()}>
        초대 링크 만들기
      </button>
      {link ? (
        <input
          className={styles.inviteLink}
          readOnly
          value={link}
          aria-label="공동 편집 초대 링크"
          onFocus={(e) => e.target.select()}
        />
      ) : null}
      {msg ? <p className={styles.hint}>{msg}</p> : null}
    </section>
  )
}
