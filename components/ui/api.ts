'use client'

/** 브라우저 → 우리 API 호출. 실패하면 서버가 준 한국어 메시지로 에러를 던진다 */
export async function api<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? (init?.body === undefined ? 'GET' : 'POST'),
    headers: init?.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) {
    if (res.status === 401) {
      window.location.href = `/api/auth/kakao/login?next=${encodeURIComponent(window.location.pathname)}`
    }
    throw new Error(data.error ?? '잠시 후 다시 시도해 주세요.')
  }
  return data
}
