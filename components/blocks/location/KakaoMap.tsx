'use client'

import { useEffect, useState } from 'react'

import { loadKakaoMaps } from '@/shared/kakao-sdk'

import { useNearViewport } from '../common/useNearViewport'

/**
 * 위치 확인용 고정 지도 (스크롤을 방해하지 않도록 끌기 · 확대 끔). 실패하면 아무것도 안 그림.
 * 카카오 지도 SDK는 지도가 화면에 300px 안으로 가까워질 때 불러온다 (첫 화면 로딩에서 제외).
 */
export default function KakaoMap({
  appKey,
  lat,
  lng,
  className,
}: {
  appKey: string
  lat: number
  lng: number
  className?: string
}) {
  const [ref, near] = useNearViewport<HTMLDivElement>('300px')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!near) return
    let cancelled = false
    loadKakaoMaps(appKey)
      .then((kakao) => {
        if (cancelled || !ref.current) return
        const center = new kakao.maps.LatLng(lat, lng)
        const map = new kakao.maps.Map(ref.current, { center, level: 3, draggable: false })
        map.setZoomable(false)
        new kakao.maps.Marker({ position: center }).setMap(map)
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [near, appKey, lat, lng, ref])

  if (failed) return null
  return <div ref={ref} className={className} role="img" aria-label="행사 장소 지도" />
}
