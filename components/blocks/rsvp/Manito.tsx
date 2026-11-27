'use client'

import { useState } from 'react'

import styles from '../common/guestForm.module.scss'
import { postJson } from '../common/storage'

type Mine = { state: 'before' } | { state: 'result'; receiver: string }

/**
 * [내 마니또 보기]: 응답을 보낸 폰(localStorage의 응답 토큰)에서만 열린다.
 * 짝 이름은 이 요청의 응답으로만 받고, 서버 HTML · 공유 카드 · 명단에는 없다.
 * 3상태: 뽑기 전 / 내 짝 / 다른 폰(토큰 없음 · 확인 실패)
 */
export default function Manito({ slug, editToken }: { slug: string; editToken: string | null }) {
  const [mine, setMine] = useState<Mine | null>(null)
  const [other, setOther] = useState(!editToken)
  const [skipped, setSkipped] = useState(false)
  const [busy, setBusy] = useState(false)

  async function look() {
    if (!editToken) return setOther(true)
    setBusy(true)
    try {
      setMine(await postJson<Mine>(`/api/i/${slug}/manito`, { editToken }))
      setOther(false)
    } catch (e) {
      // 참석했지만 선물 교환에 안 낀 사람: 다른 폰 안내 대신 그대로 알려 줌
      if ((e as Error).message.startsWith('선물 교환에')) setSkipped(true)
      else setOther(true)
    } finally {
      setBusy(false)
    }
  }

  if (skipped)
    return (
      <p className={styles.manito} data-state="skipped" role="status">
        이번 선물 교환에는 참여하지 않았어요.
      </p>
    )
  if (other)
    return (
      <p className={styles.manito} data-state="other" role="status">
        <strong>응답한 폰에서 열어 주세요</strong>
        다른 폰이라면 주최자에게 물어보세요.
      </p>
    )
  if (mine?.state === 'result')
    return (
      <p className={styles.manito} data-state="result" role="status">
        내 마니또
        <strong data-testid="manito-receiver">{mine.receiver}</strong>
        선물 받을 사람은 끝까지 비밀로 해 주세요.
      </p>
    )
  if (mine?.state === 'before')
    return (
      <p className={styles.manito} data-state="before" role="status">
        <strong>아직 짝을 뽑지 않았어요</strong>
        주최자가 뽑으면 여기서 볼 수 있어요.
        <button type="button" onClick={look} disabled={busy}>
          다시 확인
        </button>
      </p>
    )
  return (
    <button type="button" className={styles.manitoBtn} onClick={look} disabled={busy}>
      {busy ? '확인 중…' : '내 마니또 보기'}
    </button>
  )
}
