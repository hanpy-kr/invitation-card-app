/** 서비스 기본 주소 (끝 / 없음) */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '')
}

export function absoluteUrl(path: string): URL {
  return new URL(path, siteUrl() + '/')
}

/** 로그인 후 돌아갈 경로: 같은 사이트 안의 경로만 허용 (오픈 리다이렉트 방지) */
export function safeNextPath(value: string | null | undefined, fallback = '/dashboard'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\'))
    return fallback
  return value
}

/** 사이트 주소가 localhost인지 (개발용 우회 기능의 안전장치) */
export function isLocalSite(): boolean {
  try {
    const host = new URL(siteUrl()).hostname
    return host === 'localhost' || host === '127.0.0.1'
  } catch {
    return false
  }
}
