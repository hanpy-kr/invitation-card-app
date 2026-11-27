'use client'

import CoverTemplate from '@/components/blocks/CoverTemplate'
import type { CoverTemplateKey } from '@/shared/blocks'
import {
  COVER_TEMPLATES,
  coverTemplateText,
  SAMPLE_CHRISTMAS_COVER,
  SAMPLE_COVER,
  WEDDING_TEMPLATE_KEYS,
} from '@/shared/cover-templates'

import styles from './CoverTemplatePicker.module.scss'

const SAMPLE_TEXT = coverTemplateText(SAMPLE_COVER, SAMPLE_COVER.eventAt)
const SAMPLE_XMAS_TEXT = coverTemplateText(SAMPLE_CHRISTMAS_COVER, SAMPLE_CHRISTMAS_COVER.eventAt)

/**
 * 결혼 표지 1 · 2 · 3안 고르기 (새 초대장 · 편집기 공용). 가상의 이름(HANUL · BORAM)으로 실제 표지를 줄여서 보여 준다.
 * lockedKeys: 프리미엄이 필요한 안(고르기 · 미리보기는 누구나, 발행할 때만 필요)에 '프리미엄' 표시
 */
export default function CoverTemplatePicker({
  value,
  onChange,
  lockedKeys = [],
  keys,
}: {
  value: CoverTemplateKey | null
  onChange: (key: CoverTemplateKey) => void
  lockedKeys?: readonly CoverTemplateKey[]
  /** 보여 줄 안 (기본: 결혼 1 · 2 · 3안) */
  keys?: readonly CoverTemplateKey[]
}) {
  return (
    <div className={styles.grid} role="group" aria-label="표지 템플릿">
      {COVER_TEMPLATES.filter((t) => (keys ?? WEDDING_TEMPLATE_KEYS).includes(t.key)).map((t) => (
        <button
          key={t.key}
          type="button"
          aria-pressed={value === t.key}
          aria-label={`${t.name} 표지${lockedKeys.includes(t.key) ? ' (프리미엄)' : ''}`}
          onClick={() => onChange(t.key)}
        >
          <span className={styles.thumb} aria-hidden="true">
            <CoverTemplate template={t.key} text={t.key === 'x' ? SAMPLE_XMAS_TEXT : SAMPLE_TEXT} thumb />
          </span>
          <span className={styles.name}>
            {t.name}
            {lockedKeys.includes(t.key) ? <em>프리미엄</em> : <em data-free>무료</em>}
          </span>
        </button>
      ))}
    </div>
  )
}
