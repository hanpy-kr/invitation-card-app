import classNames from 'classnames/bind'

import type { ContactConfig } from '@/shared/blocks'

import { IconMessage, IconPhone } from '../common/icons'
import Section from '../common/Section'
import styles from './Contact.module.scss'

const cx = classNames.bind(styles)

const telOf = (phone: string) => phone.replace(/[^\d+]/g, '')

export default function Contact({ config }: { config: ContactConfig }) {
  const people = config.people.filter((p) => telOf(p.phone).length >= 3)
  if (people.length === 0) return null
  return (
    <Section eyebrow="CONTACT" title={config.title} className={cx('container')}>
      <ul className={cx('list')}>
        {people.map((p, i) => {
          const who = [p.relation, p.name].filter(Boolean).join(' ')
          const tel = telOf(p.phone)
          return (
            <li key={i}>
              {/* 신랑 강창현 — 한 줄 */}
              <span className={cx('who')}>
                {p.relation ? <small>{p.relation}</small> : null}
                {p.name || p.phone}
              </span>
              <a
                href={`tel:${tel}`}
                className={cx('btn')}
                aria-label={`${who || p.phone}에게 전화`}
              >
                <IconPhone className={cx('ico')} />
              </a>
              <a
                href={`sms:${tel}`}
                className={cx('btn')}
                aria-label={`${who || p.phone}에게 문자`}
              >
                <IconMessage className={cx('ico')} />
              </a>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}
