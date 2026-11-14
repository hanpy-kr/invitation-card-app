import 'server-only'

import type { ResponsesData } from './dashboard'
import { cell } from './rsvp-csv'

/** 나눠 맡기 CSV: 항목별 필요 수 · 맡은 수 · 맡은 사람(쉼표로 구분). UTF-8 BOM + CRLF */
export function bringCsv(bring: NonNullable<ResponsesData['bring']>): string {
  const header = ['준비물', '필요', '맡은 수', '맡은 사람']
  const rows = bring.items.map((it) => [it.name, it.need, it.count, it.names.join(', ')])
  return '﻿' + [header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n'
}
