import type { NextRequest } from 'next/server'

import { ApiError, handle, json, requireApiSession } from '@/lib/api'
import { getAccess } from '@/lib/access'
import { isUuid } from '@/lib/editor'
import { drawGiftPairs, giftStatus, listGiftPairs, manitoEnabled } from '@/lib/manito'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const noStore = { headers: { 'Cache-Control': 'private, no-store' } }

async function authorize(req: NextRequest, params: Promise<{ id: string }>) {
  const session = await requireApiSession(req)
  const { id } = await params
  if (!isUuid(id)) throw new ApiError(404, '초대장을 찾을 수 없어요.')
  if (!manitoEnabled()) throw new ApiError(404, '지금은 쓸 수 없어요.')
  if (!(await getAccess(id, session.userId))) throw new ApiError(404, '초대장을 찾을 수 없어요.')
  return id
}

/** 주최자(소유자 · 편집자): 상태, 또는 ?pairs=1이면 짝 목록 (대시보드에서 경고 뒤에 '열어 보기'를 눌렀을 때만 부름) */
export const GET = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const id = await authorize(req, params)
    if (req.nextUrl.searchParams.get('pairs') === '1')
      return json({ pairs: await listGiftPairs(id) }, noStore)
    return json(await giftStatus(id), noStore)
  },
)

/** 짝 뽑기 · 다시 뽑기 */
export const POST = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const id = await authorize(req, params)
    return json(await drawGiftPairs(id), noStore)
  },
)
