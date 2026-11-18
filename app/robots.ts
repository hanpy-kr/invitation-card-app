import type { MetadataRoute } from 'next'

// AI 학습 · AI 대화 도구가 사이트를 가져가지 못하게 막는다(일반 검색 · 카카오 미리보기는 그대로).
// 사람이 화면을 캡처하는 건 막을 수 없고, 대량 수집 · 학습을 줄이는 용도.
const AI_BOTS = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'anthropic-ai',
  'Google-Extended',
  'Applebot-Extended',
  'PerplexityBot',
  'Perplexity-User',
  'CCBot',
  'Bytespider',
  'meta-externalagent',
  'cohere-ai',
  'Diffbot',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: AI_BOTS, disallow: '/' },
      { userAgent: '*', allow: '/', disallow: ['/api/', '/edit/', '/dashboard', '/pay', '/admin', '/join/'] },
    ],
  }
}
