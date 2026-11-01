import 'server-only'

import { randomUUID } from 'node:crypto'

import { and, count, eq } from 'drizzle-orm'
import { z } from 'zod'

import { PHOTO_LIMIT, type MediaRef } from '@/shared/blocks'

import { ApiError } from './api'
import { signPayload, verifyPayload } from './auth/token'
import { getDb, schema } from './db/client'
import { cleanupUnusedMedia, isUuid } from './editor'
import { presignPut } from './r2'
import { storageMode, storedSize } from './storage'

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

const EXT = { 'image/webp': 'webp', 'image/jpeg': 'jpg' } as const

export const presignSchema = z.object({
  invitationId: z.uuid(),
  contentType: z.enum(['image/webp', 'image/jpeg']),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES, '사진이 너무 커요.'),
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
  exp: number
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
    exp: Math.floor(Date.now() / 1000) + 600,
  } satisfies UploadToken)

  const uploadUrl =
    mode === 'r2'
      ? await presignPut(key, input.contentType, input.size)
      : `/api/uploads/local?token=${encodeURIComponent(token)}`
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
  const size = await storedSize(t.key)
  if (size === null) throw new ApiError(400, '사진이 올라가지 않았어요. 다시 시도해 주세요.')
  if (size > MAX_UPLOAD_BYTES) throw new ApiError(400, '사진이 너무 커요.')

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
  return { id: row.id, key: row.storageKey, w: row.width, h: row.height }
}
