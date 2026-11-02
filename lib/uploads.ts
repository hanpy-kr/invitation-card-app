import 'server-only'

import { randomUUID } from 'node:crypto'

import { and, count, eq } from 'drizzle-orm'
import { z } from 'zod'

import { PHOTO_LIMIT, type MediaRef } from '@/shared/blocks'
import { shareKey, thumbKey } from '@/shared/media'

import { ApiError } from './api'
import { signPayload, verifyPayload } from './auth/token'
import { getDb, schema } from './db/client'
import { cleanupUnusedMedia, isUuid } from './editor'
import { presignPut } from './r2'
import { storageMode, storedSize } from './storage'

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
export const MAX_SHARE_BYTES = 1 * 1024 * 1024
export const MAX_THUMB_BYTES = 300 * 1024

const EXT = { 'image/webp': 'webp', 'image/jpeg': 'jpg' } as const

export const presignSchema = z.object({
  invitationId: z.uuid(),
  contentType: z.enum(['image/webp', 'image/jpeg']),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES, '사진이 너무 커요.'),
  /** 카톡 미리보기용 JPEG 사본 크기 */
  shareSize: z.number().int().positive().max(MAX_SHARE_BYTES),
  /** 사진첩 썸네일(webp) 크기. webp를 못 만드는 브라우저는 생략 */
  thumbSize: z.number().int().positive().max(MAX_THUMB_BYTES).optional(),
})

export const completeSchema = z.object({
  token: z.string().min(10).max(2000),
  width: z.number().int().min(1).max(4000),
  height: z.number().int().min(1).max(4000),
})

type UploadToken = {
  uid: string
  inv: string
  mid: string
  key: string
  ct: string
  size: number
  skey: string
  ssize: number
  tkey?: string
  tsize?: number
  exp: number
}

export type UploadPart = 'main' | 'share' | 'thumb'

/** 토큰에서 올릴 파일(원본 / 공유용 사본)의 key · 형식 · 최대 크기 */
export function uploadTarget(t: UploadToken, part: UploadPart) {
  if (part === 'share') return { key: t.skey, ct: 'image/jpeg', size: t.ssize }
  if (part === 'thumb') {
    if (!t.tkey || !t.tsize) throw new ApiError(400, '썸네일을 올릴 수 없는 요청이에요.')
    return { key: t.tkey, ct: 'image/webp', size: t.tsize }
  }
  return { key: t.key, ct: t.ct, size: t.size }
}

async function assertOwnerAndRoom(invitationId: string, userId: string) {
  const db = getDb()
  const [inv] = await db
    .select({ id: schema.invitations.id })
    .from(schema.invitations)
    .where(and(eq(schema.invitations.id, invitationId), eq(schema.invitations.ownerId, userId)))
  if (!inv) throw new ApiError(404, '초대장을 찾을 수 없어요.')
  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.media)
    .where(eq(schema.media.invitationId, invitationId))
  if (n >= PHOTO_LIMIT)
    throw new ApiError(409, `사진은 초대장당 ${PHOTO_LIMIT}장까지 올릴 수 있어요.`)
}

/** 업로드 주소 발급. R2면 presigned PUT, 로컬 우회면 우리 서버의 /api/uploads/local */
export async function createUpload(userId: string, input: z.infer<typeof presignSchema>) {
  const mode = storageMode()
  if (mode === 'none') throw new ApiError(503, '사진 저장소가 아직 연결되지 않았어요.')

  // 빠진 사진을 먼저 정리해야 한도 계산이 정확하다
  await cleanupUnusedMedia(input.invitationId)
  await assertOwnerAndRoom(input.invitationId, userId)

  const mid = randomUUID()
  const key = `inv/${input.invitationId}/${mid}.${EXT[input.contentType]}`
  const token = signPayload({
    uid: userId,
    inv: input.invitationId,
    mid,
    key,
    ct: input.contentType,
    size: input.size,
    skey: shareKey(key),
    ssize: input.shareSize,
    ...(input.thumbSize ? { tkey: thumbKey(key), tsize: input.thumbSize } : {}),
    exp: Math.floor(Date.now() / 1000) + 600,
  } satisfies UploadToken)

  const local = (part: UploadPart) =>
    `/api/uploads/local?part=${part}&token=${encodeURIComponent(token)}`
  const [uploadUrl, shareUploadUrl, thumbUploadUrl] =
    mode === 'r2'
      ? await Promise.all([
          presignPut(key, input.contentType, input.size),
          presignPut(shareKey(key), 'image/jpeg', input.shareSize),
          input.thumbSize ? presignPut(thumbKey(key), 'image/webp', input.thumbSize) : null,
        ])
      : [local('main'), local('share'), input.thumbSize ? local('thumb') : null]
  return { uploadUrl, shareUploadUrl, thumbUploadUrl, token }
}

export function readUploadToken(token: string | null, userId?: string): UploadToken {
  const payload = verifyPayload<UploadToken>(token ?? undefined)
  if (!payload || !isUuid(payload.inv) || !isUuid(payload.mid)) {
    throw new ApiError(400, '업로드 시간이 지났어요. 다시 올려 주세요.')
  }
  if (userId && payload.uid !== userId) throw new ApiError(403, '허용되지 않은 요청입니다.')
  return payload
}

/** 저장소에 파일이 실제로 올라갔는지 확인하고 media 행을 만든다 */
export async function completeUpload(
  userId: string,
  input: z.infer<typeof completeSchema>,
): Promise<MediaRef> {
  const t = readUploadToken(input.token, userId)
  const size = await storedSize(t.key)
  if (size === null) throw new ApiError(400, '사진이 올라가지 않았어요. 다시 시도해 주세요.')
  if (size > MAX_UPLOAD_BYTES) throw new ApiError(400, '사진이 너무 커요.')
  // 공유용 사본이 없으면 카톡 미리보기가 깨지므로 둘 다 있어야 등록
  if ((await storedSize(t.skey)) === null) {
    throw new ApiError(400, '사진이 다 올라가지 않았어요. 다시 시도해 주세요.')
  }
  // 썸네일은 있으면 쓰고, 없으면 바둑판에 원본을 쓴다 (실패해도 등록은 진행)
  const thumb = t.tkey ? (await storedSize(t.tkey)) !== null : false

  await assertOwnerAndRoom(t.inv, userId)
  const [row] = await getDb()
    .insert(schema.media)
    .values({
      id: t.mid,
      ownerId: userId,
      invitationId: t.inv,
      storageKey: t.key,
      width: input.width,
      height: input.height,
      sizeBytes: size,
    })
    .onConflictDoNothing()
    .returning()
  if (!row) throw new ApiError(409, '이미 등록된 사진이에요.')
  // 완료 전에 사본 존재를 확인했으므로 share: true
  return {
    id: row.id,
    key: row.storageKey,
    w: row.width,
    h: row.height,
    share: true,
    ...(thumb ? { thumb: true } : {}),
  }
}
