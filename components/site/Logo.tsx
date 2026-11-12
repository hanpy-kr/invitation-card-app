import Link from 'next/link'

import Seal from './Seal'
import styles from './Logo.module.scss'

/** 도장 + dearday(18px) + 디어데이(10px, 자간 0.3em) */
export default function Logo({
  href = '/',
  label = true,
}: {
  href?: string | null
  label?: boolean
}) {
  const body = (
    <>
      <Seal />
      {label ? (
        <span className={styles.words}>
          <span className={styles.name}>dearday</span>
          <span className={styles.ko}>디어데이</span>
        </span>
      ) : null}
    </>
  )
  return href ? (
    <Link href={href} className={styles.logo} aria-label="dearday 디어데이">
      {body}
    </Link>
  ) : (
    <span className={styles.logo}>{body}</span>
  )
}
