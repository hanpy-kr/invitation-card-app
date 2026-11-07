'use client'

import { useState } from 'react'

/** 클립보드 복사. navigator.clipboard가 막힌 인앱 브라우저는 textarea + execCommand로, 그것도 안 되면 prompt */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      ta.setSelectionRange(0, text.length)
      const ok = document.execCommand('copy')
      ta.remove()
      if (ok) return true
    } catch {
      // 아래 prompt로
    }
    window.prompt('아래 내용을 복사하세요.', text)
    return false
  }
}

export default function CopyButton({
  text,
  label,
  className,
  ariaLabel,
}: {
  text: string
  label: string
  className?: string
  ariaLabel?: string
}) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel}
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        }
      }}
    >
      {done ? '복사했어요' : label}
    </button>
  )
}
