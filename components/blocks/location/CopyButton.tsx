'use client'

import { useState } from 'react'

export default function CopyButton({
  text,
  label,
  className,
}: {
  text: string
  label: string
  className?: string
}) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        } catch {
          window.prompt('아래 내용을 복사하세요.', text)
        }
      }}
    >
      {done ? '복사했어요' : label}
    </button>
  )
}
