'use client'

import classNames from 'classnames/bind'
import { useEffect, useState } from 'react'

import type { CalendarConfig } from '@/shared/blocks'
import { daysUntil, googleCalendarUrl, monthGrid } from '@/shared/calendar'
import {
  formatDotDate,
  formatDotDateDay,
  formatMonthEn,
  formatTime,
  formatWeekdayKo,
} from '@/shared/date'

import Section from '../common/Section'
import type { BlockContext } from '../types'
import styles from './Calendar.module.scss'

const cx = classNames.bind(styles)
const WEEK = ['일', '월', '화', '수', '목', '금', '토']
const EN = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function Calendar({
  config,
  ctx,
  place,
  venue = '',
}: {
  config: CalendarConfig
  ctx: BlockContext
  /** 구글 캘린더에 넣을 장소 */
  place: string
  /** 카드 맨 위 날짜 아래 장소 줄 */
  venue?: string
}) {
  // D-day는 보는 사람의 '오늘' 기준이라 브라우저에서 계산 (서버 렌더링과 어긋나지 않게)
  const [left, setLeft] = useState<number | null>(null)
  const [origin, setOrigin] = useState('')
  useEffect(() => {
    if (ctx.eventAt) setLeft(daysUntil(ctx.eventAt))
    setOrigin(window.location.origin)
  }, [ctx.eventAt])

  if (!ctx.eventAt) return null
  const { year, month, day, cells } = monthGrid(ctx.eventAt)
  const past = left !== null && left < 0
  const pageUrl = origin ? `${origin}/i/${ctx.slug}` : ''

  return (
    <Section eyebrow="THE DAY" title={config.title} className={cx('container')}>
      <div className={cx('card')}>
        {/* 2027.12.26(일) 오후 5시 30분 / 더채플앳청담 3F 커티지홀 */}
        <p className={cx('when')}>
          {formatDotDateDay(ctx.eventAt)} {formatTime(ctx.eventAt)}
        </p>
        {venue ? <p className={cx('venue')}>{venue}</p> : null}
        {/* 종이 편지: 날짜(Cinzel) + 요일 · 시간 · 장소 (위의 한 줄 날짜는 숨김) */}
        <p className={cx('cl-date')}>{formatDotDate(ctx.eventAt)}</p>
        <p className={cx('cl-when')}>
          {formatWeekdayKo(ctx.eventAt)} {formatTime(ctx.eventAt)}
          {venue ? ` · ${venue}` : ''}
        </p>
        <div className={cx('month')}>
          <div className={cx('month-title')}>
            {year}년 {month}월
          </div>
          <div className={cx('cl-month')}>{formatMonthEn(ctx.eventAt)}</div>
          <table className={cx('grid')}>
            <thead>
              <tr>
                {WEEK.map((w, i) => (
                  <th key={w} className={cx({ sun: i === 0, sat: i === 6 })}>
                    <span className={cx('ko')}>{w}</span>
                    <span className={cx('en')} aria-hidden>
                      {EN[i]}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.ceil(cells.length / 7) }, (_, r) => (
                <tr key={r}>
                  {Array.from({ length: 7 }, (_, c) => {
                    const d = cells[r * 7 + c] ?? null
                    return (
                      <td
                        key={c}
                        className={cx({ sun: c === 0, sat: c === 6, today: d === day })}
                        aria-current={d === day ? 'date' : undefined}
                      >
                        {d ? <span>{d}</span> : null}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {config.showDday && left !== null && left >= 0 ? (
          <p className={cx('dday')}>
            <b>{left === 0 ? 'D-DAY' : `D-${left}`}</b>
            {left === 0 ? '오늘이에요!' : `${left}일 남았어요`}
          </p>
        ) : null}
        {!past ? (
          <div className={cx('save')}>
            <div className={cx('save-buttons')}>
              <a href={`/i/${ctx.slug}/event.ics`} className={cx('btn')}>
                기본 캘린더 (아이폰 등)
              </a>
              <a
                href={googleCalendarUrl({
                  title: ctx.title || '초대',
                  start: ctx.eventAt,
                  place,
                  details: pageUrl ? `초대장: ${pageUrl}` : undefined,
                })}
                target="_blank"
                rel="noopener noreferrer"
                className={cx('btn')}
              >
                구글 캘린더
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </Section>
  )
}
