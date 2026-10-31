import { ImageResponse } from 'next/og'

import { EVENT_TYPES, type EventType } from '@/shared/blocks'

/** 사진이 없는 초대장의 기본 OG 이미지. 빌드 때 4종을 미리 만들어 둔다. */
export const runtime = 'nodejs'
export const dynamic = 'force-static'

export function generateStaticParams() {
  return EVENT_TYPES.map((eventType) => ({ eventType }))
}

const STYLE: Record<EventType, { label: string; bg: string; fg: string }> = {
  wedding: { label: 'WEDDING INVITATION', bg: '#f6f5f5', fg: '#ea7664' },
  dol: { label: 'FIRST BIRTHDAY', bg: '#fbf1f3', fg: '#e88ea6' },
  meetup: { label: 'YOU ARE INVITED', bg: '#f0f2f7', fg: '#3d5a98' },
  etc: { label: 'YOU ARE INVITED', bg: '#eff6f3', fg: '#4fa58f' },
}

export async function GET(_req: Request, { params }: { params: Promise<{ eventType: string }> }) {
  const { eventType } = await params
  const s =
    STYLE[(EVENT_TYPES as readonly string[]).includes(eventType) ? (eventType as EventType) : 'etc']
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: s.bg,
        color: s.fg,
      }}
    >
      <div style={{ fontSize: 40, letterSpacing: 12 }}>{s.label}</div>
      <div style={{ marginTop: 28, fontSize: 28, color: '#89757a', letterSpacing: 4 }}>dearday</div>
    </div>,
    { width: 1200, height: 630 },
  )
}
