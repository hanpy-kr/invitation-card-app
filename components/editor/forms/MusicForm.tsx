'use client'

import { useState } from 'react'

import type { MediaRef } from '@/shared/blocks'

import { useEditorEnv } from '../context'
import { PublicNotice, TextField } from '../fields'
import imageStyles from '../ImageFields.module.scss'
import { uploadAudio } from '../upload'
import { patcher, type FormProps } from './types'

export default function MusicForm({ config, update }: FormProps<'music'>) {
  const set = patcher(update)
  const env = useEditorEnv()
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  async function pick(file: File) {
    setError('')
    if (!env.uploadEnabled) return setError('파일 저장소가 아직 연결되지 않았어요.')
    setStatus('음악 올리는 중…')
    try {
      const ref: MediaRef = await uploadAudio(env.invitationId, file)
      set({ audio: ref, title: config.title || file.name.replace(/\.[^.]+$/, '').slice(0, 40) })
    } catch (err) {
      setError((err as Error).message)
    }
    setStatus('')
  }

  return (
    <>
      <PublicNotice>
        저작권이 있는 음악은 올리지 마세요. 직접 만들었거나 사용을 허락받은 음악만 올려 주세요.
        링크를 받은 누구나 이 파일을 들을 수 있어요.
      </PublicNotice>
      <p className={imageStyles.label}>
        음악 파일 <em>mp3 · m4a, 10MB까지 · 하객이 재생 버튼을 눌러야 나와요(자동 재생 없음)</em>
      </p>
      {config.audio ? (
        <audio
          src={`${env.mediaBaseUrl.replace(/\/+$/, '') || '/uploads'}/${config.audio.key}`}
          controls
          preload="none"
          style={{ width: '100%', marginBottom: 8 }}
        />
      ) : null}
      <div className={imageStyles.buttons}>
        <label className={imageStyles.btn} aria-disabled={status !== ''}>
          {config.audio ? '음악 바꾸기' : '+ 음악 올리기'}
          <input
            type="file"
            accept=".mp3,.m4a,audio/mpeg,audio/mp4"
            disabled={status !== ''}
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void pick(f)
            }}
          />
        </label>
        {config.audio ? (
          <button
            type="button"
            className={`${imageStyles.btn} ${imageStyles.solid}`}
            onClick={() => set({ audio: null })}
          >
            음악 빼기
          </button>
        ) : null}
      </div>
      {status ? <p className={imageStyles.status}>{status}</p> : null}
      {error ? <p className={imageStyles.error}>{error}</p> : null}
      <TextField
        label="곡 이름 (재생 버튼 옆에 보여요)"
        value={config.title}
        maxLength={40}
        onChange={(title) => set({ title })}
      />
    </>
  )
}
