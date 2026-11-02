/**
 * 일회성: 예전에 올라간 사진에 빠진 사본을 만들고, 블록 설정의 사진 참조에 표시를 붙인다.
 *  - 공유용 JPEG 사본 `*.share.jpg` (긴 변 1200px) → `share: true`   대상: 표지 · 사진첩 사진
 *  - 사진첩 썸네일 `*.thumb.webp` (긴 변 480px)    → `thumb: true`   대상: 사진첩 사진
 * 여러 번 돌려도 안전하다(이미 있는 사본은 만들지 않고 표시만 붙임).
 *
 * 실행 (운영 DB · R2 값을 환경변수로 넣고 — 키는 채팅에 붙이지 말 것):
 *   pnpm backfill:share            # 미리 보기만 (아무것도 안 바꿈)
 *   pnpm backfill:share --apply    # 사본 생성 + 블록 갱신
 * 필요한 환경변수: DATABASE_URL, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 * R2 값이 없으면 로컬 개발 저장소(.local/uploads)를 대상으로 한다.
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { eq, inArray } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import sharp from 'sharp'

import * as schema from '../lib/db/schema'
import { shareKey, thumbKey } from '../shared/media'
import { requireEnv } from './env'

const APPLY = process.argv.includes('--apply')

type Ref = { id: string; key: string; w: number; h: number; share?: boolean; thumb?: boolean }

/** 만들 사본 종류. 크기 · 형식은 브라우저 업로드(components/editor/upload.ts)와 같게 */
const VARIANTS = [
  {
    flag: 'share' as const,
    label: '공유용 JPEG',
    keyOf: shareKey,
    contentType: 'image/jpeg',
    appliesTo: (blockType: string) => blockType === 'cover' || blockType === 'gallery',
    make: (input: Buffer) =>
      sharp(input)
        .rotate()
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 80, mozjpeg: true })
        .toBuffer(),
  },
  {
    flag: 'thumb' as const,
    label: '사진첩 썸네일',
    keyOf: thumbKey,
    contentType: 'image/webp',
    appliesTo: (blockType: string) => blockType === 'gallery',
    make: (input: Buffer) =>
      sharp(input)
        .rotate()
        .resize(480, 480, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 75 })
        .toBuffer(),
  },
]

interface Store {
  name: string
  exists(key: string): Promise<boolean>
  read(key: string): Promise<Buffer>
  write(key: string, data: Buffer, contentType: string): Promise<void>
}

function r2Store(): Store {
  const bucket = requireEnv('R2_BUCKET')
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${requireEnv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
    },
  })
  return {
    name: `R2 버킷 ${bucket}`,
    async exists(key) {
      try {
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
        return true
      } catch {
        return false
      }
    },
    async read(key) {
      const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
      return Buffer.from(await res.Body!.transformToByteArray())
    },
    async write(key, data, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: data,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      )
    },
  }
}

function localStore(): Store {
  const root = path.join(process.cwd(), '.local', 'uploads')
  return {
    name: `로컬 ${root}`,
    exists: async (key) => existsSync(path.join(root, key)),
    read: (key) => readFile(path.join(root, key)),
    async write(key, data) {
      const full = path.join(root, key)
      await mkdir(path.dirname(full), { recursive: true })
      await writeFile(full, data)
    },
  }
}

function refsIn(type: string, config: unknown): Ref[] {
  const c = config as { image?: Ref | null; images?: Ref[] }
  if (type === 'cover') return c.image ? [c.image] : []
  if (type === 'gallery') return c.images ?? []
  return []
}

async function main() {
  const store = process.env.R2_ACCESS_KEY_ID ? r2Store() : localStore()
  const client = postgres(requireEnv('DATABASE_URL'), {
    max: 1,
    prepare: false,
    onnotice: () => {},
  })
  const db = drizzle(client, { schema })
  console.log(`${APPLY ? '실행' : '미리 보기(--apply 없음)'} · 저장소: ${store.name}`)

  const rows = await db
    .select({ id: schema.blocks.id, type: schema.blocks.type, config: schema.blocks.config })
    .from(schema.blocks)
    .where(inArray(schema.blocks.type, ['cover', 'gallery']))

  // 종류별로: 표시가 없는 원본 key → 사본이 준비됐는지
  const ready: Record<'share' | 'thumb', Set<string>> = { share: new Set(), thumb: new Set() }
  let created = 0
  let failed = 0

  for (const v of VARIANTS) {
    const pending = new Set<string>()
    for (const row of rows) {
      if (!v.appliesTo(row.type)) continue
      for (const ref of refsIn(row.type, row.config)) if (!ref[v.flag]) pending.add(ref.key)
    }
    console.log(`\n[${v.label}] 표시가 없는 사진 ${pending.size}장`)
    for (const key of pending) {
      const target = v.keyOf(key)
      try {
        if (await store.exists(target)) {
          ready[v.flag].add(key)
          console.log(`  이미 있음  ${target}`)
          continue
        }
        if (!APPLY) {
          console.log(`  만들 예정  ${target}`)
          continue
        }
        const data = await v.make(await store.read(key))
        await store.write(target, data, v.contentType)
        ready[v.flag].add(key)
        created++
        console.log(`  만듦        ${target} (${Math.round(data.length / 1024)}KB)`)
      } catch (err) {
        failed++
        console.error(`  실패        ${key}: ${(err as Error).message}`)
      }
    }
  }

  // 블록 설정에 표시 붙이기 (사본이 확인된 사진만)
  let updatedBlocks = 0
  if (APPLY && (ready.share.size > 0 || ready.thumb.size > 0)) {
    await db.transaction(async (tx) => {
      for (const row of rows) {
        const mark = (ref: Ref): Ref => ({
          ...ref,
          ...(!ref.share && ready.share.has(ref.key) ? { share: true } : {}),
          ...(row.type === 'gallery' && !ref.thumb && ready.thumb.has(ref.key)
            ? { thumb: true }
            : {}),
        })
        const c = row.config as { image?: Ref | null; images?: Ref[] }
        const next =
          row.type === 'cover'
            ? { ...c, image: c.image ? mark(c.image) : c.image }
            : { ...c, images: (c.images ?? []).map(mark) }
        if (JSON.stringify(next) === JSON.stringify(c)) continue
        await tx.update(schema.blocks).set({ config: next }).where(eq(schema.blocks.id, row.id))
        updatedBlocks++
      }
    })
  }

  console.log(
    APPLY
      ? `\n완료: 사본 ${created}개 생성, 블록 ${updatedBlocks}개 갱신, 실패 ${failed}개`
      : `\n미리 보기 끝: 실제로 하려면 --apply`,
  )
  await client.end()
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
