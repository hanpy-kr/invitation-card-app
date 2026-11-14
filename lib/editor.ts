import 'server-only'

import { and, asc, eq, inArray, lt, sql } from 'drizzle-orm'

import {
  isBlockType,
  parseBlockConfig,
  parseShareOverride,
  toBlock,
  type Block,
  type BlockType,
} from '@/shared/blocks'
import type { EditorBlock, InvitationMeta, SaveInvitationInput } from '@/shared/invitation'
import { findCover } from '@/shared/covers'
import { getEntitlements, type Plan } from '@/shared/entitlements'
import { priceFor, refundEligibility } from '@/shared/pricing'
import { collectAudioRefs, collectMediaRefs } from '@/shared/media'
import { buildFromLayout, buildTemplate } from '@/shared/templates'
import type { EventType } from '@/shared/blocks'

import { canEditWhere, getAccess } from './access'
import { canCheckout, derivedPremiumSql, hasPaidPremium, planOf } from './plan'
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
  /** 소유자인지 (편집자는 삭제 · 편집자 관리 못 함) */
  isOwner: boolean
  /** 사진 한도 (shared/entitlements.ts) */
  photoLimit: number
  /** 로그인 없이 만든 초대장 (발행하려면 카카오 로그인) */
  ownerAnonymous: boolean
  /** 결제 플랜과 권한 · 결제 안내 (shared/entitlements.ts · pricing.ts) */
  plan: Plan
  introEffects: boolean
  canHideMadeWith: boolean
  /** 결제 버튼을 보여 줄지(PAYMENTS_LIVE가 켜지고 아직 프리미엄이 아닐 때) · 가격 */
  upsell: { price: number } | null
  /** 결제한 초대장이면 환불 가능 여부 (지우기 확인창에서 안내) */
  paid: { refundable: boolean } | null
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } }
  return e?.code === '23505' || e?.cause?.code === '23505'
}

/** 새 초대장 + 행사 종류별 기본 블록. slug는 만들 때 발급하고, 발행 전에는 공개 페이지가 404 */
export async function createInvitation(
  userId: string,
  requestedType: EventType,
  from?: string,
): Promise<{ id: string }> {
  let eventType = requestedType
  let template: {
    title: string
    theme: string
    blocks: { type: string; config: unknown; visible?: boolean }[]
  } = buildTemplate(eventType)
  let createdFrom: string | null = null

  if (from) {
    // 원본에서 읽는 건 행사 종류 · 테마 · 블록 종류/순서/표시 여부뿐 (config는 select하지 않음)
    const source = await getDb().query.invitations.findFirst({
      where: and(eq(schema.invitations.slug, from), eq(schema.invitations.status, 'published')),
      columns: { slug: true, eventType: true, theme: true },
      with: {
        blocks: {
          columns: { type: true, visible: true },
          orderBy: [asc(schema.blocks.position)],
        },
      },
    })
    if (source) {
      eventType = source.eventType
      const layout = source.blocks.filter((b): b is { type: BlockType; visible: boolean } =>
        isBlockType(b.type),
      )
      const built = buildFromLayout(eventType, layout)
      // 원본의 표지 config에서는 '디자인 표지 key' 하나만 읽는다 (개인 정보가 아님, 목록에 있는 key만 인정)
      const [pick] = await getDb()
        .select({
          key: sql<
            string | null
          >`case when ${schema.blocks.config}->>'layout' = 'design' then ${schema.blocks.config}->>'designKey' end`,
        })
        .from(schema.blocks)
        .innerJoin(schema.invitations, eq(schema.invitations.id, schema.blocks.invitationId))
        .where(and(eq(schema.invitations.slug, source.slug), eq(schema.blocks.type, 'cover')))
        .limit(1)
      const picked = findCover(pick?.key)
      if (picked) {
        for (const b of built.blocks) {
          if (b.type === 'cover') {
            b.config = parseBlockConfig('cover', {
              ...b.config,
              layout: 'design',
              designKey: picked.key,
            })
          }
        }
      }
      template = { title: built.title, theme: source.theme, blocks: built.blocks }
      createdFrom = source.slug
    }
  }
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
            createdFrom,
          })
          .returning({ id: schema.invitations.id })
        await tx.insert(schema.blocks).values(
          template.blocks.map((b, position) => ({
            invitationId: inv.id,
            type: b.type,
            position,
            config: b.config,
            visible: b.visible ?? true,
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
    where: and(eq(schema.invitations.id, id), canEditWhere(userId)),
    with: {
      blocks: { orderBy: [asc(schema.blocks.position)] },
      owner: { columns: { anonymous: true } },
    },
    extras: {
      mediaCount:
        sql<number>`(select count(*)::int from media m where m.kind = 'image' and m.invitation_id = ${schema.invitations.id})`.as(
          'media_count',
        ),
      derivedPremium: derivedPremiumSql().as('derived_premium'),
    },
  })
  if (!row) return null
  // 결제한 초대장이면 지우기 전에 환불 안내를 보여 주기 위해 환불 가능 여부를 같이 준다 (소유자만)
  let paid: { refundable: boolean } | null = null
  if (row.premiumOrderId && row.ownerId === userId) {
    const [order] = await getDb()
      .select({ status: schema.orders.status, approvedAt: schema.orders.approvedAt })
      .from(schema.orders)
      .where(eq(schema.orders.id, row.premiumOrderId))
    if (order?.status === 'paid')
      paid = {
        refundable: refundEligibility({
          status: order.status,
          approvedAt: order.approvedAt,
          invitationPublishedAt: row.publishedAt,
        }).ok,
      }
  }
  const plan = planOf(row)
  const ent = getEntitlements({ plan, anonymous: Boolean(row.owner?.anonymous) })
  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    meta: {
      title: row.title,
      eventType: row.eventType,
      eventAt: row.eventAt ? row.eventAt.toISOString() : null,
      theme: row.theme,
      font: row.font,
      share: parseShareOverride(row.share),
    },
    blocks: row.blocks
      .map(toBlock)
      .filter((b): b is Block => b !== null)
      .map(
        (b) => ({ id: b.id, type: b.type, visible: b.visible, config: b.config }) as EditorBlock,
      ),
    mediaCount: Number(row.mediaCount),
    isOwner: row.ownerId === userId,
    photoLimit: ent.photoLimit,
    ownerAnonymous: Boolean(row.owner?.anonymous),
    plan,
    introEffects: ent.introEffects,
    canHideMadeWith: ent.canHideMadeWith,
    paid,
    upsell:
      !hasPaidPremium(row) && row.ownerId === userId && (await canCheckout(userId))
        ? { price: priceFor(row.eventType) }
        : null,
  }
}

