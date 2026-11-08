'use client'

import { parseYoutubeId } from '@/shared/video'

import { TextField } from '../fields'
import { patcher, type FormProps } from './types'

export default function VideoForm({ config, update }: FormProps<'video'>) {
  const set = patcher(update)
  const bad = config.url.trim() !== '' && !parseYoutubeId(config.url)
  return (
    <>
      <TextField
        label="제목"
        value={config.title}
        maxLength={30}
        onChange={(title) => set({ title })}
      />
      <TextField
        label="유튜브 주소"
        hint="youtube.com 또는 youtu.be 주소를 붙여 넣어 주세요. 하객이 누르기 전에는 영상이 불러와지지 않아요."
        value={config.url}
        maxLength={300}
        onChange={(url) => set({ url })}
      />
      {bad ? (
        <p style={{ color: '#c0392b', fontSize: 13 }}>
          알아볼 수 없는 주소예요. 유튜브 주소가 맞는지 확인해 주세요.
        </p>
      ) : null}
      <TextField
        label="설명 (선택)"
        value={config.caption}
        maxLength={100}
        onChange={(caption) => set({ caption })}
      />
    </>
  )
}
