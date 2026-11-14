import 'server-only'

import { randomUUID } from 'node:crypto'

import { and, asc, eq, inArray } from 'drizzle-orm'

import {
  parseBlockConfig,
  parseShareOverride,
  toBlock,
  type Block,
  type BlockInput,
} from '@/shared/blocks'
import { collectAudioRefs, collectMediaRefs } from '@/shared/media'
import { buildTemplate } from '@/shared/templates'

import { ApiError } from './api'
import { getDb, schema } from './db/client'
import { isUuid } from './editor'
import { randomSlug } from './slug'
import { copyStored } from './storage'

type Ref = { id: string; key: string }
type MediaMap = Map<string, { id: string; key: string }>

/** JSON 안의 사진 참조({id, key, …})를 새 사진으로 바꿈 */
function remap<T>(value: T, map: MediaMap): T {
  if (Array.isArray(value)) return value.map((v) => remap(v, map)) as T
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>
    if (typeof o.id === 'string' && typeof o.key === 'string' && map.has(o.id)) {
      const n = map.get(o.id)!
      return { ...o, id: n.id, key: n.key } as T
    }
    return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, remap(v, map)])) as T
  }
  return value
}

const isHost = (s: string | undefined) => Boolean(s && s.trim() && !/\[[^\]]*\]/.test(s))

/**
 * 내 초대장 복제 (mode=copy: 그대로, 응답 · 방명록 · 투표 결과는 빼고)
 * 또는 결혼 초대장에서 청첩장 모임 만들기 (mode=prewedding: 표지 사진 · 이름 · 테마만)
 * 사진은 저장소에서 새 key로 복사 — 한쪽을 지워도 다른 쪽 사진이 안 사라지게
 */
