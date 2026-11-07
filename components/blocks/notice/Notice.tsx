'use client'

import classNames from 'classnames/bind'
import { useId, useState } from 'react'

import type { NoticeConfig } from '@/shared/blocks'

import LinkedText from '../common/LinkedText'
import Section from '../common/Section'
import styles from './Notice.module.scss'

const cx = classNames.bind(styles)

const isWebUrl = (url: string) => /^https?:\/\/\S+$/.test(url)

export default function Notice({ config }: { config: NoticeConfig }) {
  const [active, setActive] = useState(0)
  const id = useId()
  const items = config.items.filter((it) => it.title || it.body)
  const button = config.buttonLabel && isWebUrl(config.buttonUrl) ? config : null
  if (items.length === 0 && !button) return null
  const tabs = items.length >= 3
  const current = Math.min(active, items.length - 1)

  return (
    <Section title={config.title} className={cx('container')}>
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
              {it.title ? <h3 className={cx('item-title')}>{it.title}</h3> : null}
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
