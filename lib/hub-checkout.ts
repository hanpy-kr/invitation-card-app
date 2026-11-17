import 'server-only'

import { skuFor } from '@/shared/pricing'

import { ApiError } from './api'
import { hanpy } from './hanpy'
import { HanpyApiError } from './hanpy-payments'
import { canCheckout, hasPaidPremium } from './plan'
import { loadInvitation, requireOwner } from './payments'
import { refreshPremium } from './premium'

/**
 * 결제 시작(허브): 로그인 · 소유자 · 익명 아님 → 이미 프리미엄이면 409 → 서버가 SKU 결정 → 허브 checkout.
 * 자체 orders 행은 만들지 않는다. 브라우저는 돌려준 url로만 이동한다(그로블 링크는 화면 코드에 없음).
 */
export async function startHubCheckout(
  invitationId: string,
  userId: string,
  attemptId: string,
): Promise<{ orderId: string; url: string }> {
  if (!(await canCheckout(userId))) throw new ApiError(403, '결제를 아직 열지 않았어요.')
  await requireOwner(invitationId, userId)
  const inv = await loadInvitation(invitationId)
  if (hasPaidPremium(inv)) throw new ApiError(409, '이미 프리미엄이에요')

  try {
    const { order, action } = await hanpy.checkout({
      sku: skuFor(inv.eventType),
      customerRef: userId,
      subject: { type: 'invitation', id: invitationId },
      idempotencyKey: `${userId}:${attemptId}`,
    })
    return { orderId: order.orderId, url: action.url }
  } catch (e) {
    if (e instanceof HanpyApiError) {
      if (e.code === 'ALREADY_ENTITLED') {
        await refreshPremium([invitationId]) // 캐시도 true로
        throw new ApiError(409, '이미 프리미엄이에요')
      }
      // 구매자 정보 · 요청 원문은 남기지 않고 코드와 requestId만
      console.error('hanpy checkout', e.code, e.requestId)
    } else {
      console.error('hanpy checkout failed')
    }
    throw new ApiError(503, '지금은 결제를 시작할 수 없어요')
  }
}
