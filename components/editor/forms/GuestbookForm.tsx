'use client'

import { TextArea, TextField } from '../fields'
import { patcher, type FormProps } from './types'

export default function GuestbookForm({ config, update }: FormProps<'guestbook'>) {
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
    </>
  )
}
