'use client'

import classNames from 'classnames/bind'
import { useEffect, useId, useState } from 'react'

import type { NoticeConfig } from '@/shared/blocks'

import LinkedText from '../common/LinkedText'
import Section from '../common/Section'
import { postJson, readLocal } from '../common/storage'
import { useNearViewport } from '../common/useNearViewport'
import type { BlockContext } from '../types'
import styles from './Notice.module.scss'

const cx = classNames.bind(styles)

const isWebUrl = (url: string) => /^https?:\/\/\S+$/.test(url)

type Entry = { title: string; body: string; locked?: boolean }

export default function Notice({ config, ctx }: { config: NoticeConfig; ctx: BlockContext }) {
  const [active, setActive] = useState(0)
  const id = useId()
  const [ref, near] = useNearViewport<HTMLDivElement>('300px')
  // 참석자 전용 항목의 내용: 공개 데이터에는 없고, 참석 응답 토큰을 확인한 API가 준다
  const [member, setMember] = useState<Record<number, { title: string; body: string }> | null>(null)
  const hasMemberOnly = config.items.some((it) => it.attendeesOnly)

  // 참석 응답 토큰으로 참석자 전용 내용을 받아 온다 (화면 근처에 오면 한 번, 응답을 보내거나 취소하면 다시)
  useEffect(() => {
    if (!hasMemberOnly || ctx.preview) return
    let cancelled = false
    const load = () => {
      const saved = readLocal<{ editToken?: string; attending?: boolean }>(
        `dearday:rsvp:${ctx.slug}`,
      )
      if (!saved?.editToken || saved.attending === false) {
        setMember(null)
        return
      }
      postJson<{ items: { index: number; title: string; body: string }[] }>(
        `/api/i/${ctx.slug}/member-notice`,
        { editToken: saved.editToken },
      )
        .then((d) => {
          if (!cancelled) setMember(Object.fromEntries(d.items.map((i) => [i.index, i])))
        })
        .catch(() => !cancelled && setMember(null))
    }
    if (near) load()
    window.addEventListener('dearday:rsvp-changed', load)
    return () => {
      cancelled = true
      window.removeEventListener('dearday:rsvp-changed', load)
    }
  }, [hasMemberOnly, ctx.preview, ctx.slug, near])

  // 보여 줄 항목: 일반 항목은 그대로, 참석자 전용은 (확인되면) 내용, 아니면 잠금 안내 하나로 묶음
  const entries: Entry[] = []
  let lockedCount = 0
  config.items.forEach((it, i) => {
    if (!it.attendeesOnly) {
      if (it.title || it.body) entries.push({ title: it.title, body: it.body })
    } else if (ctx.preview) {
      if (it.title || it.body) entries.push({ title: it.title, body: it.body, locked: true })
    } else if (member?.[i]) {
      entries.push({ title: member[i].title, body: member[i].body, locked: true })
    } else {
      lockedCount++
    }
  })
  if (lockedCount > 0) {
    entries.push({
      title: '참석자 전용',
      body: `참석 응답을 보내신 분께만 보이는 안내가 ${lockedCount}개 있어요.`,
      locked: true,
    })
  }
  const items = entries
  const button = config.buttonLabel && isWebUrl(config.buttonUrl) ? config : null
  if (items.length === 0 && !button) return null
  const tabs = items.length >= 3
  const current = Math.min(active, items.length - 1)

  return (
    <Section eyebrow="NOTICE" title={config.title} className={cx('container')}>
      <div ref={ref} />
      {tabs ? (
        <>
          <div className={cx('tabs')} role="tablist" aria-label={config.title || '안내'}>
            {items.map((it, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                id={`${id}-t${i}`}
                aria-selected={i === current}
                aria-controls={`${id}-p${i}`}
                onClick={() => setActive(i)}
              >
                {it.locked ? '🔒 ' : ''}
                {it.title || `안내 ${i + 1}`}
              </button>
            ))}
          </div>
          <div
            className={cx('panel')}
            role="tabpanel"
            id={`${id}-p${current}`}
            aria-labelledby={`${id}-t${current}`}
          >
            <LinkedText className={cx('body')}>{items[current].body}</LinkedText>
          </div>
        </>
      ) : (
        <ul className={cx('list')}>
          {items.map((it, i) => (
            <li key={i} className={cx('panel')}>
              {it.title ? (
                <h3 className={cx('item-title')}>
                  {it.locked ? '🔒 ' : ''}
                  {it.title}
                </h3>
              ) : null}
              {it.body ? <LinkedText className={cx('body')}>{it.body}</LinkedText> : null}
            </li>
          ))}
        </ul>
      )}
      {button ? (
        <a
          className={cx('button')}
          href={button.buttonUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {button.buttonLabel}
        </a>
      ) : null}
    </Section>
  )
}
