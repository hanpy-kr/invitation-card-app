'use client'

import { MAX_CONTACTS } from '@/shared/blocks'

import fieldStyles from '../fields.module.scss'
import { AddButton, FieldRow, ItemCard, list, PublicNotice, TextField } from '../fields'
import { patcher, type FormProps } from './types'

export default function ContactForm({ config, update }: FormProps<'contact'>) {
  const set = patcher(update)
  type Person = (typeof config.people)[number]
  const setPeople = (fn: (p: Person[]) => Person[]) =>
    update((c) => ({ ...c, people: fn(c.people) }))
  return (
    <>
      <PublicNotice>링크를 받은 누구나 이 번호를 볼 수 있어요.</PublicNotice>
      <TextField
        label="제목"
        value={config.title}
        maxLength={30}
        onChange={(title) => set({ title })}
      />
      {config.people.map((p, i) => (
        <ItemCard
          key={i}
          title={`연락처 ${i + 1}`}
          index={i}
          count={config.people.length}
          onMove={(a, b) => setPeople((xs) => list.move(xs, a, b))}
          onRemove={(x) => setPeople((xs) => list.remove(xs, x))}
        >
          <FieldRow>
            <TextField
              label="관계"
              value={p.relation}
              maxLength={20}
              placeholder="예) 신랑 아버지"
              onChange={(relation) => setPeople((xs) => list.set(xs, i, { relation }))}
            />
            <TextField
              label="이름"
              value={p.name}
              maxLength={20}
              onChange={(name) => setPeople((xs) => list.set(xs, i, { name }))}
            />
          </FieldRow>
          <label className={fieldStyles.field}>
            <span>전화번호</span>
            <input
              className={fieldStyles.input}
              type="tel"
              inputMode="tel"
              value={p.phone}
              maxLength={20}
              placeholder="010-0000-0000"
              aria-label={`연락처 ${i + 1} 전화번호`}
              onChange={(e) =>
                setPeople((xs) =>
                  list.set(xs, i, { phone: e.target.value.replace(/[^0-9\-+ ]/g, '') }),
                )
              }
            />
          </label>
        </ItemCard>
      ))}
      {config.people.length < MAX_CONTACTS ? (
        <AddButton
          label="연락처 추가"
          onClick={() => setPeople((xs) => [...xs, { relation: '', name: '', phone: '' }])}
        />
      ) : null}
    </>
  )
}