export async function duplicateInvitation(
  sourceId: string,
  userId: string,
  mode: 'copy' | 'prewedding' | 'thanks',
): Promise<{ id: string }> {
  if (!isUuid(sourceId)) throw new ApiError(404, '초대장을 찾을 수 없어요.')
  const db = getDb()
  const src = await db.query.invitations.findFirst({
    where: and(eq(schema.invitations.id, sourceId), eq(schema.invitations.ownerId, userId)),
    with: { blocks: { orderBy: [asc(schema.blocks.position)] } },
  })
  if (!src) throw new ApiError(404, '초대장을 찾을 수 없어요.')
  const blocks = src.blocks.map(toBlock).filter((b): b is Block => b !== null)
  const share = parseShareOverride(src.share)

  let draft: {
    title: string
    eventType: typeof src.eventType
    theme: string
    font: string | null
    eventAt: Date | null
    share: unknown
    blocks: (BlockInput & { visible: boolean })[]
  }
  if (mode === 'copy') {
    draft = {
      title: `${src.title} (복사본)`.slice(0, 60),
      eventType: src.eventType,
      theme: src.theme,
      font: src.font,
      eventAt: src.eventAt,
      share,
      blocks: blocks
        // 정산 내역(대시보드가 만든 안내)은 복사하지 않음
        .filter((b) => !(b.type === 'notice' && b.config.source === 'settlement'))
        .map((b) => ({
          type: b.type,
          visible: b.visible,
          // 투표는 확정 전 상태로 (표는 복사하지 않음)
          config: b.type === 'vote' ? { ...b.config, status: 'open', confirmedId: null } : b.config,
        })) as (BlockInput & { visible: boolean })[],
    }
  } else if (mode === 'prewedding') {
    if (src.eventType !== 'wedding')
      throw new ApiError(400, '청첩장 모임은 결혼 초대장에서만 만들 수 있어요.')
    const cover = blocks.find((b) => b.type === 'cover')
    const greeting = blocks.find((b) => b.type === 'greeting')
    const hosts = greeting?.type === 'greeting' ? greeting.config.hosts : []
    const [a, b] = [hosts[0], hosts[1]]
    const names = isHost(a) && isHost(b) ? ([a, b] as [string, string]) : null
    const fill = (s: string) =>
      names ? s.replaceAll('[신랑 이름]', names[0]).replaceAll('[신부 이름]', names[1]) : s
    const t = buildTemplate('prewedding')
    draft = {
      title: fill(t.title),
      eventType: 'prewedding',
      theme: src.theme,
      font: src.font,
      eventAt: null,
      share: { title: '', description: '', image: null, hideMadeWith: false },
      blocks: t.blocks.map((blk) => {
        let config = JSON.parse(fill(JSON.stringify(blk.config)))
        if (blk.type === 'cover' && cover?.type === 'cover' && cover.config.image)
          config = parseBlockConfig('cover', {
            ...config,
            layout: 'photo',
            image: cover.config.image,
          })
        return { ...blk, config, visible: true } as BlockInput & { visible: boolean }
      }),
    }
  } else {
    // 감사장: 결혼 · 돌 초대장에서 표지 사진 · 보내는 사람 · 사진첩을 가져옴 (내 초대장이라 가능)
    if (src.eventType !== 'wedding' && src.eventType !== 'dol')
      throw new ApiError(400, '감사장은 결혼 · 돌잔치 초대장에서만 만들 수 있어요.')
    const cover = blocks.find((b) => b.type === 'cover')
    const greeting = blocks.find((b) => b.type === 'greeting')
    const gallery = blocks.find((b) => b.type === 'gallery')
    const hosts = greeting?.type === 'greeting' ? greeting.config.hosts : []
    const t = buildTemplate('thanks')
    const named = hosts.filter(isHost)
    const title = named.length > 0 ? `${named.join(' · ')} 감사 인사` : t.title
    const message =
      src.eventType === 'wedding'
        ? '바쁘신 중에도 귀한 걸음 해 주시고\n따뜻한 마음을 보내 주셔서\n진심으로 감사드립니다.\n\n보내 주신 사랑 오래 간직하며\n행복하게 살겠습니다.'
        : '저희 아이의 첫 생일을\n함께 축하해 주셔서\n진심으로 감사드립니다.\n\n보내 주신 사랑 덕분에\n건강하고 밝게 자라겠습니다.'
    draft = {
      title: title.slice(0, 60),
      eventType: 'thanks',
      theme: src.theme,
      font: src.font,
      eventAt: null,
      share: { title: '', description: '', image: null, hideMadeWith: false },
      blocks: t.blocks.map((blk) => {
        let config = blk.config as Record<string, unknown>
        if (blk.type === 'cover' && cover?.type === 'cover' && cover.config.image)
          config = parseBlockConfig('cover', { ...config, image: cover.config.image })
        if (blk.type === 'greeting')
          config = parseBlockConfig('greeting', {
            ...config,
            message,
            ...(named.length > 0 ? { hosts } : {}),
          })
        if (blk.type === 'gallery' && gallery?.type === 'gallery')
          config = parseBlockConfig('gallery', {
            ...config,
            images: gallery.config.images,
            layout: gallery.config.layout,
          })
        return { ...blk, config, visible: true } as BlockInput & { visible: boolean }
      }),
    }
  }

  // 새 초대장 id를 먼저 정해 사진 key(inv/{id}/…)를 만든다
  const newId = randomUUID()
  const refs: Ref[] = [
    ...collectMediaRefs(draft.blocks),
    ...collectAudioRefs(draft.blocks),
    ...((draft.share as { image?: Ref | null }).image
      ? [(draft.share as { image: Ref }).image]
      : []),
  ]
  const ownIds = [...new Set(refs.filter((r) => !r.key.startsWith('samples/')).map((r) => r.id))]
  const rows = ownIds.length
    ? await db
        .select()
        .from(schema.media)
        .where(and(inArray(schema.media.id, ownIds), eq(schema.media.invitationId, sourceId)))
    : []
  const map: MediaMap = new Map()
  for (const m of rows) {
    const mid = randomUUID()
    const ext = m.storageKey.split('.').pop()
    map.set(m.id, { id: mid, key: `inv/${newId}/${mid}.${ext}` })
  }
  await copyStored(rows.map((m) => [m.storageKey, map.get(m.id)!.key]))

  const blocksOut = remap(draft.blocks, map)
  const shareOut = remap(draft.share, map)
  const coverRef = collectMediaRefs(blocksOut.filter((b) => b.type === 'cover' && b.visible))[0]

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await db.transaction(async (tx) => {
        await tx.insert(schema.invitations).values({
          id: newId,
          ownerId: userId,
          slug: randomSlug(),
          eventType: draft.eventType,
          title: draft.title,
          eventAt: draft.eventAt,
          theme: draft.theme,
          font: draft.font,
          share: shareOut,
          // 원본 기록: 결제된 결혼 · 돌에서 만든 청첩장 모임 · 감사장은 프리미엄이 같이 적용됨 (shared/entitlements.ts)
          derivedFromId: sourceId,
          status: 'draft',
        })
        if (rows.length > 0) {
          await tx.insert(schema.media).values(
            rows.map((m) => ({
              id: map.get(m.id)!.id,
              ownerId: userId,
              invitationId: newId,
              storageKey: map.get(m.id)!.key,
              kind: m.kind,
              width: m.width,
              height: m.height,
              sizeBytes: m.sizeBytes,
            })),
          )
        }
        if (coverRef && map.size > 0 && [...map.values()].some((v) => v.id === coverRef.id)) {
          await tx
            .update(schema.invitations)
            .set({ coverMediaId: coverRef.id })
            .where(eq(schema.invitations.id, newId))
        }
        await tx.insert(schema.blocks).values(
          blocksOut.map((b, position) => ({
            invitationId: newId,
            type: b.type,
            position,
            visible: b.visible,
            config: b.config,
          })),
        )
      })
      return { id: newId }
    } catch (err) {
      const e = err as { code?: string; cause?: { code?: string } }
      if (e?.code !== '23505' && e?.cause?.code !== '23505') throw err
    }
  }
  throw new Error('slug 발급 실패')
}
