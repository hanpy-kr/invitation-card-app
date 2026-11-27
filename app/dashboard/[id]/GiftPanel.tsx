'use client'

import { useEffect, useState } from 'react'

import { api } from '@/components/ui/api'

import styles from './page.module.scss'

type Status = { count: number; min: number; drawn: boolean; changed: number }
type Pair = { giver: string; receiver: string }

/** 주최자: 선물 교환(마니또) — 짝 뽑기 · 다시 뽑기 · 짝 목록(경고 뒤에만 열람). 짝 정보는 이 패널이 요청할 때만 받음 */
export default function GiftPanel({ invitationId }: { invitationId: string }) {
  const url = `/api/invitations/${invitationId}/gift`
  const [st, setSt] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [warn, setWarn] = useState(false)
  const [pairs, setPairs] = useState<Pair[] | null>(null)

  useEffect(() => {
    api<Status>(url)
      .then(setSt)
      .catch((e: Error) => setError(e.message))
  }, [url])

  async function draw() {
    const redo = Boolean(st?.drawn)
    if (
      redo &&
      !window.confirm('다시 뽑을까요?\n이미 확인한 사람의 결과도 바뀌어요.')
    )
      return
    setBusy(true)
    setError('')
    try {
      setSt(await api<Status>(url, { method: 'POST', body: {} }))
      setPairs(null)
      setWarn(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function openPairs() {
    setBusy(true)
    try {
      setPairs((await api<{ pairs: Pair[] }>(`${url}?pairs=1`)).pairs)
      setWarn(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const enough = st ? st.count >= st.min : false
  return (
    <section className={styles.section} aria-label="선물 교환" data-testid="gift-panel">
      <div className={styles.sectionHead}>
        <h2>선물 교환 · 마니또</h2>
      </div>
      {!st ? (
        <p className={styles.giftNote}>{error || '불러오는 중…'}</p>
      ) : (
        <div className={styles.gift}>
          <p className={styles.giftNote}>
            참여하는 사람 <strong>{st.count}명</strong>
            {enough ? '' : ` · ${st.min}명 이상 모이면 뽑을 수 있어요`}
          </p>
          {st.drawn && st.changed > 0 ? (
            <p className={styles.giftWarn} role="status">
              뽑은 뒤 바뀐 응답 {st.changed}건 — 다시 뽑기 필요
            </p>
          ) : null}
          <button type="button" className={styles.giftBtn} disabled={busy || !enough} onClick={draw}>
            {st.drawn ? '다시 뽑기' : '짝 뽑기'}
          </button>
          {st.drawn ? (
            <>
              <p className={styles.giftNote}>
                뽑았어요. 참여자는 초대장에서 [내 마니또 보기]로 자기 짝만 볼 수 있어요.
              </p>
              {pairs ? (
                <ul className={styles.giftPairs}>
                  {pairs.map((p) => (
                    <li key={p.giver}>
                      {p.giver} → {p.receiver}
                    </li>
                  ))}
                </ul>
              ) : warn ? (
                <div className={styles.giftWarn}>
                  <p>본인도 참여자면 보지 마세요. 서프라이즈가 사라져요.</p>
                  <button type="button" className={styles.giftBtn} disabled={busy} onClick={openPairs}>
                    그래도 볼게요
                  </button>
                </div>
              ) : (
                <button type="button" className={styles.giftLink} onClick={() => setWarn(true)}>
                  짝 목록 열어 보기
                </button>
              )}
            </>
          ) : null}
          {error ? (
            <p className={styles.giftWarn} role="alert">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </section>
  )
}
