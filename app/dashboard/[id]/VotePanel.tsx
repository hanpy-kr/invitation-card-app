'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { api } from '@/components/ui/api'
import type { VoteConfig, VoteOption } from '@/shared/blocks'
import { optionSub, optionTitle, type VoteResult } from '@/shared/vote'

import styles from './page.module.scss'

/** 주최자: 투표 결과 + [확정] / [다시 열기] */
export default function VotePanel({
  invitationId,
  config,
  options,
  results,
  voters,
}: {
  invitationId: string
  config: VoteConfig
  options: VoteOption[]
  results: VoteResult[]
  voters: number
}) {
  const router = useRouter()
  const [after, setAfter] = useState<'result' | 'hide'>('result')
  const [busy, setBusy] = useState(false)
  const byId = new Map(results.map((r) => [r.id, r]))
  const closed = config.status === 'closed'
  const top = Math.max(0, ...results.map((r) => r.count))

  async function send(body: object, confirmText: string) {
    if (!window.confirm(confirmText)) return
    setBusy(true)
    try {
      await api(`/api/invitations/${invitationId}/vote`, { body })
      router.refresh()
    } catch (err) {
      window.alert((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const what =
    config.kind === 'date' ? '초대장 날짜' : config.kind === 'place' ? '첫 번째 장소' : ''

  return (
    <section className={styles.section}>
      <h2>
        {config.title} · {voters}명 투표 {closed ? '(확정됨)' : ''}
      </h2>
      <ul className={styles.vote}>
        {options.map((o) => {
          const r = byId.get(o.id)
          const won = config.confirmedId === o.id
          return (
            <li key={o.id} data-won={won}>
              <div>
                <strong>
                  {won ? '✓ ' : ''}
                  {optionTitle(config.kind, o)}
                </strong>
                {optionSub(config.kind, o) ? <small>{optionSub(config.kind, o)}</small> : null}
                {r && r.names.length > 0 ? <p>{r.names.join(', ')}</p> : null}
              </div>
              <span className={r && r.count === top && top > 0 ? styles.voteTop : undefined}>
                {r?.count ?? 0}표
              </span>
              {!closed ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    send(
                      { action: 'confirm', optionId: o.id, after },
                      `'${optionTitle(config.kind, o)}'(으)로 확정할까요?${
                        what ? `\n${what}에 바로 반영되고 링크는 그대로예요.` : ''
                      }`,
                    )
                  }
                >
                  확정
                </button>
              ) : null}
            </li>
          )
        })}
      </ul>
      {closed ? (
        <button
          type="button"
          className={styles.textBtn}
          disabled={busy}
          onClick={() =>
            send(
              { action: 'reopen' },
              '확정을 취소하고 다시 투표를 받을까요? 이미 바뀐 날짜 · 장소는 그대로예요.',
            )
          }
        >
          다시 열기
        </button>
      ) : (
        <label className={styles.after}>
          확정한 뒤 투표 블록은
          <select value={after} onChange={(e) => setAfter(e.target.value as 'result' | 'hide')}>
            <option value="result">결과만 남기기</option>
            <option value="hide">숨기기</option>
          </select>
        </label>
      )}
    </section>
  )
}
