import { readLocal, storageMode } from '@/lib/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TYPES: Record<string, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
}

/** 로컬 우회 저장소(.local/uploads)의 사진을 내려준다. R2를 쓰면 사진은 R2 공개 주소로 나가므로 404 */
export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  if (storageMode() !== 'local') return new Response('Not found', { status: 404 })
  const { key } = await params
  const path = key.map(decodeURIComponent).join('/')
  const type = TYPES[path.split('.').pop()?.toLowerCase() ?? '']
  if (!type || path.includes('..')) return new Response('Not found', { status: 404 })
  const data = await readLocal(path)
  if (!data) return new Response('Not found', { status: 404 })
  const headers: Record<string, string> = {
    'Content-Type': type,
    'Cache-Control': 'public, max-age=3600',
    'Accept-Ranges': 'bytes',
  }
  // 음악은 브라우저(특히 사파리)가 구간 요청(Range)으로 읽는다
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') ?? '')
  if (range && type.startsWith('audio/')) {
    const start = range[1] ? Number(range[1]) : Math.max(0, data.length - Number(range[2] || 0))
    const end = range[1] && range[2] ? Math.min(Number(range[2]), data.length - 1) : data.length - 1
    if (start > end || start >= data.length)
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${data.length}` },
      })
    return new Response(new Uint8Array(data.subarray(start, end + 1)), {
      status: 206,
      headers: {
        ...headers,
        'Content-Range': `bytes ${start}-${end}/${data.length}`,
        'Content-Length': String(end - start + 1),
      },
    })
  }
  return new Response(new Uint8Array(data), { headers })
}
