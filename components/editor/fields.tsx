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

/** 반복 항목 카드: 제목 + 위/아래/빼기 */
export function ItemCard({
  title,
  index,
  count,
  onMove,
  onRemove,
  children,
}: {
  title: string
  index: number
  count: number
  onMove: (from: number, to: number) => void
  onRemove: (index: number) => void
  children: React.ReactNode
}) {
  return (
    <div className={styles.item} role="group" aria-label={title}>
      <div className={styles['item-head']}>
        <strong>{title}</strong>
        <button
          type="button"
          aria-label={`${title} 위로`}
          disabled={index === 0}
          onClick={() => onMove(index, index - 1)}
        >
          ↑
        </button>
        <button
          type="button"
          aria-label={`${title} 아래로`}
          disabled={index === count - 1}
          onClick={() => onMove(index, index + 1)}
        >
          ↓
        </button>
        <button type="button" aria-label={`${title} 빼기`} onClick={() => onRemove(index)}>
          ✕
        </button>
      </div>
      {children}
    </div>
  )
}

export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className={styles.add} onClick={onClick}>
      + {label}
    </button>
  )
}

/** 공개 범위 안내 (계좌 · 연락처) */
export function PublicNotice({ children }: { children: React.ReactNode }) {
  return <p className={styles.notice}>{children}</p>
}

/** 배열 도우미 */
export const list = {
  move<T>(arr: T[], from: number, to: number): T[] {
    if (to < 0 || to >= arr.length) return arr
    const next = [...arr]
    const [x] = next.splice(from, 1)
    next.splice(to, 0, x)
    return next
  },
  set<T>(arr: T[], i: number, patch: Partial<T>): T[] {
    return arr.map((x, j) => (j === i ? { ...x, ...patch } : x))
  },
  remove<T>(arr: T[], i: number): T[] {
    return arr.filter((_, j) => j !== i)
  },
}
