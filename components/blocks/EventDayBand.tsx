import classNames from 'classnames/bind'

import type { Block } from '@/shared/blocks'
import { toKstDateString } from '@/shared/date'
import { kakaoMapUrl } from '@/shared/maps'

import ParkingButton from './ParkingButton'
import type { BlockContext } from './types'
import styles from './EventDayBand.module.scss'

const cx = classNames.bind(styles)

export const PARKING_ID = 'notice-parking'

/** 서버 렌더링 시점이 한국 시간으로 행사 당일인가 (날짜 투표 중이거나 날짜가 없으면 false) */
export function isEventDay(ctx: Pick<BlockContext, 'eventAt' | 'dateVoting'>, now = new Date()) {
  if (!ctx.eventAt || ctx.dateVoting) return false
  return toKstDateString(ctx.eventAt) === toKstDateString(now)
}

/** 행사 당일 표지 아래 버튼 띠: 길 찾기 · 주차 안내 · 전화하기 (해당 블록이 없으면 그 버튼만 숨김) */
export default function EventDayBand({ blocks, ctx }: { blocks: Block[]; ctx: BlockContext }) {
  if (ctx.preview || !isEventDay(ctx)) return null
  const visible = blocks.filter((b) => b.visible)

  let map: string | null = null
  for (const b of visible) {
    if (b.type === 'location' && (b.config.placeName || b.config.address)) {
      map = kakaoMapUrl({
        name: b.config.placeName,
        address: b.config.address,
        lat: b.config.lat,
        lng: b.config.lng,
      })
      break
    }
  }

  const parking = visible.some(
    (b) =>
      b.type === 'notice' &&
      b.config.items.some((it) => !it.attendeesOnly && (it.title + it.body).includes('주차')),
  )

  let phone: string | null = null
  for (const b of visible) {
    if (b.type !== 'contact') continue
    const p = b.config.people.find((x) => x.phone)
    if (p) {
      phone = p.phone.replace(/[^0-9+]/g, '')
      break
    }
  }

  if (!map && !parking && !phone) return null
  return (
    <nav className={cx('band')} aria-label="행사 당일 바로가기">
      {map ? (
        <a href={map} target="_blank" rel="noopener noreferrer">
          길 찾기
        </a>
      ) : null}
      {parking ? <ParkingButton targetId={PARKING_ID} /> : null}
      {phone ? <a href={`tel:${phone}`}>전화하기</a> : null}
    </nav>
  )
}
