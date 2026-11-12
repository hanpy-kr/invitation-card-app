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
  themeColor: '#f3ede2',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* 제목 · 본문 글씨(고운바탕): 쓰는 글자의 조각만 내려받음 */}
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/fonts/gowun-batang/v1/font.css" precedence="font" />
      </head>
      <body>{children}</body>
    </html>
  )
}
