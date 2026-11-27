import classNames from 'classnames/bind'

import type { CoverConfig } from '@/shared/blocks'
import { COVER_RATIO, coverSrc, coverSrcSet, findCover } from '@/shared/covers'
import { formatDotDate, formatShortDate, formatWeekday, toKstTimeString } from '@/shared/date'
import { mediaSrc } from '@/shared/media'

import CallaEmboss from './common/CallaEmboss'
import Section from './common/Section'
import { coverTemplateLocked, FREE_COVER_TEMPLATE } from '@/shared/entitlements'

import { coverTemplateOf } from './CoverTemplate'
import CoverEffect from './CoverEffect'
import CoverShell from './CoverShell'
import { fitCqw } from './coverFit'
import styles from './Cover.module.scss'
import type { BlockContext } from './types'

const cx = classNames.bind(styles)

/** 봉투(리본 카드 · 책 표지) 안에 보이는 표지 그림: 템플릿 표지를 줄여 찍은 정적 이미지 */
const TEMPLATE_CARD: Record<string, string> = {
  x: '/covers/templates/xmas-card-560.webp',
}

export default function Cover({ config, ctx }: { config: CoverConfig; ctx: BlockContext }) {
  // 결혼 표지 템플릿: 이용권이 없으면(결제 전 발행 · 환불 등) 무료인 2안으로 대체해 보여 줌 (봉투 · 효과와 같은 방식)
  if (config.layout === 'template') {
    const key = coverTemplateLocked(config.template, { coverTemplates: ctx.coverTemplates })
      ? FREE_COVER_TEMPLATE
      : config.template
    const face = coverTemplateOf(key, config, ctx.eventAt, {
      title: ctx.title,
      dateVoting: ctx.dateVoting,
    })
    // 봉투 · 떨어지는 효과: 디자인 표지와 같은 방식으로 템플릿 표지에서도 동작 (기본은 없음 → 결혼 표지는 그대로)
    const fx = key === 'x' && ctx.introEffects
    const effect = fx && config.effect !== 'none' ? config.effect : null
    const intro = fx && config.intro !== 'none' ? config.intro : null
    if (!effect && !intro) return face
    const style = {
      '--cv-paper': '#f3f1ec',
      '--cv-surface': '#f8f7f3',
      '--cv-line': '#d9d4cb',
      '--cv-accent': '#a8915f',
      '--cover-accent': '#a8915f',
    } as React.CSSProperties
    const cls = cx('cover', 'light')
    const inner = (
      <>
        {face}
        {effect ? (
          <CoverEffect
            key={`${effect}-${config.effectDensity}-${config.effectDuration}`}
            kind={effect}
            lightPaper
            density={config.effectDensity}
            once={config.effectDuration === 'once'}
          />
        ) : null}
      </>
    )
    return intro ? (
      <CoverShell
        kind={intro}
        slug={ctx.slug}
        preview={Boolean(ctx.preview)}
        title={config.title}
        sealText={config.sealText}
        imageSrc={TEMPLATE_CARD[key] ?? TEMPLATE_CARD.x}
        className={cls}
        style={style}
      >
        {inner}
      </CoverShell>
    ) : (
      <section className={cls} style={style}>
        {inner}
      </section>
    )
  }
  const design = config.layout === 'design' ? findCover(config.designKey) : undefined
  const photo = config.layout === 'photo' ? config.image : null
  const showDate = config.showDate && ctx.eventAt

  const dateBlock = (
    <>
      {config.showDate && ctx.dateVoting ? <div className={cx('txt-day')}>날짜 투표 중</div> : null}
      {showDate ? (
        <>
          <div className={cx('txt-date')}>{formatShortDate(ctx.eventAt!)}</div>
          {/* 요일은 날짜에서 계산, 한국어로 (영문 머리글 없앰) */}
          <div className={cx('txt-day')}>{formatWeekday(ctx.eventAt!)}</div>
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

  // 디자인 표지: 화면 한 장(100svh)을 꽉 채움. 종이 색 바탕 가운데에 가로 116%짜리 4:5 그림을 놓고
  // 위아래를 종이 색으로 녹이며, 날짜 · 제목 · 부제는 화면 가운데에 둔다.
  if (design) {
    const fx = ctx.introEffects
    const effect = fx && config.effect !== 'none' ? config.effect : null
    const intro = fx && config.intro !== 'none' ? config.intro : null
    const style = {
      '--cover-accent': design.accent,
      '--pad-x': `${design.padX}%`,
      '--cv-paper': design.paper,
      '--cv-surface': design.surface,
      '--cv-line': design.line,
      '--cv-accent': design.dark?.point ?? design.accent,
    } as React.CSSProperties
    const cls = cx('cover', design.tone)
    const inner = (
      <>
        <div className={cx('art')}>
          <div
            className={cx('wrap-design')}
            style={{ aspectRatio: `${COVER_RATIO.w} / ${COVER_RATIO.h}` }}
          >
            <img
              src={coverSrc(design, 800)}
              srcSet={coverSrcSet(design)}
              sizes="(min-width: 480px) 560px, 116vw"
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
        </div>
        {effect ? (
          <CoverEffect
            key={`${effect}-${config.effectDensity}-${config.effectDuration}`}
            kind={effect}
            lightPaper={!design.dark}
            density={config.effectDensity}
            once={config.effectDuration === 'once'}
          />
        ) : null}
        <div className={cx('scroll')} aria-hidden="true">
          <span>SCROLL</span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor">
            <path d="M2 4.5 7 9.5 12 4.5" strokeWidth="1" />
          </svg>
        </div>
      </>
    )
    return intro ? (
      <CoverShell
        kind={intro}
        slug={ctx.slug}
        preview={Boolean(ctx.preview)}
        title={config.title}
        sealText={config.sealText}
        imageSrc={coverSrc(design, 800)}
        className={cls}
        style={style}
      >
        {inner}
      </CoverShell>
    ) : (
      <section className={cls} style={style}>
        {inner}
      </section>
    )
  }

  // 사진 · 글자 표지: 2027.12.26 / 일요일 17:30 (종이 편지 테마는 맨 위에 꽃 한 송이 음각)
  return (
    <Section className={cx('container', { text: !photo })}>
      <CallaEmboss className={cx('flower')} />
      {config.showDate && ctx.dateVoting ? <div className={cx('txt-day')}>날짜 투표 중</div> : null}
      {showDate ? (
        <>
          <div className={cx('txt-date', 'num')}>{formatDotDate(ctx.eventAt!)}</div>
          <div className={cx('txt-day')}>
            <span className={cx('wd')}>{formatWeekday(ctx.eventAt!)}</span>{' '}
            <span className={cx('num')}>{toKstTimeString(ctx.eventAt!)}</span>
          </div>
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
      {titles}
    </Section>
  )
}
