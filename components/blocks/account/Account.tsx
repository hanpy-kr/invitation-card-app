'use client'

import classNames from 'classnames/bind'
import { useEffect, useId, useState } from 'react'

import type { AccountConfig, AccountGroup, AccountItem } from '@/shared/blocks'
import { formatWon, isKakaoPayUrl, isMobileUA, tossSendUrl } from '@/shared/money'

import CopyButton, { copyText } from '../common/CopyButton'
import Section from '../common/Section'
import Text from '../common/Text'
import styles from './Account.module.scss'

const cx = classNames.bind(styles)

const filled = (a: AccountItem) => Boolean(a.number && a.bank)

function AccountRow({
  item,
  amount,
  mobile,
}: {
  item: AccountItem
  amount: number | null
  mobile: boolean
}) {
  const who = item.relation
  return (
    <li className={cx('row')}>
      <div className={cx('info')}>
        {who ? <div className={cx('relation')}>{who}</div> : null}
        <div className={cx('number')}>
          {item.bank} {item.number}
        </div>
        {item.holder ? <div className={cx('holder')}>예금주 {item.holder}</div> : null}
      </div>
      <div className={cx('actions')}>
        <CopyButton
          text={`${item.bank} ${item.number}`}
          label="복사"
          ariaLabel={`${item.relation || item.holder || item.bank} 계좌번호 복사`}
          className={cx('btn')}
        />
        {mobile ? (
          <a
            className={cx('btn', 'toss')}
            href={tossSendUrl(item.bank, item.number, amount)}
            // 앱이 안 열리는 환경을 대비해 계좌번호를 먼저 복사해 둔다
            onClick={() => void copyText(`${item.bank} ${item.number}`)}
          >
            토스로 보내기
          </a>
        ) : null}
        {mobile && isKakaoPayUrl(item.kakaopay) ? (
          <a
            className={cx('btn', 'kakaopay')}
            href={item.kakaopay}
            target="_blank"
            rel="noopener noreferrer"
          >
            카카오페이
          </a>
        ) : null}
      </div>
    </li>
  )
}

function Group({
  group,
  amount,
  mobile,
  defaultOpen,
}: {
  group: AccountGroup
  amount: number | null
  mobile: boolean
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  const accounts = group.accounts.filter(filled)
  if (accounts.length === 0) return null
  return (
    <div className={cx('group', { open })}>
      <button
        type="button"
        className={cx('group-head')}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{group.label || '계좌'}</span>
        <span className={cx('chevron')} aria-hidden>
          ▾
        </span>
      </button>
      <ul id={id} className={cx('list')} hidden={!open}>
        {accounts.map((a, i) => (
          <AccountRow key={i} item={a} amount={amount} mobile={mobile} />
        ))}
      </ul>
    </div>
  )
}

export default function Account({ config }: { config: AccountConfig }) {
  const [mobile, setMobile] = useState(false)
  useEffect(() => setMobile(isMobileUA(navigator.userAgent)), [])

  const groups = config.groups.filter((g) => g.accounts.some(filled))
  if (groups.length === 0 && !config.perPerson) return null
  const amount = config.perPerson && config.perPerson > 0 ? config.perPerson : null

  return (
    <Section title={config.title} className={cx('container')}>
      {config.message ? <Text className={cx('message')}>{config.message}</Text> : null}
      {amount ? (
        <div className={cx('per-person')}>
          <span>1인 회비</span>
          <strong>{formatWon(amount)}</strong>
        </div>
      ) : null}
      {groups.map((g, i) => (
        // 그룹이 하나뿐이면(회비 계좌 등) 처음부터 펼쳐 둔다
        <Group
          key={i}
          group={g}
          amount={amount}
          mobile={mobile}
          defaultOpen={groups.length === 1}
        />
      ))}
    </Section>
  )
}
