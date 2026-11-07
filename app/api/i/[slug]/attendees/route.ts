import type { NextRequest } from 'next/server'

import { handle, json } from '@/lib/api'
import { listAttendees } from '@/lib/guest'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 참석자 명단 (이름만). 주최자가 명단 공개를 켰을 때만 */
export const GET = handle(
  async (_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params
    return json(await listAttendees(slug), { headers: { 'Cache-Control': 'no-store' } })
  },
)
