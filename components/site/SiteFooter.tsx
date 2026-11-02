import Link from 'next/link'

import { BUSINESS, pending } from '@/shared/business'

import styles from './SiteFooter.module.scss'

export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <nav>
        <Link href="/terms">이용약관</Link>
        <Link href="/privacy">개인정보처리방침</Link>
      </nav>
      <p>
        상호 {BUSINESS.tradeName} · 대표 {pending(BUSINESS.representative)}
        <br />
        사업자등록번호 {pending(BUSINESS.registrationNumber)}
        <br />
        문의 <a href={`mailto:${BUSINESS.email}`}>{pending(BUSINESS.email)}</a>
      </p>
      <p>© 2026 {BUSINESS.tradeName}</p>
    </footer>
  )
}
