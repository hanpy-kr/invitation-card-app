import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  date,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'

import { EVENT_TYPES } from '../../shared/blocks'

export const eventTypeEnum = pgEnum('event_type', EVENT_TYPES)
export const invitationStatusEnum = pgEnum('invitation_status', ['draft', 'published'])

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** (2차) 익명 사용자는 null — 카카오로 로그인하면 실제 계정으로 옮기고 지움 */
  kakaoId: text('kakao_id').unique(),
  nickname: text('nickname').notNull().default(''),
  /** (2차) 로그인 없이 만들기 시작한 임시 사용자 */
  anonymous: boolean('anonymous').notNull().default(false),
  /** (2차 P2⑦) 새 응답 카톡 알림용 카카오 refresh token. AES-256-GCM으로 암호화해 저장 (KAKAO_TOKEN_KEY) */
  kakaoRefreshEnc: text('kakao_refresh_enc'),
  /** 새 응답 카톡 알림 켜짐 (토큰이 있어야 실제로 보냄) */
  notifyRsvp: boolean('notify_rsvp').notNull().default(false),
  createdAt: createdAt(),
})

export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    slug: varchar('slug', { length: 8 }).notNull(),
    eventType: eventTypeEnum('event_type').notNull(),
    title: text('title').notNull().default(''),
    eventAt: timestamp('event_at', { withTimezone: true }),
    theme: text('theme').notNull().default('classic'),
    /** 제목 · 인사말 글씨체(shared/fonts.ts). null이면 테마의 기본 글씨체 */
    font: text('font'),
    coverMediaId: uuid('cover_media_id').references((): AnyPgColumn => media.id, {
      onDelete: 'set null',
    }),
    status: invitationStatusEnum('status').notNull().default('draft'),
    /** (2차) 처음 발행한 시각 — 운영 지표(주간 발행 수)용 */
    publishedAt: timestamp('published_at', { withTimezone: true }),
    /** (2차) 카톡 공유 카드 직접 지정 {title, description, image}. 비어 있으면 자동 */
    share: jsonb('share').notNull().default({}),
    /** (2차) '나도 만들기'로 만들었을 때 원본 초대장 slug — 하객 → 주최자 전환 지표 */
    createdFrom: varchar('created_from', { length: 8 }),
    /** (결제) 프리미엄이 적용된 결제 주문. null이면 무료(또는 결제 시작 전에 만든 초대장) */
    premiumOrderId: uuid('premium_order_id'),
    /** (결제) 복제 · 청첩장 모임 · 감사장을 만들 때 원본 초대장. 결제된 결혼 · 돌에서 파생된 청첩장 모임 · 감사장은 프리미엄 */
    derivedFromId: uuid('derived_from_id').references((): AnyPgColumn => invitations.id, {
      onDelete: 'set null',
    }),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex('invitations_slug_idx').on(t.slug),
    index('invitations_owner_idx').on(t.ownerId),
  ],
)

export const blocks = pgTable(
  'blocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invitationId: uuid('invitation_id')
      .notNull()
      .references(() => invitations.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    position: integer('position').notNull(),
    config: jsonb('config').notNull().default({}),
    visible: boolean('visible').notNull().default(true),
  },
  (t) => [index('blocks_invitation_position_idx').on(t.invitationId, t.position)],
)

export const media = pgTable(
  'media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    invitationId: uuid('invitation_id').references((): AnyPgColumn => invitations.id, {
      onDelete: 'cascade',
    }),
    storageKey: text('storage_key').notNull(),
    /** image: 사진 · audio: 배경음악(사진 한도에 세지 않음) */
    kind: text('kind').notNull().default('image'),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('media_invitation_idx').on(t.invitationId)],
)

export const rsvps = pgTable(
  'rsvps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invitationId: uuid('invitation_id')
      .notNull()
      .references(() => invitations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 20 }).notNull(),
    attending: boolean('attending').notNull(),
    partySize: smallint('party_size').notNull().default(1),
    meal: boolean('meal'),
    answers: jsonb('answers').notNull().default({}),
    /** (2차) 하객 수정 토큰의 SHA-256 해시. 원문은 하객 브라우저에만 */
    editTokenHash: text('edit_token_hash'),
    /** (2차) 회비 입금 확인 — 주최자만 체크 */
    paid: boolean('paid').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index('rsvps_invitation_idx').on(t.invitationId),
    index('rsvps_edit_token_idx').on(t.editTokenHash),
  ],
)

export const guestbookEntries = pgTable(
  'guestbook_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invitationId: uuid('invitation_id')
      .notNull()
      .references(() => invitations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 20 }).notNull(),
    message: varchar('message', { length: 300 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    hidden: boolean('hidden').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('guestbook_invitation_idx').on(t.invitationId, t.createdAt)],
)

