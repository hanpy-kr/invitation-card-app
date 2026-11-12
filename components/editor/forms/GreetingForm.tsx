'use client'

import { GREETING_PRESETS } from '@/shared/greeting-presets'
import type { EventType } from '@/shared/blocks'
import { useState } from 'react'

import fieldStyles from '../fields.module.scss'
import { Segmented, TextArea, TextField, Toggle } from '../fields'
import { patcher, type FormProps } from './types'

const MAX_HOSTS = 4

export default function GreetingForm({
  config,
  update,
  eventType,
}: FormProps<'greeting'> & { eventType: string }) {
  const set = patcher(update)
  const [picking, setPicking] = useState(false)
  const presets = GREETING_PRESETS[eventType as EventType] ?? GREETING_PRESETS.etc

  function choose(text: string) {
    if (config.message.trim() && config.message !== text) {
      if (!window.confirm('지금 쓴 인사말이 이 문구로 바뀌어요. 바꿀까요?')) return
    }
    set({ message: text })
    setPicking(false)
  }
  const hosts = config.hosts.length > 0 ? config.hosts : ['']

  const setHost = (idx: number, value: string) =>
    update((c) => {
      const next = c.hosts.length > 0 ? [...c.hosts] : ['']
      next[idx] = value
      return { ...c, hosts: next }
    })

  return (
    <>
      <Segmented
        label="아이콘"
        value={config.icon}
        options={[
          { value: 'flower', label: '꽃' },
          { value: 'post', label: '편지' },
          { value: 'none', label: '없음' },
        ]}
        onChange={(icon) => set({ icon })}
      />
      <TextField
        label="제목"
        value={config.title}
        maxLength={30}
        onChange={(title) => set({ title })}
      />
      <TextArea
        label="인사말"
        hint="줄바꿈이 그대로 보여요"
        value={config.message}
        maxLength={1000}
        rows={8}
        onChange={(message) => set({ message })}
      />
      <button
        type="button"
        aria-expanded={picking}
        style={{
          alignSelf: 'flex-start',
          border: '1px solid var(--btn-line)',
          background: 'none',
          color: 'var(--accent)',
          minHeight: 'var(--tap)',
          padding: '0 14px',
        }}
        onClick={() => setPicking((v) => !v)}
      >
        추천 문구
      </button>
      {picking ? (
        <ul
          aria-label="추천 문구 목록"
          style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}
        >
          {presets.map((text, i) => (
            <li key={i}>
              <button
                type="button"
                aria-label={`추천 문구 ${i + 1} 고르기`}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  whiteSpace: 'pre-line',
                  border: '1px solid var(--line)',
                  background: 'var(--surface, transparent)',
                  padding: '10px 12px',
                  fontSize: 13,
                  lineHeight: 1.7,
                  minHeight: 'var(--tap)',
                }}
                onClick={() => choose(text)}
              >
                {text}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className={fieldStyles.field}>
        <span>
          보내는 사람 <em className={fieldStyles.hint}>최대 {MAX_HOSTS}명</em>
        </span>
        {hosts.map((name, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 6 }}>
            <input
              className={fieldStyles.input}
              value={name}
              maxLength={20}
              placeholder={idx === 0 ? '예) 신랑 김민준' : '이름'}
              aria-label={`보내는 사람 ${idx + 1}`}
              onChange={(e) => setHost(idx, e.target.value)}
            />
            {hosts.length > 1 ? (
              <button
                type="button"
                aria-label={`보내는 사람 ${idx + 1} 빼기`}
                style={{
                  border: 0,
                  background: 'none',
                  fontSize: 18,
                  color: 'var(--muted)',
                  padding: '0 8px',
                }}
                onClick={() =>
                  update((c) => ({ ...c, hosts: c.hosts.filter((_, i) => i !== idx) }))
                }
              >
                ✕
              </button>
            ) : null}
          </div>
        ))}
        {hosts.length < MAX_HOSTS ? (
          <button
            type="button"
            style={{
              alignSelf: 'flex-start',
              border: 0,
              background: 'none',
              color: 'var(--accent)',
              padding: '4px 0',
            }}
            onClick={() =>
              update((c) => ({ ...c, hosts: [...(c.hosts.length ? c.hosts : ['']), ''] }))
            }
          >
            + 이름 추가
          </button>
        ) : null}
      </div>

      {hosts.length > 1 ? (
        <Segmented
          label="이름 사이 표시"
          value={config.hostSeparator}
          options={[
            { value: 'heart', label: '하트 ♥' },
            { value: 'dot', label: '가운뎃점 ·' },
          ]}
          onChange={(hostSeparator) => set({ hostSeparator })}
        />
      ) : null}
      <Toggle
        label="행사 날짜 · 시간 보이기"
        checked={config.showEventDate}
        onChange={(showEventDate) => set({ showEventDate })}
      />
    </>
  )
}
