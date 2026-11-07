'use client'

import { useEffect } from 'react'

/** 열람 수: 화면이 뜬 뒤 브라우저당 하루 한 번만 sendBeacon (페이지 렌더링에 DB 쓰기 없음) */
export default function ViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
    const key = `dearday:view:${slug}`
    try {
      if (window.localStorage.getItem(key) === day) return
      window.localStorage.setItem(key, day)
    } catch {
      // 저장 못 하는 브라우저도 한 번은 센다
    }
    const url = `/api/i/${slug}/view`
    if (!navigator.sendBeacon?.(url)) void fetch(url, { method: 'POST', keepalive: true })
  }, [slug])
  return null
}
