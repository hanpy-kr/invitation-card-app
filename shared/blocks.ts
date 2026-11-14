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
  'thanks',
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
  thanks: '감사장',
}

/** 참석자 명단 공개 기본값: 모임형 켜짐, 결혼 · 돌 꺼짐 */
export function defaultShowAttendees(eventType: EventType): boolean {
  return eventType !== 'wedding' && eventType !== 'dol'
}

/** 화면에 보여 줄 순서 (/new 선택 · 편집기) */
export const EVENT_TYPE_ORDER: readonly EventType[] = [
  'wedding',
  'yearend',
  'prewedding',
  'dol',
  'birthday',
  'housewarming',
  'thanks',
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
  'calendar',
  'contact',
  'vote',
  'video',
  'music',
  'album',
  'timeline',
  'bring',
] as const
export type BlockType = (typeof BLOCK_TYPES)[number]

export const BLOCK_LABELS: Record<BlockType, string> = {
  cover: '표지',
  greeting: '인사말',
  gallery: '갤러리',
  location: '오시는 길',
  rsvp: '참석 여부',
  guestbook: '방명록',
  account: '계좌 · 회비',
  notice: '안내',
  calendar: '캘린더',
  contact: '연락하기',
  vote: '날짜 · 장소 투표',
  video: '영상',
  music: '배경음악',
  album: '하객 앨범',
  timeline: '진행 순서',
  bring: '나눠 맡기',
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

/** 카톡 공유 카드 직접 지정 (모두 선택). 비어 있으면 제목 · 날짜 · 표지 사진으로 자동 */
export const shareOverrideSchema = z.object({
  title: z.string().trim().max(60).default(''),
  description: z.string().trim().max(100).default(''),
  image: mediaRefSchema.nullable().default(null),
  /** 하단 'dearday로 만들었어요' 문구 숨기기 (프리미엄만 적용, 서버가 권한을 확인함). 카톡 카드와 같은 초대장 단위 설정이라 여기에 둠 */
  hideMadeWith: z.boolean().default(false),
})
export type ShareOverride = z.infer<typeof shareOverrideSchema>

export function parseShareOverride(value: unknown): ShareOverride {
  const r = shareOverrideSchema.safeParse(value ?? {})
  return r.success ? r.data : shareOverrideSchema.parse({})
}

export const INTRO_KINDS = ['none', 'seal', 'door', 'book'] as const
export type IntroKind = (typeof INTRO_KINDS)[number]
export const EFFECT_KINDS = ['none', 'petal', 'snow', 'party', 'bubble', 'leaf', 'ginkgo'] as const
export type EffectKind = (typeof EFFECT_KINDS)[number]

const shortText = (max: number) => z.string().trim().max(max)

export const coverConfigSchema = z.object({
  layout: z.enum(['photo', 'text', 'design']).default('photo'),
  /** layout 'design'일 때 shared/covers.ts 의 표지 key (config만 저장, 마이그레이션 없음) */
  designKey: z
    .string()
    .regex(/^[a-z0-9-]{1,30}$/)
    .nullable()
    .default(null),
  image: mediaRefSchema.nullable().default(null),
  title: shortText(40).default(''),
  subtitle: shortText(60).default(''),
  showDate: z.boolean().default(true),
  /** 첫 화면 여는 방식(봉투). 디자인 표지에서만 쓰며 기본은 없음 */
  intro: z.enum(INTRO_KINDS).default('none'),
  /** 표지 위에 떨어지는 효과. 디자인 표지에서만 쓰며 기본은 없음 */
  effect: z.enum(EFFECT_KINDS).default('none'),
  effectDensity: z.enum(['low', 'mid', 'high']).default('mid'),
  /** loop: 계속 · once: 처음 5초 뒤 1.6초에 걸쳐 사라짐 */
  effectDuration: z.enum(['loop', 'once']).default('loop'),
  /** 도장 글자(최대 3자). 비어 있으면 표지 제목의 첫 글자 */
  sealText: shortText(3).default(''),
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
  title: shortText(30).default('갤러리'),
  images: z.array(mediaRefSchema).max(MAX_GALLERY_IMAGES).default([]),
  /** grid: 정사각 바둑판 · ratio: 원본 비율(2열) · slide: 옆으로 넘겨 보기 */
  layout: z.enum(['grid', 'ratio', 'slide']).default('grid'),
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
  /**
   * 참석자 명단 공개 (이름만). 새 블록은 행사 종류별 기본값(defaultShowAttendees)으로 채우고,
   * 값이 없는 1차 블록은 꺼짐 — 안내 없이 응답한 하객 이름이 갑자기 공개되지 않게
   */
  showAttendees: z.boolean().default(false),
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
    .array(
      z.object({
        title: shortText(20).default(''),
        body: shortText(1000).default(''),
        /**
         * 참석 응답을 보낸 분에게만 보임. 공개 초대장 데이터에는 제목 · 본문을 싣지 않고(redactMemberOnly),
         * 참석 응답 토큰을 확인하는 API로만 내려 준다
         */
        attendeesOnly: z.boolean().default(false),
      }),
    )
    .max(MAX_NOTICE_ITEMS)
    .default([]),
  /** 선택 버튼 1개. 주소가 http(s)로 시작할 때만 하객 화면에 보임 */
  buttonLabel: shortText(20).default(''),
  buttonUrl: z.string().trim().max(500).default(''),
  /** 대시보드가 자동으로 만든 안내('settlement' = 정산 내역). 편집기에서는 내용을 고치지 않고 대시보드에서 고친다 */
  source: z.enum(['settlement']).nullable().default(null),
})

export const MAX_TIMELINE_ITEMS = 12

export const timelineConfigSchema = z.object({
  title: shortText(30).default('진행 순서'),
  items: z
    .array(
      z.object({
        /** 짧은 글 (예: 오후 7시) */
        time: shortText(12).default(''),
        title: shortText(30).default(''),
        body: shortText(200).default(''),
      }),
    )
    .max(MAX_TIMELINE_ITEMS)
    .default([]),
})

export const calendarConfigSchema = z.object({
  title: shortText(30).default(''),
  showDday: z.boolean().default(true),
})

export const MAX_CONTACTS = 8

export const contactConfigSchema = z.object({
  title: shortText(30).default('연락하기'),
  people: z
    .array(
      z.object({
        relation: shortText(20).default(''),
        name: shortText(20).default(''),
        phone: z
          .string()
          .trim()
          .max(20)
          .regex(/^[0-9\-+ ]*$/, '전화번호는 숫자와 - 만 넣어 주세요.')
          .default(''),
      }),
    )
    .max(MAX_CONTACTS)
    .default([]),
})

export const MAX_BRING_ITEMS = 20
export const MAX_BRING_NEED = 20

export const bringItemSchema = z.object({
  id: z.string().regex(/^[a-z0-9]{4,12}$/),
  name: shortText(30).default(''),
  /** 필요한 수 (이만큼 맡으면 '마감') */
  need: z.number().int().min(1).max(MAX_BRING_NEED).default(1),
})
export type BringItem = z.infer<typeof bringItemSchema>

export const bringConfigSchema = z.object({
  title: shortText(30).default('나눠 맡기'),
  message: shortText(200).default(''),
  items: z.array(bringItemSchema).max(MAX_BRING_ITEMS).default([]),
})

export const MAX_VOTE_OPTIONS = 6

export const voteOptionSchema = z.object({
  id: z.string().regex(/^[a-z0-9]{4,12}$/),
  /** 날짜 투표: 메모(예: 저녁) · 장소 투표: 장소 이름 · 자유 투표: 후보 글 */
  label: shortText(40).default(''),
  /** 날짜 투표의 후보 일시 (ISO, 오프셋 포함) */
  at: z.iso.datetime({ offset: true }).nullable().default(null),
  /** 장소 투표의 주소 */
  address: shortText(200).default(''),
})
export type VoteOption = z.infer<typeof voteOptionSchema>

export const voteConfigSchema = z.object({
  title: shortText(30).default('날짜 투표'),
  message: shortText(200).default(''),
  kind: z.enum(['date', 'place', 'text']).default('date'),
  options: z.array(voteOptionSchema).max(MAX_VOTE_OPTIONS).default([]),
  /** 여러 개 고르기 */
  multiple: z.boolean().default(true),
  /** 확정 상태 — 편집기가 아니라 대시보드 [확정]으로만 바뀜 (저장할 때 서버가 DB 값을 유지) */
  status: z.enum(['open', 'closed']).default('open'),
  confirmedId: z.string().max(12).nullable().default(null),
})

/** 배경음악 파일 한도 */
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024
export const AUDIO_TYPES = ['audio/mpeg', 'audio/mp4'] as const

export const videoConfigSchema = z.object({
  title: shortText(30).default('영상'),
  /** 유튜브 주소. 알아볼 수 없는 주소면 하객 화면에서 숨김(저장은 막지 않음) */
  url: z.string().trim().max(300).default(''),
  caption: shortText(100).default(''),
})

export const musicConfigSchema = z.object({
  /** 재생 버튼 옆에 보여 줄 곡 이름 */
  title: shortText(40).default(''),
  /** 주최자가 올린 mp3 · m4a (자동 재생 없음) */
  audio: mediaRefSchema.nullable().default(null),
})

/** 하객 앨범 한도: 초대장당 장수, IP당 하루 장수. 사진은 올리기 전 브라우저에서 긴 변 1600px webp로 줄임 */
export const ALBUM_MAX_PHOTOS = 200
export const ALBUM_IP_DAILY = 30

export const albumConfigSchema = z.object({
  title: shortText(30).default('하객 앨범'),
  message: shortText(200).default('오늘 찍으신 사진을 함께 나눠 주세요.'),
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
  calendar: calendarConfigSchema,
  contact: contactConfigSchema,
  vote: voteConfigSchema,
  video: videoConfigSchema,
  music: musicConfigSchema,
  album: albumConfigSchema,
  timeline: timelineConfigSchema,
  bring: bringConfigSchema,
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
export type TimelineConfig = BlockConfigMap['timeline']
export type CalendarConfig = BlockConfigMap['calendar']
export type ContactConfig = BlockConfigMap['contact']
export type VoteConfig = BlockConfigMap['vote']
export type BringConfig = BlockConfigMap['bring']
export type VideoConfig = BlockConfigMap['video']
export type MusicConfig = BlockConfigMap['music']
export type AlbumConfig = BlockConfigMap['album']

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
  z.object({ type: z.literal('calendar'), config: calendarConfigSchema }),
  z.object({ type: z.literal('contact'), config: contactConfigSchema }),
  z.object({ type: z.literal('vote'), config: voteConfigSchema }),
  z.object({ type: z.literal('video'), config: videoConfigSchema }),
  z.object({ type: z.literal('music'), config: musicConfigSchema }),
  z.object({ type: z.literal('album'), config: albumConfigSchema }),
  z.object({ type: z.literal('timeline'), config: timelineConfigSchema }),
  z.object({ type: z.literal('bring'), config: bringConfigSchema }),
])
export type BlockInput = z.infer<typeof blockInputSchema>

/**
 * 공개 초대장(서버 HTML · RSC 데이터 · OG · 공유 카드)에 실을 블록에서 '참석한 분에게만' 안내의 제목 · 본문을 지운다.
 * 항목 자리(attendeesOnly: true)만 남겨 하객 화면이 '참석자 전용 n개'를 알릴 수 있게 한다.
 * 공개 데이터를 만드는 곳은 이 함수를 반드시 거칠 것 (lib/invitations.ts getPublishedInvitation).
 */
export function redactMemberOnly(block: Block): Block {
  if (block.type !== 'notice') return block
  if (!block.config.items.some((it) => it.attendeesOnly)) return block
  return {
    ...block,
    config: {
      ...block.config,
      items: block.config.items.map((it) =>
        it.attendeesOnly ? { title: '', body: '', attendeesOnly: true } : it,
      ),
    },
  }
}
