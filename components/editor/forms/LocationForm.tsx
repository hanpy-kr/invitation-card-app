'use client'

import { TextArea, TextField } from '../fields'
import { patcher, type FormProps } from './types'

export default function LocationForm({ config, update }: FormProps<'location'>) {
  const set = patcher(update)
  return (
    <>
      <TextField
        label="제목"
        value={config.title}
        maxLength={30}
        onChange={(title) => set({ title })}
      />
      <TextField
        label="장소 이름"
        value={config.placeName}
        maxLength={60}
        placeholder="예) 디어홀 웨딩"
        onChange={(placeName) => set({ placeName })}
      />
      <TextField
        label="주소"
        value={config.address}
        maxLength={200}
        onChange={(address) => set({ address, lat: null, lng: null })}
      />
      <TextField
        label="상세 위치"
        hint="층 · 홀 이름 등"
        value={config.detail}
        maxLength={100}
        onChange={(detail) => set({ detail })}
      />
      <TextArea
        label="지하철"
        value={config.subway}
        maxLength={500}
        rows={2}
        onChange={(subway) => set({ subway })}
      />
      <TextArea
        label="버스"
        value={config.bus}
        maxLength={500}
        rows={2}
        onChange={(bus) => set({ bus })}
      />
      <TextArea
        label="주차"
        value={config.parking}
        maxLength={500}
        rows={2}
        onChange={(parking) => set({ parking })}
      />
    </>
  )
}
