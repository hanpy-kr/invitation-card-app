import classNames from 'classnames/bind'
import { Fragment } from 'react'

import type { GreetingConfig } from '@/shared/blocks'
import { formatLongDate, formatTime } from '@/shared/date'

import { IconFlower, IconHeart, IconPost } from './common/icons'
import Section, { LeafDivider } from './common/Section'
import Text from './common/Text'
import styles from './Greeting.module.scss'
import type { BlockContext } from './types'

const cx = classNames.bind(styles)

/** 인사말 (레거시 Intro + Invitation 합침) */
export default function Greeting({ config, ctx }: { config: GreetingConfig; ctx: BlockContext }) {
  const hosts = config.hosts.filter(Boolean)

  return (
    <Section eyebrow="INVITATION" className={cx('container')}>
      <LeafDivider />
      {config.icon === 'flower' ? <IconFlower className={cx('ico-flower')} /> : null}
      {config.icon === 'post' ? <IconPost className={cx('ico-post')} /> : null}
      {config.title ? <h2 className={cx('txt-heading')}>{config.title}</h2> : null}
      {config.message ? <Text className={cx('txt-message')}>{config.message}</Text> : null}

      {hosts.length > 0 ? (
        <div className={cx('wrap-hosts')}>
          {hosts.map((name, idx) => (
            <Fragment key={idx}>
              {idx > 0 ? (
                config.hostSeparator === 'heart' ? (
                  <IconHeart className={cx('ico-heart')} />
                ) : (
                  <span className={cx('sep-dot')}>·</span>
                )
              ) : null}
              <span>{name}</span>
            </Fragment>
          ))}
        </div>
      ) : null}

      {config.showEventDate && ctx.eventAt ? (
        <div className={cx('wrap-date')}>
          <span>{formatLongDate(ctx.eventAt)}</span>
          <span>{formatTime(ctx.eventAt)}</span>
        </div>
      ) : null}
    </Section>
  )
}
