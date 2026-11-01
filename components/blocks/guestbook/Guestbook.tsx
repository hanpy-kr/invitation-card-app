'use client'

import classNames from 'classnames/bind'
import { useCallback, useEffect, useState } from 'react'

import type { GuestbookConfig } from '@/shared/blocks'
import { formatShortDate } from '@/shared/date'
import { guestbookInputSchema, type GuestbookEntryView } from '@/shared/guest'

import formStyles from '../common/guestForm.module.scss'
import Section from '../common/Section'
import { postJson } from '../common/storage'
import Text from '../common/Text'
import type { BlockContext } from '../types'
import styles from './Guestbook.module.scss'

const cx = classNames.bind(styles)

const SAMPLE: GuestbookEntryView[] = [
  {
    id: 'sample',
    name: '하객',
    message: '하객이 남긴 글이 여기에 보여요.',
    createdAt: new Date().toISOString(),
  },
]

export default function Guestbook({ config, ctx }: { config: GuestbookConfig; ctx: BlockContext }) {
  const base = `/api/i/${ctx.slug}/guestbook`
  const [entries, setEntries] = useState<GuestbookEntryView[]>(ctx.preview ? SAMPLE : [])
  const [next, setNext] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(Boolean(ctx.preview))
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', password: '', message: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<{ id: string; password: string; error: string } | null>(
    null,
  )

  const load = useCallback(
    async (before?: string) => {
      const res = await fetch(before ? `${base}?before=${encodeURIComponent(before)}` : base)
      if (!res.ok) return
      const data = (await res.json()) as { entries: GuestbookEntryView[]; next: string | null }
      setEntries((list) => (before ? [...list, ...data.entries] : data.entries))
      setNext(data.next)
      setLoaded(true)
    },
    [base],
  )

  useEffect(() => {
    if (!ctx.preview) void load()
  }, [ctx.preview, load])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = guestbookInputSchema.safeParse(form)
    if (!parsed.success)
      return setError(parsed.error.issues[0]?.message ?? '입력값을 확인해 주세요.')
    if (ctx.preview) return setError('미리보기에서는 남길 수 없어요.')
    setBusy(true)
    setError('')
    try {
      const entry = await postJson<GuestbookEntryView>(base, parsed.data)
      setEntries((list) => [entry, ...list])
      setForm({ name: '', password: '', message: '' })
      setOpen(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(e: React.FormEvent) {
    e.preventDefault()
    if (!deleting) return
    try {
      await postJson(`${base}/${deleting.id}`, { password: deleting.password })
      setEntries((list) => list.filter((x) => x.id !== deleting.id))
      setDeleting(null)
    } catch (err) {
      setDeleting({ ...deleting, error: (err as Error).message })
    }
  }

  return (
    <Section title={config.title}>
      {config.message ? <Text className={formStyles.intro}>{config.message}</Text> : null}

      {open ? (
        <form className={formStyles.form} onSubmit={submit} noValidate>
          <div className={formStyles.row}>
            <label className={formStyles.label}>
              이름
              <input
                className={formStyles.input}
                value={form.name}
                maxLength={20}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className={formStyles.label}>
              비밀번호
              <input
                className={formStyles.input}
                type="password"
                value={form.password}
                maxLength={20}
                autoComplete="new-password"
                placeholder="지울 때 필요해요"
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>
          </div>
          <label className={formStyles.label}>
            메시지
            <textarea
              className={formStyles.textarea}
              value={form.message}
              maxLength={300}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />
            <small className={formStyles.counter}>{form.message.length} / 300</small>
          </label>
          {error ? (
            <p className={formStyles.error} role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className={formStyles.submit} disabled={busy}>
            {busy ? '남기는 중…' : '남기기'}
          </button>
          <button type="button" className={formStyles.cancel} onClick={() => setOpen(false)}>
            닫기
          </button>
        </form>
      ) : (
        <button type="button" className={formStyles.open} onClick={() => setOpen(true)}>
          축하 글 남기기
        </button>
      )}

      {loaded && entries.length === 0 ? <p className={cx('empty')}>첫 글을 남겨 주세요.</p> : null}
      {entries.length > 0 ? (
        <ul className={cx('list')}>
          {entries.map((entry) => (
            <li key={entry.id}>
              <div className={cx('head')}>
                <strong>{entry.name}</strong>
                <time dateTime={entry.createdAt}>{formatShortDate(entry.createdAt)}</time>
                {!ctx.preview ? (
                  <button
                    type="button"
                    aria-label={`${entry.name}님 글 지우기`}
                    onClick={() =>
                      setDeleting(
                        deleting?.id === entry.id
                          ? null
                          : { id: entry.id, password: '', error: '' },
                      )
                    }
                  >
                    지우기
                  </button>
                ) : null}
              </div>
              <p className={cx('msg')}>{entry.message}</p>
              {deleting?.id === entry.id ? (
                <>
                  <form className={cx('del')} onSubmit={remove}>
                    <input
                      type="password"
                      value={deleting.password}
                      maxLength={20}
                      placeholder="남길 때 쓴 비밀번호"
                      aria-label="비밀번호"
                      onChange={(e) =>
                        setDeleting({ ...deleting, password: e.target.value, error: '' })
                      }
                    />
                    <button type="submit">지우기</button>
                  </form>
                  {deleting.error ? <p className={cx('delError')}>{deleting.error}</p> : null}
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {next ? (
        <button type="button" className={cx('more')} onClick={() => void load(next)}>
          더 보기
        </button>
      ) : null}
    </Section>
  )
}
