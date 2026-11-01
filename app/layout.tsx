import type { Metadata, Viewport } from 'next'

import '@/styles/global.scss'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: 'dearday — 모바일 초대장',
  description: '결혼식 · 돌잔치 · 모임 초대장을 만들어 카톡으로 보내세요.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
