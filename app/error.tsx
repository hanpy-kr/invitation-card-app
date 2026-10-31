'use client'

import FullScreenMessage from '@/components/shared/FullScreenMessage'

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <FullScreenMessage type="error">
      <button
        type="button"
        onClick={reset}
        style={{
          padding: '10px 20px',
          borderRadius: 8,
          border: '1px solid var(--line)',
          background: '#fff',
        }}
      >
        다시 시도
      </button>
    </FullScreenMessage>
  )
}
