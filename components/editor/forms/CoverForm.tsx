'use client'

import { coverSrc, coversForEvent, defaultCoverKey, findCover } from '@/shared/covers'

import { Segmented, TextField, Toggle } from '../fields'
import { SingleImageField } from '../ImageFields'
import styles from './CoverForm.module.scss'
import { patcher, type FormProps } from './types'

export default function CoverForm({
  config,
  update,
  eventType,
}: FormProps<'cover'> & { eventType: string }) {
  const set = patcher(update)
  // 지워진 표지 key를 가리키면 아무것도 고르지 않은 상태로 보여 줌 (초대장에는 글자만 표지로 나옴)
  const selected = findCover(config.designKey)
  return (
    <>
      <Segmented
        label="표지 모양"
        value={config.layout}
        options={[
          { value: 'design', label: '디자인' },
          { value: 'photo', label: '사진' },
          { value: 'text', label: '글자만' },
        ]}
        onChange={(layout) =>
          // 디자인으로 바꿀 때 고른 게 없으면 이 행사에 가장 어울리는 표지
          set(
            layout === 'design' && !selected
              ? {
                  layout,
                  designKey:
                    defaultCoverKey(eventType) ?? coversForEvent(eventType)[0]?.key ?? null,
                }
              : { layout },
          )
        }
      />
      {config.layout === 'design' ? (
        <>
          <div className={styles.grid} role="group" aria-label="표지 디자인">
            {coversForEvent(eventType).map((c) => (
              <button
                key={c.key}
                type="button"
                aria-pressed={c.key === selected?.key}
                aria-label={`${c.name} 표지`}
                onClick={() => set({ designKey: c.key })}
              >
                <img src={coverSrc(c, 800)} alt="" loading="lazy" width={800} height={1000} />
                <span>{c.name}</span>
              </button>
            ))}
          </div>
          <p className={styles.hint}>내 사진을 쓰고 싶으면 위에서 [사진]을 눌러 주세요.</p>
        </>
      ) : null}
      {config.layout === 'photo' ? (
        <SingleImageField
          label="표지 사진"
          value={config.image}
          onChange={(image) => set({ image })}
        />
      ) : null}
      <TextField
        label="큰 제목"
        value={config.title}
        maxLength={40}
        onChange={(title) => set({ title })}
      />
      <TextField
        label="작은 제목"
        value={config.subtitle}
        maxLength={60}
        onChange={(subtitle) => set({ subtitle })}
      />
      <Toggle
        label="날짜 · 요일 보이기"
        checked={config.showDate}
        onChange={(showDate) => set({ showDate })}
      />
    </>
  )
}
