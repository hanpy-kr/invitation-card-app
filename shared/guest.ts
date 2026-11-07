import { z } from 'zod'

import { GUEST_LIMITS } from './guest-rules'

/** 하객 쓰기 API 입력 (블록 UI · API 공용). 연락처는 받지 않는다 */
const name = z
  .string()
  .trim()
  .min(1, '이름을 적어 주세요.')
  .max(GUEST_LIMITS.name, `이름은 ${GUEST_LIMITS.name}자까지예요.`)

export const rsvpInputSchema = z.object({
  name,
  attending: z.boolean(),
  partySize: z.number().int().min(1).max(10),
  /** 식사 여부: 예 / 아니오 / 미정(null). 주최자가 묻지 않으면 무시 */
  meal: z.boolean().nullable(),
  /** 주최자가 만든 질문의 답 {질문id: 값}. 질문에 맞는지는 서버가 config로 다시 확인 */
  answers: z
    .record(z.string().max(12), z.union([z.string().max(200), z.number()]))
    .refine((a) => Object.keys(a).length <= 10)
    .default({}),
  /** 같은 기기에서 다시 보내면 이전 응답을 고친다 */
  editToken: z.string().max(500).optional(),
})
export type RsvpInput = z.infer<typeof rsvpInputSchema>

export const guestbookInputSchema = z.object({
  name,
  message: z
    .string()
    .trim()
    .min(1, '메시지를 적어 주세요.')
    .max(GUEST_LIMITS.message, `메시지는 ${GUEST_LIMITS.message}자까지예요.`),
  password: z.string().min(GUEST_LIMITS.passwordMin).max(GUEST_LIMITS.passwordMax),
})
export type GuestbookInput = z.infer<typeof guestbookInputSchema>

export const rsvpCancelSchema = z.object({ editToken: z.string().min(1).max(500) })

export const guestbookDeleteSchema = z.object({ password: z.string().min(1).max(20) })

export { isPastDeadline, type GuestbookEntryView } from './guest-rules'
