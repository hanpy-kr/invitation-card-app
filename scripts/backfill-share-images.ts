/**
 * 일회성: 공유용 JPEG 사본(`*.share.jpg`)이 생기기 전에 올라간 사진에 사본을 만들고,
 * 블록 설정의 사진 참조에 `share: true`를 표시한다. 여러 번 돌려도 안전하다(있는 사본은 건너뜀).
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
import { inArray, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import sharp from 'sharp'

import * as schema from '../lib/db/schema'
import { shareKey } from '../shared/media'
import { requireEnv } from './env'

const APPLY = process.argv.includes('--apply')
const SHARE_SIDE = 1200 // 브라우저 업로드(components/editor/upload.ts)와 같은 크기

type Ref = { id: string; key: string; w: number; h: number; share?: boolean }

interface Store {
  name: string
  exists(key: string): Promise<boolean>
  read(key: string): Promise<Buffer>
  write(key: string, data: Buffer): Promise<void>
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
    async write(key, data) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: data,
          ContentType: 'image/jpeg',
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

  const pending = new Map<string, Ref>()
  for (const row of rows)
    for (const ref of refsIn(row.type, row.config)) if (!ref.share) pending.set(ref.key, ref)
  console.log(`사본 표시가 없는 사진 ${pending.size}장 (블록 ${rows.length}개 확인)`)

  // 1) 사본 만들기
  const ready = new Set<string>()
  let created = 0
  let failed = 0
  for (const key of pending.keys()) {
    const target = shareKey(key)
    try {
      if (await store.exists(target)) {
        ready.add(key)
        console.log(`  이미 있음  ${target}`)
        continue
      }
      if (!APPLY) {
        console.log(`  만들 예정  ${target}`)
        continue
      }
      const jpeg = await sharp(await store.read(key))
        .rotate()
        .resize(SHARE_SIDE, SHARE_SIDE, { fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 80, mozjpeg: true })
        .toBuffer()
      await store.write(target, jpeg)
      ready.add(key)
      created++
      console.log(`  만듦        ${target} (${Math.round(jpeg.length / 1024)}KB)`)
    } catch (err) {
      failed++
      console.error(`  실패        ${key}: ${(err as Error).message}`)
    }
  }

  // 2) 블록 설정에 share: true 표시 (사본이 확인된 사진만)
  let updatedBlocks = 0
  if (APPLY && ready.size > 0) {
    await db.transaction(async (tx) => {
      for (const row of rows) {
        const mark = (ref: Ref) =>
          !ref.share && ready.has(ref.key) ? { ...ref, share: true } : ref
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
      ? `완료: 사본 ${created}장 생성, 블록 ${updatedBlocks}개 갱신, 실패 ${failed}장`
      : `미리 보기 끝: 실제로 하려면 --apply`,
  )
  await client.end()
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
