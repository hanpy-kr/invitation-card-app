import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript', 'prettier'),
  {
    ignores: ['node_modules/**', '.next/**', 'out/**', 'build/**', 'drizzle/**', 'next-env.d.ts'],
  },
  {
    // 블록 UI는 순수 표시용 — 앱인토스 미니앱으로 옮길 수 있도록 서버 · DB · Next 전용 모듈 금지
    files: ['components/blocks/**/*.{ts,tsx}'],
    rules: {
      '@next/next/no-img-element': 'off',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['next', 'next/*'], message: '블록은 Next 전용 모듈을 쓰지 않습니다.' },
            {
              group: ['@/lib/*', '**/lib/*', 'server-only'],
              message: '블록은 DB · 서버 코드를 import하지 않습니다.',
            },
          ],
        },
      ],
    },
  },
]

export default eslintConfig
