import 'server-only'

import { and, asc, eq, inArray, lt, sql } from 'drizzle-orm'

import { toBlock, type Block, type MediaRef } from '@/shared/blocks'
import type { EditorBlock, InvitationMeta, SaveInvitationInput } from '@/shared/invitation'
import { buildTemplate } from '@/shared/templates'
import type { EventType } from '@/shared/blocks'

import { ApiError } from './api'
import { getDb, schema } from './db/client'
import { randomSlug } from './slug'
import { deleteStored } from './storage'

/** 업로드 직후 아직 블록에 저장되기 전인 사진을 지우지 않도록 두는 여유 시간 */
const MEDIA_GRACE_MS = 2 * 60 * 1000

export type EditableInvitation = {
  id: string
  slug: string
  status: 'draft' | 'published'
  meta: InvitationMeta
  blocks: EditorBlock[]
  mediaCount: number
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } }
  return e?.code === '23505' || e?.cause?.code === '23505'
}

/** 새 초대장 + 행사 종류별 기본 블록. slug는 만들 때 발급하고, 발행 전에는 공개 페이지가 404 */
export async function createInvitation(
  userId: string,
  eventType: EventType,
): Promise<{ id: string }> {
  const template = buildTemplate(eventType)
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await getDb().transaction(async (tx) => {
        const [inv] = await tx
          .insert(schema.invitations)
          .values({
            ownerId: userId,
            slug: randomSlug(),
            eventType,
            title: template.title,
            theme: template.theme,
          })
          .returning({ id: schema.invitations.id })
        await tx.insert(schema.blocks).values(
          template.blocks.map((b, position) => ({
            invitationId: inv.id,
            type: b.type,
            position,
            config: b.config,
          })),
        )
        return { id: inv.id }
      })
    } catch (err) {
      if (!isUniqueViolation(err)) throw err
    }
  }
  throw new Error('slug 발급 실패')
}

/** 편집기용: 내 초대장 + 블록 + 사진 수 (쿼리 1회) */
export async function getEditableInvitation(
  id: string,
  userId: string,
): Promise<EditableInvitation | null> {
  if (!isUuid(id)) return null
  const row = await getDb().query.invitations.findFirst({
    where: and(eq(schema.invitations.id, id), eq(schema.invitations.ownerId, userId)),
    with: {
      blocks: { orderBy: [asc(schema.blocks.position)] },
    },
    extras: {
      mediaCount:
        sql<number>`(select count(*)::int from ${schema.media} where ${schema.media.invitationId} = ${schema.invitations.id})`.as(
          'media_count',
        ),
    },
  })
  if (!row) return null
  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    meta: {
      title: row.title,
      eventType: row.eventType,
      eventAt: row.eventAt ? row.eventAt.toISOString() : null,
      theme: row.theme,
    },
    blocks: row.blocks
      .map(toBlock)
      .filter((b): b is Block => b !== null)
      .map(
        (b) => ({ id: b.id, type: b.type, visible: b.visible, config: b.config }) as EditorBlock,
      ),
    mediaCount: Number(row.mediaCount),
  }
}

export function collectMediaRefs(blocks: { type: string; config: unknown }[]): MediaRef[] {
  const refs: MediaRef[] = []
  for (const b of blocks) {
    if (b.type === 'cover') {
      const image = (b.config as { image?: MediaRef | null }).image
      if (image) refs.push(image)
    } else if (b.type === 'gallery') {
      refs.push(...((b.config as { images?: MediaRef[] }).images ?? []))
    }
  }
  return refs
}

