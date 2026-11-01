'use client'

import { Segmented, TextField } from '../fields'
import { GalleryField } from '../ImageFields'
import { patcher, type FormProps } from './types'

export default function GalleryForm({ config, update }: FormProps<'gallery'>) {
  const set = patcher(update)
  return (
    <>
      <TextField
        label="제목"
        value={config.title}
        maxLength={30}
        onChange={(title) => set({ title })}
      />
      <GalleryField
        images={config.images}
        onChange={(fn) => update((c) => ({ ...c, images: fn(c.images) }))}
      />
      <div style={{ height: 16 }} />
      <Segmented
        label="보여 주는 방식"
        value={config.layout}
        options={[
          { value: 'grid', label: '바둑판' },
          { value: 'slide', label: '넘겨 보기 (준비 중)' },
        ]}
        onChange={(layout) => set({ layout })}
      />
    </>
  )
}
