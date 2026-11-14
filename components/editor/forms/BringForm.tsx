'use client'

import { MAX_BRING_ITEMS, MAX_BRING_NEED } from '@/shared/blocks'
import { newQuestionId } from '@/shared/rsvp-questions'

import fieldStyles from '../fields.module.scss'
import { AddButton, FieldRow, ItemCard, list, TextArea, TextField } from '../fields'
import { patcher, type FormProps } from './types'

export default function BringForm({ config, update }: FormProps<'bring'>) {
  const set = patcher(update)
  type Item = (typeof config.items)[number]
  const setItems = (fn: (items: Item[]) => Item[]) => update((c) => ({ ...c, items: fn(c.items) }))
  return (
    <>
      <p className={fieldStyles.notice}>
        맡은 분의 이름은 초대장을 받은 분 모두에게 보여요 (하객 화면에도 안내가 나와요). 다 채워진
        항목은 &lsquo;마감&rsquo;으로 바뀌고, 누가 무엇을 맡았는지는 응답 보기 화면에서 엑셀로 받을 수
        있어요.
      </p>
      <TextField
        label="제목"
        value={config.title}
        maxLength={30}
        onChange={(title) => set({ title })}
      />
      <TextArea
        label="안내 문구"
        hint="선택"
        value={config.message}
        maxLength={200}
        rows={2}
        placeholder="예) 가져오실 수 있는 걸 하나씩 맡아 주세요"
        onChange={(message) => set({ message })}
      />
      {config.items.map((it, i) => (
        <ItemCard
          key={it.id}
          title={`준비물 ${i + 1}`}
          index={i}
          count={config.items.length}
          onMove={(a, b) => setItems((xs) => list.move(xs, a, b))}
          onRemove={(x) => setItems((xs) => list.remove(xs, x))}
        >
          <FieldRow>
            <TextField
              label={`준비물 ${i + 1} 이름`}
              value={it.name}
              maxLength={30}
              placeholder="예) 케이크"
              onChange={(name) => setItems((xs) => list.set(xs, i, { name }))}
            />
            <TextField
              label={`준비물 ${i + 1} 필요 수`}
              hint={`1~${MAX_BRING_NEED}`}
              value={String(it.need)}
              maxLength={2}
              onChange={(v) =>
                setItems((xs) =>
                  list.set(xs, i, {
                    need: Math.min(MAX_BRING_NEED, Math.max(1, Number(v.replace(/\D/g, '')) || 1)),
                  }),
                )
              }
            />
          </FieldRow>
        </ItemCard>
      ))}
      {config.items.length < MAX_BRING_ITEMS ? (
        <AddButton
          label="준비물 추가"
          onClick={() => setItems((xs) => [...xs, { id: newQuestionId(), name: '', need: 1 }])}
        />
      ) : (
        <small style={{ color: 'var(--muted)' }}>준비물은 최대 {MAX_BRING_ITEMS}개까지예요.</small>
      )}
    </>
  )
}
