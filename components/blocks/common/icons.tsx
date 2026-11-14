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

/** 지하철: 열차 앞모습 (가는 선) */
export function IconSubway({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" {...line}>
      <rect x="5.5" y="3" width="13" height="14" rx="3" />
      <path d="M5.5 10h13M9 14h.01M15 14h.01M8 20.5l2-3.5M16 20.5l-2-3.5" />
    </svg>
  )
}

/** 버스: 옆이 아닌 앞모습 (가는 선) */
export function IconBus({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" {...line}>
      <rect x="4.5" y="3.5" width="15" height="14" rx="2.5" />
      <path d="M4.5 11h15M8 14.5h.01M16 14.5h.01M7.5 17.5V20M16.5 17.5V20M9 6.5h6" />
    </svg>
  )
}

/** 주차: 자동차 앞모습 (가는 선) */
export function IconCar({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" {...line}>
      <path d="M5 16.5V12l1.8-4.6A2 2 0 0 1 8.7 6h6.6a2 2 0 0 1 1.9 1.4L19 12v4.5" />
      <path d="M4 12.5h16v4H4zM7 16.5V19M17 16.5V19M7.5 14.5h.01M16.5 14.5h.01" />
    </svg>
  )
}

/** 전화 (검정 채움) */
export function IconPhone({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6.6 3.2c.5-.3 1.1-.2 1.5.2l2.3 2.6c.4.5.4 1.2 0 1.7l-1.3 1.5c.9 1.9 2.4 3.5 4.3 4.5l1.6-1.2c.5-.4 1.2-.3 1.6.1l2.5 2.4c.4.4.5 1 .2 1.5l-1 1.7c-.5.8-1.4 1.2-2.3 1C9.6 18.6 5.2 14 4.2 7.7c-.1-.9.3-1.8 1.1-2.3l1.3-2.2Z"
      />
    </svg>
  )
}

/** 문자 (검정 채움 말풍선) */
export function IconMessage({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3.5c-4.9 0-8.8 3.2-8.8 7.2 0 2.3 1.3 4.4 3.4 5.7l-.7 3.3c-.1.4.4.7.7.5l3.6-2.4c.6.1 1.2.1 1.8.1 4.9 0 8.8-3.2 8.8-7.2S16.9 3.5 12 3.5Z"
      />
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
