import type { NextRequest } from 'next/server'

import { bringCsv } from '@/lib/bring-csv'
import { ApiError, handle, requireApiSession } from '@/lib/api'
import { getResponses } from '@/lib/dashboard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 주최자: 나눠 맡기 엑셀(CSV) 받기 */
export const GET = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireApiSession(req)
    const { id } = await params
    const data = await getResponses(id, session.userId)
    if (!data?.bring) throw new ApiError(404, '나눠 맡기를 찾을 수 없어요.')
    const name = `${(data.title || 'dearday').replace(/[\\/:*?"<>|]/g, '').slice(0, 40)} 나눠 맡기.csv`
    return new Response(bringCsv(data.bring), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="bring.csv"; filename*=UTF-8''${encodeURIComponent(name)}`,
        'Cache-Control': 'private, no-store',
      },
    })
  },
)
