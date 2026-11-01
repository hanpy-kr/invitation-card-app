import { z } from 'zod'

/** 하객 쓰기 API 입력 (블록 UI · API 공용). 연락처는 받지 않는다 */
const name = z.string().trim().min(1, '이름을 적어 주세요.').max(20, '이름은 20자까지예요.')

export const rsvpInputSchema = z.object({
  name,
  attending: z.boolean(),
  partySize: z.number().int().min(1).max(10),
  /** 식사 여부: 예 / 아니오 / 미정(null). 주최자가 묻지 않으면 무시 */
  meal: z.boolean().nullable(),
  /** 같은 기기에서 다시 보내면 이전 응답을 고친다 */
  editToken: z.string().max(500).optional(),
})
export type RsvpInput = z.infer<typeof rsvpInputSchema>

export const guestbookInputSchema = z.object({
  name,
  message: z.string().trim().min(1, '메시지를 적어 주세요.').max(300, '메시지는 300자까지예요.'),
  password: z.string().min(4, '비밀번호는 4자 이상이에요.').max(20),
})
export type GuestbookInput = z.infer<typeof guestbookInputSchema>

export const guestbookDeleteSchema = z.object({ password: z.string().min(1).max(20) })

export type GuestbookEntryView = { id: string; name: string; message: string; createdAt: string }

/** 응답 마감일(YYYY-MM-DD, 한국 시간 그날 끝까지)이 지났는지 */
export function isPastDeadline(deadline: string | null, now = new Date()): boolean {
  if (!deadline) return false
  return now.getTime() > new Date(`${deadline}T23:59:59.999+09:00`).getTime()
}
