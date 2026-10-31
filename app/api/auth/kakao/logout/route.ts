import { NextResponse } from 'next/server'

import { clearSessionCookie } from '@/lib/auth/session'
import { absoluteUrl } from '@/lib/site'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 우리 서비스 세션만 끊는다 (카카오 계정 로그아웃은 하지 않음) */
export async function POST() {
  const res = NextResponse.redirect(absoluteUrl('/'), 303)
  clearSessionCookie(res)
  return res
}