/**
 * 하객 앨범: 로그인 없이 올린 사진. 하객은 자기 사진만 지울 수 있고(삭제 토큰은 하객 브라우저 localStorage에만,
 * DB에는 SHA-256 해시만), 주최자는 숨김 · 삭제 · 전체 받기를 할 수 있다. 파일 key는 album/{초대장}/{id}.webp
 */
export const albumPhotos = pgTable(
  'album_photos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invitationId: uuid('invitation_id')
      .notNull()
      .references(() => invitations.id, { onDelete: 'cascade' }),
    storageKey: text('storage_key').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    /** 같은 사진 위 썸네일(.thumb.webp)이 있음 */
    thumb: boolean('thumb').notNull().default(false),
    tokenHash: text('token_hash').notNull(),
    hidden: boolean('hidden').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('album_photos_invitation_idx').on(t.invitationId, t.createdAt)],
)

/**
 * (결제) 프리미엄 이용료 주문. dearday는 이용료만 받는다(축의금 · 회비는 하객 ↔ 주최자 직접).
 * status: pending(결제창 열기 전 · 승인 전) → paid(토스 승인) → canceled(환불). failed는 승인 실패 기록.
 * order_id는 토스에 보내는 주문번호(우리가 만듦), payment_key는 승인 뒤 토스가 준 값(서버에서만 씀).
 */
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // 초대장을 지우거나 탈퇴해도 결제 기록은 남긴다(전자상거래법 보관 의무) → set null
    invitationId: uuid('invitation_id').references(() => invitations.id, { onDelete: 'set null' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    orderId: text('order_id').notNull(),
    orderName: text('order_name').notNull(),
    /** 원 단위, 부가세 포함. 서버가 shared/pricing.ts로 계산한 값 */
    amount: integer('amount').notNull(),
    /** pending | paid | canceled | failed | cancel_requested(그로블에서 환불 요청됨) */
    status: text('status').notNull().default('pending'),
    /** 결제 수단 제공처: 'toss'(결제위젯) | 'groble'(그로블 결제 링크 · 웹훅) */
    provider: text('provider').notNull().default('toss'),
    /** 토스 paymentKey, 그로블이면 그로블 주문번호(merchantUid) */
    paymentKey: text('payment_key'),
    /** 결제 방법(카드 · 간편결제 등, 토스 응답의 method) */
    method: text('method'),
    receiptUrl: text('receipt_url'),
    /** 결제 전 '발행 후 환불 불가' 동의를 받은 시각 */
    refundAgreedAt: timestamp('refund_agreed_at', { withTimezone: true }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    failReason: text('fail_reason'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('orders_order_id_idx').on(t.orderId),
    index('orders_invitation_idx').on(t.invitationId),
    index('orders_user_idx').on(t.userId),
    // 같은 초대장에 결제 완료 주문은 하나만 (중복 결제 방지)
    uniqueIndex('orders_one_paid_idx').on(t.invitationId).where(sql`${t.status} = 'paid'`),
  ],
)

/** 결제 웹훅 중복 차단: 제공처가 보내는 멱등 키를 한 번만 처리 */
export const webhookEvents = pgTable('webhook_events', {
  key: text('key').primaryKey(),
  provider: text('provider').notNull(),
  createdAt: createdAt(),
})

/** 하객 쓰기 API용 간단한 rate limit. key는 IP+slug+종류의 해시(원래 IP는 저장 안 함) */
export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  resetAt: timestamp('reset_at', { withTimezone: true }).notNull(),
})

/** (2차) 날짜 · 장소 투표. 초대장당 투표 블록 1개라 invitation_id로 묶는다 */
export const pollVotes = pgTable(
  'poll_votes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invitationId: uuid('invitation_id')
      .notNull()
      .references(() => invitations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 20 }).notNull(),
    /** 고른 후보 id 목록 */
    choices: jsonb('choices').notNull().default([]),
    /** 하객 수정 토큰의 SHA-256 해시 */
    editTokenHash: text('edit_token_hash'),
    createdAt: createdAt(),
  },
  (t) => [
    index('poll_votes_invitation_idx').on(t.invitationId),
    index('poll_votes_edit_token_idx').on(t.editTokenHash),
  ],
)

