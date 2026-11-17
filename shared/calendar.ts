/**
 * 캘린더 블록 · event.ics 도우미 (순수 함수, 하객 번들에 들어감 — zod 쓰지 말 것).
 * 종료 시각은 따로 받지 않고 시작 + 2시간.
 */
import { toKstDateString } from './date'

export const EVENT_DURATION_MS = 2 * 60 * 60 * 1000

/** 20261219T100000Z */
export function icsUtc(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

export function googleCalendarUrl(opts: {
  title: string
  start: string
  place?: string
  details?: string
}): string {
  const start = new Date(opts.start)
  const end = new Date(start.getTime() + EVENT_DURATION_MS)
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: opts.title,
    dates: `${icsUtc(start)}/${icsUtc(end)}`,
    ctz: 'Asia/Seoul',
  })
  if (opts.place) q.set('location', opts.place)
  if (opts.details) q.set('details', opts.details)
  return `https://calendar.google.com/calendar/render?${q.toString()}`
}

/** 그 달 달력: 앞쪽 빈칸(null) + 1..말일 */
export function monthGrid(eventAt: string): {
  year: number
  month: number
  day: number
  cells: (number | null)[]
} {
  const [year, month, day] = toKstDateString(eventAt).split('-').map(Number)
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const cells: (number | null)[] = Array.from({ length: first }, () => null)
  for (let d = 1; d <= last; d++) cells.push(d)
  return { year, month, day, cells }
}

/** 한국 날짜 기준 남은 날 (오늘 = 0, 지났으면 음수) */
export function daysUntil(eventAt: string, now = new Date()): number {
  const toUtcDay = (s: string) => {
    const [y, m, d] = s.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round(
    (toUtcDay(toKstDateString(eventAt)) - toUtcDay(toKstDateString(now))) / 86400000,
  )
}

/** iCalendar 글자 이스케이프 */
function icsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** 75바이트 줄 접기 (UTF-8 글자 중간을 자르지 않게 글자 단위로) */
function fold(line: string): string {
  const out: string[] = []
  let cur = ''
  let bytes = 0
  for (const ch of line) {
    const b = new TextEncoder().encode(ch).length
    if (bytes + b > 73) {
      out.push(cur)
      cur = ' '
      bytes = 1
    }
    cur += ch
    bytes += b
  }
  out.push(cur)
  return out.join('\r\n')
}

export function buildIcs(opts: {
  uid: string
  title: string
  start: string
  place?: string
  url: string
  now?: Date
}): string {
  const start = new Date(opts.start)
  const end = new Date(start.getTime() + EVENT_DURATION_MS)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//dearday//invitation//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${opts.uid}`,
    `DTSTAMP:${icsUtc(opts.now ?? new Date())}`,
    `DTSTART:${icsUtc(start)}`,
    `DTEND:${icsUtc(end)}`,
    `SUMMARY:${icsText(opts.title)}`,
    ...(opts.place ? [`LOCATION:${icsText(opts.place)}`] : []),
    `DESCRIPTION:${icsText(`초대장: ${opts.url}`)}`,
    `URL:${opts.url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}

/** 장소 블록에서 캘린더에 넣을 장소 글자 (첫 번째 보이는 장소) */
/** 캘린더 카드에 보일 장소: '더채플앳청담 3F 커티지홀' (장소명 + 층 · 홀) */
export function firstVenue(blocks: { type: string; visible: boolean; config: unknown }[]): string {
  const b = blocks.find((x) => x.type === 'location' && x.visible)
  if (!b) return ''
  const c = b.config as { placeName?: string; detail?: string }
  return [c.placeName, c.detail].filter(Boolean).join(' ')
}

export function firstPlace(blocks: { type: string; visible: boolean; config: unknown }[]): string {
  const b = blocks.find((x) => x.type === 'location' && x.visible)
  if (!b) return ''
  const c = b.config as { placeName?: string; address?: string }
  return [c.placeName, c.address].filter(Boolean).join(', ')
}
