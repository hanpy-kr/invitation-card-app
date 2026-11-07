import 'server-only'

import { toKstDateString, toKstTimeString } from '@/shared/date'

import type { ResponsesData } from './dashboard'

/** 엑셀에서 =, +, -, @ 로 시작하는 칸이 수식으로 실행되지 않게 */
function cell(value: string | number | null | undefined): string {
  let v = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

/** 참석 응답 CSV — UTF-8 BOM(엑셀에서 한글 안 깨짐), CRLF 줄바꿈 */
export function rsvpCsv(data: ResponsesData): string {
  const header = [
    '이름',
    '참석',
    '인원',
    ...(data.askMeal ? ['식사'] : []),
    ...data.questions.map((q) => q.label),
    '응답 시각',
  ]
  const rows = [...data.rsvps]
    .reverse()
    .map((r) => [
      r.name,
      r.attending ? '참석' : '불참',
      r.attending ? r.partySize : 0,
      ...(data.askMeal
        ? [r.attending ? (r.meal === true ? '함' : r.meal === false ? '안 함' : '미정') : '']
        : []),
      ...data.questions.map((q) => r.answers[q.id] ?? ''),
      `${toKstDateString(r.createdAt)} ${toKstTimeString(r.createdAt)}`,
    ])
  return '﻿' + [header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n'
}
