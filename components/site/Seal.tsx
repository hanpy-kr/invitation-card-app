import { SEAL } from '@/shared/brand'

/** 밀랍 도장. 점선 원은 현재 종이 색(--bg)으로 그려서 어떤 배경에서도 파여 보임 */
export default function Seal({ size = 30, color }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden="true" focusable="false">
      <circle cx="15" cy="15" r="15" fill={color ?? SEAL.gold} />
      <circle
        cx="15"
        cy="15"
        r={SEAL.ring.r}
        fill="none"
        stroke="var(--bg, #f3ede2)"
        strokeWidth={SEAL.ring.width}
        strokeDasharray={SEAL.ring.dash}
      />
      <path d={SEAL.d} fill={SEAL.letter} />
    </svg>
  )
}
