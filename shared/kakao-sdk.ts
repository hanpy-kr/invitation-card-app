/** 브라우저 전용: 카카오 SDK 스크립트를 한 번만 불러온다 */
const loading = new Map<string, Promise<void>>()

function loadScript(src: string): Promise<void> {
  const cached = loading.get(src)
  if (cached) return cached
  const p = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.crossOrigin = 'anonymous'
    s.onload = () => resolve()
    s.onerror = () => {
      loading.delete(src)
      s.remove()
      reject(new Error(`스크립트를 불러오지 못했어요: ${src}`))
    }
    document.head.appendChild(s)
  })
  loading.set(src, p)
  return p
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type KakaoGlobal = any
declare global {
  interface Window {
    kakao?: KakaoGlobal
    Kakao?: KakaoGlobal
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** 카카오 지도 SDK (window.kakao.maps) */
export async function loadKakaoMaps(appKey: string): Promise<KakaoGlobal> {
  await loadScript(
    `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false`,
  )
  const kakao = window.kakao
  if (!kakao?.maps) throw new Error('카카오 지도를 불러오지 못했어요.')
  await new Promise<void>((resolve) => kakao.maps.load(resolve))
  return kakao
}

/** 카카오 JS SDK (window.Kakao: 공유하기). 버전은 developers.kakao.com 다운로드 페이지 기준 */
export const KAKAO_JS_SDK_VERSION = '2.8.4'

export async function loadKakaoSdk(appKey: string): Promise<KakaoGlobal> {
  await loadScript(`https://t1.kakaocdn.net/kakao_js_sdk/${KAKAO_JS_SDK_VERSION}/kakao.min.js`)
  const Kakao = window.Kakao
  if (!Kakao) throw new Error('카카오 SDK를 불러오지 못했어요.')
  if (!Kakao.isInitialized()) Kakao.init(appKey)
  return Kakao
}
