import type { NextRequest } from 'next/server'

import { deleteAccount } from '@/lib/account'
import { handle, json, requireApiSession } from '@/lib/api'
import { clearSessionCookie } from '@/lib/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 회원 탈퇴 */
export const POST = handle(async (req: NextRequest) => {
  const session = await requireApiSession(req)
  await deleteAccount(session.userId)
  const res = json({ ok: true })
  clearSessionCookie(res)
  return res
})
