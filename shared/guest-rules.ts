/**
 * 하객 입력 규칙 — zod 없이 (공개 초대장 JS를 가볍게 유지하려고 브라우저에서는 이것만 씀).
 * 서버는 shared/guest.ts의 zod 스키마로 한 번 더 검증한다.
 */
export const GUEST_LIMITS = { name: 20, message: 300, passwordMin: 4, passwordMax: 20 } as const

export function checkName(name: string): string | null {
  const v = name.trim()
  if (!v) return '이름을 적어 주세요.'
  if (v.length > GUEST_LIMITS.name) return `이름은 ${GUEST_LIMITS.name}자까지예요.`
  return null
}

export function checkGuestbook(input: {
  name: string
  message: string
  password: string
}): string | null {
  const nameError = checkName(input.name)
  if (nameError) return nameError
  const message = input.message.trim()
  if (!message) return '메시지를 적어 주세요.'
  if (message.length > GUEST_LIMITS.message) return `메시지는 ${GUEST_LIMITS.message}자까지예요.`
  if (input.password.length < GUEST_LIMITS.passwordMin)
    return `비밀번호는 ${GUEST_LIMITS.passwordMin}자 이상이에요.`
  if (input.password.length > GUEST_LIMITS.passwordMax)
    return `비밀번호는 ${GUEST_LIMITS.passwordMax}자까지예요.`
  return null
}

/** 응답 마감일(YYYY-MM-DD, 한국 시간 그날 끝까지)이 지났는지 */
export function isPastDeadline(deadline: string | null, now = new Date()): boolean {
  if (!deadline) return false
  return now.getTime() > new Date(`${deadline}T23:59:59.999+09:00`).getTime()
}

export type GuestbookEntryView = { id: string; name: string; message: string; createdAt: string }
