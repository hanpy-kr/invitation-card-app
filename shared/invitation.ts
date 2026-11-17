import { z } from 'zod'

import { BLOCK_TYPES, blockInputSchema, EVENT_TYPES, shareOverrideSchema } from './blocks'
import { FONT_KEYS } from './fonts'
import { THEME_KEYS } from './themes'

/** 편집기 · API 공용 입력 스키마 */
export const MAX_BLOCKS = 20

export const createInvitationSchema = z.object({
  eventType: z.enum(EVENT_TYPES),
  /** '나도 만들기': 원본 초대장 slug. 행사 종류 · 테마 · 블록 구성만 가져옴 */
  from: z
    .string()
    .regex(/^[a-z0-9]{8}$/)
    .optional(),
})

export const invitationMetaSchema = z.object({
  title: z.string().trim().max(60),
  eventType: z.enum(EVENT_TYPES),
  /** ISO 8601 (오프셋 포함) */
  eventAt: z.iso.datetime({ offset: true }).nullable(),
  theme: z.enum(THEME_KEYS as [string, ...string[]]),
  /** null이면 테마의 기본 글씨체 */
  font: z
    .enum(FONT_KEYS as [string, ...string[]])
    .nullable()
    .default(null),
  share: shareOverrideSchema.default({
    title: '',
    description: '',
    image: null,
    hideMadeWith: false,
  }),
})
export type InvitationMeta = z.infer<typeof invitationMetaSchema>

export const editorBlockSchema = z.intersection(
  z.object({ id: z.uuid(), visible: z.boolean() }),
  blockInputSchema,
)
export type EditorBlock = z.infer<typeof editorBlockSchema>

/** 자동 저장 본문: 메타 + 블록 전체(순서 = 배열 순서) */
export const saveInvitationSchema = z.object({
  meta: invitationMetaSchema,
  blocks: z.array(editorBlockSchema).max(MAX_BLOCKS),
})
export type SaveInvitationInput = z.infer<typeof saveInvitationSchema>

export const publishSchema = z.object({ published: z.boolean() })

/** 한 초대장에 하나만 둘 수 있는 블록 */
export const SINGLE_BLOCK_TYPES: readonly (typeof BLOCK_TYPES)[number][] = [
  'cover',
  'rsvp',
  'guestbook',
  'calendar',
  'vote',
  'bring',
  'music',
  'album',
]
