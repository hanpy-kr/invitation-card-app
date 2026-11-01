import 'server-only'

import { ApiError } from './api'

export type GeoResult = { name: string; address: string; lat: number; lng: number }

type KakaoDoc = {
  place_name?: string
  address_name: string
  road_address_name?: string
  road_address?: { address_name: string } | null
  x: string
  y: string
}

async function kakaoLocal(path: string, query: string): Promise<KakaoDoc[]> {
  const url = new URL(`https://dapi.kakao.com${path}`)
  url.searchParams.set('query', query)
  url.searchParams.set('size', '8')
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) {
    console.error('[geo]', res.status, await res.text().catch(() => ''))
    throw new ApiError(502, '주소 검색이 잠시 안 돼요. 직접 입력해 주세요.')
  }
  return ((await res.json()) as { documents: KakaoDoc[] }).documents
}

/** 카카오 로컬 API (서버 경유 — REST 키를 브라우저에 노출하지 않음). 장소 이름 → 없으면 주소로 */
export async function searchPlaces(query: string): Promise<GeoResult[]> {
  if (!process.env.KAKAO_REST_API_KEY)
    throw new ApiError(503, '주소 검색이 아직 준비되지 않았어요. 직접 입력해 주세요.')
  let docs = await kakaoLocal('/v2/local/search/keyword.json', query)
  if (docs.length === 0) docs = await kakaoLocal('/v2/local/search/address.json', query)
  return docs.map((d) => ({
    name: d.place_name ?? '',
    address: d.road_address_name || d.road_address?.address_name || d.address_name,
    lat: Number(d.y),
    lng: Number(d.x),
  }))
}
