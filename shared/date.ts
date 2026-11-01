/**
 * 날짜 표시 도우미. 서버(UTC)와 브라우저 어디서 렌더링해도 같은 결과가 나오도록
 * 항상 한국 시간(Asia/Seoul)으로 계산한다.
 */
const TZ = 'Asia/Seoul'

function parts(date: Date, options: Intl.DateTimeFormatOptions, locale = 'ko-KR') {
  const out: Record<string, string> = {}
  for (const p of new Intl.DateTimeFormat(locale, { timeZone: TZ, ...options }).formatToParts(
    date,
  )) {
    out[p.type] = p.value
  }
  return out
}

function toDate(value: Date | string): Date {
  return typeof value === 'string' ? new Date(value) : value
}

/** 26.11.21 */
export function formatShortDate(value: Date | string): string {
  const p = parts(toDate(value), { year: '2-digit', month: '2-digit', day: '2-digit' })
  return `${p.year}.${p.month}.${p.day}`
}

/** SATURDAY — 날짜에서 요일을 계산 */
export function formatWeekdayEn(value: Date | string): string {
  return parts(toDate(value), { weekday: 'long' }, 'en-US').weekday.toUpperCase()
}

/** 2026년 11월 21일 토요일 */
export function formatLongDate(value: Date | string): string {
  const p = parts(toDate(value), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })
  return `${p.year}년 ${p.month} ${p.day}일 ${p.weekday}`
}

/** 오후 12시 30분 / 오후 7시 */
export function formatTime(value: Date | string): string {
  const p = parts(toDate(value), { hour: 'numeric', minute: '2-digit', hour12: true })
  const minute = p.minute && p.minute !== '00' ? ` ${Number(p.minute)}분` : ''
  return `${p.dayPeriod} ${p.hour}시${minute}`
}

/** 2026년 11월 21일 토요일 오후 12시 30분 */
export function formatEventDateTime(value: Date | string): string {
  return `${formatLongDate(value)} ${formatTime(value)}`
}

/** YYYY-MM-DD (한국 날짜) */
export function toKstDateString(value: Date | string): string {
  const p = parts(toDate(value), { year: 'numeric', month: '2-digit', day: '2-digit' }, 'en-CA')
  return `${p.year}-${p.month}-${p.day}`
}

/** HH:mm (한국 시간, 24시간) */
export function toKstTimeString(value: Date | string): string {
  const p = parts(toDate(value), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }, 'en-GB')
  return `${p.hour}:${p.minute}`
}

/** 편집기 입력(한국 날짜 · 시간) → ISO 문자열. 날짜가 비면 null */
export function kstInputToIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const t = /^\d{2}:\d{2}$/.test(time) ? time : '12:00'
  return `${date}T${t}:00+09:00`
}
