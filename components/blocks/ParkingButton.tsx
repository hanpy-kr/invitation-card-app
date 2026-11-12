'use client'

/** 안내 블록의 '주차' 항목으로 스크롤 (탭 안내면 그 탭을 먼저 연다) */
export default function ParkingButton({ targetId }: { targetId: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(new CustomEvent('dearday:show-parking'))
        requestAnimationFrame(() => {
          const el = document.getElementById(targetId)
          if (!el) return
          let reduce = false
          try {
            reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
          } catch {}
          el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
        })
      }}
    >
      주차 안내
    </button>
  )
}
