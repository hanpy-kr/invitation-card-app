import { ImageResponse } from 'next/og'

import { SEAL } from '@/shared/brand'

export const runtime = 'nodejs'
export const dynamic = 'force-static'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

/** 앱 아이콘(홈 화면 추가): 종이 바탕에 밀랍 도장 */
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: SEAL.paper,
      }}
    >
      <svg width="132" height="132" viewBox="0 0 30 30">
        <circle cx="15" cy="15" r="15" fill={SEAL.gold} />
        <circle
          cx="15"
          cy="15"
          r={SEAL.ring.r}
          fill="none"
          stroke={SEAL.paper}
          strokeWidth={SEAL.ring.width}
          strokeDasharray={SEAL.ring.dash}
        />
        <path d={SEAL.d} fill={SEAL.letter} />
      </svg>
    </div>,
    size,
  )
}
