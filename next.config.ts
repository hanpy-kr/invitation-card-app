import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async redirects() {
    return [
      {
        // www → 루트 도메인으로 통일 (카톡 공유 링크 · 로그인 쿠키 · OG 주소가 한 도메인을 쓰도록)
        // permanent: true는 308이라, 요청대로 301을 명시. 경로와 쿼리스트링은 그대로 넘어간다
        source: '/:path*',
        has: [{ type: 'host', value: 'www.thedearday.com' }],
        destination: 'https://thedearday.com/:path*',
        statusCode: 301,
      },
    ]
  },
}

export default nextConfig
