'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * 요소가 화면에 rootMargin만큼 가까워지면 true가 된다 (한 번 true면 계속 true).
 * 첫 화면에 필요 없는 지도 SDK · 방명록 목록을 늦게 불러올 때 쓴다.
 * IntersectionObserver가 없는 오래된 브라우저에서는 바로 true.
 */
export function useNearViewport<T extends Element>(rootMargin = '300px') {
  const ref = useRef<T>(null)
  const [near, setNear] = useState(false)

  useEffect(() => {
    if (near) return
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true)
          io.disconnect()
        }
      },
      { rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [near, rootMargin])

  return [ref, near] as const
}
