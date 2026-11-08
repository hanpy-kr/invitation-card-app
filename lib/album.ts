import 'server-only'

import { randomUUID } from 'node:crypto'

import { and, asc, count, desc, eq } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { ALBUM_IP_DAILY, ALBUM_MAX_PHOTOS } from '@/shared/blocks'
import { thumbKey } from '@/shared/media'

import { getAccess } from './access'
import { ApiError } from './api'
import { signPayload, verifyPayload } from './auth/token'
import { getDb, schema } from './db/client'
import { isUuid } from './editor'
import { hashGuestToken, isGuestToken, newGuestToken } from './guest-token'
import { presignPut } from './r2'
import { rateLimit } from './rate-limit'
import { deleteStored, readStored, storageMode, storedSize } from './storage'
import { MAX_THUMB_BYTES, MAX_UPLOAD_BYTES } from './uploads'

/**
 * 하객 앨범 (로그인 없음). 하객 브라우저가 긴 변 1600px webp로 줄인 뒤 R2에 직접 올린다.
 * 한도: 초대장당 ALBUM_MAX_PHOTOS장, IP당 하루 ALBUM_IP_DAILY장. 하객은 올릴 때 받은 삭제 토큰으로 자기 사진만 지운다.
 */
const EXT = { 'image/webp': 'webp', 'image/jpeg': 'jpg' } as const

export const albumPresignSchema = z.object({
  contentType: z.enum(['image/webp', 'image/jpeg']),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES, '사진이 너무 커요.'),
  thumbSize: z.number().int().positive().max(MAX_THUMB_BYTES).optional(),
})
export const albumCompleteSchema = z.object({
  token: z.string().min(10).max(2000),
  width: z.number().int().min(1).max(4000),
  height: z.number().int().min(1).max(4000),
})
export const albumDeleteSchema = z.object({ deleteToken: z.string().length(43) })

type AlbumToken = {
  inv: string
  pid: string
  key: string
  ct: string
  size: number
  tkey?: string
  tsize?: number
  exp: number
}

export type AlbumPhoto = {
  id: string
  key: string
  thumb: boolean
  w: number
  h: number
}

/** 발행된 초대장 중 하객 앨범 블록이 보이는 것 (쓰기 · 읽기 모두 이 조건) */
async function albumInvitation(slug: string): Promise<{ id: string }> {
  if (!/^[a-z0-9]{8}$/.test(slug)) throw new ApiError(404, '초대장을 찾을 수 없어요.')
  const row = await getDb().query.invitations.findFirst({
    where: and(eq(schema.invitations.slug, slug), eq(schema.invitations.status, 'published')),
    columns: { id: true },
    with: {
      blocks: {
        columns: { id: true },
        where: and(eq(schema.blocks.type, 'album'), eq(schema.blocks.visible, true)),
      },
    },
  })
  if (!row || row.blocks.length === 0) throw new ApiError(404, '앨범을 찾을 수 없어요.')
  return { id: row.id }
}

const toPhoto = (r: typeof schema.albumPhotos.$inferSelect): AlbumPhoto => ({
  id: r.id,
  key: r.storageKey,
  thumb: r.thumb,
  w: r.width,
  h: r.height,
})

/** 하객 화면: 숨기지 않은 사진, 최신순 (최대 한도 장수라 한 번에) */
export async function listAlbum(slug: string): Promise<AlbumPhoto[]> {
  const { id } = await albumInvitation(slug)
  const rows = await getDb()
    .select()
    .from(schema.albumPhotos)
    .where(and(eq(schema.albumPhotos.invitationId, id), eq(schema.albumPhotos.hidden, false)))
    .orderBy(desc(schema.albumPhotos.createdAt))
    .limit(ALBUM_MAX_PHOTOS)
  return rows.map(toPhoto)
}

async function photoCount(invitationId: string): Promise<number> {
  const [{ n }] = await getDb()
    .select({ n: count() })
    .from(schema.albumPhotos)
    .where(eq(schema.albumPhotos.invitationId, invitationId))
  return n
}