/** (2차) 나눠 맡기: 한 행 = 한 사람이 항목 1개(수량 1)를 맡음. 취소 토큰 해시는 행마다 따로 */
export const bringClaims = pgTable(
  'bring_claims',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invitationId: uuid('invitation_id')
      .notNull()
      .references(() => invitations.id, { onDelete: 'cascade' }),
    /** 나눠 맡기 블록 항목 id (항목을 지우면 이 행은 집계에서 빠짐) */
    itemId: varchar('item_id', { length: 12 }).notNull(),
    name: varchar('name', { length: 20 }).notNull(),
    editTokenHash: text('edit_token_hash'),
    createdAt: createdAt(),
  },
  (t) => [
    index('bring_claims_invitation_idx').on(t.invitationId),
    index('bring_claims_edit_token_idx').on(t.editTokenHash),
  ],
)

/** (2차) 초대 명단 체크 — 대시보드 전용. 하객 화면 · 공개 API · OG에는 절대 싣지 않는다 (공개 쿼리는 이 테이블을 읽지 않음) */
export const inviteeLists = pgTable('invitee_lists', {
  invitationId: uuid('invitation_id')
    .primaryKey()
    .references(() => invitations.id, { onDelete: 'cascade' }),
  /** 이름 문자열 배열 (이름만, 연락처 없음) */
  names: jsonb('names').notNull().default([]),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/** (2차) 회비 정산 마무리 — 대시보드 전용. 지출 항목 [{name, amount}]. dearday는 돈을 받거나 보내지 않음(계산 · 복사만) */
export const settlements = pgTable('settlements', {
  invitationId: uuid('invitation_id')
    .primaryKey()
    .references(() => invitations.id, { onDelete: 'cascade' }),
  items: jsonb('items').notNull().default([]),
  /** 정산 내역을 하객 화면(안내 블록)에 보이기 */
  showGuests: boolean('show_guests').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/** (2차) 공동 편집자. 삭제 · 편집자 관리는 소유자만 */
export const invitationEditors = pgTable(
  'invitation_editors',
  {
    invitationId: uuid('invitation_id')
      .notNull()
      .references(() => invitations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.invitationId, t.userId] }),
    index('invitation_editors_user_idx').on(t.userId),
  ],
)

/** (2차) 하객 화면 일별 열람 수 (브라우저당 하루 한 번, sendBeacon) */
export const invitationViewsDaily = pgTable(
  'invitation_views_daily',
  {
    invitationId: uuid('invitation_id')
      .notNull()
      .references(() => invitations.id, { onDelete: 'cascade' }),
    /** 한국 날짜 */
    day: date('day').notNull(),
    views: integer('views').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.invitationId, t.day] })],
)

/** (2차) 사람별로 응답 화면을 마지막으로 본 시각 → 대시보드 '새 응답 n' */
export const invitationSeen = pgTable(
  'invitation_seen',
  {
    invitationId: uuid('invitation_id')
      .notNull()
      .references(() => invitations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    seenAt: timestamp('seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.invitationId, t.userId] })],
)

export const usersRelations = relations(users, ({ many }) => ({
  invitations: many(invitations),
}))

export const invitationsRelations = relations(invitations, ({ one, many }) => ({
  owner: one(users, { fields: [invitations.ownerId], references: [users.id] }),
  blocks: many(blocks),
  rsvps: many(rsvps),
  guestbookEntries: many(guestbookEntries),
  pollVotes: many(pollVotes),
  bringClaims: many(bringClaims),
  coverMedia: one(media, { fields: [invitations.coverMediaId], references: [media.id] }),
}))

export const blocksRelations = relations(blocks, ({ one }) => ({
  invitation: one(invitations, { fields: [blocks.invitationId], references: [invitations.id] }),
}))

export const bringClaimsRelations = relations(bringClaims, ({ one }) => ({
  invitation: one(invitations, { fields: [bringClaims.invitationId], references: [invitations.id] }),
}))

export const rsvpsRelations = relations(rsvps, ({ one }) => ({
  invitation: one(invitations, { fields: [rsvps.invitationId], references: [invitations.id] }),
}))

export const guestbookEntriesRelations = relations(guestbookEntries, ({ one }) => ({
  invitation: one(invitations, {
    fields: [guestbookEntries.invitationId],
    references: [invitations.id],
  }),
}))

export const pollVotesRelations = relations(pollVotes, ({ one }) => ({
  invitation: one(invitations, { fields: [pollVotes.invitationId], references: [invitations.id] }),
}))

export type User = typeof users.$inferSelect
export type Invitation = typeof invitations.$inferSelect
export type BlockRow = typeof blocks.$inferSelect
export type Order = typeof orders.$inferSelect
export type Media = typeof media.$inferSelect
export type Rsvp = typeof rsvps.$inferSelect
export type GuestbookEntry = typeof guestbookEntries.$inferSelect
