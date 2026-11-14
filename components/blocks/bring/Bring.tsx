'use client'

import classNames from 'classnames/bind'
import { useEffect, useState } from 'react'

import type { BringConfig } from '@/shared/blocks'
import { isBringFull, usableBringItems, type BringResults } from '@/shared/bring'
import { checkName } from '@/shared/guest-rules'

import guest from '../common/guestForm.module.scss'
import Section from '../common/Section'
import { postJson, readLocal, writeLocal } from '../common/storage'
import Text from '../common/Text'
import { useNearViewport } from '../common/useNearViewport'
import type { BlockContext } from '../types'
import styles from './Bring.module.scss'

const cx = classNames.bind(styles)

/** 이 브라우저에서 맡은 것 (취소 토큰 원문은 여기에만 있고 DB에는 해시만 있음) */
type Mine = { editToken: string; itemId: string; name: string }

export default function Bring({ config, ctx }: { config: BringConfig; ctx: BlockContext }) {
  const storageKey = `dearday:bring:${ctx.slug}`
  const items = usableBringItems(config.items)

  const [ref, near] = useNearViewport<HTMLDivElement>('300px')
  const [results, setResults] = useState<BringResults | null>(null)
  const [version, setVersion] = useState(0)
  const [mine, setMine] = useState<Mine[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (ctx.preview) return
    const saved = readLocal<Mine[]>(storageKey)
    if (Array.isArray(saved)) {
      setMine(saved)
      if (saved[0]) setName(saved[0].name)
    }
  }, [storageKey, ctx.preview])

  useEffect(() => {
    if (!near || ctx.preview) return
    let cancelled = false
    fetch(`/api/i/${ctx.slug}/bring`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: BringResults | null) => !cancelled && setResults(d))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [near, ctx.slug, ctx.preview, version])

  if (items.length === 0) return null

  const byId = new Map(results?.items.map((r) => [r.id, r]) ?? [])

  function save(next: Mine[]) {
    setMine(next)
    writeLocal(storageKey, next)
  }

  async function claim(itemId: string, e: React.FormEvent) {
    e.preventDefault()
    const nameError = checkName(name)
    if (nameError) return setError(nameError)
    if (ctx.preview) return setError('미리보기에서는 보낼 수 없어요.')
    setBusy(true)
    setError('')
    try {
      const { editToken } = await postJson<{ editToken: string }>(`/api/i/${ctx.slug}/bring`, {
        name: name.trim(),
        itemId,
      })
      save([...mine, { editToken, itemId, name: name.trim() }])
      setOpenId(null)
      setVersion((v) => v + 1)
    } catch (err) {
      setError((err as Error).message)
      setVersion((v) => v + 1)
    } finally {
      setBusy(false)
    }
  }

  async function cancel(m: Mine) {
    if (!window.confirm('맡은 것을 취소할까요?')) return
    setBusy(true)
    setError('')
    try {
      await postJson(`/api/i/${ctx.slug}/bring`, { editToken: m.editToken }, 'DELETE')
    } catch (err) {
      // 이미 없어진 맡기(예: 주최자가 정리)면 이 기기 기록만 지운다
      if (!/찾지 못했어요/.test((err as Error).message)) {
        setError((err as Error).message)
        setBusy(false)
        return
      }
    }
    save(mine.filter((x) => x.editToken !== m.editToken))
    setVersion((v) => v + 1)
    setBusy(false)
  }

  return (
    <Section
      eyebrow="BRING"
      title={config.title}
      className={cx('container')}
      id={ctx.preview ? undefined : 'bring'}
    >
      <div ref={ref}>
        {config.message ? <Text className={guest.intro}>{config.message}</Text> : null}
        <p className={cx('public')}>맡은 분의 이름은 초대장을 받은 분 모두에게 보여요.</p>
        <ul className={cx('items')}>
          {items.map((it) => {
            const r = byId.get(it.id)
            const count = r?.count ?? 0
            const full = results ? isBringFull(it.need, count) : false
            const myClaims = mine.filter((m) => m.itemId === it.id)
            const opening = openId === it.id
            return (
              <li key={it.id} className={cx('item', { full })} data-item={it.name}>
                <div className={cx('row')}>
                  <span className={cx('name')}>
                    <b>{it.name}</b>
                    <small>
                      {results ? `${count}/${it.need}` : `필요 ${it.need}`}
                      {full ? ' · 마감' : ''}
                    </small>
                  </span>
                  {full ? (
                    <span className={cx('done')}>마감</span>
                  ) : (
                    <button
                      type="button"
                      className={cx('take')}
                      aria-expanded={opening}
                      onClick={() => {
                        setError('')
                        setOpenId(opening ? null : it.id)
                      }}
                    >
                      맡기
                    </button>
                  )}
                </div>
                {r && r.names.length > 0 ? <p className={cx('names')}>{r.names.join(', ')}</p> : null}
                {myClaims.map((m) => (
                  <p key={m.editToken} className={cx('mine')}>
                    {m.name}님이 맡았어요{' '}
                    <button type="button" onClick={() => cancel(m)} disabled={busy}>
                      취소
                    </button>
                  </p>
                ))}
                {opening ? (
                  <form className={cx('form')} onSubmit={(e) => claim(it.id, e)} noValidate>
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
                    {error ? (
                      <p className={guest.error} role="alert">
                        {error}
                      </p>
                    ) : null}
                    <button type="submit" className={guest.submit} disabled={busy}>
                      {busy ? '보내는 중…' : `${it.name} 맡을게요`}
                    </button>
                  </form>
                ) : null}
              </li>
            )
          })}
        </ul>
        {error && !openId ? (
          <p className={guest.error} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Section>
  )
}
