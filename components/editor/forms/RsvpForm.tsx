'use client'

import { FieldRow, Select, TextArea, TextField, Toggle } from '../fields'
import { patcher, type FormProps } from './types'

export default function RsvpForm({ config, update }: FormProps<'rsvp'>) {
  const set = patcher(update)
  return (
    <>
      <TextField
        label="제목"
        value={config.title}
        maxLength={30}
        onChange={(title) => set({ title })}
      />
      <TextArea
        label="안내 문구"
        value={config.message}
        maxLength={200}
        rows={3}
        onChange={(message) => set({ message })}
      />
      <FieldRow>
        <Select
          label="한 응답당 최대 인원"
          value={config.maxPartySize}
          options={Array.from({ length: 10 }, (_, i) => ({ value: i + 1, label: `${i + 1}명` }))}
          onChange={(maxPartySize) => set({ maxPartySize })}
        />
        <TextField
          label="응답 마감일"
          type="date"
          value={config.deadline ?? ''}
          onChange={(v) => set({ deadline: v || null })}
        />
      </FieldRow>
      <Toggle
        label="식사 여부도 묻기"
        checked={config.askMeal}
        onChange={(askMeal) => set({ askMeal })}
      />
    </>
  )
}
