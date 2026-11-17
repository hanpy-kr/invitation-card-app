'use client'

import { EVENT_TYPE_LABELS, EVENT_TYPE_ORDER } from '@/shared/blocks'
import { kstInputToIso, toKstDateString, toKstTimeString } from '@/shared/date'
import type { InvitationMeta } from '@/shared/invitation'
import { FONT_KEYS, FONTS, fontSample } from '@/shared/fonts'
import { resolveFont, themesForEvent, THEMES } from '@/shared/themes'

import styles from './Editor.module.scss'
import fieldStyles from './fields.module.scss'
import { FieldRow, Select, TextField } from './fields'

type Props = {
  meta: InvitationMeta
  onChange: (fn: (m: InvitationMeta) => InvitationMeta) => void
}

/** 선택된 칸 오른쪽 위의 금색 체크 */
function Check() {
  return (
    <svg className={styles.tick} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

/** BASICS · 기본 정보 */
export function BasicsForm({ meta, onChange }: Props) {
  const date = meta.eventAt ? toKstDateString(meta.eventAt) : ''
  const time = meta.eventAt ? toKstTimeString(meta.eventAt) : ''
  const set = (patch: Partial<InvitationMeta>) => onChange((m) => ({ ...m, ...patch }))
  return (
    <>
      <TextField
        label="초대장 제목"
        hint="카톡으로 보낼 때 보이는 제목"
        value={meta.title}
        maxLength={60}
        onChange={(title) => set({ title })}
      />
      <FieldRow>
        <TextField
          label="날짜"
          type="date"
          value={date}
          onChange={(d) => set({ eventAt: kstInputToIso(d, time) })}
        />
        <TextField
          label="시간"
          type="time"
          value={time}
          onChange={(t) => set({ eventAt: kstInputToIso(date, t) })}
        />
      </FieldRow>
      <Select
        label="행사 종류"
        value={meta.eventType}
        options={EVENT_TYPE_ORDER.map((t) => ({ value: t, label: EVENT_TYPE_LABELS[t] }))}
        onChange={(eventType) => set({ eventType })}
      />
    </>
  )
}

/** STYLE · 꾸미기: 테마 색 · 글씨체 (표지 사진은 Editor가 CoverForm을 위에 붙임) */
export function StyleForm({ meta, onChange }: Props) {
  const current = resolveFont(meta.theme, meta.font)
  const set = (patch: Partial<InvitationMeta>) => onChange((m) => ({ ...m, ...patch }))
  const sample = fontSample(meta.eventType)

  return (
    <>
      <div className={fieldStyles.field} role="radiogroup" aria-label="테마 색">
        <span>테마 색</span>
        <div className={styles.swatches}>
          {themesForEvent(meta.eventType).map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={meta.theme === key}
              className={styles.swatch}
              onClick={() => set({ theme: key, font: null })}
            >
              <i style={{ background: THEMES[key].vars.accent }} />
              {THEMES[key].label}
              {meta.theme === key ? <Check /> : null}
            </button>
          ))}
        </div>
      </div>
      <div className={fieldStyles.field} role="radiogroup" aria-label="글씨체">
        <span>제목 · 인사말 글씨체</span>
        {/* 고르는 칸 미리보기를 위해 이 칸이 열려 있는 동안 글씨체 CSS를 모두 불러옴 (글자 조각은 쓰는 만큼만) */}
        {FONT_KEYS.map((key) =>
          FONTS[key].css ? (
            <link key={key} rel="stylesheet" href={FONTS[key].css} precedence="font" />
          ) : null,
        )}
        <div className={styles.fonts}>
          {FONT_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={current === key}
              className={styles.fontOption}
              onClick={() => set({ font: key })}
            >
              {/* 글씨체 이름은 보여 주지 않고 견본 문구만 그 글씨로 */}
              <b style={{ fontFamily: `'${FONTS[key].family}'` }}>{sample}</b>
              <small>{FONTS[key].note}</small>
              {current === key ? <Check /> : null}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
