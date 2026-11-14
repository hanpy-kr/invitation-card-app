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

/** 표지 맨 위 꽃 한 송이(선 그림). 종이에 눌러 찍은 음각으로 보이게 CSS에서 그림자를 준다 */
export function IconTulip({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 220"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M36 52c0-16 8-24 15-21 3-8 6-12 9-16 3 4 6 8 9 16 7-3 15 5 15 21 0 21-10 35-24 36-14-1-24-15-24-36Z" />
      <path d="M51 31c2 20 5 40 9 57M69 31c-2 20-5 40-9 57" />
      <path d="M60 88c-2 32-4 72 2 122" />
      <path d="M59 176c-18-9-31-28-34-52 15 11 27 29 34 52Z" />
      <path d="M60 154c15-9 28-27 32-50-13 9-25 27-32 50Z" />
      <path d="M44 112c5 15 10 25 15 34M77 120c-6 12-11 20-16 27" opacity=".7" />
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
