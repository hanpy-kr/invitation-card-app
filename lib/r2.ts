import 'server-only'

import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/** Cloudflare R2 (S3 호환). 브라우저가 presigned PUT으로 직접 올리고, 서버는 파일을 나르지 않는다. */
export function r2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET &&
    process.env.R2_PUBLIC_BASE_URL,
  )
}

let client: S3Client | null = null
function r2(): S3Client {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
      },
    })
  }
  return client
}

const bucket = () => process.env.R2_BUCKET ?? 'dearday-media'

export async function presignPut(key: string, contentType: string, size: number): Promise<string> {
  return getSignedUrl(
    r2(),
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: contentType,
      ContentLength: size,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
    { expiresIn: 300 },
  )
}

/** 올라간 파일 크기 (없으면 null) */
export async function headSize(key: string): Promise<number | null> {
  try {
    const res = await r2().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }))
    return res.ContentLength ?? null
  } catch {
    return null
  }
}

export async function deleteKeys(keys: string[]): Promise<void> {
  if (keys.length === 0) return
  await r2().send(
    new DeleteObjectsCommand({
      Bucket: bucket(),
      Delete: { Objects: keys.map((Key) => ({ Key })) },
    }),
  )
}

/** 서버 측 복사 (파일을 서버로 내려받지 않음). 없는 원본은 건너뜀 → 복사된 key 목록 */
export async function copyKeys(pairs: [from: string, to: string][]): Promise<string[]> {
  const done: string[] = []
  for (const [from, to] of pairs) {
    try {
      await r2().send(
        new CopyObjectCommand({
          Bucket: bucket(),
          Key: to,
          CopySource: `${bucket()}/${from.split('/').map(encodeURIComponent).join('/')}`,
          MetadataDirective: 'COPY',
        }),
      )
      done.push(to)
    } catch (err) {
      const name = (err as { name?: string }).name
      if (name !== 'NoSuchKey' && name !== 'NotFound') throw err
    }
  }
  return done
}