/** 업로드 주소 발급. IP당 하루 한도는 여기서 한 장마다 센다 */
export async function createAlbumUpload(
  req: NextRequest,
  slug: string,
  input: z.infer<typeof albumPresignSchema>,
) {
  const mode = storageMode()
  if (mode === 'none') throw new ApiError(503, '사진 저장소가 아직 연결되지 않았어요.')
  const { id } = await albumInvitation(slug)
  await rateLimit(req, 'album-day', { limit: ALBUM_IP_DAILY, windowSec: 86400 })
  if ((await photoCount(id)) >= ALBUM_MAX_PHOTOS)
    throw new ApiError(409, `앨범이 가득 찼어요. (최대 ${ALBUM_MAX_PHOTOS}장)`)

  const pid = randomUUID()
  const key = `album/${id}/${pid}.${EXT[input.contentType]}`
  const token = signPayload({
    inv: id,
    pid,
    key,
    ct: input.contentType,
    size: input.size,
    ...(input.thumbSize ? { tkey: thumbKey(key), tsize: input.thumbSize } : {}),
    exp: Math.floor(Date.now() / 1000) + 600,
  } satisfies AlbumToken)

  const local = (part: 'main' | 'thumb') =>
    `/api/i/${slug}/album/local?part=${part}&token=${encodeURIComponent(token)}`
  const [uploadUrl, thumbUploadUrl] =
    mode === 'r2'
      ? await Promise.all([
          presignPut(key, input.contentType, input.size),
          input.thumbSize ? presignPut(thumbKey(key), 'image/webp', input.thumbSize) : null,
        ])
      : [local('main'), input.thumbSize ? local('thumb') : null]
  return { uploadUrl, thumbUploadUrl, token }
}

export function readAlbumToken(token: string | null, slugInvId?: string): AlbumToken {
  const t = verifyPayload<AlbumToken>(token ?? undefined)
  if (!t || !isUuid(t.inv) || !isUuid(t.pid))
    throw new ApiError(400, '업로드 시간이 지났어요. 다시 올려 주세요.')
  if (slugInvId && t.inv !== slugInvId) throw new ApiError(403, '허용되지 않은 요청입니다.')
  return t
}

/** 로컬 개발용 PUT 대상 (토큰이 가리키는 key · 형식 · 최대 크기) */
export function albumLocalTarget(t: AlbumToken, part: 'main' | 'thumb') {
  if (part === 'thumb') {
    if (!t.tkey || !t.tsize) throw new ApiError(400, '썸네일을 올릴 수 없는 요청이에요.')
    return { key: t.tkey, ct: 'image/webp', size: t.tsize }
  }
  return { key: t.key, ct: t.ct, size: t.size }
}

export async function albumLocalInvitationCheck(slug: string, t: AlbumToken) {
  const { id } = await albumInvitation(slug)
  if (t.inv !== id) throw new ApiError(403, '허용되지 않은 요청입니다.')
}

/** 업로드 끝 → 등록. 삭제 토큰 원문은 이 응답에서만 나가고 DB에는 해시만 남는다 */
export async function completeAlbumUpload(
  slug: string,
  input: z.infer<typeof albumCompleteSchema>,
): Promise<{ photo: AlbumPhoto; deleteToken: string }> {
  const { id } = await albumInvitation(slug)
  const t = readAlbumToken(input.token, id)
  const size = await storedSize(t.key)
  if (size === null) throw new ApiError(400, '사진이 올라가지 않았어요. 다시 시도해 주세요.')
  if (size > MAX_UPLOAD_BYTES) throw new ApiError(400, '사진이 너무 커요.')
  const thumb = t.tkey ? (await storedSize(t.tkey)) !== null : false
  if ((await photoCount(id)) >= ALBUM_MAX_PHOTOS) {
    await deleteStored([t.key])
    throw new ApiError(409, `앨범이 가득 찼어요. (최대 ${ALBUM_MAX_PHOTOS}장)`)
  }
  const { token, hash } = newGuestToken()
  const [row] = await getDb()
    .insert(schema.albumPhotos)
    .values({
      id: t.pid,
      invitationId: id,
      storageKey: t.key,
      width: input.width,
      height: input.height,
      sizeBytes: size,
      thumb,
      tokenHash: hash,
    })
    .onConflictDoNothing()
    .returning()
  if (!row) throw new ApiError(409, '이미 등록된 사진이에요.')
  return { photo: toPhoto(row), deleteToken: token }
}

