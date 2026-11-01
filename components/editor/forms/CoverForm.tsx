'use client'

import { Segmented, TextField, Toggle } from '../fields'
import { SingleImageField } from '../ImageFields'
import { patcher, type FormProps } from './types'

export default function CoverForm({ config, update }: FormProps<'cover'>) {
  const set = patcher(update)
  return (
    <>
      <Segmented
        label="표지 모양"
        value={config.layout}
        options={[
          { value: 'photo', label: '사진 표지' },
          { value: 'text', label: '글자만' },
        ]}
        onChange={(layout) => set({ layout })}
      />
      {config.layout === 'photo' ? (
        <SingleImageField
          label="표지 사진"
          value={config.image}
          onChange={(image) => set({ image })}
        />
      ) : null}
      <TextField
        label="큰 제목"
        value={config.title}
        maxLength={40}
        onChange={(title) => set({ title })}
      />
      <TextField
        label="작은 제목"
        value={config.subtitle}
        maxLength={60}
        onChange={(subtitle) => set({ subtitle })}
      />
      <Toggle
        label="날짜 · 요일 보이기"
        checked={config.showDate}
        onChange={(showDate) => set({ showDate })}
      />
    </>
  )
}
