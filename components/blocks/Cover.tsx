import classNames from 'classnames/bind'

import type { CoverConfig } from '@/shared/blocks'
import { formatShortDate, formatWeekdayEn } from '@/shared/date'
import { mediaSrc } from '@/shared/media'

import Section from './common/Section'
import styles from './Cover.module.scss'
import type { BlockContext } from './types'

const cx = classNames.bind(styles)

export default function Cover({ config, ctx }: { config: CoverConfig; ctx: BlockContext }) {
  const photo = config.layout === 'photo' ? config.image : null
  const showDate = config.showDate && ctx.eventAt

  return (
    <Section className={cx('container', { text: !photo })}>
      {config.showDate && ctx.dateVoting ? <div className={cx('txt-day')}>날짜 투표 중</div> : null}
      {showDate ? (
        <>
          <div className={cx('txt-date')}>{formatShortDate(ctx.eventAt!)}</div>
          {/* 요일은 날짜에서 계산 (레거시 하드코딩 SATURDAY 제거) */}
          <div className={cx('txt-day')}>{formatWeekdayEn(ctx.eventAt!)}</div>
        </>
      ) : null}
      {photo ? (
        <div className={cx('wrap-photo')}>
          <img
            src={mediaSrc(ctx.mediaBaseUrl, photo.key)}
            width={photo.w}
            height={photo.h}
            alt="표지 사진"
            fetchPriority="high"
          />
        </div>
      ) : null}
      {config.title ? <h1 className={cx('txt-title')}>{config.title}</h1> : null}
      {config.subtitle ? <p className={cx('txt-subtitle')}>{config.subtitle}</p> : null}
    </Section>
  )
}
