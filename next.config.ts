import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        // 손글씨 폰트 조각: 내용이 바뀌면 폴더 버전(v1 → v2)을 올려 주소가 바뀌므로 1년 immutable 캐시
        // 로컬(next start)용. 운영(Amplify)은 정적 파일에 이 설정을 안 써서 레포 루트 customHttp.yml이 정함 — 같이 고칠 것
        source: '/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },
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
