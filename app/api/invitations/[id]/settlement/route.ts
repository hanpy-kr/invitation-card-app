import type { NextRequest } from 'next/server'

import { handle, json, readJson, requireApiSession } from '@/lib/api'
import { saveSettlement, settlementInputSchema } from '@/lib/host-tools'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 주최자 전용: 쓴 돈 항목 저장 (+ 하객 화면에 정산 내역 보이기 켜기 · 끄기). 돈을 받거나 보내는 일은 하지 않음 */
export const PUT = handle(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireApiSession(req)
    const { id } = await params
    const input = await readJson(req, settlementInputSchema)
    return json(await saveSettlement(id, session.userId, input))
  },
)
