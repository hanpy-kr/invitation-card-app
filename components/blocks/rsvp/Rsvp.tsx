'use client'

import { useEffect, useState } from 'react'

import type { RsvpConfig } from '@/shared/blocks'
import { checkName, isPastDeadline } from '@/shared/guest-rules'
import {
  choiceOptions,
  cleanAnswers,
  visibleQuestions,
  type Answers,
  type RsvpQuestion,
} from '@/shared/rsvp-questions'

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
  answers?: Answers
}

function QuestionField({
  q,
  value,
  onChange,
}: {
  q: RsvpQuestion
  value: string | number | undefined
  onChange: (v: string) => void
}) {
  const label = (
    <>
      {q.label}
      {q.required ? null : <small className={styles.optional}> (선택)</small>}
    </>
  )
  if (q.kind === 'choice') {
    return (
      <div className={styles.label} role="group" aria-label={q.label}>
        <span>{label}</span>
        <div className={styles.choices} data-wrap>
          {choiceOptions(q).map((o) => (
            <button
              key={o}
              type="button"
              aria-pressed={value === o}
              onClick={() => onChange(value === o ? '' : o)}
            >
              {o}
            </button>
          ))}
        </div>
      </div>
    )
  }
  return (
    <label className={styles.label}>
      <span>{label}</span>
      <input
        className={styles.input}
        inputMode={q.kind === 'number' ? 'numeric' : undefined}
        value={value ?? ''}
        maxLength={q.kind === 'number' ? 3 : 100}
        aria-label={q.label}
        onChange={(e) =>
          onChange(q.kind === 'number' ? e.target.value.replace(/\D/g, '') : e.target.value)
        }
      />
    </label>
  )
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
  const [answers, setAnswers] = useState<Record<string, string | number>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const closed = isPastDeadline(config.deadline)

  useEffect(() => {
    if (ctx.preview) return
    const prev = readLocal<Saved>(storageKey)
    setSaved(prev)
    // 카톡 카드의 [참석 여부 알리기] → /i/[slug]?go=rsvp: 참석 칸으로 스크롤 (아직 안 보냈으면 폼 열기)
    if (new URLSearchParams(window.location.search).get('go') === 'rsvp') {
      if (!prev && !isPastDeadline(config.deadline)) setOpen(true)
      const go = () =>
        document.getElementById('rsvp')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      requestAnimationFrame(go)
      // 위쪽 사진이 늦게 뜨며 자리가 밀리면 한 번 더
      window.addEventListener('load', go, { once: true })
    }
  }, [storageKey, ctx.preview, config.deadline])

  function startEdit() {
    if (saved) {
      setName(saved.name)
      setAttending(saved.attending)
      setPartySize(Math.max(1, saved.partySize))
      setMeal(saved.meal)
      setAnswers(saved.answers ?? {})
    }
    setError('')
    setOpen(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (attending === null) return setError('참석 여부를 골라 주세요.')
    const nameError = checkName(name)
    if (nameError) return setError(nameError)
    const cleaned = cleanAnswers(config.questions, attending, answers)
    if ('error' in cleaned) return setError(cleaned.error)
    if (ctx.preview) return setError('미리보기에서는 보낼 수 없어요.')
    const body = {
      name: name.trim(),
      attending,
      partySize,
      meal,
      answers: cleaned.answers,
      editToken: saved?.editToken,
    }
    setBusy(true)
    setError('')
    try {
      const { editToken } = await postJson<{ editToken: string }>(`/api/i/${ctx.slug}/rsvp`, body)
      const next: Saved = {
        editToken,
        name: body.name,
        attending,
        partySize,
        meal,
        answers: cleaned.answers,
      }
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
    <Section title={config.title} id={ctx.preview ? undefined : 'rsvp'}>
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
          {visibleQuestions(config.questions, attending).map((q) => (
            <QuestionField
              key={q.id}
              q={q}
              value={answers[q.id]}
              onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
            />
          ))}
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
