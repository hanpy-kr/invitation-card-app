import { relations } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
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
  kakaoId: text('kakao_id').notNull().unique(),
  nickname: text('nickname').notNull().default(''),
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
    coverMediaId: uuid('cover_media_id').references((): AnyPgColumn => media.id, {
      onDelete: 'set null',
    }),
    status: invitationStatusEnum('status').notNull().default('draft'),
    /** (2차) 카톡 공유 카드 직접 지정 {title, description, image}. 비어 있으면 자동 */
    share: jsonb('share').notNull().default({}),
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
    createdAt: createdAt(),
  },
  (t) => [index('rsvps_invitation_idx').on(t.invitationId)],
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

/** 하객 쓰기 API용 간단한 rate limit. key는 IP+slug+종류의 해시(원래 IP는 저장 안 함) */
export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  resetAt: timestamp('reset_at', { withTimezone: true }).notNull(),
})

export const usersRelations = relations(users, ({ many }) => ({
  invitations: many(invitations),
}))

export const invitationsRelations = relations(invitations, ({ one, many }) => ({
  owner: one(users, { fields: [invitations.ownerId], references: [users.id] }),
  blocks: many(blocks),
  rsvps: many(rsvps),
  guestbookEntries: many(guestbookEntries),
  coverMedia: one(media, { fields: [invitations.coverMediaId], references: [media.id] }),
}))

export const blocksRelations = relations(blocks, ({ one }) => ({
  invitation: one(invitations, { fields: [blocks.invitationId], references: [invitations.id] }),
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

export type User = typeof users.$inferSelect
export type Invitation = typeof invitations.$inferSelect
export type BlockRow = typeof blocks.$inferSelect
export type Media = typeof media.$inferSelect
export type Rsvp = typeof rsvps.$inferSelect
export type GuestbookEntry = typeof guestbookEntries.$inferSelect
