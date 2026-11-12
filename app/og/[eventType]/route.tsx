import { ImageResponse } from 'next/og'

import { EVENT_TYPES, type EventType } from '@/shared/blocks'
import { SEAL } from '@/shared/brand'

/** 사진이 없는 초대장의 기본 OG 이미지. 빌드 때 행사 종류별로 미리 만들어 둔다. */
export const runtime = 'nodejs'
export const dynamic = 'force-static'

export function generateStaticParams() {
  return EVENT_TYPES.map((eventType) => ({ eventType }))
}

/** 행사별 영문 머리글. 바탕은 모두 종이 색, 글자는 금갈색 (A · 종이 편지) */
const LABEL: Record<EventType, string> = {
  wedding: 'WEDDING INVITATION',
  dol: 'FIRST BIRTHDAY',
  meetup: 'YOU ARE INVITED',
  etc: 'YOU ARE INVITED',
  yearend: 'YEAR-END PARTY',
  prewedding: 'BEFORE THE WEDDING',
  birthday: 'BIRTHDAY PARTY',
  housewarming: 'HOUSEWARMING',
  thanks: 'THANK YOU',
}

export async function GET(_req: Request, { params }: { params: Promise<{ eventType: string }> }) {
  const { eventType } = await params
  const label =
    LABEL[(EVENT_TYPES as readonly string[]).includes(eventType) ? (eventType as EventType) : 'etc']
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f3ede2',
        color: '#8a6a43',
      }}
    >
      <svg width="96" height="96" viewBox="0 0 30 30">
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
      <div style={{ marginTop: 44, fontSize: 36, letterSpacing: 14 }}>{label}</div>
      <div style={{ marginTop: 14, width: 56, height: 1, background: '#b79a74' }} />
      <div style={{ marginTop: 22, fontSize: 26, color: '#6b6156', letterSpacing: 6 }}>dearday</div>
    </div>,
    { width: 1200, height: 630 },
  )
}
