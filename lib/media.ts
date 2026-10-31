import 'server-only'

/** 서버에서 사진 공개 주소의 앞부분. R2 공개 도메인이 없으면 로컬 /uploads */
export function getMediaBaseUrl(): string {
  return process.env.R2_PUBLIC_BASE_URL ?? ''
}
