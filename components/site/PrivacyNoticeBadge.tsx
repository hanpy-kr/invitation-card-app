'use client'

import { useEffect, useState } from 'react'

import { PRIVACY_NEXT } from '@/shared/privacy'

import styles from './SiteFooter.module.scss'

/** 개정 시행 전에만 푸터에 '개정 안내' 표시 (정적 페이지에서도 날짜가 지나면 사라지도록 브라우저에서 확인) */
export default function PrivacyNoticeBadge() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    setShow(Date.now() < new Date(PRIVACY_NEXT.effectiveAt).getTime())
  }, [])
  if (!show) return null
  return (
    <span className={styles.badge} title={`${PRIVACY_NEXT.short} 시행 개정 예정`}>
      개정 안내
    </span>
  )
}