/** 자동 저장: 메타 수정 + 블록 전체 교체 (한 트랜잭션) */
export async function saveInvitation(
  id: string,
  userId: string,
  input: SaveInvitationInput,
): Promise<{ updatedAt: string }> {
  if (!isUuid(id)) throw new ApiError(404, '초대장을 찾을 수 없어요.')

  const refs = [...collectMediaRefs(input.blocks), ...collectAudioRefs(input.blocks)]
  if (input.meta.share.image) refs.push(input.meta.share.image)
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
        font: input.meta.font,
        share: input.meta.share,
        // 표지 사진이 이 초대장의 사진일 때만 연결 (없으면 null)
        coverMediaId: coverMediaId
          ? sql`(select ${schema.media.id} from ${schema.media} where ${schema.media.id} = ${coverMediaId} and ${schema.media.invitationId} = ${id})`
          : null,
      })
      .where(and(eq(schema.invitations.id, id), canEditWhere(userId)))
      .returning({ updatedAt: schema.invitations.updatedAt })
    if (!inv) throw new ApiError(404, '초대장을 찾을 수 없어요.')

    // 투표 확정 상태는 대시보드에서만 바뀜 — 편집기가 보낸 값 대신 DB 값을 유지
    const [prevVote] = await tx
      .select({ config: schema.blocks.config })
      .from(schema.blocks)
      .where(and(eq(schema.blocks.invitationId, id), eq(schema.blocks.type, 'vote')))
      .limit(1)
    const voteState = prevVote
      ? (({ status, confirmedId }) => ({ status, confirmedId }))(
          parseBlockConfig('vote', prevVote.config),
        )
      : { status: 'open' as const, confirmedId: null }
    const blocksToSave = input.blocks.map((b) =>
      b.type === 'vote' ? { ...b, config: { ...b.config, ...voteState } } : b,
    )

    await tx.delete(schema.blocks).where(eq(schema.blocks.invitationId, id))
    if (blocksToSave.length > 0) {
      await tx.insert(schema.blocks).values(
        blocksToSave.map((b, position) => ({
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
        inArray(schema.blocks.type, ['cover', 'gallery', 'music']),
      ),
    )
  const used = new Set(
    [...collectMediaRefs(blockRows), ...collectAudioRefs(blockRows)].map((r) => r.id),
  )
  const [inv] = await db
    .select({ share: schema.invitations.share })
    .from(schema.invitations)
    .where(eq(schema.invitations.id, invitationId))
  const shareImage = parseShareOverride(inv?.share).image
  if (shareImage) used.add(shareImage.id)

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
  const access = await getAccess(id, userId)
  if (!access) throw new ApiError(404, '초대장을 찾을 수 없어요.')
  if (published && access.ownerAnonymous)
    throw new ApiError(403, '카카오로 로그인하면 발행하고 공유할 수 있어요.')
  const [row] = await getDb()
    .update(schema.invitations)
    .set({
      status: published ? 'published' : 'draft',
      // 처음 발행한 시각만 남김 (운영 지표)
      ...(published
        ? { publishedAt: sql`coalesce(${schema.invitations.publishedAt}, now())` }
        : {}),
    })
    .where(and(eq(schema.invitations.id, id), canEditWhere(userId)))
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
  const albumKeys = await db
    .select({ key: schema.albumPhotos.storageKey })
    .from(schema.albumPhotos)
    .innerJoin(schema.invitations, eq(schema.invitations.id, schema.albumPhotos.invitationId))
    .where(and(eq(schema.albumPhotos.invitationId, id), eq(schema.invitations.ownerId, userId)))
  const deleted = await db
    .delete(schema.invitations)
    .where(and(eq(schema.invitations.id, id), eq(schema.invitations.ownerId, userId)))
    .returning({ id: schema.invitations.id })
  if (deleted.length === 0) throw new ApiError(404, '초대장을 찾을 수 없어요.')
  await deleteStored([...keys, ...albumKeys].map((k) => k.key))
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

/** '나도 만들기' 안내용: 발행된 원본의 행사 종류 · 테마 · 블록 수 (내용은 읽지 않음) */
export async function getLayoutSource(slug: string) {
  if (!/^[a-z0-9]{8}$/.test(slug)) return null
  const row = await getDb().query.invitations.findFirst({
    where: and(eq(schema.invitations.slug, slug), eq(schema.invitations.status, 'published')),
    columns: { slug: true, eventType: true, theme: true },
    with: { blocks: { columns: { type: true }, where: eq(schema.blocks.visible, true) } },
  })
  if (!row) return null
  return {
    slug: row.slug,
    eventType: row.eventType,
    theme: row.theme,
    blockCount: row.blocks.length,
  }
}
