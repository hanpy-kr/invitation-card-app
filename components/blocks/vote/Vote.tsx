'use client'

import classNames from 'classnames/bind'
import { useEffect, useState } from 'react'

import type { VoteConfig } from '@/shared/blocks'
import { checkName } from '@/shared/guest-rules'
import { optionSub, optionTitle, usableOptions, type VoteResults } from '@/shared/vote'

import guest from '../common/guestForm.module.scss'
import Section from '../common/Section'
import { postJson, readLocal, removeLocal, writeLocal } from '../common/storage'
import Text from '../common/Text'
import { useNearViewport } from '../common/useNearViewport'
import type { BlockContext } from '../types'
import styles from './Vote.module.scss'

const cx = classNames.bind(styles)

type Saved = { editToken: string; name: string; choices: string[] }

export default function Vote({ config, ctx }: { config: VoteConfig; ctx: BlockContext }) {
  const storageKey = `dearday:vote:${ctx.slug}`
  const options = usableOptions(config)
  const closed = config.status === 'closed'
  const confirmed = options.find((o) => o.id === config.confirmedId) ?? null

  const [ref, near] = useNearViewport<HTMLDivElement>('300px')
  const [results, setResults] = useState<VoteResults | null>(null)
  const [version, setVersion] = useState(0)
  const [saved, setSaved] = useState<Saved | null>(null)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!ctx.preview) setSaved(readLocal<Saved>(storageKey))
  }, [storageKey, ctx.preview])

  useEffect(() => {
    if (!near || ctx.preview) return
    let cancelled = false
    fetch(`/api/i/${ctx.slug}/vote`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: VoteResults | null) => !cancelled && setResults(d))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [near, ctx.slug, ctx.preview, version])

  if (options.length === 0) return null

  function toggle(id: string) {
    setPicked((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : config.multiple ? [...p, id] : [id],
    )
  }

  function startEdit() {
    setName(saved?.name ?? '')
    setPicked(saved?.choices ?? [])
    setError('')
    setEditing(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const nameError = checkName(name)
    if (nameError) return setError(nameError)
    if (picked.length === 0) return setError('후보를 하나 이상 골라 주세요.')
    if (ctx.preview) return setError('미리보기에서는 보낼 수 없어요.')
    setBusy(true)
    setError('')
    try {
      const body = { name: name.trim(), choices: picked, editToken: saved?.editToken }
      const { editToken } = await postJson<{ editToken: string }>(`/api/i/${ctx.slug}/vote`, body)
      const next = { editToken, name: body.name, choices: picked }
      writeLocal(storageKey, next)
      setSaved(next)
      setEditing(false)
      setVersion((v) => v + 1)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    if (!saved || !window.confirm('투표를 취소할까요?')) return
    setBusy(true)
    try {
      await postJson(`/api/i/${ctx.slug}/vote`, { editToken: saved.editToken }, 'DELETE')
      removeLocal(storageKey)
      setSaved(null)
      setVersion((v) => v + 1)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const byId = new Map(results?.results.map((r) => [r.id, r]) ?? [])
  const max = Math.max(1, ...(results?.results.map((r) => r.count) ?? [0]))

  return (
    <Section
      eyebrow="VOTE"
      title={config.title}
      className={cx('container')}
      id={ctx.preview ? undefined : 'vote'}
    >
      <div ref={ref}>
        {closed && confirmed ? (
          <div className={cx('confirmed')} role="status">
            <span>확정됐어요</span>
            <strong>{optionTitle(config.kind, confirmed)}</strong>
            {optionSub(config.kind, confirmed) ? (
              <em>{optionSub(config.kind, confirmed)}</em>
            ) : null}
          </div>
        ) : config.message ? (
          <Text className={guest.intro}>{config.message}</Text>
        ) : null}

        <form onSubmit={submit} noValidate>
          <ul className={cx('options')}>
            {options.map((o) => {
              const r = byId.get(o.id)
              const selectable = editing && !closed
              const mine = saved?.choices.includes(o.id)
              return (
                <li key={o.id} className={cx({ win: o.id === config.confirmedId })}>
                  <button
                    type="button"
                    className={cx('option')}
                    aria-pressed={selectable ? picked.includes(o.id) : undefined}
                    disabled={!selectable}
                    onClick={() => toggle(o.id)}
                  >
                    <span
                      className={cx('bar')}
                      style={{ width: `${((r?.count ?? 0) / max) * 100}%` }}
                    />
                    <span className={cx('text')}>
                      <b>
                        {selectable ? (picked.includes(o.id) ? '☑ ' : '☐ ') : mine ? '✓ ' : ''}
                        {optionTitle(config.kind, o)}
                      </b>
                      {optionSub(config.kind, o) ? (
                        <small>{optionSub(config.kind, o)}</small>
                      ) : null}
                    </span>
                    <span className={cx('count')}>{r ? `${r.count}표` : ''}</span>
                  </button>
                  {r && r.names.length > 0 ? (
                    <p className={cx('names')}>{r.names.join(', ')}</p>
                  ) : null}
                </li>
              )
            })}
          </ul>

          {closed ? null : editing ? (
            <div className={guest.form}>
              <label className={guest.label}>
                이름
                <input
                  className={guest.input}
                  value={name}
                  maxLength={20}
                  autoComplete="name"
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <p className={guest.note}>
                {config.multiple ? '되는 후보를 모두 골라 주세요. ' : '하나만 골라 주세요. '}
                이름과 고른 후보는 초대장을 받은 분 모두에게 보여요.
              </p>
              {error ? (
                <p className={guest.error} role="alert">
                  {error}
                </p>
              ) : null}
              <button type="submit" className={guest.submit} disabled={busy}>
                {busy ? '보내는 중…' : saved ? '고쳐서 투표하기' : '투표하기'}
              </button>
              <button type="button" className={guest.cancel} onClick={() => setEditing(false)}>
                닫기
              </button>
            </div>
          ) : saved ? (
            <div className={guest.done} role="status">
              <strong>{saved.name}님, 투표했어요.</strong>
              <button type="button" onClick={startEdit}>
                투표 고치기
              </button>
              <button type="button" onClick={cancel} disabled={busy}>
                투표 취소
              </button>
              {error ? (
                <p className={guest.error} role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          ) : (
            <button type="button" className={guest.open} onClick={startEdit}>
              투표하기
            </button>
          )}
        </form>
        {results ? <p className={cx('total')}>지금까지 {results.voters}명 투표</p> : null}
      </div>
    </Section>
  )
}
