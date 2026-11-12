'use client'

import {
  coverFits,
  coverSrc,
  coversForEvent,
  defaultCoverKey,
  findCover,
  type CoverDef,
} from '@/shared/covers'

import { Segmented, Select, TextField, Toggle } from '../fields'
import { useEditorEnv } from '../context'
import { SingleImageField } from '../ImageFields'
import styles from './CoverForm.module.scss'
import { patcher, type FormProps } from './types'

export default function CoverForm({
  config,
  update,
  eventType,
}: FormProps<'cover'> & { eventType: string }) {
  const set = patcher(update)
  const env = useEditorEnv()
  // 지워진 표지 key를 가리키면 아무것도 고르지 않은 상태로 보여 줌 (초대장에는 글자만 표지로 나옴)
  const selected = findCover(config.designKey)
  const all = coversForEvent(eventType)
  const fits = all.filter((c) => coverFits(c, eventType))
  const others = all.filter((c) => !coverFits(c, eventType))
  const grid = (list: CoverDef[]) =>
    list.length === 0 ? null : (
      <div className={styles.grid} role="group" aria-label="표지 디자인">
        {list.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={c.key === selected?.key}
            aria-label={`${c.name} 표지`}
            onClick={() => set({ designKey: c.key })}
          >
            <img
              src={coverSrc(c, 800)}
              alt=""
              loading="lazy"
              decoding="async"
              width={800}
              height={1000}
            />
            <span>{c.name}</span>
          </button>
        ))}
      </div>
    )
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
          {fits.length > 0 ? <p className={styles.caption}>이 행사에 어울리는 표지</p> : null}
          {grid(fits)}
          {others.length > 0 ? (
            <p className={styles.caption}>{fits.length > 0 ? '다른 표지' : '표지 디자인'}</p>
          ) : null}
          {grid(others)}
          <p className={styles.hint}>내 사진을 쓰고 싶으면 위에서 [사진]을 눌러 주세요.</p>
          {!env.introEffects ? (
            <p className={styles.hint}>
              봉투 열기 · 떨어지는 효과는 프리미엄에서 하객에게 보여요. 미리보기에서는 볼 수 있어요.
            </p>
          ) : null}
          <Segmented
            label="여는 방식"
            value={config.intro}
            options={[
              { value: 'none', label: '없음' },
              { value: 'seal', label: '도장 봉투' },
              { value: 'door', label: '리본 카드' },
              { value: 'book', label: '책 표지' },
            ]}
            onChange={(intro) => set({ intro })}
          />
          {config.intro !== 'none' ? (
            <TextField
              label="도장 글자 (최대 3자)"
              value={config.sealText}
              maxLength={3}
              onChange={(sealText) => set({ sealText })}
            />
          ) : null}
          {config.intro !== 'none' ? (
            <p className={styles.hint}>비워 두면 제목에서 처음 나오는 글자를 써요.</p>
          ) : null}
          <Select
            label="떨어지는 효과"
            value={config.effect}
            options={[
              { value: 'none', label: '없음' },
              { value: 'petal', label: '꽃잎' },
              { value: 'snow', label: '눈' },
              { value: 'party', label: '풍선 · 색종이' },
              { value: 'bubble', label: '비눗방울' },
              { value: 'leaf', label: '잎사귀' },
              { value: 'ginkgo', label: '은행잎' },
            ]}
            onChange={(effect) => set({ effect })}
          />
          {config.effect !== 'none' ? (
            <>
              <Segmented
                label="효과 세기"
                value={config.effectDensity}
                options={[
                  { value: 'low', label: '약하게' },
                  { value: 'mid', label: '보통' },
                  { value: 'high', label: '많이' },
                ]}
                onChange={(effectDensity) => set({ effectDensity })}
              />
              <Segmented
                label="효과 시간"
                value={config.effectDuration}
                options={[
                  { value: 'loop', label: '계속' },
                  { value: 'once', label: '처음 5초만' },
                ]}
                onChange={(effectDuration) => set({ effectDuration })}
              />
            </>
          ) : null}
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
