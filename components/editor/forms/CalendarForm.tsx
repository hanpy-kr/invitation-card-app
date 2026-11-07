'use client'

import fieldStyles from '../fields.module.scss'
import { TextField, Toggle } from '../fields'
import { patcher, type FormProps } from './types'

export default function CalendarForm({ config, update }: FormProps<'calendar'>) {
  const set = patcher(update)
  return (
    <>
      <p className={fieldStyles.hint} style={{ marginBottom: 12 }}>
        기본 정보의 날짜 · 시간으로 달력을 그려요. 하객은 [내 캘린더에 저장]으로 일정을 넣을 수
        있어요(끝나는 시간은 시작 + 2시간).
      </p>
      <TextField
        label="제목"
        hint="선택"
        value={config.title}
        maxLength={30}
        placeholder="예) 날짜"
        onChange={(title) => set({ title })}
      />
      <Toggle
        label="D-day 보이기"
        checked={config.showDday}
        onChange={(showDday) => set({ showDday })}
      />
    </>
  )
}