/** 자동 저장: 메타 수정 + 블록 전체 교체 (한 트랜잭션) */
export async function saveInvitation(
  id: string,
  userId: string,
  input: SaveInvitationInput,
): Promise<{ updatedAt: string }> {
  if (!isUuid(id)) throw new ApiError(404, '초대장을 찾을 수 없어요.')

  const refs = collectMediaRefs(input.blocks)
  for (const ref of refs) {
    if (!ref.key.startsWith(`inv/${id}/`) && !ref.key.startsWith('samples/')) {
      throw new ApiError(400, '다른 초대장의 사진은 쓸 수 없어요.')
    }
  }
  const ids = new Set(input.blocks.map((b) => b.id))
  if (ids.size !== input.blocks.length) throw new ApiError(400, '블록 id가 중복됐어요.')

  const cover = input.blocks.find((b) => b.type === 'cover' && b.visible)
  const coverMediaId = cover?.type === 'cover' ? (cover.config.image?.id ?? null) : null

  const updatedAt = await getDb().transaction(async (tx) => {
    const [inv] = await tx
      .update(schema.invitations)
      .set({
        title: input.meta.title,
        eventType: input.meta.eventType,
        eventAt: input.meta.eventAt ? new Date(input.meta.eventAt) : null,
        theme: input.meta.theme,
        // 표지 사진이 이 초대장의 사진일 때만 연결 (없으면 null)
        coverMediaId: coverMediaId
          ? sql`(select ${schema.media.id} from ${schema.media} where ${schema.media.id} = ${coverMediaId} and ${schema.media.invitationId} = ${id})`
          : null,
      })
      .where(and(eq(schema.invitations.id, id), eq(schema.invitations.ownerId, userId)))
      .returning({ updatedAt: schema.invitations.updatedAt })
    if (!inv) throw new ApiError(404, '초대장을 찾을 수 없어요.')

    await tx.delete(schema.blocks).where(eq(schema.blocks.invitationId, id))
    if (input.blocks.length > 0) {
      await tx.insert(schema.blocks).values(
        input.blocks.map((b, position) => ({
          id: b.id,
          invitationId: id,
          type: b.type,
          position,
          visible: b.visible,
          config: b.config,
        })),
      )
    }
    return inv.updatedAt
  })

  await cleanupUnusedMedia(id)
  return { updatedAt: updatedAt.toISOString() }
}

/** 블록에서 빠진 사진 정리 (방금 올린 사진은 MEDIA_GRACE_MS 동안 보존) */
export async function cleanupUnusedMedia(invitationId: string): Promise<void> {
  const db = getDb()
  const blockRows = await db
    .select({ type: schema.blocks.type, config: schema.blocks.config })
    .from(schema.blocks)
    .where(
      and(
        eq(schema.blocks.invitationId, invitationId),
        inArray(schema.blocks.type, ['cover', 'gallery']),
      ),
    )
  const used = new Set(collectMediaRefs(blockRows).map((r) => r.id))

  const stale = await db
    .select({ id: schema.media.id, key: schema.media.storageKey })
    .from(schema.media)
    .where(
      and(
        eq(schema.media.invitationId, invitationId),
        lt(schema.media.createdAt, new Date(Date.now() - MEDIA_GRACE_MS)),
      ),
    )
  const unused = stale.filter((m) => !used.has(m.id))
  if (unused.length === 0) return

  await db.delete(schema.media).where(
    inArray(
      schema.media.id,
      unused.map((m) => m.id),
    ),
  )
  await deleteStored(unused.map((m) => m.key))
}

export async function setPublished(
  id: string,
  userId: string,
  published: boolean,
): Promise<{ slug: string; status: 'draft' | 'published' }> {
  if (!isUuid(id)) throw new ApiError(404, '초대장을 찾을 수 없어요.')
  const [row] = await getDb()
    .update(schema.invitations)
    .set({ status: published ? 'published' : 'draft' })
    .where(and(eq(schema.invitations.id, id), eq(schema.invitations.ownerId, userId)))
    .returning({ slug: schema.invitations.slug, status: schema.invitations.status })
  if (!row) throw new ApiError(404, '초대장을 찾을 수 없어요.')
  return row
}

export async function deleteInvitation(id: string, userId: string): Promise<void> {
  if (!isUuid(id)) throw new ApiError(404, '초대장을 찾을 수 없어요.')
  const db = getDb()
  const keys = await db
    .select({ key: schema.media.storageKey })
    .from(schema.media)
    .innerJoin(schema.invitations, eq(schema.invitations.id, schema.media.invitationId))
    .where(and(eq(schema.media.invitationId, id), eq(schema.invitations.ownerId, userId)))
  const deleted = await db
    .delete(schema.invitations)
    .where(and(eq(schema.invitations.id, id), eq(schema.invitations.ownerId, userId)))
    .returning({ id: schema.invitations.id })
  if (deleted.length === 0) throw new ApiError(404, '초대장을 찾을 수 없어요.')
  await deleteStored(keys.map((k) => k.key))
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}
