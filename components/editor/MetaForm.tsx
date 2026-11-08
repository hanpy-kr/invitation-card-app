'use client'

import { EVENT_TYPE_LABELS, EVENT_TYPE_ORDER } from '@/shared/blocks'
import { kstInputToIso, toKstDateString, toKstTimeString } from '@/shared/date'
import type { InvitationMeta } from '@/shared/invitation'
import { FONT_KEYS, FONTS } from '@/shared/fonts'
import { resolveFont, themesForEvent, THEMES } from '@/shared/themes'

import styles from './Editor.module.scss'
import fieldStyles from './fields.module.scss'
import { FieldRow, Select, TextField } from './fields'

export default function MetaForm({
  meta,
  onChange,
}: {
  meta: InvitationMeta
  onChange: (fn: (m: InvitationMeta) => InvitationMeta) => void
}) {
  const date = meta.eventAt ? toKstDateString(meta.eventAt) : ''
  const time = meta.eventAt ? toKstTimeString(meta.eventAt) : ''
  const current = resolveFont(meta.theme, meta.font)
  const set = (patch: Partial<InvitationMeta>) => onChange((m) => ({ ...m, ...patch }))

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>기본 정보</h2>
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
              <b style={{ fontFamily: `'${FONTS[key].family}'` }}>{FONTS[key].label}</b>
              <small>{FONTS[key].note}</small>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
