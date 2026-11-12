import 'server-only'

import { randomUUID } from 'node:crypto'

import { and, count, eq } from 'drizzle-orm'
import { z } from 'zod'

import { AUDIO_TYPES, MAX_AUDIO_BYTES, type MediaRef } from '@/shared/blocks'
import { getEntitlements } from '@/shared/entitlements'
import { shareKey, thumbKey } from '@/shared/media'

import { getAccess } from './access'
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
const AUDIO_EXT = { 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a' } as const

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
  /** 사진만: 카톡 미리보기용 사본 */
  skey?: string
  ssize?: number
  /** 배경음악이면 'audio' (사진 한도 · 사본 확인에서 빠짐) */
  kind?: 'audio'
  tkey?: string
  tsize?: number
  exp: number
}

export type UploadPart = 'main' | 'share' | 'thumb'

/** 토큰에서 올릴 파일(원본 / 공유용 사본)의 key · 형식 · 최대 크기 */
export function uploadTarget(t: UploadToken, part: UploadPart) {
  if (part === 'share') {
    if (!t.skey || !t.ssize) throw new ApiError(400, '공유용 사본을 올릴 수 없는 요청이에요.')
    return { key: t.skey, ct: 'image/jpeg', size: t.ssize }
  }
  if (part === 'thumb') {
    if (!t.tkey || !t.tsize) throw new ApiError(400, '썸네일을 올릴 수 없는 요청이에요.')
    return { key: t.tkey, ct: 'image/webp', size: t.tsize }
  }
  return { key: t.key, ct: t.ct, size: t.size }
}

async function assertOwnerAndRoom(
  invitationId: string,
  userId: string,
  kind: 'image' | 'audio' = 'image',
) {
  const db = getDb()
  const access = await getAccess(invitationId, userId)
  if (!access) throw new ApiError(404, '초대장을 찾을 수 없어요.')
  if (kind === 'audio') return { ownerId: access.ownerId }
  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.media)
    .where(and(eq(schema.media.invitationId, invitationId), eq(schema.media.kind, 'image')))
  const { photoLimit } = getEntitlements({ plan: access.plan, anonymous: access.ownerAnonymous })
  if (n >= photoLimit)
    throw new ApiError(409, `사진은 초대장당 ${photoLimit}장까지 올릴 수 있어요.`)
  return { ownerId: access.ownerId }
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

export const audioPresignSchema = z.object({
  invitationId: z.uuid(),
  contentType: z.enum(AUDIO_TYPES),
  size: z.number().int().positive().max(MAX_AUDIO_BYTES, '음악 파일은 10MB까지 올릴 수 있어요.'),
})

/** 배경음악 업로드 주소 발급 (사진과 같은 저장소 · 같은 완료 API, 사진 한도에는 안 셈) */
export async function createAudioUpload(userId: string, input: z.infer<typeof audioPresignSchema>) {
  const mode = storageMode()
  if (mode === 'none') throw new ApiError(503, '파일 저장소가 아직 연결되지 않았어요.')
  await cleanupUnusedMedia(input.invitationId)
  await assertOwnerAndRoom(input.invitationId, userId, 'audio')

  const mid = randomUUID()
  const key = `inv/${input.invitationId}/${mid}.${AUDIO_EXT[input.contentType]}`
  const token = signPayload({
    uid: userId,
    inv: input.invitationId,
    mid,
    key,
    ct: input.contentType,
    size: input.size,
    kind: 'audio',
    exp: Math.floor(Date.now() / 1000) + 600,
  } satisfies UploadToken)
  const uploadUrl =
    mode === 'r2'
      ? await presignPut(key, input.contentType, input.size)
      : `/api/uploads/local?part=main&token=${encodeURIComponent(token)}`
  return { uploadUrl, token }
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
  const audio = t.kind === 'audio'
  const size = await storedSize(t.key)
  if (size === null) throw new ApiError(400, '파일이 올라가지 않았어요. 다시 시도해 주세요.')
  if (size > (audio ? MAX_AUDIO_BYTES : MAX_UPLOAD_BYTES))
    throw new ApiError(400, audio ? '음악 파일이 너무 커요.' : '사진이 너무 커요.')
  if (!audio) {
    // 공유용 사본이 없으면 카톡 미리보기가 깨지므로 둘 다 있어야 등록
    if (!t.skey || (await storedSize(t.skey)) === null) {
      throw new ApiError(400, '사진이 다 올라가지 않았어요. 다시 시도해 주세요.')
    }
  }
  // 썸네일은 있으면 쓰고, 없으면 바둑판에 원본을 쓴다 (실패해도 등록은 진행)
  const thumb = t.tkey ? (await storedSize(t.tkey)) !== null : false

  const { ownerId } = await assertOwnerAndRoom(t.inv, userId, audio ? 'audio' : 'image')
  const [row] = await getDb()
    .insert(schema.media)
    .values({
      id: t.mid,
      // 편집자가 올려도 초대장 소유자 것으로 (소유자 탈퇴 때 함께 지워지게)
      ownerId,
      invitationId: t.inv,
      storageKey: t.key,
      kind: audio ? 'audio' : 'image',
      width: audio ? 1 : input.width,
      height: audio ? 1 : input.height,
      sizeBytes: size,
    })
    .onConflictDoNothing()
    .returning()
  if (!row) throw new ApiError(409, '이미 등록된 파일이에요.')
  if (audio) return { id: row.id, key: row.storageKey, w: 1, h: 1 }
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
