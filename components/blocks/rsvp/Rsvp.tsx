'use client'

import { useEffect, useState } from 'react'

import type { RsvpConfig } from '@/shared/blocks'
import { isPastDeadline, rsvpInputSchema } from '@/shared/guest'

import styles from '../common/guestForm.module.scss'
import Section from '../common/Section'
import { postJson, readLocal, writeLocal } from '../common/storage'
import Text from '../common/Text'
import type { BlockContext } from '../types'

type Saved = {
  editToken: string
  name: string
  attending: boolean
  partySize: number
  meal: boolean | null
}

function deadlineLabel(deadline: string): string {
  const [, m, d] = deadline.split('-').map(Number)
  return `${m}월 ${d}일까지 알려 주세요.`
}

export default function Rsvp({ config, ctx }: { config: RsvpConfig; ctx: BlockContext }) {
  const storageKey = `dearday:rsvp:${ctx.slug}`
  const [saved, setSaved] = useState<Saved | null>(null)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [attending, setAttending] = useState<boolean | null>(null)
  const [partySize, setPartySize] = useState(1)
  const [meal, setMeal] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const closed = isPastDeadline(config.deadline)

  useEffect(() => {
    if (!ctx.preview) setSaved(readLocal<Saved>(storageKey))
  }, [storageKey, ctx.preview])

  function startEdit() {
    if (saved) {
      setName(saved.name)
      setAttending(saved.attending)
      setPartySize(Math.max(1, saved.partySize))
      setMeal(saved.meal)
    }
    setError('')
    setOpen(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (attending === null) return setError('참석 여부를 골라 주세요.')
    const input = { name, attending, partySize, meal, editToken: saved?.editToken }
    const parsed = rsvpInputSchema.safeParse(input)
    if (!parsed.success)
      return setError(parsed.error.issues[0]?.message ?? '입력값을 확인해 주세요.')
    if (ctx.preview) return setError('미리보기에서는 보낼 수 없어요.')
    setBusy(true)
    setError('')
    try {
      const { editToken } = await postJson<{ editToken: string }>(
        `/api/i/${ctx.slug}/rsvp`,
        parsed.data,
      )
      const next: Saved = { editToken, name: parsed.data.name, attending, partySize, meal }
      writeLocal(storageKey, next)
      setSaved(next)
      setOpen(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section title={config.title}>
      {config.message ? <Text className={styles.intro}>{config.message}</Text> : null}
      {!open && config.deadline && !closed ? (
        <p className={styles.note}>{deadlineLabel(config.deadline)}</p>
      ) : null}
      <div style={{ height: 12 }} />

      {closed ? (
        <p className={styles.done}>응답이 마감됐어요.</p>
      ) : open ? (
        <form className={styles.form} onSubmit={submit} noValidate>
          <label className={styles.label}>
            성함
            <input
              className={styles.input}
              value={name}
              maxLength={20}
              autoComplete="name"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className={styles.label} role="group" aria-label="참석 여부">
            참석 여부
            <div className={styles.choices}>
              <button
                type="button"
                aria-pressed={attending === true}
                onClick={() => setAttending(true)}
              >
                참석할게요
              </button>
              <button
                type="button"
                aria-pressed={attending === false}
                onClick={() => setAttending(false)}
              >
                못 가요
              </button>
            </div>
          </div>
          {attending ? (
            <>
              <label className={styles.label}>
                인원 (본인 포함)
                <select
                  className={styles.select}
                  value={partySize}
                  onChange={(e) => setPartySize(Number(e.target.value))}
                >
                  {Array.from({ length: config.maxPartySize }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}명
                    </option>
                  ))}
                </select>
              </label>
              {config.askMeal ? (
                <div className={styles.label} role="group" aria-label="식사 여부">
                  식사
                  <div className={styles.choices}>
                    <button
                      type="button"
                      aria-pressed={meal === true}
                      onClick={() => setMeal(true)}
                    >
                      할게요
                    </button>
                    <button
                      type="button"
                      aria-pressed={meal === false}
                      onClick={() => setMeal(false)}
                    >
                      안 해요
                    </button>
                    <button
                      type="button"
                      aria-pressed={meal === null}
                      onClick={() => setMeal(null)}
                    >
                      미정
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className={styles.submit} disabled={busy}>
            {busy ? '보내는 중…' : saved ? '고쳐서 보내기' : '보내기'}
          </button>
          <p className={styles.note}>
            보낸 내용은 초대장 주인에게만 보여요.{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer">
              개인정보처리방침
            </a>
          </p>
          <button type="button" className={styles.cancel} onClick={() => setOpen(false)}>
            닫기
          </button>
        </form>
      ) : saved ? (
        <div className={styles.done} role="status">
          <strong>{saved.name}님, 응답을 보냈어요.</strong>
          {saved.attending ? `참석 · ${saved.partySize}명` : '불참'}
          <br />
          <button type="button" onClick={startEdit}>
            응답 고치기
          </button>
        </div>
      ) : (
        <button type="button" className={styles.open} onClick={startEdit}>
          참석 의사 전달하기
        </button>
      )}
    </Section>
  )
}
