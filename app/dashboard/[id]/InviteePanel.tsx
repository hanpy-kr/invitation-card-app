'use client'

import { useMemo, useState } from 'react'

import { copyText } from '@/components/blocks/common/CopyButton'
import { api } from '@/components/ui/api'
import { matchInvitees, parseInvitees, reminderText } from '@/shared/invitees'

import styles from './page.module.scss'

/**
 * 초대 명단 체크 — 주최자 전용. 이름만 받고(연락처 없음), 응답 이름과 맞춰 '응답함 / 아직'을 나눠 보여 준다.
 * 이 화면의 데이터는 하객 화면 · 공개 API · 카톡 미리보기 어디에도 나오지 않는다.
 */
export default function InviteePanel({
  invitationId,
  initialNames,
  rsvps,
  url,
  title,
  deadline,
}: {
  invitationId: string
  initialNames: string[]
  rsvps: { name: string; attending: boolean }[]
  /** 발행된 초대장 주소 (발행 전이면 null) */
  url: string | null
  title: string
  deadline: string | null
}) {
  const [names, setNames] = useState(initialNames)
  const [open, setOpen] = useState(initialNames.length === 0)
  const [text, setText] = useState(initialNames.join('\n'))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const match = useMemo(() => matchInvitees(names, rsvps), [names, rsvps])
  const draft = useMemo(() => parseInvitees(text), [text])

  async function save() {
    setBusy(true)
    setMsg('')
    try {
      const res = await api<{ names: string[]; duplicates: number }>(
        `/api/invitations/${invitationId}/invitees`,
        { method: 'PUT', body: { text } },
      )
      setNames(res.names)
      setText(res.names.join('\n'))
      setOpen(false)
      setMsg(res.duplicates > 0 ? `같은 이름 ${res.duplicates}개는 하나로 합쳤어요.` : '')
    } catch (err) {
      setMsg((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    if (!url) return
    const ok = await copyText(reminderText({ title, url, deadline }))
    setMsg(ok ? '문구를 복사했어요. 단톡방에 붙여 넣으세요.' : '')
  }

  return (
    <section className={styles.section} aria-label="초대 명단 체크">
      <div className={styles.sectionHead}>
        <h2>초대 명단 체크</h2>
        {names.length > 0 ? (
          <button type="button" className={styles.csv} onClick={() => setOpen((o) => !o)}>
            {open ? '닫기' : '명단 고치기'}
          </button>
        ) : null}
      </div>
      <p className={styles.hint}>
        초대할 분의 이름만 붙여 넣으세요 (줄바꿈 · 쉼표로 구분, 최대 300명). 이 명단은 나만 볼 수
        있고 하객에게는 보이지 않아요. 전화번호는 받지 않아요.
      </p>

      {open ? (
        <div className={styles.tool}>
          <textarea
            aria-label="초대 명단"
            value={text}
            rows={6}
            placeholder={'김민준\n이서연, 박지호'}
            onChange={(e) => setText(e.target.value)}
          />
          <div className={styles.toolRow}>
            <small>{draft.ok ? `${draft.names.length}명` : draft.error}</small>
            <button type="button" onClick={save} disabled={busy || !draft.ok}>
              {busy ? '저장 중…' : '명단 저장'}
            </button>
          </div>
        </div>
      ) : null}

      {names.length > 0 ? (
        <>
          <p className={styles.meal} role="status">
            응답함 {match.responded.length}명 · 아직 {match.pending.length}명
            {match.extra > 0 ? ` · 명단에 없는 응답 ${match.extra}건` : ''}
          </p>
          {match.pending.length > 0 ? (
            <div className={styles.names} data-kind="pending">
              <h3>아직 응답 안 했어요 ({match.pending.length})</h3>
              <p>{match.pending.join(', ')}</p>
            </div>
          ) : null}
          {match.responded.length > 0 ? (
            <div className={styles.names} data-kind="responded">
              <h3>응답했어요 ({match.responded.length})</h3>
              <p>
                {match.responded.map((r) => `${r.name}${r.attending ? '' : '(불참)'}`).join(', ')}
              </p>
            </div>
          ) : null}
          <button
            type="button"
            className={styles.wide}
            onClick={copy}
            disabled={!url || match.pending.length === 0}
          >
            아직 응답 안 한 분께 보낼 문구 복사
          </button>
          {!url ? <small className={styles.hint}>발행한 뒤에 쓸 수 있어요.</small> : null}
        </>
      ) : null}
      {msg ? (
        <p className={styles.hint} role="status">
          {msg}
        </p>
      ) : null}
    </section>
  )
}
