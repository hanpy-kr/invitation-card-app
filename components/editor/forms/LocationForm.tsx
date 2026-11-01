'use client'

import { useState } from 'react'

import { api } from '../../ui/api'
import { useEditorEnv } from '../context'
import fieldStyles from '../fields.module.scss'
import { TextArea, TextField } from '../fields'
import { patcher, type FormProps } from './types'

type GeoResult = { name: string; address: string; lat: number; lng: number }

function PlaceSearch({ onPick }: { onPick: (r: GeoResult) => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<GeoResult[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function search() {
    if (q.trim().length < 2) return
    setBusy(true)
    setError('')
    try {
      const data = await api<{ results: GeoResult[] }>(
        `/api/geo/search?q=${encodeURIComponent(q.trim())}`,
      )
      setResults(data.results)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={fieldStyles.field}>
      <span>장소 검색</span>
      <form
        style={{ display: 'flex', gap: 6 }}
        onSubmit={(e) => {
          e.preventDefault()
          void search()
        }}
      >
        <input
          className={fieldStyles.input}
          value={q}
          maxLength={60}
          placeholder="예) 디어홀 웨딩, 세종대로 110"
          aria-label="장소 검색어"
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="submit"
          disabled={busy}
          style={{
            flexShrink: 0,
            border: 0,
            borderRadius: 10,
            padding: '0 14px',
            background: 'var(--text)',
            color: '#fff',
          }}
        >
          {busy ? '검색 중' : '검색'}
        </button>
      </form>
      {error ? <small style={{ color: '#d64545' }}>{error}</small> : null}
      {results ? (
        results.length === 0 ? (
          <small style={{ color: 'var(--muted)' }}>
            검색 결과가 없어요. 아래에 직접 입력해 주세요.
          </small>
        ) : (
          <ul style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
            {results.map((r, i) => (
              <li key={i} style={{ borderTop: i ? '1px solid var(--line)' : 0 }}>
                <button
                  type="button"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    border: 0,
                    background: '#fff',
                    padding: '10px 12px',
                  }}
                  onClick={() => {
                    onPick(r)
                    setResults(null)
                    setQ('')
                  }}
                >
                  <strong style={{ display: 'block', fontSize: 14 }}>{r.name || r.address}</strong>
                  {r.name ? <small style={{ color: 'var(--muted)' }}>{r.address}</small> : null}
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  )
}

export default function LocationForm({ config, update }: FormProps<'location'>) {
  const set = patcher(update)
  const { geoSearchEnabled } = useEditorEnv()
  return (
    <>
      {geoSearchEnabled ? (
        <PlaceSearch
          onPick={(r) =>
            update((c) => ({
              ...c,
              placeName: r.name || c.placeName,
              address: r.address,
              lat: r.lat,
              lng: r.lng,
            }))
          }
        />
      ) : (
        <p className={fieldStyles.hint} style={{ marginBottom: 12 }}>
          주소를 직접 입력해 주세요. 하객이 누르면 지도 앱에서 주소로 찾아요.
        </p>
      )}
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
        hint={config.lat != null ? '지도 위치 연결됨' : undefined}
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
