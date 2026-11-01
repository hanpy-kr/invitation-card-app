import { z } from 'zod'

/**
 * 블록 타입 + zod 스키마. 웹(편집기 · 공개 페이지)과 API가 함께 씀.
 * 블록 config는 DB에 저장하기 전에 반드시 `parseBlockConfig`로 검증한다.
 */

export const EVENT_TYPES = ['wedding', 'dol', 'meetup', 'etc'] as const
export type EventType = (typeof EVENT_TYPES)[number]

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  wedding: '결혼식',
  dol: '돌잔치',
  meetup: '회식 · 동창회',
  etc: '기타 모임',
}

export const BLOCK_TYPES = [
  'cover',
  'greeting',
  'gallery',
  'location',
  'rsvp',
  'guestbook',
] as const
export type BlockType = (typeof BLOCK_TYPES)[number]

export const BLOCK_LABELS: Record<BlockType, string> = {
  cover: '표지',
  greeting: '인사말',
  gallery: '사진첩',
  location: '오시는 길',
  rsvp: '참석 여부',
  guestbook: '방명록',
}

export const MAX_GALLERY_IMAGES = 10
/** 무료 한도: 초대장 하나에 올릴 수 있는 사진 수 (표지 + 사진첩) */
export const PHOTO_LIMIT = 10

/** 업로드된 사진 참조. URL 대신 storage key를 저장하고, 표시할 때 공개 주소로 바꾼다. */
export const mediaRefSchema = z.object({
  id: z.string().uuid(),
  key: z.string().min(1).max(300),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
})
export type MediaRef = z.infer<typeof mediaRefSchema>

const shortText = (max: number) => z.string().trim().max(max)

export const coverConfigSchema = z.object({
  layout: z.enum(['photo', 'text']).default('photo'),
  image: mediaRefSchema.nullable().default(null),
  title: shortText(40).default(''),
  subtitle: shortText(60).default(''),
  showDate: z.boolean().default(true),
})

export const greetingConfigSchema = z.object({
  icon: z.enum(['flower', 'post', 'none']).default('flower'),
  title: shortText(30).default(''),
  message: shortText(1000).default(''),
  /** 주최자 이름. 결혼식은 [신랑, 신부]를 하트로 이어 보여 줌 */
  hosts: z.array(shortText(20)).max(4).default([]),
  hostSeparator: z.enum(['heart', 'dot']).default('dot'),
  showEventDate: z.boolean().default(true),
})

export const galleryConfigSchema = z.object({
  title: shortText(30).default('사진첩'),
  images: z.array(mediaRefSchema).max(MAX_GALLERY_IMAGES).default([]),
  layout: z.enum(['grid', 'slide']).default('grid'),
})

export const locationConfigSchema = z.object({
  title: shortText(30).default('오시는 길'),
  placeName: shortText(60).default(''),
  address: shortText(200).default(''),
  /** 층 · 홀 등 상세 위치 */
  detail: shortText(100).default(''),
  lat: z.number().min(-90).max(90).nullable().default(null),
  lng: z.number().min(-180).max(180).nullable().default(null),
  subway: shortText(500).default(''),
  bus: shortText(500).default(''),
  parking: shortText(500).default(''),
})

export const rsvpConfigSchema = z.object({
  title: shortText(30).default('참석 의사 전달'),
  message: shortText(200).default(''),
  askMeal: z.boolean().default(false),
  maxPartySize: z.number().int().min(1).max(10).default(5),
  /** 응답 마감일 (YYYY-MM-DD, 한국 시간 기준 그날 자정까지) */
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
})

export const guestbookConfigSchema = z.object({
  title: shortText(30).default('방명록'),
  message: shortText(200).default(''),
})

export const blockConfigSchemas = {
  cover: coverConfigSchema,
  greeting: greetingConfigSchema,
  gallery: galleryConfigSchema,
  location: locationConfigSchema,
  rsvp: rsvpConfigSchema,
  guestbook: guestbookConfigSchema,
} as const satisfies Record<BlockType, z.ZodType>

export type BlockConfigMap = { [K in BlockType]: z.infer<(typeof blockConfigSchemas)[K]> }
export type CoverConfig = BlockConfigMap['cover']
export type GreetingConfig = BlockConfigMap['greeting']
export type GalleryConfig = BlockConfigMap['gallery']
export type LocationConfig = BlockConfigMap['location']
export type RsvpConfig = BlockConfigMap['rsvp']
export type GuestbookConfig = BlockConfigMap['guestbook']

export type Block = {
  [K in BlockType]: {
    id: string
    type: K
    position: number
    visible: boolean
    config: BlockConfigMap[K]
  }
}[BlockType]

export function isBlockType(value: unknown): value is BlockType {
  return typeof value === 'string' && (BLOCK_TYPES as readonly string[]).includes(value)
}

/** 저장 전 검증. 실패하면 ZodError를 던진다. */
export function parseBlockConfig<K extends BlockType>(type: K, config: unknown): BlockConfigMap[K] {
  return blockConfigSchemas[type].parse(config) as BlockConfigMap[K]
}

/** DB에서 읽은 행을 표시용 Block으로. 깨진 config는 null(렌더링 생략). */
export function toBlock(row: {
  id: string
  type: string
  position: number
  visible: boolean
  config: unknown
}): Block | null {
  if (!isBlockType(row.type)) return null
  const parsed = blockConfigSchemas[row.type].safeParse(row.config)
  if (!parsed.success) return null
  return {
    id: row.id,
    type: row.type,
    position: row.position,
    visible: row.visible,
    config: parsed.data,
  } as Block
}

export function defaultBlockConfig<K extends BlockType>(type: K): BlockConfigMap[K] {
  return parseBlockConfig(type, {})
}

/** 블록 추가 · 수정 API 입력 */
export const blockInputSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('cover'), config: coverConfigSchema }),
  z.object({ type: z.literal('greeting'), config: greetingConfigSchema }),
  z.object({ type: z.literal('gallery'), config: galleryConfigSchema }),
  z.object({ type: z.literal('location'), config: locationConfigSchema }),
  z.object({ type: z.literal('rsvp'), config: rsvpConfigSchema }),
  z.object({ type: z.literal('guestbook'), config: guestbookConfigSchema }),
])
export type BlockInput = z.infer<typeof blockInputSchema>
