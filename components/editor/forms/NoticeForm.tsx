'use client'

import { MAX_NOTICE_ITEMS } from '@/shared/blocks'

import { AddButton, ItemCard, list, TextArea, TextField, Toggle } from '../fields'
import { patcher, type FormProps } from './types'

export default function NoticeForm({ config, update }: FormProps<'notice'>) {
  const set = patcher(update)
  type Item = (typeof config.items)[number]
  const setItems = (fn: (items: Item[]) => Item[]) => update((c) => ({ ...c, items: fn(c.items) }))
  const urlError = config.buttonUrl !== '' && !/^https?:\/\/\S+$/.test(config.buttonUrl)

  if (config.source === 'settlement')
    return (
      <p style={{ fontSize: 13, color: 'var(--muted)' }}>
        응답 보기 화면의 &lsquo;회비 정산 마무리&rsquo;에서 자동으로 만든 안내예요. 내용은 거기서
        고치고, 하객에게 보이고 싶지 않으면 &lsquo;하객 화면에도 보이기&rsquo;를 끄세요.
      </p>
    )

  return (
    <>
      <TextField
        label="제목"
        value={config.title}
        maxLength={30}
        onChange={(title) => set({ title })}
      />
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
        항목이 3개 이상이면 하객 화면에서 탭으로 나눠 보여요. 본문의 전화번호 · 인터넷 주소는 눌러서
        열 수 있어요.
      </p>
      {config.items.map((it, i) => (
        <ItemCard
          key={i}
          title={`안내 ${i + 1}`}
          index={i}
          count={config.items.length}
          onMove={(a, b) => setItems((xs) => list.move(xs, a, b))}
          onRemove={(x) => setItems((xs) => list.remove(xs, x))}
        >
          <TextField
            label={`안내 ${i + 1} 제목`}
            value={it.title}
            maxLength={20}
            placeholder="예) 주차, 드레스 코드"
            onChange={(title) => setItems((xs) => list.set(xs, i, { title }))}
          />
          <TextArea
            label={`안내 ${i + 1} 내용`}
            value={it.body}
            maxLength={1000}
            rows={4}
            onChange={(body) => setItems((xs) => list.set(xs, i, { body }))}
          />
          <Toggle
            label="참석한 분에게만 보이기"
            checked={it.attendeesOnly}
            onChange={(attendeesOnly) => setItems((xs) => list.set(xs, i, { attendeesOnly }))}
          />
          {it.attendeesOnly ? (
            <small style={{ display: 'block', color: 'var(--muted)', marginTop: -6 }}>
              링크만 받은 사람 · 카톡 미리보기에는 나오지 않고, &apos;참석&apos;으로 응답한 분의
              기기에서만 열려요. (응답한 기기가 아니면 다시 응답해야 볼 수 있어요)
            </small>
          ) : null}
        </ItemCard>
      ))}
      {config.items.length < MAX_NOTICE_ITEMS ? (
        <AddButton
          label="안내 항목 추가"
          onClick={() => setItems((xs) => [...xs, { title: '', body: '', attendeesOnly: false }])}
        />
      ) : null}
      <TextField
        label="버튼 문구"
        hint="선택"
        value={config.buttonLabel}
        maxLength={20}
        placeholder="예) 메뉴 미리 보기"
        onChange={(buttonLabel) => set({ buttonLabel })}
      />
      <TextField
        label="버튼 링크"
        value={config.buttonUrl}
        maxLength={500}
        placeholder="https://"
        onChange={(buttonUrl) => set({ buttonUrl: buttonUrl.trim() })}
      />
      {urlError ? (
        <small style={{ display: 'block', color: '#d64545', marginTop: -10, marginBottom: 14 }}>
          https:// 로 시작하는 주소만 버튼으로 보여요.
        </small>
      ) : null}
    </>
  )
}
