'use client'

import { TextField } from '../fields'
import { GalleryField } from '../ImageFields'
import { patcher, type FormProps } from './types'

/**
 * 사진첩 편집. '넘겨 보기(slide)' 방식은 스키마에만 남겨 두고 런칭 때는 선택지를 숨김
 * (선택지가 바둑판 하나뿐이라 고르는 칸 자체를 빼 둠). 구현하면 여기에 다시 Segmented를 붙인다.
 */
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
    </>
  )
}
