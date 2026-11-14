import classNames from 'classnames/bind'

import styles from './Section.module.scss'

const cx = classNames.bind(styles)

export default function Section({
  children,
  className,
  title,
  eyebrow,
  id,
}: {
  children: React.ReactNode
  className?: string
  title?: string | null
  /** 옛 영문 머리글(INVITATION · GALLERY …). 디자인 피드백으로 화면에 그리지 않음 — 블록 구분용 표시로만 남김 */
  eyebrow?: string
  id?: string
}) {
  return (
    <section id={id} className={cx('container', className)} data-block={eyebrow?.toLowerCase()}>
      {title ? (
        <header className={cx('head')} data-block={eyebrow?.toLowerCase()}>
          {/* 제목이 비어 있으면 제목 영역 자체를 그리지 않음 */}
          {title ? <h2 className={cx('txt-title')}>{title}</h2> : null}
        </header>
      ) : null}
      {children}
    </section>
  )
}

/** 가는 선 + 잎 장식 (인라인 SVG) */
export function LeafDivider() {
  return (
    <svg
      className={cx('leaf')}
      width="56"
      height="14"
      viewBox="0 0 56 14"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2 7h18M36 7h18" fill="none" stroke="currentColor" strokeWidth="0.8" />
      <path
        d="M28 2c3 2 4 6 0 10-4-4-3-8 0-10z"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}
