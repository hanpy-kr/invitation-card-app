import classNames from 'classnames/bind'

import styles from './Section.module.scss'

const cx = classNames.bind(styles)

export default function Section({
  children,
  className,
  title,
  id,
}: {
  children: React.ReactNode
  className?: string
  title?: string | null
  id?: string
}) {
  return (
    <section id={id} className={cx('container', className)}>
      {/* 제목이 비어 있으면 제목 영역 자체를 그리지 않음 (레거시 `title !== null` 버그 수정) */}
      {title ? <h2 className={cx('txt-title')}>{title}</h2> : null}
      {children}
    </section>
  )
}
