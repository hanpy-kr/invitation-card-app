'use client'

import { useEffect, useState } from 'react'

import {
  coverFits,
  coverSrc,
  coversForEvent,
  defaultCoverKey,
  findCover,
  type CoverDef,
} from '@/shared/covers'

import { coverTemplateLocked } from '@/shared/entitlements'
import { templateName } from '@/shared/cover-templates'

import CoverTemplatePicker from '../CoverTemplatePicker'
import { Segmented, Select, TextField, Toggle } from '../fields'
import { useEditorEnv } from '../context'
import { SingleImageField } from '../ImageFields'
import styles from './CoverForm.module.scss'
import { patcher, type FormProps } from './types'

/** 영문 이름: 영문 · 공백 · 하이픈만 (맨 앞은 글자) */
const cleanName = (v: string) => v.replace(/[^A-Za-z -]/g, '').replace(/^[ -]+/, '')
const cleanPlace = (v: string) => v.replace(/[^A-Za-z0-9 .,'&/#()-]/g, '')

export default function CoverForm({
  config,
  update,
  eventType,
  eventAt,
}: FormProps<'cover'> & { eventType: string; eventAt: string | null }) {
  const set = patcher(update)
  const env = useEditorEnv()
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const on = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
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
          // 결혼 표지 템플릿은 결혼 초대장에만 보임 (이미 템플릿으로 만든 초대장은 그대로 보임)
          ...(eventType === 'wedding' || config.layout === 'template'
            ? [{ value: 'template' as const, label: '템플릿' }]
            : []),
          // 결혼은 표지 템플릿이 생겨 디자인 표지를 새로 고르지 않음. 이미 디자인 표지인 초대장만 현재 선택으로 보임
          ...(eventType !== 'wedding' || config.layout === 'design'
            ? [{ value: 'design' as const, label: '디자인' }]
            : []),
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
      {eventType === 'wedding' && config.layout === 'design' ? (
        <p className={styles.hint} data-testid="design-cover-retire">
          이 초대장은 예전 디자인 표지를 쓰고 있어요. 다른 모양을 고르면 디자인 표지로 되돌아갈 수
          없어요.
        </p>
      ) : null}
      {config.layout === 'template' ? (
        <>
          <p className={styles.caption}>표지 템플릿</p>
          <CoverTemplatePicker
            value={config.template}
            onChange={(template) => set({ template })}
            lockedKeys={env.coverTemplates ? [] : ['a', 'c']}
          />
          {coverTemplateLocked(config.template, env) ? (
            <p className={styles.hint}>
              {templateName(config.template)} 표지는 누구나 골라서 미리 볼 수 있어요. 발행하려면
              프리미엄이 필요해요(2안은 무료).
            </p>
          ) : null}
          <TextField
            label="신랑 영문 이름"
            value={config.groomEn}
            maxLength={20}
            placeholder="예: HANUL"
            onChange={(v) => set({ groomEn: cleanName(v) })}
          />
          <TextField
            label="신부 영문 이름"
            value={config.brideEn}
            maxLength={20}
            placeholder="예: BORAM"
            onChange={(v) => set({ brideEn: cleanName(v) })}
          />
          {!config.groomEn.trim() || !config.brideEn.trim() ? (
            <p className={styles.hint} data-testid="cover-name-guide">
              영문 이름을 입력하면 표지에 이름이 들어가요. 영문 · 공백 · 하이픈만 쓸 수 있고, 자동
              변환은 하지 않아요.
            </p>
          ) : null}
          {!eventAt ? (
            <p className={styles.hint}>
              예식 일시를 정하면 날짜 · 요일 · 시간이 표지에 자동으로 들어가요.
            </p>
          ) : null}
          {config.template === 'b' ? (
            <>
              <TextField
                label="영문 예식장명 (선택)"
                value={config.venueEn}
                maxLength={40}
                placeholder="예: THE GARDEN HALL"
                onChange={(v) => set({ venueEn: cleanPlace(v) })}
              />
              <TextField
                label="영문 주소 (선택)"
                value={config.addressEn}
                maxLength={60}
                placeholder="예: 12 SAMPLE-RO, SEOUL"
                onChange={(v) => set({ addressEn: cleanPlace(v) })}
              />
              <p className={styles.hint}>비워 두면 그 줄은 표지에서 빠져요.</p>
            </>
          ) : null}
          <p className={styles.hint}>한국어 이름 · 예식장은 표지에 나오지 않고 본문에서 보여요.</p>
        </>
      ) : null}
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
              {reduced ? (
                <p className={styles.hint}>
                  이 기기는 &apos;동작 줄이기&apos;가 켜져 있어 효과가 보이지 않아요. 하객 화면에서는 설정에 따라 보여요.
                </p>
              ) : null}
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
      {config.layout === 'template' ? null : (
        <>
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
      )}
    </>
  )
}
