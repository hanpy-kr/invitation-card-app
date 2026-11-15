type IconProps = { className?: string }

export function IconHeart({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M365.4,59.628c60.56,0,109.6,49.03,109.6,109.47c0,109.47-109.6,171.8-219.06,281.271C146.47,340.898,37,278.568,37,169.099c0-60.44,49.04-109.47,109.47-109.47c54.73,0,82.1,27.37,109.47,82.1C283.3,86.999,310.67,59.628,365.4,59.628z" />
    </svg>
  )
}

/** 인사말 장식: 가는 선 봉투 */
export function IconPost({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="6" y="11" width="28" height="19" rx="1" />
      <path d="M6.5 11.5 20 22l13.5-10.5" />
      <circle cx="20" cy="22" r="2.2" />
    </svg>
  )
}

/** 인사말 장식: 가는 선 잔가지 (포인트 색, 종이 느낌에 맞춘 선 그림) */
export function IconFlower({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 36V6" />
      <path d="M20 29c-4.5-.6-7.6-3.6-8.4-8.2 4.4.5 7.6 3.4 8.4 8.2z" />
      <path d="M20 23.5c4.5-.6 7.6-3.6 8.4-8.2-4.4.5-7.6 3.4-8.4 8.2z" />
      <path d="M20 16.5c-3.3-.5-5.6-2.7-6.2-6 3.2.4 5.6 2.5 6.2 6z" />
      <path d="M20 11c2.2-.6 3.6-2.2 4-4.4-2.2.3-3.7 1.9-4 4.4z" />
    </svg>
  )
}

/** 여덟 갈래 별 (금박 느낌, 색은 currentColor 기준 그라데이션 대신 단색) */
export function IconStar({ className }: IconProps) {
  const pts: string[] = []
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? 15 : 3.2
    const a = (Math.PI / 8) * i - Math.PI / 2
    pts.push(`${(16 + r * Math.cos(a)).toFixed(2)},${(16 + r * Math.sin(a)).toFixed(2)}`)
  }
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <polygon points={pts.join(' ')} fill="currentColor" />
    </svg>
  )
}

const line = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

export function IconSubway({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" {...line}>
      <rect x="5" y="3" width="14" height="14" rx="3" />
      <path d="M5 11h14M8.5 14h.01M15.5 14h.01M8 21l2-4M16 21l-2-4" />
    </svg>
  )
}

export function IconBus({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" {...line}>
      <rect x="4" y="3" width="16" height="14" rx="2" />
      <path d="M4 10h16M7 20v-3M17 20v-3M8 14h.01M16 14h.01" />
    </svg>
  )
}

export function IconCar({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" {...line}>
      <path d="M5 16l1.5-5.5A2 2 0 0 1 8.4 9h7.2a2 2 0 0 1 1.9 1.5L19 16M4 16h16v3H4zM7 19v1.5M17 19v1.5" />
    </svg>
  )
}

/** 전화 (가는 선) */
export function IconPhone({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" {...line}>
      <path d="M6.5 3.5l3 3-2 2.5a12 12 0 0 0 7.5 7.5l2.5-2 3 3-2 3C11 20.5 3.5 13 3.5 5.5z" />
    </svg>
  )
}

/** 문자 (가는 선 말풍선) */
export function IconMessage({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" {...line}>
      <path d="M4 5h16v11H9l-5 4z" />
    </svg>
  )
}

/** ♥ 글리프 외곽선(Noto Sans Symbols 2) — 이름 줄 하트 (종이 편지) */
export function IconHeartGlyph({ className }: IconProps) {
  return (
    <svg className={className} viewBox="51 0 638 719" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <g transform="translate(0 719) scale(1 -1)">
        <path d="M346 0Q322 59 285.5 122.0Q249 185 199 252Q100 384 75 447Q51 507 51 559Q51 603 73.5 639.5Q96 676 133.5 697.5Q171 719 215 719Q262 719 302.5 695.0Q343 671 369 622Q396 671 437.0 695.0Q478 719 525 719Q568 719 605.5 697.5Q643 676 666.0 639.5Q689 603 689 559Q689 505 663 441Q637 378 539 249Q490 184 453.5 121.5Q417 59 393 0Z" />
      </g>
    </svg>
  )
}

/** 펼침 화살표 V자 (종이 편지) */
export function IconChevronLine({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 12 12"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 4.2l4 4 4-4" />
    </svg>
  )
}

export function IconClose({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M12,0A12,12,0,1,0,24,12,12.013,12.013,0,0,0,12,0Zm0,22A10,10,0,1,1,22,12,10.011,10.011,0,0,1,12,22Z" />
      <path d="M16.707,7.293a1,1,0,0,0-1.414,0L12,10.586,8.707,7.293A1,1,0,1,0,7.293,8.707L10.586,12,7.293,15.293a1,1,0,1,0,1.414,1.414L12,13.414l3.293,3.293a1,1,0,0,0,1.414-1.414L13.414,12l3.293-3.293A1,1,0,0,0,16.707,7.293Z" />
    </svg>
  )
}
