import type { NextRequest } from 'next/server'

import { ApiError, handle, requireApiSession } from '@/lib/api'
import { getResponses } from '@/lib/dashboard'
import { rsvpCsv } from '@/lib/rsvp-csv'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 주최자: 참석 응답 엑셀(CSV) 받기 */
export const GET = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireApiSession(req)
    const { id } = await params
    const data = await getResponses(id, session.userId)
    if (!data) throw new ApiError(404, '초대장을 찾을 수 없어요.')
    const name = `${(data.title || 'dearday').replace(/[\\/:*?"<>|]/g, '').slice(0, 40)} 참석 응답.csv`
    return new Response(rsvpCsv(data), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="rsvps.csv"; filename*=UTF-8''${encodeURIComponent(name)}`,
        'Cache-Control': 'private, no-store',
      },
    })
  },
)
