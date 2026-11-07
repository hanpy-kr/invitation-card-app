'use client'

import { EVENT_TYPE_LABELS, EVENT_TYPE_ORDER } from '@/shared/blocks'
import { kstInputToIso, toKstDateString, toKstTimeString } from '@/shared/date'
import type { InvitationMeta } from '@/shared/invitation'
import { THEME_KEYS, THEMES } from '@/shared/themes'

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
          {THEME_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={meta.theme === key}
              className={styles.swatch}
              onClick={() => set({ theme: key })}
            >
              <i style={{ background: THEMES[key].vars.accent }} />
              {THEMES[key].label}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
