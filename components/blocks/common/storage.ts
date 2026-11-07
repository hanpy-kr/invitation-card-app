/** 브라우저 저장소 (사생활 보호 모드 · 인앱 브라우저에서 실패할 수 있어 항상 try/catch) */
export function readLocal<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeLocal(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 저장 못 해도 기능에는 지장 없음
  }
}

export function removeLocal(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // 무시
  }
}

/** 하객 API 호출 (블록은 순수 표시용이라 편집기 api 도우미 대신 가볍게 따로 둠) */
export async function postJson<T>(url: string, body: unknown, method = 'POST'): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data.error ?? '잠시 후 다시 시도해 주세요.')
  return data
}
