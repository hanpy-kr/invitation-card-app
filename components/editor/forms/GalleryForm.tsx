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
      <GalleryField
        images={config.images}
        onChange={(fn) => update((c) => ({ ...c, images: fn(c.images) }))}
      />
    </>
  )
}
