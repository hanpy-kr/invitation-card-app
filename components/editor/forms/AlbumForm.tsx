'use client'

import { PublicNotice, TextField } from '../fields'
import { patcher, type FormProps } from './types'

export default function AlbumForm({ config, update }: FormProps<'album'>) {
  const set = patcher(update)
  return (
    <>
      <PublicNotice>
        하객이 로그인 없이 사진을 올려요. 올라온 사진은 링크를 받은 누구나 볼 수 있고, 초대장당
        200장 · 한 사람(IP)당 하루 30장까지예요. 대시보드에서 숨기거나 지우고, 전체를 한 번에 받을
        수 있어요.
      </PublicNotice>
      <TextField
        label="제목"
        value={config.title}
        maxLength={30}
        onChange={(title) => set({ title })}
      />
      <TextField
        label="안내 문구"
        value={config.message}
        maxLength={200}
        onChange={(message) => set({ message })}
      />
    </>
  )
}
