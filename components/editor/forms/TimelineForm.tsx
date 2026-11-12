'use client'

import { MAX_TIMELINE_ITEMS } from '@/shared/blocks'

import { AddButton, ItemCard, list, TextArea, TextField } from '../fields'
import { patcher, type FormProps } from './types'

export default function TimelineForm({ config, update }: FormProps<'timeline'>) {
  const set = patcher(update)
  type Item = (typeof config.items)[number]
  const setItems = (fn: (items: Item[]) => Item[]) => update((c) => ({ ...c, items: fn(c.items) }))
  return (
    <>
      <TextField
        label="제목"
        value={config.title}
        maxLength={30}
        onChange={(title) => set({ title })}
      />
      {config.items.map((it, i) => (
        <ItemCard
          key={i}
          title={`순서 ${i + 1}`}
          index={i}
          count={config.items.length}
          onMove={(a, b) => setItems((xs) => list.move(xs, a, b))}
          onRemove={(x) => setItems((xs) => list.remove(xs, x))}
        >
          <TextField
            label={`순서 ${i + 1} 시간`}
            value={it.time}
            maxLength={12}
            placeholder="예) 오후 7시"
            onChange={(time) => setItems((xs) => list.set(xs, i, { time }))}
          />
          <TextField
            label={`순서 ${i + 1} 제목`}
            value={it.title}
            maxLength={30}
            placeholder="예) 건배와 식사"
            onChange={(title) => setItems((xs) => list.set(xs, i, { title }))}
          />
          <TextArea
            label={`순서 ${i + 1} 설명`}
            hint="선택"
            value={it.body}
            maxLength={200}
            rows={2}
            onChange={(body) => setItems((xs) => list.set(xs, i, { body }))}
          />
        </ItemCard>
      ))}
      {config.items.length < MAX_TIMELINE_ITEMS ? (
        <AddButton
          label="순서 추가"
          onClick={() => setItems((xs) => [...xs, { time: '', title: '', body: '' }])}
        />
      ) : (
        <small style={{ color: 'var(--muted)' }}>순서는 최대 {MAX_TIMELINE_ITEMS}개까지예요.</small>
      )}
    </>
  )
}
