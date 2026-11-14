import type { Metadata } from 'next'
import Link from 'next/link'

import BackLink from '@/components/site/BackLink'
import Logo from '@/components/site/Logo'
import SiteFooter from '@/components/site/SiteFooter'
import { paymentProvider, paymentsOpen } from '@/lib/plan'
import { EVENT_TYPE_LABELS, EVENT_TYPES, type EventType } from '@/shared/blocks'
import { PLAN_FEATURES } from '@/shared/entitlements'
import { formatWon, PRICE_KRW, REFUND_DAYS } from '@/shared/pricing'

import styles from '../terms/legal.module.scss'

// 결제가 열리는 시각(PAYMENTS_LIVE)이 지나면 저절로 안내가 바뀌므로 요청 때마다 확인
export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: '가격 · 환불 안내 — dearday',
  description: 'dearday 무료 기능과 프리미엄 가격, 환불 규정',
}

/** 가격 안내 (결제대행사 심사용 · 이용자 안내용). 숫자는 shared/pricing.ts · entitlements.ts에서 읽음 */
export default function PricingPage() {
  const open = paymentsOpen()
  const f = PLAN_FEATURES
  // 같은 가격끼리 묶어 보여 줌 (가격 · 순서는 pricing.ts가 정함)
  const groups = new Map<number, EventType[]>()
  for (const t of EVENT_TYPES) groups.set(PRICE_KRW[t], [...(groups.get(PRICE_KRW[t]) ?? []), t])
  const ordered = [...groups.entries()].sort((a, b) => b[0] - a[0])

  // 결제 시작 전: 유료 안내(가격표 · 환불 규정)는 숨기고 무료 안내 한 줄만. 내용은 결제가 열리면 그대로 다시 보임
  if (!open)
    return (
      <>
        <main className={styles.page}>
          <div style={{ marginBottom: 12 }}>
            <Logo />
          </div>
          <BackLink href="/" label="처음 화면으로" />
          <h1>가격 · 환불 안내</h1>
          <aside className={styles.notice} aria-label="이용 요금 안내">
            <p>현재는 모든 기능이 무료로 열려있어요.</p>
          </aside>
        </main>
        <SiteFooter />
      </>
    )

  return (
    <>
      <main className={styles.page}>
        <div style={{ marginBottom: 12 }}>
          <Logo />
        </div>
        <BackLink href="/" label="처음 화면으로" />
        <h1>가격 · 환불 안내</h1>
        <p className={styles.date}>모든 금액은 부가세 포함이에요.</p>

        <h2>무료와 프리미엄</h2>
        <table>
          <thead>
            <tr>
              <th>기능</th>
              <th>무료</th>
              <th>프리미엄</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                초대장 만들기 · 모든 블록 · 디자인 표지 · 참석 응답 · 방명록 · 투표 · QR · 카톡 공유
              </td>
              <td>✓</td>
              <td>✓</td>
            </tr>
            <tr>
              <td>봉투 열기 3종 · 떨어지는 효과 6종</td>
              <td>{f.free.introEffects ? '✓' : '—'}</td>
              <td>{f.premium.introEffects ? '✓' : '—'}</td>
            </tr>
            <tr>
              <td>초대장당 사진</td>
              <td>{f.free.photoLimit}장</td>
              <td>{f.premium.photoLimit}장</td>
            </tr>
            <tr>
              <td>하단 &lsquo;dearday로 만들었어요&rsquo; 문구 숨기기</td>
              <td>{f.free.canHideMadeWith ? '✓' : '—'}</td>
              <td>{f.premium.canHideMadeWith ? '✓' : '—'}</td>
            </tr>
          </tbody>
        </table>

        <h2>행사별 프리미엄 가격</h2>
        <p>초대장 1개당 1회 결제예요. 구독이나 자동 결제는 없어요.</p>
        <table>
          <thead>
            <tr>
              <th>행사</th>
              <th>가격</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map(([price, types]) => (
              <tr key={price}>
                <td>{types.map((t) => EVENT_TYPE_LABELS[t]).join(' · ')}</td>
                <td>{formatWon(price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul>
          <li>
            결제한 결혼 · 돌잔치 초대장에서 만든 청첩장 모임 · 감사장에는 추가 결제 없이 프리미엄이
            함께 적용돼요.
          </li>
          <li>
            유료 결제가 시작되기 전에 만든 초대장은 그때 쓰던 기능(봉투 열기 · 효과, 사진{' '}
            {f.free.photoLimit}장)을 그대로 쓸 수 있어요.
          </li>
          <li>
            dearday는 이용료만 받아요. 축의금 · 회비는 받거나 보관하지 않고, 하객과 주최자가 직접
            주고받아요.
          </li>
        </ul>

        <h2>결제 방법</h2>
        {paymentProvider() === 'groble' ? (
          <p>
            통신판매중개 플랫폼 그로블의 결제창에서 결제해요. 카드 정보와 구매자 정보는 그로블 ·
            결제대행사가 직접 받고 dearday는 받거나 저장하지 않아요. 그로블 결제에는 그로블 표준
            환불 규정이 함께 적용돼요.
          </p>
        ) : (
          <p>
            토스페이먼츠 결제창에서 신용 · 체크카드, 간편결제 등으로 결제해요. 카드 정보는
            결제대행사가 직접 받고 dearday는 받거나 저장하지 않아요.
          </p>
        )}

        <h2>환불 규정</h2>
        <ul>
          <li>
            결제 후 {REFUND_DAYS}일 이내이고 아직 초대장을 발행하지 않았다면 <b>전액 환불</b>돼요.
          </li>
          <li>
            초대장을 <b>발행한 뒤에는 환불되지 않아요</b>. 서비스 제공이 시작된 것으로 보기
            때문이에요(서비스 제공 후에는 실제 제공분을 공제해요). 결제 전에 이 내용을 알려 드리고
            동의를 받아요.
          </li>
          <li>
            {paymentProvider() === 'groble'
              ? '환불은 \u2018내 초대장\u2019 화면의 결제 내역에서 안내하는 그로블 주문조회에서 신청해요. 환불이 확인되면 프리미엄이 해제되고, 카드사에 따라 취소가 반영되는 데 며칠 걸릴 수 있어요.'
              : '환불은 \u2018내 초대장\u2019 화면의 결제 내역에서 직접 요청해요. 환불하면 프리미엄이 해제되고, 카드사에 따라 취소가 반영되는 데 며칠 걸릴 수 있어요.'}
          </li>
          <li>
            dearday의 사정으로 프리미엄 기능을 쓰지 못한 경우에는 발행 여부와 관계없이 환불해요.
            문의는 도움말의 이메일로 보내 주세요.
          </li>
        </ul>
        <p>
          <Link href="/terms">이용약관</Link> · <Link href="/privacy">개인정보처리방침</Link> ·{' '}
          <Link href="/help">도움말</Link>
        </p>
      </main>
      <SiteFooter />
    </>
  )
}
