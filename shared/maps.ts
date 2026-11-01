/** 지도 앱 길찾기 링크. 좌표가 없으면 주소 검색 링크로 대신한다. */
export type Place = { name: string; address: string; lat: number | null; lng: number | null }

const hasCoords = (p: Place): p is Place & { lat: number; lng: number } =>
  p.lat != null && p.lng != null

export function kakaoMapUrl(p: Place): string {
  if (hasCoords(p)) {
    return `https://map.kakao.com/link/to/${encodeURIComponent(p.name || p.address)},${p.lat},${p.lng}`
  }
  return `https://map.kakao.com/link/search/${encodeURIComponent(p.address || p.name)}`
}

export function naverMapUrl(p: Place): string {
  return `https://map.naver.com/p/search/${encodeURIComponent(p.address || p.name)}`
}

/** 티맵 앱 길안내 (앱이 있어야 열림, 좌표 필요) */
export function tmapUrl(p: Place): string | null {
  if (!hasCoords(p)) return null
  return `tmap://route?rGoName=${encodeURIComponent(p.name || p.address)}&rGoX=${p.lng}&rGoY=${p.lat}`
}
