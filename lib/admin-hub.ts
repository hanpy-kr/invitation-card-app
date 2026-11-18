import 'server-only'

import { type PlanBasis, planDecision } from '@/shared/entitlements'
import { isFamilyEvent } from '@/shared/pricing'
import type { EventType } from '@/shared/blocks'

import { HanpyApiError } from './hanpy-payments'
import { hanpy } from './hanpy'
import { hubConfigured, paymentsLiveAt } from './plan'
import { isAdmin } from './stats'

const BASIS_LABEL: Record<PlanBasis, string> = {
  'payments-off': '결제 꺼짐',
  hub: '허브 결제',
  parent: '부모 상속',
  'old-order': '옛 결제',
  'before-live': '오픈 전 생성',
  'meetup-event': '모임 이벤트',
  free: '무료',
}

/** 허브 호출 실패의 종류만(토큰 · 응답 본문은 담지 않음): HanpyApiError는 status · code, 그 밖은 오류 이름 + 메시지 앞부분 */
export type HubFail = { kind: 'api'; status: number; code: string } | { kind: 'other'; name: string; message: string }

function failOf(e: unknown): HubFail {
  if (e instanceof HanpyApiError) return { kind: 'api', status: e.status, code: e.code }
  if (e instanceof Error) return { kind: 'other', name: e.name, message: e.message.replace(/\s+/g, ' ').slice(0, 80) }
  return { kind: 'other', name: 'Error', message: String(e).slice(0, 80) }
}

/** 화면 표시용 한 줄 (관리자 줄 괄호 안) */
export function failShort(f: HubFail): string {
  return f.kind === 'api' ? `${f.status} ${f.code}` : `${f.name}: ${f.message}`
}
/** /admin/stats 칸 표시용 */
export function failLong(f: HubFail): string {
  return f.kind === 'api' ? `status ${f.status} · code ${f.code}` : `${f.name}: ${f.message}`
}

/** /admin/stats '결제 허브' 칸: 설정 여부(값은 절대 안 줌) + listProducts 결과(실패는 status · code만) */
export async function hubAdminPanel() {
  const env = {
    HANPY_API_ORIGIN: Boolean(process.env.HANPY_API_ORIGIN?.trim()),
    HANPY_SERVICE_TOKEN: Boolean(process.env.HANPY_SERVICE_TOKEN?.trim()),
    HANPY_NOTIFY_SECRET: Boolean(process.env.HANPY_NOTIFY_SECRET?.trim()),
  }
  if (!hubConfigured()) return { env, products: null as null, error: null as HubFail | null }
  try {
    const items = (await hanpy.listProducts()).map((p) => ({
      sku: p.sku,
      amount: p.amount,
      onSale: p.onSale,
    }))
    return { env, products: items, error: null as HubFail | null }
  } catch (e) {
    return { env, products: null as null, error: failOf(e) }
  }
}

type Row = {
  id: string
  createdAt: Date | string
  eventType: EventType
  premiumHub?: boolean | null
  premiumOrderId: string | null
  derivedPremium?: boolean | null
}

const hhmm = (d: Date) =>
  new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(d)

/**
 * 관리자 전용 한 줄: "허브 이용권: 있음/없음 · 확인 시각 HH:mm · 프리미엄 근거: …".
 * 허브 이용권은 이 함수가 허브에 바로 다시 물어본 값(캐시 아님). 관리자가 아니면 null.
 */
export async function adminHubLines(
  userId: string,
  rows: readonly Row[],
): Promise<Record<string, string> | null> {
  if (rows.length === 0 || !(await isAdmin(userId))) return null
  const out: Record<string, string> = {}
  const at = hhmm(new Date())
  const ids = rows.map((r) => r.id)
  let on: Set<string> | null = null
  let fail: HubFail | null = null
  if (!hubConfigured()) fail = { kind: 'api', status: 0, code: 'NOT_CONFIGURED' }
  else {
    try {
      on = new Set<string>()
      for (let i = 0; i < ids.length; i += 100) {
        const ents = await hanpy.getSubjectEntitlements('invitation', ids.slice(i, i + 100))
        for (const e of ents) if (e.key === 'premium' && e.subject) on.add(e.subject.id)
      }
    } catch (e) {
      on = null
      fail = failOf(e)
    }
  }
  // 주문 상태: 초대장당 최신 허브 주문 1건을 허브에 직접 조회(관리자 화면이라 최대 30줄)
  const ORDER_LABEL: Record<string, string> = {
    pending: '결제 대기',
    paid: '결제 완료',
    cancel_requested: '환불 요청',
    partially_refunded: '일부 환불',
    refunded: '환불됨',
    canceled: '취소',
    expired: '만료',
  }
  const orderNote = new Map<string, string>()
  if (hubConfigured()) {
    await Promise.all(
      rows.slice(0, 30).map(async (r) => {
        try {
          const [o] = await hanpy.listOrders({ subject: { type: 'invitation', id: r.id }, limit: 1 })
          if (!o) return orderNote.set(r.id, ' · 주문 없음')
          const label = ORDER_LABEL[o.status] ?? o.status
          orderNote.set(
            r.id,
            ` · 주문 상태: ${label}${o.status === 'partially_refunded' ? `(${(o.refundedAmount ?? 0).toLocaleString('ko-KR')}원)` : ''}`,
          )
        } catch {
          orderNote.set(r.id, ' · 주문 상태: 확인 못 함')
        }
      }),
    )
  }
  for (const r of rows) {
    const { basis } = planDecision({
      liveAt: paymentsLiveAt(),
      createdAt: r.createdAt,
      premiumHub: on ? on.has(r.id) : Boolean(r.premiumHub),
      premiumOrderId: r.premiumOrderId,
      derivedPremium: Boolean(r.derivedPremium),
      isMeetup: !isFamilyEvent(r.eventType),
    })
    const head = on
      ? `허브 이용권: ${on.has(r.id) ? '있음' : '없음'}`
      : `허브 이용권: 확인 못 함(${fail ? failShort(fail) : 'ERROR'})`
    out[r.id] = `${head} · 확인 시각 ${at}${orderNote.get(r.id) ?? ''} · 프리미엄 근거: ${BASIS_LABEL[basis]}`
  }
  return out
}
