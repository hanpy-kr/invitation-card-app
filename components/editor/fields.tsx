'use client'

import { useId } from 'react'

import styles from './fields.module.scss'

type Base = { label: string; hint?: string }

export function TextField({
  label,
  hint,
  value,
  onChange,
  maxLength,
  placeholder,
  type = 'text',
}: Base & {
  value: string
  onChange: (v: string) => void
  maxLength?: number
  placeholder?: string
  type?: 'text' | 'date' | 'time'
}) {
  const id = useId()
  return (
    <label className={styles.field} htmlFor={id}>
      <span>
        {label} {hint ? <em className={styles.hint}>{hint}</em> : null}
      </span>
      <input
        id={id}
        className={styles.input}
        type={type}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

export function TextArea({
  label,
  hint,
  value,
  onChange,
  maxLength,
  rows = 6,
  placeholder,
}: Base & {
  value: string
  onChange: (v: string) => void
  maxLength: number
  rows?: number
  placeholder?: string
}) {
  const id = useId()
  return (
    <label className={styles.field} htmlFor={id}>
      <span>
        {label} {hint ? <em className={styles.hint}>{hint}</em> : null}
      </span>
      <textarea
        id={id}
        className={styles.textarea}
        value={value}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <small className={styles.counter}>
        {value.length} / {maxLength}
      </small>
    </label>
  )
}

export function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: Base & { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const id = useId()
  return (
    <label className={styles.field} htmlFor={id}>
      <span>{label}</span>
      <select
        id={id}
        className={styles.select}
        value={String(value)}
        onChange={(e) => {
          const found = options.find((o) => String(o.value) === e.target.value)
          if (found) onChange(found.value)
        }}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: Base & { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className={styles.field} role="group" aria-label={label}>
      <span>{label}</span>
      <div className={styles.segmented}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className={styles.toggle}>
      <span>{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  )
}

export function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className={styles.row}>{children}</div>
}
