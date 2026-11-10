import classNames from 'classnames/bind'

import type { CoverConfig } from '@/shared/blocks'
import { COVER_RATIO, coverSrc, coverSrcSet, findCover } from '@/shared/covers'
import { formatShortDate, formatWeekdayEn } from '@/shared/date'
import { mediaSrc } from '@/shared/media'

import Section from './common/Section'
import { fitCqw } from './coverFit'
import styles from './Cover.module.scss'
import type { BlockContext } from './types'

const cx = classNames.bind(styles)

export default function Cover({ config, ctx }: { config: CoverConfig; ctx: BlockContext }) {
  const design = config.layout === 'design' ? findCover(config.designKey) : undefined
  const photo = config.layout === 'photo' ? config.image : null
  const showDate = config.showDate && ctx.eventAt

  const dateBlock = (
    <>
      {config.showDate && ctx.dateVoting ? <div className={cx('txt-day')}>날짜 투표 중</div> : null}
      {showDate ? (
        <>
          <div className={cx('txt-date')}>{formatShortDate(ctx.eventAt!)}</div>
          {/* 요일은 날짜에서 계산 (레거시 하드코딩 SATURDAY 제거) */}
          <div className={cx('txt-day')}>{formatWeekdayEn(ctx.eventAt!)}</div>
        </>
      ) : null}
    </>
  )
  // 디자인 표지: 그림 가운데 빈 면(가로 100 - 양옆 여백)에 맞춰 제목 · 부제 글자 크기를 자동으로 줄임
  const area = design ? 100 - design.padX * 2 : 100
  const titles = (
    <>
      {config.title ? (
        <h1
          className={cx('txt-title')}
          style={
            design
              ? ({
                  '--fit': `${fitCqw(config.title, area, { max: 5.8, min: 4.6, floor: 3.9 }).toFixed(2)}cqw`,
                } as React.CSSProperties)
              : undefined
          }
        >
          {config.title}
        </h1>
      ) : null}
      {config.subtitle ? (
        <p
          className={cx('txt-subtitle')}
          style={
            design
              ? ({
                  '--fit': `${fitCqw(config.subtitle, area, { max: 3.5, min: 3, floor: 2.8 }).toFixed(2)}cqw`,
                } as React.CSSProperties)
              : undefined
          }
        >
          {config.subtitle}
        </p>
      ) : null}
    </>
  )

  // 디자인 표지: 4:5 그림 위 가운데에 날짜 · 제목 · 부제. 글자색은 표지 톤, 포인트는 테마 색
  if (design) {
    return (
      <Section className={cx('container', 'design', design.tone)}>
        <div
          className={cx('wrap-design')}
          style={
            {
              aspectRatio: `${COVER_RATIO.w} / ${COVER_RATIO.h}`,
              '--cover-accent': design.accent,
              '--pad-x': `${design.padX}%`,
            } as React.CSSProperties
          }
        >
          <img
            src={coverSrc(design, 800)}
            srcSet={coverSrcSet(design)}
            sizes="(min-width: 480px) 480px, 100vw"
            width={800}
            height={1000}
            alt=""
            fetchPriority="high"
          />
          <div className={cx('over')}>
            {dateBlock}
            {titles}
          </div>
        </div>
      </Section>
    )
  }

  return (
    <Section className={cx('container', { text: !photo })}>
      {dateBlock}
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
      {titles}
    </Section>
  )
}
