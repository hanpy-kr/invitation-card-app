import 'server-only'

import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { shareKey, thumbKey } from '@/shared/media'

import * as r2 from './r2'
import { isLocalSite } from './site'

/**
 * 사진 저장소 선택. R2 키가 있으면 R2, 없으면 (localhost에서만) .local/uploads 폴더.
 * 로컬 저장소는 R2 키를 받기 전 개발용 우회다.
 */
export type StorageMode = 'r2' | 'local' | 'none'

export function storageMode(): StorageMode {
  if (r2.r2Configured()) return 'r2'
  if (isLocalSite()) return 'local'
  return 'none'
}

const LOCAL_ROOT = path.join(process.cwd(), '.local', 'uploads')

export function localPath(key: string): string {
  const full = path.join(LOCAL_ROOT, key)
  if (!full.startsWith(LOCAL_ROOT + path.sep)) throw new Error('잘못된 경로')
  return full
}

export async function writeLocal(key: string, data: Uint8Array): Promise<void> {
  const full = localPath(key)
  await mkdir(path.dirname(full), { recursive: true })
  await writeFile(full, data)
}

export async function readLocal(key: string): Promise<Buffer | null> {
  try {
    return await readFile(localPath(key))
  } catch {
    return null
  }
}

export async function storedSize(key: string): Promise<number | null> {
  const mode = storageMode()
  if (mode === 'r2') return r2.headSize(key)
  if (mode === 'local') {
    try {
      return (await stat(localPath(key))).size
    } catch {
      return null
    }
  }
  return null
}

/** 실패해도 서비스에는 영향 없음 (고아 파일만 남음) */
export async function deleteStored(keys: string[]): Promise<void> {
  // 원본과 함께 공유용 JPEG 사본 · 썸네일도 지운다
  const own = keys
    .filter((k) => !k.startsWith('samples/'))
    .flatMap((k) => [k, shareKey(k), thumbKey(k)])
  if (own.length === 0) return
  try {
    const mode = storageMode()
    if (mode === 'r2') await r2.deleteKeys(own)
    else if (mode === 'local') await Promise.all(own.map((k) => rm(localPath(k), { force: true })))
  } catch (err) {
    console.error('[storage] delete failed', err)
  }
}

/**
 * 사진 복사 (원본 + 공유용 JPEG 사본 + 썸네일). R2는 서버 측 CopyObject라 파일을 나르지 않는다.
 * 한쪽 초대장을 지워도 다른 쪽 사진이 남도록 항상 새 key로 복사. 없는 사본은 건너뜀
 */
export async function copyStored(pairs: [from: string, to: string][]): Promise<void> {
  const all = pairs.flatMap(([a, b]): [string, string][] => [
    [a, b],
    [shareKey(a), shareKey(b)],
    [thumbKey(a), thumbKey(b)],
  ])
  const mode = storageMode()
  if (mode === 'r2') {
    await r2.copyKeys(all)
  } else if (mode === 'local') {
    for (const [a, b] of all) {
      try {
        await mkdir(path.dirname(localPath(b)), { recursive: true })
        await copyFile(localPath(a), localPath(b))
      } catch (err) {
        if ((err as { code?: string }).code !== 'ENOENT') throw err
      }
    }
  } else {
    throw new Error('사진 저장소가 설정되지 않았어요.')
  }
}