/** 하객: 내가 올린 사진 삭제 (브라우저에 있는 삭제 토큰으로만) */
export async function deleteOwnAlbumPhoto(
  req: NextRequest,
  slug: string,
  photoId: string,
  deleteToken: string,
): Promise<void> {
  if (!isUuid(photoId) || !isGuestToken(deleteToken))
    throw new ApiError(404, '사진을 찾을 수 없어요.')
  const { id } = await albumInvitation(slug)
  await rateLimit(req, `album-del:${slug}`, { limit: 30, windowSec: 600 })
  const [row] = await getDb()
    .delete(schema.albumPhotos)
    .where(
      and(
        eq(schema.albumPhotos.id, photoId),
        eq(schema.albumPhotos.invitationId, id),
        eq(schema.albumPhotos.tokenHash, hashGuestToken(deleteToken)),
      ),
    )
    .returning({ key: schema.albumPhotos.storageKey })
  if (!row) throw new ApiError(404, '내가 올린 사진만 지울 수 있어요.')
  await deleteStored([row.key])
}

// ---- 주최자 (소유자 · 공동 편집자) ----

async function assertEditor(invitationId: string, userId: string) {
  if (!isUuid(invitationId) || !(await getAccess(invitationId, userId)))
    throw new ApiError(404, '초대장을 찾을 수 없어요.')
}

export type HostAlbumPhoto = AlbumPhoto & { hidden: boolean; createdAt: string; size: number }

export async function listAlbumForHost(
  invitationId: string,
  userId: string,
): Promise<HostAlbumPhoto[]> {
  await assertEditor(invitationId, userId)
  const rows = await getDb()
    .select()
    .from(schema.albumPhotos)
    .where(eq(schema.albumPhotos.invitationId, invitationId))
    .orderBy(asc(schema.albumPhotos.createdAt))
  return rows.map((r) => ({
    ...toPhoto(r),
    hidden: r.hidden,
    createdAt: r.createdAt.toISOString(),
    size: r.sizeBytes,
  }))
}

export async function setAlbumPhotoHidden(
  invitationId: string,
  userId: string,
  photoId: string,
  hidden: boolean,
) {
  await assertEditor(invitationId, userId)
  if (!isUuid(photoId)) throw new ApiError(404, '사진을 찾을 수 없어요.')
  const [row] = await getDb()
    .update(schema.albumPhotos)
    .set({ hidden })
    .where(
      and(eq(schema.albumPhotos.id, photoId), eq(schema.albumPhotos.invitationId, invitationId)),
    )
    .returning({ id: schema.albumPhotos.id })
  if (!row) throw new ApiError(404, '사진을 찾을 수 없어요.')
}

export async function deleteAlbumPhotoByHost(
  invitationId: string,
  userId: string,
  photoId: string,
) {
  await assertEditor(invitationId, userId)
  if (!isUuid(photoId)) throw new ApiError(404, '사진을 찾을 수 없어요.')
  const [row] = await getDb()
    .delete(schema.albumPhotos)
    .where(
      and(eq(schema.albumPhotos.id, photoId), eq(schema.albumPhotos.invitationId, invitationId)),
    )
    .returning({ key: schema.albumPhotos.storageKey })
  if (!row) throw new ApiError(404, '사진을 찾을 수 없어요.')
  await deleteStored([row.key])
}

/** 전체 받기용: 사진 한 장의 파일 내용 (한 장씩 읽어 줌 — 한 번에 압축해서 내려주지 않음) */
export async function albumPhotoFile(
  invitationId: string,
  userId: string,
  photoId: string,
): Promise<{ bytes: Uint8Array; ext: string; type: string }> {
  await assertEditor(invitationId, userId)
  if (!isUuid(photoId)) throw new ApiError(404, '사진을 찾을 수 없어요.')
  const [row] = await getDb()
    .select({ key: schema.albumPhotos.storageKey })
    .from(schema.albumPhotos)
    .where(
      and(eq(schema.albumPhotos.id, photoId), eq(schema.albumPhotos.invitationId, invitationId)),
    )
  if (!row) throw new ApiError(404, '사진을 찾을 수 없어요.')
  const bytes = await readStored(row.key)
  if (!bytes) throw new ApiError(404, '사진 파일을 찾을 수 없어요.')
  const ext = row.key.split('.').pop() ?? 'webp'
  return { bytes, ext, type: ext === 'jpg' ? 'image/jpeg' : 'image/webp' }
}
