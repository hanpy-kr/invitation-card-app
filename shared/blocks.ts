import { z } from 'zod'

import { PHOTO_LIMIT_CAP } from './entitlements'
import { QUESTION_LIMITS } from './rsvp-questions'

/**
 * 블록 타입 + zod 스키마. 웹(편집기 · 공개 페이지)과 API가 함께 씀.
 * 블록 config는 DB에 저장하기 전에 반드시 `parseBlockConfig`로 검증한다.
 */

/** DB enum 순서와 같아야 함 — 새 값은 맨 뒤에만 추가 (마이그레이션은 ADD VALUE만) */
export const EVENT_TYPES = [
  'wedding',
  'dol',
  'meetup',
  'etc',
  'yearend',
  'prewedding',
  'birthday',
  'housewarming',
] as const
export type EventType = (typeof EVENT_TYPES)[number]

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  wedding: '결혼식',
  dol: '돌잔치',
  meetup: '회식 · 동창회',
  etc: '기타 모임',
  yearend: '송년회 · 신년회',
  prewedding: '청첩장 모임',
  birthday: '생일',
  housewarming: '집들이',
}

/** 화면에 보여 줄 순서 (/new 선택 · 편집기) */
export const EVENT_TYPE_ORDER: readonly EventType[] = [
  'wedding',
  'yearend',
  'prewedding',
  'dol',
  'birthday',
  'housewarming',
  'meetup',
  'etc',
]

export const BLOCK_TYPES = [
  'cover',
  'greeting',
  'gallery',
  'location',
  'rsvp',
  'guestbook',
  'account',
  'notice',
] as const
export type BlockType = (typeof BLOCK_TYPES)[number]

export const BLOCK_LABELS: Record<BlockType, string> = {
  cover: '표지',
  greeting: '인사말',
  gallery: '사진첩',
  location: '오시는 길',
  rsvp: '참석 여부',
  guestbook: '방명록',
  account: '계좌 · 회비',
  notice: '안내',
}

/** 사진첩 스키마 상한. 실제 업로드 한도는 shared/entitlements.ts */
export const MAX_GALLERY_IMAGES = PHOTO_LIMIT_CAP

/** 업로드된 사진 참조. URL 대신 storage key를 저장하고, 표시할 때 공개 주소로 바꾼다. */
export const mediaRefSchema = z.object({
  id: z.string().uuid(),
  key: z.string().min(1).max(300),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
  /** 카톡 미리보기용 JPEG 사본(`*.share.jpg`)이 있음. 이 값이 없는 사진은 사본 이전에 올라간 것 */
  share: z.boolean().optional(),
  /** 사진첩 썸네일(`*.thumb.webp`)이 있음. 없으면 바둑판에도 원본을 씀 */
  thumb: z.boolean().optional(),
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
  /** 이 장소의 시간 (예: '오후 9시부터'). 1차 · 2차처럼 장소가 여러 개일 때 */
  time: shortText(30).default(''),
  address: shortText(200).default(''),
  /** 층 · 홀 등 상세 위치 */
  detail: shortText(100).default(''),
  lat: z.number().min(-90).max(90).nullable().default(null),
  lng: z.number().min(-180).max(180).nullable().default(null),
  subway: shortText(500).default(''),
  bus: shortText(500).default(''),
  parking: shortText(500).default(''),
})

export const rsvpQuestionSchema = z.object({
  id: z.string().regex(/^[a-z0-9]{4,12}$/),
  kind: z.enum(['choice', 'text', 'number']).default('choice'),
  label: shortText(40).default(''),
  options: z.array(shortText(30)).max(QUESTION_LIMITS.options).default([]),
  required: z.boolean().default(false),
  target: z.enum(['attending', 'absent', 'all']).default('attending'),
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
  /** 주최자가 만든 질문 (최대 5개). 답은 rsvps.answers에 {질문id: 값} */
  questions: z.array(rsvpQuestionSchema).max(QUESTION_LIMITS.count).default([]),
})

export const guestbookConfigSchema = z.object({
  title: shortText(30).default('방명록'),
  message: shortText(200).default(''),
})

export const MAX_ACCOUNT_GROUPS = 4
export const MAX_ACCOUNTS_PER_GROUP = 4

export const accountItemSchema = z.object({
  /** 관계 · 이름 (예: 신랑, 신랑 아버지 김철수) */
  relation: shortText(30).default(''),
  bank: shortText(20).default(''),
  number: z
    .string()
    .trim()
    .max(30)
    .regex(/^[0-9\- ]*$/, '계좌번호는 숫자와 - 만 넣어 주세요.')
    .default(''),
  holder: shortText(20).default(''),
  /**
   * 카카오페이 송금 링크. 입력 중에도 자동 저장되도록 형식은 여기서 막지 않고,
   * 하객 화면에서 https://qr.kakaopay.com/ 으로 시작할 때만 버튼을 보여 준다(shared/money.ts isKakaoPayUrl).
   */
  kakaopay: z.string().trim().max(200).default(''),
})
export type AccountItem = z.infer<typeof accountItemSchema>

export const accountGroupSchema = z.object({
  /** 그룹 이름 (예: 신랑 측, 신부 측, 회비) */
  label: shortText(20).default(''),
  accounts: z.array(accountItemSchema).max(MAX_ACCOUNTS_PER_GROUP).default([]),
})
export type AccountGroup = z.infer<typeof accountGroupSchema>

export const accountConfigSchema = z.object({
  title: shortText(30).default('마음 전하실 곳'),
  message: shortText(300).default(''),
  /** 1인 회비(원). 있으면 크게 보여 주고 토스 송금 금액에 채움 */
  perPerson: z.number().int().min(0).max(10_000_000).nullable().default(null),
  groups: z.array(accountGroupSchema).max(MAX_ACCOUNT_GROUPS).default([]),
})

export const MAX_NOTICE_ITEMS = 6

export const noticeConfigSchema = z.object({
  title: shortText(30).default('안내'),
  items: z
    .array(z.object({ title: shortText(20).default(''), body: shortText(1000).default('') }))
    .max(MAX_NOTICE_ITEMS)
    .default([]),
  /** 선택 버튼 1개. 주소가 http(s)로 시작할 때만 하객 화면에 보임 */
  buttonLabel: shortText(20).default(''),
  buttonUrl: z.string().trim().max(500).default(''),
})

export const blockConfigSchemas = {
  cover: coverConfigSchema,
  greeting: greetingConfigSchema,
  gallery: galleryConfigSchema,
  location: locationConfigSchema,
  rsvp: rsvpConfigSchema,
  guestbook: guestbookConfigSchema,
  account: accountConfigSchema,
  notice: noticeConfigSchema,
} as const satisfies Record<BlockType, z.ZodType>

export type BlockConfigMap = { [K in BlockType]: z.infer<(typeof blockConfigSchemas)[K]> }
export type CoverConfig = BlockConfigMap['cover']
export type GreetingConfig = BlockConfigMap['greeting']
export type GalleryConfig = BlockConfigMap['gallery']
export type LocationConfig = BlockConfigMap['location']
export type RsvpConfig = BlockConfigMap['rsvp']
export type GuestbookConfig = BlockConfigMap['guestbook']
export type AccountConfig = BlockConfigMap['account']
export type NoticeConfig = BlockConfigMap['notice']

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
  z.object({ type: z.literal('account'), config: accountConfigSchema }),
  z.object({ type: z.literal('notice'), config: noticeConfigSchema }),
])
export type BlockInput = z.infer<typeof blockInputSchema>
