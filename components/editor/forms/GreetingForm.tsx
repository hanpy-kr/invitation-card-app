'use client'

import { GREETING_PRESETS } from '@/shared/greeting-presets'
import type { EventType } from '@/shared/blocks'
import { useState } from 'react'

import fieldStyles from '../fields.module.scss'
import { Segmented, TextArea, TextField, Toggle } from '../fields'
import { patcher, type FormProps } from './types'

const MAX_HOSTS = 4
const MAX_FAMILIES = 2
type Family = { parents: string; relation: '아들' | '딸'; name: string }
const EMPTY_FAMILY: Family = { parents: '', relation: '아들', name: '' }

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
  const families = Array.from(
    { length: MAX_FAMILIES },
    (_, i) => config.families[i] ?? EMPTY_FAMILY,
  )
  const setFamily = (idx: number, patch: Partial<Family>) =>
    update((c) => {
      const next = Array.from({ length: MAX_FAMILIES }, (_, i) => c.families[i] ?? EMPTY_FAMILY)
      next[idx] = { ...next[idx], ...patch }
      // 끝쪽 빈 줄은 저장하지 않음 (비우면 그 줄은 안 보임)
      while (next.length > 0 && !next[next.length - 1].parents && !next[next.length - 1].name)
        next.pop()
      return { ...c, families: next }
    })

  const setHost = (idx: number, value: string) =>
    update((c) => {
      const next = c.hosts.length > 0 ? [...c.hosts] : ['']
      next[idx] = value
      return { ...c, hosts: next }
    })

  return (
    <>
      <Segmented
        label="윗장식"
        value={config.icon}
        options={[
          { value: 'none', label: '없음' },
          { value: 'flower', label: '꽃' },
          { value: 'post', label: '편지' },
          { value: 'star', label: '별' },
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
          borderRadius: 2,
          background: 'none',
          color: 'var(--ink)',
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
                  border: '1px solid var(--paper-line)',
                  background: 'var(--paper-surface)',
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
              color: 'var(--ink)',
              textDecoration: 'underline',
              textUnderlineOffset: 4,
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
      {eventType === 'wedding' ? (
        <div className={fieldStyles.field}>
          <span>
            혼주 <em className={fieldStyles.hint}>최대 {MAX_FAMILIES}줄</em>
          </span>
          {families.map((f, idx) => (
            <div key={idx} className={fieldStyles.familyRow}>
              <input
                className={fieldStyles.input}
                value={f.parents}
                maxLength={40}
                placeholder="강춘근 · 심남숙"
                aria-label={`혼주 ${idx + 1} 부모님 이름`}
                onChange={(e) => setFamily(idx, { parents: e.target.value })}
              />
              <span className={fieldStyles.control}>
                <select
                  className={fieldStyles.select}
                  value={f.relation}
                  aria-label={`혼주 ${idx + 1} 관계`}
                  onChange={(e) => setFamily(idx, { relation: e.target.value as '아들' | '딸' })}
                >
                  <option value="아들">아들</option>
                  <option value="딸">딸</option>
                </select>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 9.5l6 6 6-6" />
                </svg>
              </span>
              <input
                className={fieldStyles.input}
                value={f.name}
                maxLength={20}
                placeholder="이름"
                aria-label={`혼주 ${idx + 1} 자녀 이름`}
                onChange={(e) => setFamily(idx, { name: e.target.value })}
              />
            </div>
          ))}
          <small className={fieldStyles.helper}>
            부모님 이름은 가운데 점(·)으로 구분. 비우면 그 줄은 안 보여요
          </small>
        </div>
      ) : null}
      <Toggle
        label={eventType === 'wedding' ? '이름 아래 예식 날짜 보이기' : '이름 아래 날짜 보이기'}
        checked={config.showEventDate}
        onChange={(showEventDate) => set({ showEventDate })}
      />
    </>
  )
}
