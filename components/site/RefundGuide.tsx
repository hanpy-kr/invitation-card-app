import { GROBLE_REFUND_GUIDE, GROBLE_REFUND_LINK_LABEL } from '@/shared/pricing'

/** 환불 신청 안내 (그로블). 문구는 shared/pricing.ts 한 곳에서만 고친다 */
export default function RefundGuide({ url, className }: { url: string; className?: string }) {
  return (
    <span className={className}>
      {GROBLE_REFUND_GUIDE}{' '}
      <a href={url} target="_blank" rel="noopener noreferrer">
        {GROBLE_REFUND_LINK_LABEL}
      </a>
    </span>
  )
}
