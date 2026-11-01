import { readLocal, storageMode } from '@/lib/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TYPES: Record<string, string> = { webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg' }

/** 로컬 우회 저장소(.local/uploads)의 사진을 내려준다. R2를 쓰면 사진은 R2 공개 주소로 나가므로 404 */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  if (storageMode() !== 'local') return new Response('Not found', { status: 404 })
  const { key } = await params
  const path = key.map(decodeURIComponent).join('/')
  const type = TYPES[path.split('.').pop()?.toLowerCase() ?? '']
  if (!type || path.includes('..')) return new Response('Not found', { status: 404 })
  const data = await readLocal(path)
  if (!data) return new Response('Not found', { status: 404 })
  return new Response(new Uint8Array(data), {
    headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=3600' },
  })
}
