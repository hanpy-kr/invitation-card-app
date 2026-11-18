'use client'

import { Segmented, TextField, Toggle } from '../fields'
import { GalleryField } from '../ImageFields'
import { patcher, type FormProps } from './types'

export default function GalleryForm({ config, update }: FormProps<'gallery'>) {
  const set = patcher(update)
  return (
    <>
      <TextField
        label="제목"
        placeholder="비우면 제목 없이 사진만"
        value={config.title}
        maxLength={30}
        onChange={(title) => set({ title })}
      />
      <Segmented
        label="보여주는 방식"
        value={config.layout}
        options={[
          { value: 'grid', label: '바둑판' },
          { value: 'ratio', label: '원본 비율' },
          { value: 'slide', label: '넘겨 보기' },
        ]}
        onChange={(layout) => set({ layout })}
      />
      <Toggle
        label="처음엔 4장만 · 더보기"
        checked={config.collapse}
        onChange={(collapse) => set({ collapse })}
      />
      <GalleryField
        images={config.images}
        onChange={(fn) => update((c) => ({ ...c, images: fn(c.images) }))}
      />
    </>
  )
}
